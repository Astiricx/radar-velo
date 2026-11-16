/**
 * Gares desservies directement depuis Paris, avec le temps de trajet le plus court
 * habituel (TGV, TER direct ou Intercités), en minutes.
 *
 * Ces durées sont des ordres de grandeur (meilleur train direct, hors correspondance) :
 * elles servent à dire si une annonce est « à 2 ou 3 h de train », comme convenu au
 * départ, pas à réserver un billet. Le temps total ajoute le trajet entre la gare et le
 * vendeur (voir lib/zones.ts).
 */
export interface Station {
  name: string
  lat: number
  lon: number
  /** Meilleur temps depuis Paris, en minutes. */
  fromParis: number
}

export const STATIONS: Station[] = [
  { name: 'Reims', lat: 49.2593, lon: 4.0246, fromParis: 45 },
  { name: 'Arras', lat: 50.2867, lon: 2.7811, fromParis: 50 },
  { name: 'Le Mans', lat: 47.9953, lon: 0.1923, fromParis: 55 },
  { name: 'Lille', lat: 50.6366, lon: 3.0707, fromParis: 60 },
  { name: 'Tours', lat: 47.3857, lon: 0.7236, fromParis: 60 },
  { name: 'Orléans', lat: 47.9078, lon: 1.9047, fromParis: 60 },
  { name: 'Amiens', lat: 49.8899, lon: 2.3069, fromParis: 65 },
  { name: 'Rouen', lat: 49.449, lon: 1.0939, fromParis: 75 },
  { name: 'Poitiers', lat: 46.5822, lon: 0.3334, fromParis: 80 },
  { name: 'Metz', lat: 49.1097, lon: 6.1772, fromParis: 85 },
  { name: 'Rennes', lat: 48.1035, lon: -1.6725, fromParis: 90 },
  { name: 'Nancy', lat: 48.6895, lon: 6.1744, fromParis: 90 },
  { name: 'Angers', lat: 47.4645, lon: -0.5567, fromParis: 95 },
  { name: 'Dijon', lat: 47.3233, lon: 5.0272, fromParis: 95 },
  { name: 'Angoulême', lat: 45.6531, lon: 0.1653, fromParis: 105 },
  { name: 'Strasbourg', lat: 48.585, lon: 7.7349, fromParis: 110 },
  { name: 'Lyon', lat: 45.7605, lon: 4.8596, fromParis: 120 },
  { name: 'Caen', lat: 49.1767, lon: -0.348, fromParis: 120 },
  { name: 'Nantes', lat: 47.2173, lon: -1.5421, fromParis: 125 },
  { name: 'Bordeaux', lat: 44.8259, lon: -0.5563, fromParis: 125 },
  { name: 'Le Havre', lat: 49.4932, lon: 0.126, fromParis: 125 },
  { name: 'Saint-Brieuc', lat: 48.5074, lon: -2.7665, fromParis: 135 },
  { name: 'Valence', lat: 44.9915, lon: 4.9785, fromParis: 135 },
  { name: 'Niort', lat: 46.3192, lon: -0.4635, fromParis: 140 },
  { name: 'Vannes', lat: 47.6658, lon: -2.7518, fromParis: 150 },
  { name: 'Besançon', lat: 47.3072, lon: 5.9542, fromParis: 155 },
  { name: 'Avignon', lat: 43.9216, lon: 4.7861, fromParis: 160 },
  { name: 'Mulhouse', lat: 47.742, lon: 7.3427, fromParis: 165 },
  { name: 'Saint-Nazaire', lat: 47.286, lon: -2.2138, fromParis: 165 },
  { name: 'Saint-Étienne', lat: 45.4434, lon: 4.3994, fromParis: 170 },
  { name: 'La Rochelle', lat: 46.1525, lon: -1.1453, fromParis: 175 },
  { name: 'Nîmes', lat: 43.8326, lon: 4.3657, fromParis: 180 },
  { name: 'Chambéry', lat: 45.5715, lon: 5.9197, fromParis: 180 },
  { name: 'Grenoble', lat: 45.1914, lon: 5.7146, fromParis: 180 },
  { name: 'Marseille', lat: 43.3027, lon: 5.3806, fromParis: 190 },
  { name: 'Limoges', lat: 45.8361, lon: 1.2676, fromParis: 190 },
  { name: 'Clermont-Ferrand', lat: 45.7787, lon: 3.1003, fromParis: 200 },
  { name: 'Montpellier', lat: 43.6043, lon: 3.8806, fromParis: 205 },
  { name: 'Brest', lat: 48.388, lon: -4.4796, fromParis: 210 },
  { name: 'Annecy', lat: 45.9017, lon: 6.1218, fromParis: 220 },
  { name: 'Toulouse', lat: 43.6113, lon: 1.4537, fromParis: 260 },
]

/** Au-delà, le vendeur est trop loin de la gare pour que le trajet reste simple. */
export const STATION_REACH_KM = 45

/**
 * Temps de porte à porte estimé : train, 10 minutes de marge, puis la route depuis la
 * gare à 55 km/h de moyenne (vendeur qui vient chercher, taxi ou voiture de location).
 */
export const travelMinutes = (station: Station, kmFromStation: number) =>
  station.fromParis + 10 + Math.round((kmFromStation / 55) * 60)

/** « 2 h 10 », « 55 min ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round((minutes % 60) / 5) * 5
  return m === 0 ? `${h} h` : m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')}`
}
