/**
 * Troc-Vélo via l'acteur générique apify/puppeteer-scraper (Chrome sans écran).
 *
 * Il n'existe pas d'acteur Troc-Vélo dans l'Apify Store, et le site refuse les
 * requêtes sans navigateur (Cheerio Scraper, lecture directe : erreur 403). Un vrai
 * navigateur exécute son JavaScript. Pour limiter le coût : ni images ni CSS
 * téléchargés, une seule page de liste, au plus TROCVELO.maxListings annonces ouvertes,
 * celles dont la vignette cite un groupe retenu et un prix dans le budget.
 *
 * Troc-Vélo ne donne que le code postal du vendeur : la distance est calculée depuis
 * la préfecture du département, et signalée comme approximative.
 */
import { BROWSER_PAGE_FUNCTION, PRE_NAVIGATION_HOOKS } from './browser-page-function'
import { DEFAULT_CRITERIA } from '../../src/lib/criteria'
import type { ActorRunner } from './client'
import { DEPARTMENTS, departmentCode, departmentsNear } from './departments'
import { PREFILTER, SEARCH, TROCVELO, TROCVELO_PROXY } from './config'
import type { ListPage } from './page-function'
import { fold, type RawAd } from './parse'

export async function fetchTrocVelo(run: ActorRunner, options: { skipIds?: string[] } = {}): Promise<{ ads: RawAd[]; skipped: number; listed: number | null; pages: ListPage[] }> {
  const items = await run(
    TROCVELO.actor,
    {
      startUrls: [{ url: TROCVELO.startUrl }],
      pageFunction: BROWSER_PAGE_FUNCTION,
      // Capture des réponses JSON du site pendant le chargement (voir browser-page-function.ts).
      preNavigationHooks: PRE_NAVIGATION_HOOKS,
      customData: {
        label: 'Troc-Vélo',
        linkPattern: '/annonce/.+-\\d+/?$',
        maxListings: TROCVELO.maxListings,
        prefilter: PREFILTER,
        priceMin: SEARCH.priceMin,
        priceMax: SEARCH.priceMax,
        sizes: DEFAULT_CRITERIA.sizes,
        // Annonces déjà analysées : inutile de payer pour les rouvrir.
        skipIds: (options.skipIds ?? []).slice(-400),
        // Départements à portée de tes zones : ailleurs, seules les annonces avec livraison sont ouvertes.
        departments: departmentsNear(DEFAULT_CRITERIA.zones, DEFAULT_CRITERIA.train),
        maxListPages: TROCVELO.maxListPages,
        // API de recherche relevée sur le site, interrogée une fois pour en connaître le format.
        apiProbe: 'https://api.troc-velo.com/api/products?category=c8&sorting=relevance%3Adesc&itemsPerPage=30',
      },
      // Champ obligatoire. Proxy Apify ; TROCVELO_PROXY_GROUPS=RESIDENTIAL si le site bloque encore.
      proxyConfiguration: TROCVELO_PROXY,
      maxPagesPerCrawl: TROCVELO.maxListings + TROCVELO.maxListPages,
      maxRequestsPerCrawl: TROCVELO.maxListings + TROCVELO.maxListPages,
      maxConcurrency: 2,
      // Une nouvelle tentative repart avec une autre adresse du proxy.
      maxRequestRetries: 3,
      // Économie de temps et de bande passante (le proxy résidentiel est facturé au volume).
      downloadMedia: false,
      downloadCss: false,
      closeCookieModals: true,
      headless: true,
      useChrome: false,
      waitUntil: ['domcontentloaded'],
      pageLoadTimeoutSecs: 90,
      pageFunctionTimeoutSecs: 120,
    },
    { memoryMbytes: 2048, timeoutSecs: 290 },
  )
  let listed: number | null = null
  const pages: ListPage[] = []
  let skipped = 0
  const ads: RawAd[] = []
  for (const item of items) {
    const record = item as { kind?: string; found?: number }
    if (record.kind === 'list') {
      listed = (listed ?? 0) + Number(record.found ?? 0)
      pages.push(item as ListPage)
      continue
    }
    const ad = normalizeTrocVelo(item)
    if (ad) ads.push(ad)
    else skipped++
  }
  return { ads, skipped, pages, listed }
}

// ───────────── Normalisation ─────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Cherche un objet schema.org Product dans les blocs JSON-LD de la page. */
export function productOf(jsonLd: unknown): Obj | null {
  const queue: unknown[] = Array.isArray(jsonLd) ? [...jsonLd] : [jsonLd]
  while (queue.length > 0) {
    const node = queue.shift()
    if (Array.isArray(node)) queue.push(...node)
    else if (isObj(node)) {
      const type = node['@type']
      if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return node
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
    }
  }
  return null
}

