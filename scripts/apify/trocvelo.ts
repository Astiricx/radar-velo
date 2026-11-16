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
import { BROWSER_PAGE_FUNCTION } from './browser-page-function'
import type { ActorRunner } from './client'
import { PREFILTER, SEARCH, TROCVELO, TROCVELO_PROXY } from './config'
import type { ListPage } from './page-function'
import { fold, type RawAd } from './parse'

export async function fetchTrocVelo(run: ActorRunner): Promise<{ ads: RawAd[]; skipped: number; listed: number | null; pages: ListPage[] }> {
  const items = await run(
    TROCVELO.actor,
    {
      startUrls: [{ url: TROCVELO.startUrl }],
      pageFunction: BROWSER_PAGE_FUNCTION,
      customData: {
        label: 'Troc-Vélo',
        linkPattern: '/annonce/.+-\\d+/?$',
        maxListings: TROCVELO.maxListings,
        prefilter: PREFILTER,
        priceMin: SEARCH.priceMin,
        priceMax: SEARCH.priceMax,
      },
      // Champ obligatoire. Proxy Apify ; TROCVELO_PROXY_GROUPS=RESIDENTIAL si le site bloque encore.
      proxyConfiguration: TROCVELO_PROXY,
      maxPagesPerCrawl: TROCVELO.maxListings + 1,
      maxRequestsPerCrawl: TROCVELO.maxListings + 1,
      maxConcurrency: 2,
      maxRequestRetries: 2,
      // Économie de temps et de bande passante (le proxy résidentiel est facturé au volume).
      downloadMedia: false,
      downloadCss: false,
      closeCookieModals: true,
      headless: true,
      useChrome: false,
      waitUntil: ['domcontentloaded'],
      pageLoadTimeoutSecs: 60,
      pageFunctionTimeoutSecs: 60,
    },
    { memoryMbytes: 2048, timeoutSecs: 280 },
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

/** Préfectures des départements autour de tes deux zones : position approximative du vendeur. */
const DEPARTMENTS: Record<string, [string, number, number]> = {
  '75': ['Paris', 48.8566, 2.3522],
  '77': ['Seine-et-Marne', 48.5421, 2.6554],
  '78': ['Yvelines', 48.8049, 2.1204],
  '91': ['Essonne', 48.6239, 2.4294],
  '92': ['Hauts-de-Seine', 48.8924, 2.2069],
  '93': ['Seine-Saint-Denis', 48.9077, 2.4386],
  '94': ['Val-de-Marne', 48.7904, 2.4556],
  '95': ["Val-d'Oise", 49.0364, 2.0761],
  '02': ['Aisne', 49.5641, 3.6199],
  '10': ['Aube', 48.2973, 4.0744],
  '14': ['Calvados', 49.1829, -0.3707],
  '17': ['Charente-Maritime', 46.1603, -1.1511],
  '18': ['Cher', 47.081, 2.3988],
  '22': ["Côtes-d'Armor", 48.5136, -2.7603],
  '27': ['Eure', 49.027, 1.1508],
  '28': ['Eure-et-Loir', 48.4439, 1.489],
  '29': ['Finistère', 47.996, -4.1024],
  '35': ['Ille-et-Vilaine', 48.1173, -1.6778],
  '37': ['Indre-et-Loire', 47.3941, 0.6848],
  '41': ['Loir-et-Cher', 47.5861, 1.3359],
  '44': ['Loire-Atlantique', 47.2184, -1.5536],
  '45': ['Loiret', 47.9029, 1.9093],
  '49': ['Maine-et-Loire', 47.4784, -0.5632],
  '50': ['Manche', 49.1157, -1.0906],
  '51': ['Marne', 48.9566, 4.3631],
  '53': ['Mayenne', 48.0707, -0.7734],
  '56': ['Morbihan', 47.6582, -2.7608],
  '58': ['Nièvre', 46.9908, 3.159],
  '60': ['Oise', 49.4295, 2.0807],
  '61': ['Orne', 48.4329, 0.0913],
  '72': ['Sarthe', 48.0061, 0.1996],
  '76': ['Seine-Maritime', 49.4432, 1.0999],
  '79': ['Deux-Sèvres', 46.3237, -0.4588],
  '80': ['Somme', 49.8941, 2.2958],
  '85': ['Vendée', 46.6705, -1.426],
  '86': ['Vienne', 46.5802, 0.3404],
  '89': ['Yonne', 47.7982, 3.5673],
}

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

export function normalizeTrocVelo(raw: unknown): RawAd | null {
  if (!isObj(raw) || raw.kind !== 'ad') return null
  const url = String(raw.url ?? '').split('?')[0]
  const id = url.match(/-(\d+)\/?$/)?.[1]
  if (!id) return null

  const product = productOf(raw.jsonLd)
  const offers = product && (Array.isArray(product.offers) ? product.offers[0] : product.offers)
  // Texte de la page sans les suggestions d'autres annonces, qui fausseraient l'analyse.
  const text = String(raw.text ?? '')
    .split(/annonces similaires|vous aimerez aussi|ces annonces (?:pourraient|peuvent)|derni[eè]res annonces|voir aussi/i)[0]
    .slice(0, 3000)
  const rawTitle = String(raw.title || raw.ogTitle || product?.name || '').trim()
  if (!rawTitle) return null

  // Titres de la forme « Modèle - MARQUE - 44600 » : on garde le modèle et la marque, on lit le code postal.
  const parts = rawTitle.split(/\s+-\s+/)
  const postal = parts.length > 1 && /^\d{4,5}$/.test(parts[parts.length - 1]) ? parts.pop()! : text.match(/\b(\d{5})\b(?=[^\d]{0,30}(?:remise|livraison|france))/i)?.[1]
  // « … - CERVELO » répète la marque déjà présente dans le titre.
  if (parts.length > 1 && fold(parts[0]).includes(fold(parts[parts.length - 1]))) parts.pop()
  const title = parts.join(' - ')

  const price =
    toNumber(isObj(offers) ? offers.price : undefined) ??
    toNumber(text.match(/(\d{1,2}[\s .]?\d{3}(?:[.,]\d{1,2})?)\s?€/)?.[1]?.replace(/[\s .](?=\d{3})/g, ''))
  if (!price) return null

  const toVerify: string[] = []
  let city = 'Lieu non précisé'
  let coords: RawAd['coords']
  if (postal && postal.length === 5) {
    const dept = DEPARTMENTS[postal.slice(0, 2)]
    city = dept ? `${postal}, ${dept[0]}` : postal
    if (dept) {
      coords = { lat: dept[1], lon: dept[2] }
      toVerify.push('Lieu approximatif : seul le code postal est connu')
    }
  } else if (postal) {
    city = `${postal}, hors de France`
  }

  const images = [String(raw.image ?? ''), ...(Array.isArray(raw.images) ? raw.images.map(String) : [])]
  if (product?.image) images.unshift(...(Array.isArray(product.image) ? product.image.map(String) : [String(product.image)]))
  const attributes: Record<string, string> = {}
  if (isObj(raw.attributes)) for (const [k, v] of Object.entries(raw.attributes)) attributes[k.toLowerCase()] = String(v)

  const description = [String(raw.description ?? product?.description ?? ''), text].filter(Boolean).join('\n\n')
  return {
    source: 'troc-velo',
    id: `tv-${id}`,
    url,
    title,
    description,
    price,
    images: [...new Set(images.filter((s) => /^https?:\/\//.test(s)))],
    city,
    coords,
    attributes,
    shipping: /mondial relay|colissimo|livraison (possible|disponible)|envoi possible|exp[ée]dition/i.test(text),
    toVerify,
  }
}
