/**
 * Decathlon Occasion via l'acteur gratuit apify/cheerio-scraper.
 *
 * La page « Vélo route occasion » liste des vélos vendus et expédiés par Decathlon
 * (Seconde Vie) ou par des vendeurs pros de sa marketplace. Pas de lieu : ces
 * vélos sont livrés, ce que tes critères acceptent hors zones.
 */
import type { ActorRunner } from './client'
import { DECATHLON, PREFILTER, PROXY, SEARCH } from './config'
import { PAGE_FUNCTION } from './page-function'
import type { RawAd } from './parse'
import { productOf, toNumber } from './trocvelo'

export async function fetchDecathlon(run: ActorRunner): Promise<{ ads: RawAd[]; skipped: number; listed: number | null; kept: number }> {
  const items = await run(
    DECATHLON.actor,
    {
      startUrls: DECATHLON.startUrls.map((url) => ({ url })),
      pageFunction: PAGE_FUNCTION,
      customData: {
        label: 'Decathlon Occasion',
        // Fiches produit : /p/mp/<nom>/<identifiant>/c<n> (marketplace) ou /p/<nom>/_/R-p-<n>.
        linkPattern: '^/p/',
        maxListings: DECATHLON.maxListings,
        prefilter: PREFILTER,
        priceMin: SEARCH.priceMin,
        priceMax: SEARCH.priceMax,
      },
      maxRequestsPerCrawl: DECATHLON.startUrls.length + DECATHLON.maxListings,
      maxConcurrency: 3,
      maxRequestRetries: 1,
      // Obligatoire pour le Cheerio Scraper : proxy Apify (voir PROXY dans config.ts).
      proxyConfiguration: PROXY,
    },
    { memoryMbytes: 1024, timeoutSecs: 240 },
  )
  let listed: number | null = null
  let kept = 0
  let skipped = 0
  const ads: RawAd[] = []
  for (const item of items) {
    const record = item as { kind?: string; found?: number; kept?: number }
    if (record.kind === 'list') {
      listed = (listed ?? 0) + Number(record.found ?? 0)
      kept += Number(record.kept ?? 0)
      continue
    }
    const ad = normalizeDecathlon(item)
    if (ad) ads.push(ad)
    else skipped++
  }
  return { ads, skipped, listed, kept }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export function normalizeDecathlon(raw: unknown): RawAd | null {
  if (!isObj(raw) || raw.kind !== 'ad') return null
  const url = String(raw.url ?? '').split(/[?#]/)[0]
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  if (!path.startsWith('/p/')) return null
  // Identifiant : l'UUID de la marketplace, sinon la référence produit, sinon le chemin.
  const id = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? path.match(/R-p-([\w-]+)/)?.[1] ?? path.replace(/\W+/g, '-')

  const product = productOf(raw.jsonLd)
  const offers = product && (Array.isArray(product.offers) ? product.offers[0] : product.offers)
  const text = String(raw.text ?? '')
    .split(/produits similaires|vous aimerez aussi|les clients ont aussi|compl[eé]tez votre/i)[0]
    .slice(0, 4000)
  const title = String(raw.title || product?.name || raw.ogTitle || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) return null

  const price =
    toNumber(isObj(offers) ? (offers.price ?? offers.lowPrice) : undefined) ??
    toNumber(text.match(/(\d{1,2}[\s .]?\d{3})(?:[.,]\d{2})?\s?€/)?.[1]?.replace(/[\s .]/g, ''))
  if (!price) return null

  const images = [String(raw.image ?? ''), ...(Array.isArray(raw.images) ? raw.images.map(String) : [])]
  if (product?.image) images.unshift(...(Array.isArray(product.image) ? product.image.map(String) : [String(product.image)]))
  const attributes: Record<string, string> = {}
  if (isObj(raw.attributes)) for (const [k, v] of Object.entries(raw.attributes)) attributes[k.toLowerCase()] = String(v)
  const newPrice = toNumber(text.match(/prix (?:neuf|initial)[^\d]{0,20}(\d{1,2}[\s .]?\d{3})/i)?.[1]?.replace(/[\s .]/g, ''))

  return {
    source: 'decathlon',
    id: `dc-${id}`,
    url,
    title,
    description: [String(raw.description ?? product?.description ?? ''), text].filter(Boolean).join('\n\n'),
    price,
    images: [...new Set(images.filter((s) => /^https?:\/\//.test(s)))],
    city: 'Livraison',
    attributes,
    shipping: true,
    newPrice: newPrice && newPrice > price ? newPrice : undefined,
  }
}
