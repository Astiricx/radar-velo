import { CITIES, distanceBetween } from '../data/cities'
import type { Listing, Zone, ZoneMatch } from '../types'

/** Trouve la zone active la plus proche d'une annonce et dit si l'annonce est dans son rayon. */
export function matchZone(listing: Listing, zones: Zone[]): ZoneMatch {
  let best: ZoneMatch = { nearest: null, distance: Number.POSITIVE_INFINITY, inside: false }
  // Coordonnées exactes de l'annonce si la plateforme les donne, sinon celles de la ville.
  const where = listing.coords ?? CITIES[listing.city]
  for (const zone of zones) {
    if (!zone.enabled) continue
    const distance = distanceBetween(CITIES[zone.center], where)
    const inside = distance <= zone.radiusKm
    // Une zone qui contient l'annonce passe avant une zone plus proche qui ne la contient pas.
    const better = (inside && !best.inside) || (inside === best.inside && distance < best.distance)
    if (better) best = { nearest: zone, distance, inside }
  }
  return best
}

/** Nom court d'une zone pour les étiquettes : « Paris », « Saint-Nazaire ». */
export const zoneShortName = (zone: Zone) => zone.center

/** Classes de couleur par zone, dans l'ordre des zones des critères. */
export const ZONE_TONES = ['bg-accent-soft text-accent', 'bg-violet-soft text-violet', 'bg-gold-soft text-gold']
