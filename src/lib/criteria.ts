import type { BikeType, Condition, Criteria, ExtensionFit, Groupset, Listing, NewBikeRules, ZoneMatch } from '../types'
import { eur } from './format'

export const TYPE_LABELS: Record<BikeType, string> = {
  route: 'Route',
  gravel: 'Gravel',
  urbain: 'Urbain',
  vae: 'VAE',
  clm: 'Contre-la-montre / triathlon',
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

/** Vélo neuf : cadre aéro exigé, et jusqu'à 10 % au-dessus du budget maximum pour un vélo impeccable. */
export const DEFAULT_NEW_BIKES: NewBikeRules = { aeroRequired: true, overBudgetPct: 10 }

/** Prix plafond d'une annonce : le budget maximum, un peu plus pour un vélo neuf. */
export function priceCap(l: Pick<Listing, 'market'>, c: Criteria): number {
  if (l.market !== 'neuf') return c.budgetMax
  const pct = Math.max(0, { ...DEFAULT_NEW_BIKES, ...c.newBikes }.overBudgetPct)
  return Math.round((c.budgetMax * (1 + pct / 100)) / 10) * 10
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
  // 2 à 3 h de train depuis Paris, comme convenu au départ.
  train: { enabled: true, maxHours: 3 },
  newBikes: DEFAULT_NEW_BIKES,
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
  const cap = priceCap(l, c)
  if (l.price > cap)
    return l.market === 'neuf' && cap > c.budgetMax
      ? `Au-dessus du budget, même avec la marge acceptée pour le neuf (${eur(l.price)} pour ${eur(cap)})`
      : `Au-dessus du budget maximum (${eur(l.price)} pour ${eur(c.budgetMax)})`
  if (c.sizes.length > 0 && !c.sizes.map(normSize).includes(normSize(l.size))) return `Taille ${l.size} incompatible`
  if (c.requireCarbon && l.frame !== 'carbone') return `Cadre en ${l.frame}`
  if (c.requireDisc && l.brakes !== 'disque') return 'Freins à patins'
  if (!c.groupsets.includes(l.groupset)) return `Groupe non retenu (${GROUPSET_LABELS[l.groupset]})`
  if (l.market === 'neuf' && { ...DEFAULT_NEW_BIKES, ...c.newBikes }.aeroRequired && !l.aero) return 'Vélo neuf au cadre non aéro (tu exiges un cadre aéro pour le neuf)'
  const deliverable = l.shipping && c.acceptShipping
  if (!zone.inside && !deliverable) {
    if (!zone.nearest) return c.zones.some((z) => z.enabled) ? 'Lieu inconnu ou trop éloigné, sans livraison' : 'Aucune zone de recherche active'
    return Number.isFinite(zone.distance)
      ? `${c.train?.enabled === false ? 'Hors de tes zones' : `Hors de tes zones et à plus de ${c.train?.maxHours ?? 3} h de train`} (${zone.distance} km de ${zone.nearest.center}), sans livraison`
      : 'Lieu inconnu, sans livraison'
  }
  return null
}
