/**
 * Leboncoin via l'acteur Apify memo23/leboncoin-scraper.
 *
 * Une recherche déjà filtrée côté Leboncoin (vélos de route, taille M, prix), sur toute
 * la France (ou par zone, LEBONCOIN_SCOPE=zones), triée de la plus récente à la plus
 * ancienne : on ne paie que les annonces les plus susceptibles de convenir. La distance
 * (zone, train, livraison) est jugée ensuite par l'analyse.
 *
 * La normalisation accepte aussi le format d'autres acteurs Leboncoin du Store
 * (piotrv1001, dz_omar, 123webdata), si tu changes APIFY_LEBONCOIN_ACTOR.
 */
import type { ActorRunner } from './client'
import { LEBONCOIN, LEBONCOIN_ZONES, SEARCH } from './config'
import type { RawAd } from './parse'

/** Catégorie « Vélos » de Leboncoin. */
const CATEGORY_VELOS = '55'

/** Recherche Leboncoin filtrée ; sans zone, sur toute la France. */
export function searchUrl(zone?: (typeof LEBONCOIN_ZONES)[number]): string {
  const params = new URLSearchParams({
    category: CATEGORY_VELOS,
    bicycle_type: SEARCH.bicycleType,
    bicycle_size: SEARCH.bicycleSize,
    price: `${SEARCH.priceMin}-${SEARCH.priceMax}`,
  })
  // Format Leboncoin : Ville_CodePostal__lat_lon_rayonParDéfaut_rayon (mètres).
  if (zone) params.set('locations', `${zone.city}_${zone.zipcode}__${zone.lat}_${zone.lon}_10000_${Math.round(zone.radiusKm * 1000)}`)
  params.set('sort', 'time')
  params.set('order', 'desc')
  return `https://www.leboncoin.fr/recherche?${params}`
}

/** Adresses des recherches de l'exécution, selon LEBONCOIN.scope. */
export const searchUrls = () => (LEBONCOIN.scope === 'zones' ? LEBONCOIN_ZONES.map(searchUrl) : [searchUrl()])

export async function fetchLeboncoin(run: ActorRunner): Promise<{ ads: RawAd[]; skipped: number; urls: string[] }> {
  const urls = searchUrls()
  const items = await run(
    LEBONCOIN.actor,
    {
      startUrls: urls.map((url) => ({ url })),
      maxItems: LEBONCOIN.maxItemsPerSearch,
      maxConcurrency: 2,
      enrichSeller: false,
      enrichSellerPhone: false,
      enrichEmails: false,
      // Champs équivalents des autres acteurs Leboncoin, ignorés par memo23.
      maxResults: LEBONCOIN.maxItemsPerSearch,
      fetchAdDetails: false,
      includeDetails: false,
    },
    {
      maxItems: LEBONCOIN.maxItemsPerSearch * urls.length,
      maxTotalChargeUsd: LEBONCOIN.maxChargeUsd,
      timeoutSecs: 240,
    },
  )
  const ads: RawAd[] = []
  let skipped = 0
  for (const item of items) {
    const ad = normalizeLeboncoin(item)
    if (ad) ads.push(ad)
    else skipped++
  }
  return { ads, skipped, urls }
}

// ───────────── Normalisation ─────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (...values: unknown[]) => {
  for (const v of values) if ((typeof v === 'string' && v.trim() !== '') || typeof v === 'number') return String(v).trim()
  return ''
}
const numOrNull = (...values: unknown[]) => {
  for (const v of values) {
    const n = typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : typeof v === 'number' ? v : NaN
    if (Number.isFinite(n) && n !== 0) return n
  }
  return null
}

/** Attributs sous forme d'objet ou de liste [{ key, value, value_label }], clés en minuscules. */
function attributesOf(item: Obj): Record<string, string> {
  const out: Record<string, string> = {}
  const add = (k: unknown, v: unknown) => {
    const key = str(k).toLowerCase()
    const value = str(v)
    if (key && value && !(key in out)) out[key] = value
  }
  for (const source of [item.attributes, item.attributesRaw, item.attributeValues]) {
    if (Array.isArray(source)) for (const a of source) if (isObj(a)) add(a.key ?? a.key_label, a.value_label ?? a.value ?? (Array.isArray(a.values) ? a.values[0] : undefined))
    if (isObj(source)) for (const [k, v] of Object.entries(source)) add(k, v)
  }
  return out
}

function imagesOf(item: Obj): string[] {
  const urls: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v) && !urls.includes(v)) urls.push(v)
    else if (isObj(v)) push(v.largeUrl ?? v.imageUrl ?? v.url ?? v.smallUrl)
  }
  const images = item.images
  if (isObj(images)) (Array.isArray(images.urls_large) ? images.urls_large : Array.isArray(images.urls) ? images.urls : []).forEach(push)
  if (Array.isArray(images)) images.forEach(push)
  push(item.main_image)
  if (isObj(images)) push(images.thumb ?? images.small_url)
  push(item.thumb_url)
  // Grande taille plutôt que vignette.
  return urls.slice(0, 4).map((u) => u.replace(/\?rule=ad-(thumb|small|image)\b/, '?rule=ad-large'))
}

/** Une annonce de l'acteur → RawAd, ou null si ce n'est pas une annonce de vélo exploitable. */
export function normalizeLeboncoin(raw: unknown): RawAd | null {
  if (!isObj(raw)) return null
  if (raw.rowType && raw.rowType !== 'ad') return null
  const url = str(raw.url, raw.canonical_url).split('?')[0]
  const id = str(raw.adId, raw.listId, raw.list_id, raw.product_id) || url.match(/(\d{6,})/)?.[1] || ''
  const title = str(raw.title, raw.subject, raw.name)
  if (!url || !id || !title) return null
  if (!/leboncoin\.fr\/(ad|vi)\//.test(url)) return null

  const cents = numOrNull(raw.priceCents, raw.price_cents)
  const priceField = Array.isArray(raw.price) ? raw.price[0] : raw.price
  const price = cents ? cents / 100 : numOrNull(priceField)
  if (!price) return null

  const loc = isObj(raw.location) ? raw.location : {}
  const lat = numOrNull(loc.lat, loc.latitude, raw.lat, raw.latitude)
  const lon = numOrNull(loc.lng, loc.lon, loc.longitude, raw.lng, raw.longitude)
  const locationText = typeof raw.location === 'string' ? raw.location : ''
  const city = str(loc.city, loc.cityLabel, raw.city, locationText.replace(/\s*\d{5}\s*$/, ''), loc.zipcode, raw.zipcode)

  const attributes = attributesOf(raw)
  const condition = str(raw.condition, attributes.condition)
  if (condition) attributes.condition = condition
  const shippable = raw.shippable === true || attributes.shippable === 'true' || attributes.is_shippable === 'true'

  return {
    source: 'leboncoin',
    id: `lbc-${id}`,
    url,
    title,
    description: str(raw.description, raw.body, raw.description_html).replace(/<[^>]+>/g, ' '),
    price,
    images: imagesOf(raw),
    city,
    coords: lat !== null && lon !== null ? { lat, lon } : undefined,
    attributes,
    shipping: shippable,
    publishedAt: str(raw.firstPublishedAt, raw.firstPublicationDate, raw.first_publication_date, raw.published_at).replace(' ', 'T') || undefined,
  }
}
