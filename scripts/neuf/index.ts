/**
 * Veille du neuf : vélos de route neufs en promotion ou en déstockage, chez les marques qui
 * vendent en direct (Canyon, Rose) et chez Alltricks. Lecture directe des sites depuis
 * GitHub, gratuite : elle ne touche pas au crédit Apify.
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
import { fetchRose } from './rose'
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

const RETAILERS: { label: string; enabled: () => boolean; fetch: () => Promise<RetailerResult> }[] = [
  { label: 'Canyon', enabled: () => NEUF.canyon, fetch: fetchCanyon },
  { label: 'Alltricks', enabled: () => NEUF.alltricks, fetch: fetchAlltricks },
  { label: 'Rose', enabled: () => NEUF.rose, fetch: fetchRose },
]

export async function collectNewBikes(today: string, warnings: string[]): Promise<{ listings: Listing[]; notes: string[] }> {
  const listings: Listing[] = []
  const notes: string[] = []
  if (!NEUF.enabled) return { listings, notes: ['Veille du neuf désactivée (variable NEUF_ENABLED).'] }
  for (const r of RETAILERS) {
    if (!r.enabled()) continue
    try {
      const { bikes, notes: detail } = await r.fetch()
      const read = bikes.map((b) => toListing(newBikeToRaw(b), today))
      listings.push(...read)
      const promos = read.filter((l) => l.market === 'neuf' && l.originalPrice).length
      notes.push(
        `${r.label} (neuf, lecture directe) : ${plural(read.length, 'vélo retenu pour analyse', 'vélos retenus pour analyse')}` +
          `${promos ? `, dont ${plural(promos, 'en promotion', 'en promotion')}` : ''}. ${detail.join(' ; ')}.`,
      )
      for (const l of read) console.log(`    Neuf ${r.label} : ${JSON.stringify({ title: l.title, price: l.price, originalPrice: l.originalPrice, market: l.market, size: l.size, sizesInStock: l.sizesInStock, groupset: l.groupset, frame: l.frame, type: l.type, url: l.url })}`)
    } catch (error) {
      warnings.push(`${r.label} (neuf) non lu : ${(error as Error).message}`)
    }
  }
  return { listings, notes }
}
