export interface City {
  lat: number
  lon: number
}

/** Villes connues de l'application (coordonnées approximatives du centre). */
export const CITIES: Record<string, City> = {
  // Région parisienne et villes à moins de 2 h 30
  Paris: { lat: 48.8566, lon: 2.3522 },
  Nanterre: { lat: 48.8924, lon: 2.2069 },
  Massy: { lat: 48.7309, lon: 2.2713 },
  Créteil: { lat: 48.7904, lon: 2.4556 },
  Rambouillet: { lat: 48.6436, lon: 1.8292 },
  Fontainebleau: { lat: 48.4047, lon: 2.7016 },
  'Boulogne-Billancourt': { lat: 48.8397, lon: 2.2399 },
  'Issy-les-Moulineaux': { lat: 48.8245, lon: 2.2743 },
  Vincennes: { lat: 48.8474, lon: 2.4396 },
  Versailles: { lat: 48.8049, lon: 2.1204 },
  'Saint-Germain-en-Laye': { lat: 48.8989, lon: 2.0938 },
  Chantilly: { lat: 49.1947, lon: 2.4711 },
  Orléans: { lat: 47.9029, lon: 1.9093 },
  Reims: { lat: 49.2583, lon: 4.0317 },
  Rouen: { lat: 49.4432, lon: 1.0999 },
  Amiens: { lat: 49.8941, lon: 2.2958 },
  'Le Mans': { lat: 48.0061, lon: 0.1996 },
  Tours: { lat: 47.3941, lon: 0.6848 },
  Lille: { lat: 50.6292, lon: 3.0573 },
  Caen: { lat: 49.1829, lon: -0.3707 },
  Angers: { lat: 47.4784, lon: -0.5632 },
  Dijon: { lat: 47.322, lon: 5.0415 },
  Rennes: { lat: 48.1173, lon: -1.6778 },
  // Saint-Nazaire, presqu'île guérandaise, Loire-Atlantique et alentours
  'Saint-Nazaire': { lat: 47.2735, lon: -2.2137 },
  Pornichet: { lat: 47.2626, lon: -2.3393 },
  'La Baule-Escoublac': { lat: 47.2866, lon: -2.391 },
  Guérande: { lat: 47.3281, lon: -2.429 },
  'Le Croisic': { lat: 47.2925, lon: -2.5106 },
  'Saint-Brevin-les-Pins': { lat: 47.2465, lon: -2.1666 },
  Pornic: { lat: 47.115, lon: -2.103 },
  Savenay: { lat: 47.3608, lon: -1.9426 },
  Nantes: { lat: 47.2184, lon: -1.5536 },
  'Saint-Herblain': { lat: 47.2122, lon: -1.6497 },
  Rezé: { lat: 47.1833, lon: -1.55 },
  Redon: { lat: 47.6514, lon: -2.0843 },
  Vannes: { lat: 47.6582, lon: -2.7608 },
  'La Roche-sur-Yon': { lat: 46.6705, lon: -1.426 },
  Lorient: { lat: 47.7483, lon: -3.37 },
  Strasbourg: { lat: 48.5734, lon: 7.7521 },
  Lyon: { lat: 45.764, lon: 4.8357 },
  Grenoble: { lat: 45.1885, lon: 5.7245 },
  Annecy: { lat: 45.8992, lon: 6.1294 },
  Bordeaux: { lat: 44.8378, lon: -0.5792 },
  Toulouse: { lat: 43.6047, lon: 1.4442 },
  Montpellier: { lat: 43.6108, lon: 3.8767 },
  Marseille: { lat: 43.2965, lon: 5.3698 },
  Nice: { lat: 43.7102, lon: 7.262 },
}

export const CITY_NAMES = Object.keys(CITIES).sort((a, b) => a.localeCompare(b, 'fr'))

/** Distance à vol d'oiseau entre deux villes connues, en km. */
export function distanceKm(from: string, to: string): number {
  return distanceBetween(CITIES[from], CITIES[to])
}

/** Distance à vol d'oiseau entre deux points, en km (formule de haversine). */
export function distanceBetween(a: City | undefined, b: City | undefined): number {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)))
}
