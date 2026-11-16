/**
 * buycycle via l'acteur Apify solidcode/buycycle-scraper (payé au résultat, ~0,10 $ les 1 000).
 *
 * buycycle est une place de marché européenne : le vendeur expédie dans un carton fourni,
 * le paiement est bloqué jusqu'à la livraison. Toutes ses annonces sont donc « livrables »
 * au sens de tes critères. La recherche est filtrée chez buycycle (vélos de route, cadre
 * carbone, freins à disque, tailles M et L, prix), triée de la plus récente à la plus
 * ancienne ; la taille exacte, le groupe et le prix avec protection sont vérifiés ensuite.
 *
 * Si l'acteur refuse les filtres (valeurs renommées), on relance avec une simple adresse
 * de catalogue buycycle, et l'analyse fait le tri.
 */
import { ApifyError, type ActorRunner } from './client'
import { BUYCYCLE, SEARCH } from './config'
import type { RawAd } from './parse'

/** Catalogue buycycle des vélos de route en taille M, prix maximum 5 000 €, vitrine française. */
export const FALLBACK_URL = 'https://buycycle.com/fr-fr/shop/main-types/bikes/types/road-gravel/categories/road/frame-sizes/m/max-price/5000'

export function buycycleInput() {
  return {
    country: BUYCYCLE.country,
    categories: ['road'],
    frameSizes: ['m', 'l'],
    frameMaterials: ['carbon'],
    brakeTypes: ['disc'],
    frameset: 'complete',
    minPrice: SEARCH.priceMin,
    maxPrice: SEARCH.priceMax,
    sortBy: 'newest',
    includeFullSpecs: true,
    maxResults: BUYCYCLE.maxItems,
  }
}

export async function fetchBuycycle(run: ActorRunner): Promise<{ ads: RawAd[]; skipped: number; mode: 'filtres' | 'catalogue' }> {
  const options = { maxItems: BUYCYCLE.maxItems + 40, maxTotalChargeUsd: BUYCYCLE.maxChargeUsd, timeoutSecs: 280 }
  let items: unknown[]
  let mode: 'filtres' | 'catalogue' = 'filtres'
  try {
    items = await run(BUYCYCLE.actor, buycycleInput(), options)
  } catch (error) {
    // 400 : une valeur de filtre n'est pas reconnue par l'acteur. On repasse par le catalogue.
    if (!(error instanceof ApifyError) || error.status !== 400) throw error
    mode = 'catalogue'
    items = await run(
      BUYCYCLE.actor,
      { startUrls: [FALLBACK_URL], country: BUYCYCLE.country, includeFullSpecs: true, maxResults: BUYCYCLE.maxItems },
      options,
    )
  }
  const ads: RawAd[] = []
  let skipped = 0
  for (const item of items) {
    const ad = normalizeBuycycle(item)
    if (ad) ads.push(ad)
    else skipped++
  }
  return { ads, skipped, mode }
}

// ───────────── Normalisation ─────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (...values: unknown[]) => {
  for (const v of values) if ((typeof v === 'string' && v.trim() !== '') || typeof v === 'number') return String(v).trim()
  return ''
}
const amount = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  // « € 3,657 incl. buyer protection », « 3.783 € » : on garde les chiffres.
  const digits = String(v ?? '').replace(/[^\d]/g, '')
  const n = Number(digits)
  return digits && n > 0 ? n : null
}

/** État buycycle (anglais ou français) → libellé lu par l'analyse. */
function conditionLabel(raw: string): string {
  const c = raw.toLowerCase()
  if (/brand new|neuf avec garantie|neuf$|^new|^neuf/.test(c)) return 'Neuf'
  if (/very good|tr[eè]s bien|tr[eè]s bon|like new|comme neuf/.test(c)) return 'Très bon état'
  if (/good|bien|bon/.test(c)) return 'Bon état'
  if (/fair|acceptable|correct|satisfaisant/.test(c)) return 'État satisfaisant'
  return raw
}

export function normalizeBuycycle(raw: unknown): RawAd | null {
  if (!isObj(raw)) return null
  const url0 = str(raw.url, raw.productUrl).split(/[?#]/)[0]
  // Liens toujours sur la vitrine française, quel que soit le pays demandé.
  const url = url0.replace(/buycycle\.com\/[a-z]{2}-[a-z]{2}\//, 'buycycle.com/fr-fr/')
  const id = url.match(/\/product\/.+-(\d+)\/?$/)?.[1] ?? str(raw.id, raw.itemId)
  const name = str(raw.title, raw.name)
  if (!/buycycle\.com\/[a-z]{2}-[a-z]{2}\/product\//.test(url) || !id || !name) return null
  if (str(raw.productType) && str(raw.productType) !== 'bike') return null

  // Prix payé par l'acheteur : avec la protection acheteur buycycle, hors frais de port.
  const base = amount(raw.price ?? raw.priceBase)
  const total = amount(raw.totalPriceFormatted) ?? amount(raw.priceTotal) ?? base
  if (!total) return null

  const year = str(raw.year)
  const brand = str(raw.brand)
  const title = [name.toLowerCase().startsWith(brand.toLowerCase()) ? '' : brand, name, year && !name.includes(year) ? year : '']
    .filter(Boolean)
    .join(' ')
  const shifting = str(raw.shifting).toLowerCase()
  const attributes: Record<string, string> = {}
  const put = (k: string, v: string) => {
    if (v) attributes[k] = v
  }
  // « 56 (M) », « 54 CM », « M » : la taille chiffrée, plus précise, est lue en premier.
  put('taille du cadre', str(raw.frameSize, raw.size))
  put('groupe', str(raw.groupset))
  if (shifting) put('groupe electrique', /electr/.test(shifting) ? 'Oui' : /mechan|mécan/.test(shifting) ? 'Non' : '')
  put('matiere principale', str(raw.frameMaterial))
  put('type de freinage', str(raw.brakeType))
  put('annee', year)
  put('pratique', str(raw.categoryName, raw.category))
  put('etat', conditionLabel(str(raw.condition)))

  const images = [str(raw.imageUrl), ...(Array.isArray(raw.images) ? raw.images.map((i) => str(i)) : [])].filter((s) => /^https?:\/\//.test(s))
  const seller = [str(raw.sellerCity), str(raw.sellerCountry)].filter(Boolean).join(', ')
  const msrp = amount(raw.msrp)
  const rating = str(raw.priceRating)

  return {
    source: 'buycycle',
    id: `bc-${id}`,
    url,
    title,
    description: [
      str(raw.description),
      base && base !== total ? `Prix vendeur ${base} €, ${total} € avec la protection acheteur buycycle (hors frais de port).` : '',
      rating ? `Avis de prix buycycle : ${rating}.` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    price: total,
    newPrice: msrp && msrp > total ? msrp : undefined,
    images: [...new Set(images)].slice(0, 4),
    city: seller ? `${seller} (livraison buycycle)` : 'Livraison buycycle',
    attributes,
    // buycycle expédie toujours : carton fourni au vendeur, paiement bloqué jusqu'à réception.
    shipping: true,
    toVerify: ['Frais de port buycycle à vérifier'],
  }
}
