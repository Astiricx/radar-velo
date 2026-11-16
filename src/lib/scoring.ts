import { durationLabel } from '../data/stations'
import type { Criteria, Listing, ScorePart, ScoreResult, ZoneMatch } from '../types'
import { CONDITION_LABELS, EXTENSION_LABELS, GROUPSET_LABELS } from './criteria'
import { discountPct, eur } from './format'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * Score de pertinence sur 100.
 * Deux familles : le rapport qualité/prix (prix, décote, état) et la conformité
 * aux critères (groupe, bonus cochés, distance). Les bonus décochés dans les
 * critères sortent du calcul, et le total est ramené sur 100.
 */
export function scoreListing(l: Listing, c: Criteria, zone: ZoneMatch): ScoreResult {
  const parts: ScorePart[] = []

  // Prix : plein score jusqu'au budget idéal, puis dégressif jusqu'au maximum.
  const over = clamp((l.price - c.budgetIdeal) / Math.max(1, c.budgetMax - c.budgetIdeal), 0, 1)
  parts.push({
    label: 'Prix',
    detail: l.price <= c.budgetIdeal ? `Sous ton budget idéal de ${eur(c.budgetIdeal)}` : `Entre l'idéal et le maximum de ${eur(c.budgetMax)}`,
    points: 25 - 15 * over,
    max: 25,
  })

  const discount = discountPct(l.price, l.newPrice)
  parts.push({
    label: 'Décote',
    detail: discount === null ? 'Prix neuf inconnu' : `${discount} % sous le prix neuf (${eur(l.newPrice!)})`,
    points: discount === null ? 4 : clamp(discount / 45, 0, 1) * 10,
    max: 10,
  })

  const groupPoints: Partial<Record<Listing['groupset'], number>> = {
    'dura-ace-di2': 15,
    'ultegra-di2': 13,
    '105-di2': 9,
    ultegra: 6,
  }
  parts.push({ label: 'Transmission', detail: GROUPSET_LABELS[l.groupset], points: groupPoints[l.groupset] ?? 3, max: 15 })

  if (c.bonus.aero) {
    parts.push({ label: 'Cadre aéro', detail: l.aero ? 'Cadre et cintre profilés' : 'Cadre polyvalent', points: l.aero ? 8 : 2, max: 8 })
  }
  if (c.bonus.powerMeter) {
    parts.push({ label: 'Capteur de puissance', detail: l.powerMeter ? 'Inclus' : 'Absent', points: l.powerMeter ? 10 : 0, max: 10 })
  }
  if (c.bonus.carbonWheels) {
    const d = l.wheelDepth
    parts.push({
      label: 'Roues',
      detail: d > 0 ? `Carbone, jantes de ${d} mm` : 'Aluminium',
      points: d >= 45 ? 8 : d >= 30 ? 5 : d > 0 ? 3 : 0,
      max: 8,
    })
  }
  if (c.bonus.extensions) {
    const pts = { oui: 6, kit: 4, inconnu: 2, non: 0 }[l.extensions]
    parts.push({ label: 'Prolongateurs', detail: EXTENSION_LABELS[l.extensions], points: pts, max: 6 })
  }

  // Distance : mesurée depuis le centre de la zone la plus proche (Paris ou Saint-Nazaire).
  const deliverable = l.shipping && c.acceptShipping
  const d = zone.distance
  // En zone : selon la route. Accessible en train : selon le temps de trajet depuis Paris.
  const byRoad = zone.train
    ? zone.train.minutes <= 90 ? 8 : zone.train.minutes <= 150 ? 6 : 5
    : !zone.inside ? 0 : d <= 30 ? 10 : d <= 80 ? 8 : d <= 150 ? 6 : 4
  const where = zone.train
    ? `≈ ${durationLabel(zone.train.minutes)} de Paris en train (gare de ${zone.train.station} à ${d} km)`
    : zone.nearest
      ? `${Number.isFinite(d) ? `${d} km de ${zone.nearest.center}` : 'Lieu inconnu'}${zone.inside ? `, zone ${zone.nearest.label}` : ', hors zone'}`
      : 'Aucune zone active'
  parts.push({
    label: 'Distance',
    detail: `${where}${deliverable ? ', livraison possible' : ''}`,
    points: Math.max(byRoad, deliverable ? 7 : 0),
    max: 10,
  })

  // Année inconnue : note moyenne, ni bonus ni pénalité.
  const age = l.year > 0 ? new Date().getFullYear() - l.year : 4
  const agePts = age <= 1 ? 4 : age <= 3 ? 3 : age <= 5 ? 2 : 1
  const condPts = { neuf: 4, 'tres-bon': 3, bon: 2, correct: 1 }[l.condition]
  const model = l.year > 0 ? `modèle ${l.year}` : 'année non précisée'
  parts.push({ label: 'État et âge', detail: `${CONDITION_LABELS[l.condition]}, ${model}`, points: agePts + condPts, max: 8 })

  const got = parts.reduce((sum, p) => sum + p.points, 0)
  const max = parts.reduce((sum, p) => sum + p.max, 0)
  return { total: Math.round((got / max) * 100), parts: parts.map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 })) }
}
