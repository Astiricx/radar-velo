import { CITIES, distanceBetween } from '../data/cities'
import { STATION_REACH_KM, STATIONS, travelMinutes } from '../data/stations'
import type { Criteria, Listing, TrainReach, Zone, ZoneMatch } from '../types'

/** Réglage par défaut de l'accès en train (critères enregistrés avant son ajout). */
export const DEFAULT_TRAIN: TrainReach = { enabled: true, maxHours: 3 }

/** Pseudo-zone « Accessible en train » : son centre est la gare la plus pratique. */
export const TRAIN_ZONE_ID = 'train'

/**
 * Situe une annonce :
 * 1. dans une zone (Paris, Saint-Nazaire) si elle est dans son rayon ;
 * 2. sinon « accessible en train » si une gare desservie depuis Paris est à moins de
 *    STATION_REACH_KM et que le trajet total tient dans le temps maximal ;
 * 3. sinon hors zone (elle n'est retenue que si le vendeur livre).
 */
export function matchZone(listing: Listing, zones: Zone[], train: TrainReach = DEFAULT_TRAIN): ZoneMatch {
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
  if (best.inside || !where || !train.enabled) return best

  let trip: { station: string; minutes: number; km: number } | null = null
  for (const station of STATIONS) {
    const km = distanceBetween(station, where)
    if (km > STATION_REACH_KM) continue
    const minutes = travelMinutes(station, km)
    if (!trip || minutes < trip.minutes) trip = { station: station.name, minutes, km }
  }
  if (trip && trip.minutes <= train.maxHours * 60) {
    const zone: Zone = { id: TRAIN_ZONE_ID, label: `À moins de ${train.maxHours} h de train`, center: trip.station, radiusKm: STATION_REACH_KM, enabled: true }
    return { nearest: zone, distance: trip.km, inside: true, train: { station: trip.station, minutes: trip.minutes } }
  }
  return best
}

/** Raccourci : situe une annonce avec les zones et l'accès en train des critères. */
export const locate = (listing: Listing, c: Criteria) => matchZone(listing, c.zones, { ...DEFAULT_TRAIN, ...c.train })

/** Nom court d'une zone pour les étiquettes : « Paris », « Saint-Nazaire ». */
export const zoneShortName = (zone: Zone) => zone.center

/** Classes de couleur par zone, dans l'ordre des zones des critères. */
export const ZONE_TONES = ['bg-accent-soft text-accent', 'bg-violet-soft text-violet', 'bg-gold-soft text-gold']

/** Couleur de la pseudo-zone « accessible en train ». */
export const TRAIN_TONE = 'bg-good-soft text-good'
