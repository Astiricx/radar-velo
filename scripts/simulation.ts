/**
 * Simulation du marché de l'occasion.
 *
 * Génère chaque jour quelques annonces réalistes dans tes deux zones (et un peu
 * en dehors), dont certaines ne respectent pas tes critères. Le tirage dépend
 * uniquement de la date : relancer la veille le même jour donne les mêmes
 * annonces, qui sont alors reconnues comme déjà vues.
 *
 * Ces annonces sont fictives. Elles servent à faire tourner la chaîne complète
 * (filtre, score, journal, commit) en attendant une vraie source d'annonces.
 */
import { photo, PHOTO_NAMES, type PhotoName } from '../src/data/photos'
import type { Condition, ExtensionFit, Frame, Groupset, Listing, SourceId } from '../src/types'

interface Model {
  brand: string
  model: string
  groupset: Groupset
  aero: boolean
  powerMeter: boolean
  wheelDepth: number
  extensions: ExtensionFit
  newPrice: number
  years: [number, number]
  frame?: Frame
  photos?: PhotoName[]
}

const CATALOG: Model[] = [
  { brand: 'Canyon', model: 'Aeroad CF SLX 7 Di2', groupset: '105-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui', newPrice: 4799, years: [2024, 2026], photos: ['canyonOnStand', 'canyonDisc'] },
  { brand: 'Canyon', model: 'Aeroad CF SLX 8 Di2', groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'kit', newPrice: 6499, years: [2021, 2025], photos: ['canyonOnStand', 'canyonDisc'] },
  { brand: 'Canyon', model: 'Aeroad CF SLX 8 AXS', groupset: 'sram-axs', aero: true, powerMeter: true, wheelDepth: 62, extensions: 'kit', newPrice: 6299, years: [2022, 2025], photos: ['canyonDisc'] },
  { brand: 'Van Rysel', model: 'RCR-F Pro 105 Di2', groupset: '105-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui', newPrice: 4500, years: [2025, 2026] },
  { brand: 'Van Rysel', model: 'RCR-F Ultegra Di2', groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui', newPrice: 5500, years: [2025, 2026] },
  { brand: 'Giant', model: 'Propel Advanced 1', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'kit', newPrice: 4200, years: [2023, 2026], photos: ['giantWhite'] },
  { brand: 'Giant', model: 'Propel Advanced Pro 0 Di2', groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'kit', newPrice: 6900, years: [2023, 2025], photos: ['giantWhite'] },
  { brand: 'Trek', model: 'Madone SL 6 Gen 8', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 51, extensions: 'inconnu', newPrice: 5499, years: [2025, 2026] },
  { brand: 'Merida', model: 'Reacto 6000', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 60, extensions: 'oui', newPrice: 3999, years: [2023, 2026] },
  { brand: 'Scott', model: 'Foil RC 20', groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'inconnu', newPrice: 5999, years: [2023, 2025] },
  { brand: 'Cervélo', model: 'S5 105 Di2', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 52, extensions: 'non', newPrice: 6499, years: [2024, 2026] },
  { brand: 'Cube', model: 'Litening Aero C:68X Race', groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 49, extensions: 'inconnu', newPrice: 4999, years: [2024, 2026] },
  { brand: 'Orbea', model: 'Orca Aero M30i', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'oui', newPrice: 4999, years: [2023, 2026] },
  { brand: 'Specialized', model: 'Tarmac SL7 Expert', groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 38, extensions: 'oui', newPrice: 7000, years: [2021, 2023] },
  { brand: 'Lapierre', model: 'Aircode DRS 7.0', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 45, extensions: 'inconnu', newPrice: 4299, years: [2022, 2025] },
  { brand: 'Bianchi', model: 'Oltre Comp 105 Di2', groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 40, extensions: 'inconnu', newPrice: 4800, years: [2023, 2025], photos: ['tealBianchi'] },
  { brand: 'Specialized', model: 'Allez Sprint Comp', groupset: '105', aero: true, powerMeter: false, wheelDepth: 0, extensions: 'oui', newPrice: 2600, years: [2021, 2024], frame: 'aluminium', photos: ['redFixie'] },
  { brand: 'Pinarello', model: 'Dogma F Dura-Ace Di2', groupset: 'dura-ace-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'non', newPrice: 13000, years: [2022, 2025] },
]

/** Villes tirées au sort, avec leur poids. Toutes sont connues de src/data/cities.ts. */
const CITIES: [string, number][] = [
  // Région parisienne
  ['Paris', 10], ['Boulogne-Billancourt', 3], ['Issy-les-Moulineaux', 2], ['Vincennes', 2], ['Versailles', 3],
  ['Saint-Germain-en-Laye', 2], ['Nanterre', 2], ['Massy', 2], ['Créteil', 2], ['Rambouillet', 1],
  ['Fontainebleau', 1], ['Chantilly', 1], ['Orléans', 2], ['Rouen', 2], ['Reims', 1], ['Amiens', 1],
  // Saint-Nazaire et Loire-Atlantique
  ['Saint-Nazaire', 8], ['Pornichet', 2], ['La Baule-Escoublac', 3], ['Guérande', 2], ['Pornic', 2],
  ['Saint-Brevin-les-Pins', 2], ['Savenay', 1], ['Nantes', 7], ['Saint-Herblain', 2], ['Rezé', 2],
  ['Vannes', 2], ['Redon', 1],
  // Hors zones
  ['Lyon', 3], ['Bordeaux', 3], ['Toulouse', 2], ['Marseille', 1],
]

const SIZES: [string, number][] = [
  ['M', 26], ['56', 14], ['57', 7], ['M/L', 6], ['L', 10], ['S', 10], ['54', 8], ['58', 7], ['XS', 5], ['XL', 5],
]

const CONDITIONS: [Condition, number][] = [['neuf', 1], ['tres-bon', 5], ['bon', 4], ['correct', 1]]

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: string) {
  let a = 0
  for (const ch of seed) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 1) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function simulateDay(date: string): Listing[] {
  const random = rng(`radar-velo:${date}`)
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
  const weighted = <T,>(items: [T, number][]) => {
    let r = random() * items.reduce((sum, [, w]) => sum + w, 0)
    for (const [item, w] of items) if ((r -= w) < 0) return item
    return items[items.length - 1][0]
  }

  const currentYear = Number(date.slice(0, 4))
  const count = int(2, 5)
  const listings: Listing[] = []

  for (let i = 0; i < count; i++) {
    const m = pick(CATALOG)
    const year = Math.min(int(m.years[0], m.years[1]), currentYear)
    const age = currentYear - year
    const decote = Math.min(0.9, Math.max(0.35, 0.86 - 0.08 * age))
    const price = Math.round((m.newPrice * decote * (0.9 + random() * 0.2)) / 50) * 50
    const size = weighted(SIZES)
    const city = weighted(CITIES)
    const source: SourceId = m.brand === 'Van Rysel' ? 'decathlon' : random() < 0.65 ? 'leboncoin' : 'troc-velo'
    const condition = weighted(CONDITIONS)
    const km = Math.max(150, Math.round((age * 4500 + random() * 3000) / 100) * 100)
    const shipping = source === 'decathlon' || random() < 0.35
    const photos = m.photos ?? PHOTO_NAMES
    const main = pick(photos)
    const hour = String(int(6, 22)).padStart(2, '0')

    listings.push({
      id: `sim-${date}-${i + 1}`,
      source,
      url: '',
      demo: true,
      image: photo(main),
      fallbackImage: photo(pick(PHOTO_NAMES.filter((n) => n !== main))),
      imageKind: 'illustration',
      title: `${m.brand} ${m.model} ${year}, taille ${size}`,
      brand: m.brand,
      model: m.model,
      year,
      type: 'route',
      size,
      price,
      newPrice: m.newPrice,
      description: `Annonce simulée : ${m.brand} ${m.model} de ${year}, ${km.toLocaleString('fr-FR')} km.`,
      city,
      shipping,
      publishedAt: `${date}T${hour}:00:00.000Z`,
      frame: m.frame ?? 'carbone',
      brakes: 'disque',
      groupset: m.groupset,
      aero: m.aero,
      powerMeter: m.powerMeter,
      wheelDepth: m.wheelDepth,
      extensions: m.extensions,
      condition,
      km,
      batch: 0,
    })
  }
  return listings
}
