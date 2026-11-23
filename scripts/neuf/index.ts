/**
 * Veille du neuf : tout le catalogue de vélos de route neufs, au prix du jour (remisé ou non),
 * chez les marques qui vendent en direct (Canyon, Rose) et chez des magasins (Alltricks,
 * Materiel-velo.com, Vélo Brival). Lecture directe des sites depuis GitHub, gratuite : elle ne
 * touche pas au crédit Apify.
 *
 * Chaque vélo devient une annonce comme les autres (même filtre strict, même score), avec
 * `market: 'neuf'`, le prix barré du magasin et les tailles en stock. Un vélo neuf est
 * toujours livré : il est retenu hors de tes zones, comme une annonce avec livraison.
 */
import { plural } from '../../src/lib/format'
import type { Listing } from '../../src/types'
import { toListing, type RawAd } from '../apify/parse'
import { fetchAlltricks } from './alltricks'
import { fetchCanyon } from './canyon'
import { NEUF } from './config'
import { fetchMaterielVelo } from './materielvelo'
import { fetchRose } from './rose'
import { fetchVeloBrival } from './velobrival'
import type { NewBike, RetailerResult } from './types'

export function newBikeToRaw(b: NewBike): RawAd {
  return {
    source: b.source,
    id: b.id,
    url: b.url,
    title: b.title,
    description: b.description,
    price: b.price,
    images: b.images,
    city: `Livraison ${b.seller}`,
    attributes: { ...b.attributes, 'taille du cadre': b.size },
    shipping: true,
    toVerify: b.toVerify?.length ? b.toVerify : undefined,
    market: b.market,
    // Neuf : prix barré du magasin. Reconditionné : ce prix est celui du vélo neuf.
    ...(b.market === 'neuf' ? { originalPrice: b.originalPrice } : { newPrice: b.originalPrice }),
    sizesInStock: b.sizesInStock,
    fixedSize: b.size,
  }
}

/**
 * Un même vélo neuf proposé en plusieurs coloris au même prix et dans la même taille : une
 * seule annonce (la première), les autres coloris sont cités dans sa description.
 */
export function dedupe(bikes: NewBike[]): NewBike[] {
  const byKey = new Map<string, NewBike>()
  for (const b of bikes) {
    if (b.market !== 'neuf') {
      byKey.set(b.id, b)
      continue
    }
    const words = b.title
      .replace(/^v[ée]lo (?:de )?route\s+/i, '')
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ')
    const key = `${b.source}|${words}|${b.price}|${b.size}`
    const first = byKey.get(key)
    if (!first) byKey.set(key, { ...b })
    else if (!first.description.includes('Autres coloris')) first.description += `\n\nAutres coloris au même prix chez ${b.seller}.`
  }
  return [...byKey.values()]
}

const RETAILERS: { label: string; enabled: () => boolean; fetch: () => Promise<RetailerResult> }[] = [
  { label: 'Canyon', enabled: () => NEUF.canyon, fetch: fetchCanyon },
  { label: 'Alltricks', enabled: () => NEUF.alltricks, fetch: fetchAlltricks },
  { label: 'Rose', enabled: () => NEUF.rose, fetch: fetchRose },
  { label: 'Materiel-velo.com', enabled: () => NEUF.materielVelo, fetch: fetchMaterielVelo },
  { label: 'Vélo Brival', enabled: () => NEUF.veloBrival, fetch: fetchVeloBrival },
]

export async function collectNewBikes(today: string, warnings: string[]): Promise<{ listings: Listing[]; notes: string[] }> {
  const listings: Listing[] = []
  const notes: string[] = []
  if (!NEUF.enabled) return { listings, notes: ['Veille du neuf désactivée (variable NEUF_ENABLED).'] }
  for (const r of RETAILERS) {
    if (!r.enabled()) continue
    try {
      const { bikes, notes: detail } = await r.fetch()
      const read = dedupe(bikes).map((b) => toListing(newBikeToRaw(b), today))
      listings.push(...read)
      const promos = read.filter((l) => l.market === 'neuf' && l.originalPrice).length
      notes.push(
        `${r.label} (neuf, lecture directe) : ${plural(read.length, 'vélo retenu pour analyse', 'vélos retenus pour analyse')}` +
          `${promos ? `, dont ${promos} avec un prix barré` : ''}. ${detail.join(' ; ')}.`,
      )
      for (const l of read) console.log(`    Neuf ${r.label} : ${JSON.stringify({ title: l.title, price: l.price, originalPrice: l.originalPrice, market: l.market, size: l.size, sizesInStock: l.sizesInStock, groupset: l.groupset, frame: l.frame, type: l.type, url: l.url })}`)
    } catch (error) {
      warnings.push(`${r.label} (neuf) non lu : ${(error as Error).message}`)
    }
  }
  return { listings, notes }
}