export const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Libellés du bloc « Caractéristiques » des fiches Troc-Vélo (collés à leur valeur dans le texte). */
const CHARACTERISTICS = [
  'Groupe électrique (AXS, Di2, eTap, ..)',
  'Localisation de l\'article',
  'Couleurs principales',
  'Matière principale',
  'Nombres de vitesses',
  'Type de freinage',
  'Taille du cadre',
  'Diametre roues',
  'Pratique',
  'Marque',
  'Année',
  'Groupe',
  'État',
]

/** « Marque WILIER Année2024 ÉtatTrès bon état … » → { marque: 'WILIER', annee: '2024', etat: 'Très bon état', … } (clés sans accents). */
export function parseCharacteristics(block: string): Record<string, string> {
  const escaped = CHARACTERISTICS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})\\s*:?\\s*`, 'g')
  const marks = [...block.matchAll(re)]
  const out: Record<string, string> = {}
  marks.forEach((m, i) => {
    const key = fold(m[1])
    const value = block.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim()
    if (value && !(key in out)) out[key] = value.slice(0, 120)
  })
  return out
}

/** Marque d'un lieu connu seulement au département près. */
export const APPROXIMATE_PLACE = 'Lieu approximatif : distance calculée depuis le chef-lieu du département'

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

/** « Date de publication samedi 24 octobre 2026, 10h00 » → date ISO. « Aujourd'hui » / « Hier » : laissé à la veille. */
function publicationDate(header: string): string | undefined {
  const m = fold(header).match(/date de publication\s+(?:[a-z]+\s+)?(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s*(\d{1,2})h(\d{2})/)
  if (!m) return undefined
  const month = MONTHS.indexOf(m[2])
  if (month < 0) return undefined
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]))).toISOString()
}

export function normalizeTrocVelo(raw: unknown): RawAd | null {
  if (!isObj(raw) || raw.kind !== 'ad') return null
  const url = String(raw.url ?? '').split('?')[0]
  const id = url.match(/-(\d+)\/?$/)?.[1]
  if (!id) return null

  const product = productOf(raw.jsonLd)
  const offers = product && (Array.isArray(product.offers) ? product.offers[0] : product.offers)
  const full = String(raw.text ?? '')
  // La fiche se lit en trois morceaux : en-tête (prix, livraison), description, caractéristiques.
  // Tout ce qui suit (« Annonces similaires », « Les annonces de … ») concerne d'autres vélos.
  // (« Voir les annonces similaires » en haut de page n'est qu'un lien : on cherche la fin après la description.)
  const descStart = full.search(/\bDescription\b/)
  const tail = full.slice(Math.max(descStart, 0)).search(/(?<!voir les )annonces similaires|les annonces de |vous aimerez aussi|ces annonces (?:pourraient|peuvent)|derni[eè]res annonces/i)
  const end = tail >= 0 ? Math.max(descStart, 0) + tail : -1
  const page = end > 0 ? full.slice(0, end) : full.slice(0, 4000)
  const descAt = page.search(/\bDescription\b/)
  const header = descAt > 0 ? page.slice(0, descAt) : page.slice(0, 600)
  // Le bloc du site commence par « Caractéristiques Marque … ». Un vendeur peut écrire
  // « Caractéristiques techniques : » dans sa description : on coupe donc au dernier titre.
  const body = descAt > 0 ? page.slice(descAt + 'Description'.length) : page
  const blockAt = Math.max(body.lastIndexOf('Caractéristiques Marque'), body.search(/Caractéristiques\s+(?:Marque|Année|État)\b(?![\s\S]*Caractéristiques\s+(?:Marque|Année|État)\b)/))
  const cut = blockAt >= 0 ? blockAt : body.lastIndexOf('Caractéristiques')
  const descriptionText = cut >= 0 ? body.slice(0, cut) : body
  const characteristicsText = cut >= 0 ? body.slice(cut + 'Caractéristiques'.length) : ''
  const characteristics = parseCharacteristics(characteristicsText)

  const ogTitle = String(raw.ogTitle ?? '')
  const rawTitle = String(raw.title || ogTitle || product?.name || '').trim()
  if (!rawTitle) return null
  // Titres de la forme « Modèle - MARQUE - 44600 » : on garde le modèle, on lit le code postal.
  const parts = rawTitle.replace(/\s+-\s+Troc V[ée]lo\s*$/i, '').split(/\s+-\s+/)
  const postalFromTitle = parts.length > 1 && /^\d{4,5}$/.test(parts[parts.length - 1]) ? parts.pop()! : undefined
  if (parts.length > 1 && fold(parts[0]).includes(fold(parts[parts.length - 1]))) parts.pop()
  const title = parts.join(' - ')

  // Lieu : « Localisation de l'article : Saint Palais (64120) », sinon le titre Open Graph ou la description.
  const located = (characteristics["localisation de l'article"] ?? '').match(/^(.*?)\s*\((\d{4,5})\)/)
  const postalField = raw.postalCode !== undefined && raw.postalCode !== null ? String(raw.postalCode).trim() : ''
  const postal =
    located?.[2] ??
    (/^\d{4,5}$/.test(postalField) ? postalField : undefined) ??
    postalFromTitle ??
    ogTitle.match(/-\s(\d{4,5})\s-\sTroc V[ée]lo/i)?.[1] ??
    String(raw.description ?? '').match(/g[ée]olocalis[ée]e [àa] : (\d{4,5})/i)?.[1]
  const placeName = located?.[1]?.trim() || String(raw.description ?? '').match(/g[ée]olocalis[ée]e [àa] : \d{4,5} ([^\n]+)/i)?.[1]?.trim()

  // Prix : premier montant de l'en-tête ; le second, s'il existe, est le prix neuf.
  const amounts = [...header.slice(Math.min(title.length, 200)).matchAll(/(\d{1,2}[\s\u202f.]?\d{3}|\d{3,5})(?:[.,]\d{1,2})?\s?€/g)].map((m) => Number(m[1].replace(/[\s\u202f.]/g, '')))
  const price =
    toNumber(isObj(offers) ? offers.price : undefined) ??
    (amounts[0] || null) ??
    toNumber(full.match(/(\d{1,2}[\s\u202f.]?\d{3}(?:[.,]\d{1,2})?)\s?€/)?.[1]?.replace(/[\s\u202f.](?=\d{3})/g, ''))
  if (!price) return null
  const newPrice = amounts[1] && amounts[1] > price ? amounts[1] : undefined

  // Position provisoire : la préfecture du département. La veille la remplace ensuite par le
  // centre de la commune (scripts/geo.ts) ; si c'est impossible, le lieu reste marqué approximatif.
  const toVerify: string[] = []
  let city = placeName ? placeName : 'Lieu non précisé'
  let coords: RawAd['coords']
  const deptCode = postal ? departmentCode(postal) : null
  if (postal && postal.length === 5 && deptCode) {
    const dept = DEPARTMENTS[deptCode]
    city = placeName ? `${placeName} (${postal})` : `${postal}, ${dept[0]}`
    coords = { lat: dept[1], lon: dept[2] }
    toVerify.push(APPROXIMATE_PLACE)
  } else if (postal) {
    city = `${placeName ?? postal} (${postal}), hors de France métropolitaine`
    toVerify.push('Annonce hors de France métropolitaine : vérifier la livraison et les frais')
  } else {
    toVerify.push('Lieu non précisé dans l’annonce')
  }

  // Le vendeur propose la livraison de la plateforme… sauf s'il écrit le contraire dans sa description.
  const platformShipping = /livraison par transporteur|mondial relay|colissimo|livraison (possible|disponible)|envoi possible/i.test(header + (descAt > 0 ? '' : page))
  const refusesShipping = /pas d[’' ]envois?|pas de livraison|aucun envoi|uniquement (?:en )?(?:remise en )?main propre|remise en main propre uniquement|sur place uniquement/i.test(descriptionText)

  // Photos de cette annonce seulement (la page affiche aussi celles d'autres annonces).
  const images = [String(raw.image ?? ''), ...(Array.isArray(raw.images) ? raw.images.map(String) : [])]
  if (product?.image) images.unshift(...(Array.isArray(product.image) ? product.image.map(String) : [String(product.image)]))
  const ownImages = images.filter((src) => /^https?:\/\//.test(src) && (!/bikeAds\//.test(src) || src.includes(`/${id}/`)))

  const attributes: Record<string, string> = { ...characteristics }
  if (isObj(raw.attributes)) for (const [k, v] of Object.entries(raw.attributes)) attributes[fold(k)] ??= String(v)
  delete attributes["localisation de l'article"]

  const description = descAt > 0 ? descriptionText.trim() : [String(raw.description ?? product?.description ?? ''), page].filter(Boolean).join('\n\n')
  return {
    source: 'troc-velo',
    id: `tv-${id}`,
    url,
    title,
    description,
    price,
    newPrice,
    // Même photo en plusieurs tailles (zoom, full, list) : une seule fois chacune.
    images: [...new Map(ownImages.map((src) => [src.split('/').pop()!, src])).values()],
    city,
    coords,
    attributes,
    shipping: platformShipping && !refusesShipping,
    publishedAt: publicationDate(header),
    postalCode: postal && postal.length === 5 ? postal : undefined,
    placeName,
    debug: `EN-TÊTE « ${header.slice(title.length, title.length + 160).trim()} » | CARACTÉRISTIQUES « ${characteristicsText.trim().slice(0, 500)} » | DESCRIPTION « ${descriptionText.trim().slice(0, 300)} »`,
    toVerify,
  }
}
