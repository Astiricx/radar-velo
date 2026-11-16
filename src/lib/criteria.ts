import type { BikeType, Condition, Criteria, ExtensionFit, Groupset, Listing, ZoneMatch } from '../types'
import { eur } from './format'

export const TYPE_LABELS: Record<BikeType, string> = {
  route: 'Route',
  gravel: 'Gravel',
  urbain: 'Urbain',
  vae: 'VAE',
}

export const GROUPSET_LABELS: Record<Groupset, string> = {
  'dura-ace-di2': 'Dura-Ace Di2',
  'ultegra-di2': 'Ultegra Di2',
  '105-di2': '105 Di2',
  ultegra: 'Ultegra mécanique',
  '105': '105 mécanique',
  'sram-axs': 'SRAM AXS',
  grx: 'Shimano GRX',
  autre: 'Autre groupe',
}

export const CONDITION_LABELS: Record<Condition, string> = {
  neuf: 'État neuf',
  'tres-bon': 'Très bon état',
  bon: 'Bon état',
  correct: 'État correct',
}

export const EXTENSION_LABELS: Record<ExtensionFit, string> = {
  oui: 'Prolongateurs : montage prévu',
  kit: 'Prolongateurs : kit tiers',
  inconnu: 'Prolongateurs : à vérifier',
  non: 'Prolongateurs impossibles',
}

/**
 * Tes critères de départ. Ils se modifient dans l'application (bouton « Critères »)
 * et sont alors enregistrés dans le navigateur.
 */
export const DEFAULT_CRITERIA: Criteria = {
  types: ['route'],
  sizes: ['M', 'M/L', '56', '57'],
  budgetIdeal: 3500,
  budgetMax: 4500,
  zones: [
    { id: 'paris', label: 'Région parisienne', center: 'Paris', radiusKm: 220, enabled: true },
    { id: 'saint-nazaire', label: 'Saint-Nazaire et Loire-Atlantique', center: 'Saint-Nazaire', radiusKm: 120, enabled: true },
  ],
  acceptShipping: true,
  requireCarbon: true,
  requireDisc: true,
  groupsets: ['dura-ace-di2', 'ultegra-di2', '105-di2', 'ultegra'],
  bonus: { aero: true, powerMeter: true, carbonWheels: true, extensions: true },
}

const normSize = (s: string) => s.trim().toUpperCase()

/**
 * Filtre automatique. Renvoie le motif d'exclusion, ou null si l'annonce
 * respecte tous les critères stricts.
 */
export function rejectionReason(l: Listing, c: Criteria, zone: ZoneMatch): string | null {
  if (!c.types.includes(l.type)) return `Type hors critères (${TYPE_LABELS[l.type]})`
  if (l.price > c.budgetMax) return `Au-dessus du budget maximum (${eur(l.price)} pour ${eur(c.budgetMax)})`
  if (c.sizes.length > 0 && !c.sizes.map(normSize).includes(normSize(l.size))) return `Taille ${l.size} incompatible`
  if (c.requireCarbon && l.frame !== 'carbone') return `Cadre en ${l.frame}`
  if (c.requireDisc && l.brakes !== 'disque') return 'Freins à patins'
  if (!c.groupsets.includes(l.groupset)) return `Groupe non retenu (${GROUPSET_LABELS[l.groupset]})`
  const deliverable = l.shipping && c.acceptShipping
  if (!zone.inside && !deliverable) {
    if (!zone.nearest) return 'Aucune zone de recherche active'
    return Number.isFinite(zone.distance)
      ? `Hors de tes zones (${zone.distance} km de ${zone.nearest.center}), sans livraison`
      : 'Lieu inconnu, sans livraison'
  }
  return null
}
