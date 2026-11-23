/**
 * Outils de lecture des pages des magasins : téléchargement poli, texte, prix, JSON-LD.
 *
 * Volontairement sans bibliothèque : les pages lues ont des repères stables (attributs
 * data-*, classes de prix, JSON-LD), et ces fonctions se testent sur les vraies pages
 * enregistrées dans scripts/neuf/fixtures.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6',
}

/** Pages de blocage anti-robot (Cloudflare, DataDome, Akamai…). */
const BLOCKED = /<title>\s*(?:just a moment|attention required|access denied|accès refusé)|cf-chl-|captcha-delivery|px-captcha/i

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Lit une page. Lève une erreur claire si le site refuse ou renvoie une page anti-robot. */
export async function getPage(url: string, extraHeaders: Record<string, string> = {}): Promise<{ html: string; url: string }> {
  const res = await fetch(url, { headers: { ...HEADERS, ...extraHeaders }, redirect: 'follow', signal: AbortSignal.timeout(25_000) })
  const html = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
  if (BLOCKED.test(html.slice(0, 8000))) throw new Error(`page anti-robot sur ${url}`)
  return { html, url: res.url }
}

const NAMED: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', euro: '€', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ucirc: 'û', ugrave: 'ù', uuml: 'ü',
  Eacute: 'É', Agrave: 'À', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', ndash: '–', mdash: '—',
  hellip: '…', deg: '°', times: '×', shy: '',
}

/** Remplace les entités HTML (&eacute;, &#x202F;, &#160;…). */
export const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : all
    }
    return NAMED[code] ?? all
  })

/** Texte lisible d'un fragment HTML : balises retirées, entités décodées, espaces normalisés. */
export const textOf = (html: string) =>
  decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[   ]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()

/**
 * Montant en euros écrit à la française ou à l'allemande : « 2 799,99 € », « 5.799 € »,
 * « 3 038,00 € », « 4199.00 ». Renvoie null si le texte ne contient pas de prix.
 */
export function euros(text: string | undefined | null): number | null {
  if (!text) return null
  const m = decode(text)
    .replace(/[   ]/g, ' ')
    .match(/(\d{1,3}(?:[ .]\d{3})+|\d+)(?:[,.](\d{1,2}))?(?!\d)/)
  if (!m) return null
  const n = Number(m[1].replace(/[ .]/g, '')) + (m[2] ? Number(m[2].padEnd(2, '0')) / 100 : 0)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** Valeur d'un attribut dans une balise ouvrante (décodée). */
export const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))
  return m ? decode(m[1] ?? m[2] ?? '') : null
}

/** Contenu texte du premier élément dont la classe contient `cls`. */
export function textByClass(html: string, cls: string): string | null {
  const re = new RegExp(`<([a-z][\\w-]*)[^>]*class="[^"]*\\b${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, 'i')
  const m = html.match(re)
  return m ? textOf(m[2]) : null
}

/** Tous les blocs JSON-LD de la page, lisibles (les blocs abîmés sont ignorés). */
export function jsonLd(html: string): unknown[] {
  const out: unknown[] = []
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown
      const graph = (data as { '@graph'?: unknown[] })?.['@graph']
      // Certains sites imbriquent des listes dans @graph : on aplatit.
      out.push(...[Array.isArray(data) ? data : Array.isArray(graph) ? graph : [data]].flat(3))
    } catch {
      // JSON-LD invalide : on passe.
    }
  }
  return out
}

/** Découpe la page en blocs commençant chacun par une occurrence de `start` (une vignette produit). */
export function blocks(html: string, start: RegExp): string[] {
  const at = [...html.matchAll(new RegExp(start.source, start.flags.includes('g') ? start.flags : `${start.flags}g`))].map((m) => m.index ?? 0)
  return at.map((from, i) => html.slice(from, at[i + 1] ?? Math.min(html.length, from + 30_000)))
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface ProductOffer {
  /** Taille de la variante (« M », « 56 »…). */
  label: string
  inStock: boolean
  /** Taille de cycliste conseillée, si la fiche la donne (« Body Height » chez Canyon). */
  riderText?: string
  price: number
  isNew: boolean
  /** Autres propriétés de la variante (« Braking type »…), clés en minuscules. */
  props: Record<string, string>
}

/**
 * Fiche produit au format schema.org : un ProductGroup avec une variante par couleur et par
 * taille (stock, prix, état), ou un Product seul. Utilisé pour Canyon et Materiel-velo.com.
 */
export function productGroup(html: string): { name: string; description: string; image?: string; offers: ProductOffer[] } | null {
  const all = jsonLd(html).filter(isObj)
  const group = all.find((d) => d['@type'] === 'ProductGroup') ?? all.find((d) => d['@type'] === 'Product')
  if (!group) return null
  const variants = (Array.isArray(group.hasVariant) ? group.hasVariant : [group]).filter(isObj)
  const offers = variants.flatMap((v): ProductOffer[] => {
    const offer = (Array.isArray(v.offers) ? v.offers[0] : v.offers) as Obj | undefined
    const price = Number(offer?.price)
    if (!offer || !Number.isFinite(price) || price <= 0) return []
    const props: Record<string, string> = {}
    for (const p of (Array.isArray(v.additionalProperty) ? v.additionalProperty : []).filter(isObj)) props[String(p.name).toLowerCase()] = String(p.value ?? '')
    const rider = Object.entries(props).find(([k]) => /body height|taille du cycliste|taille de l.utilisateur|rider height/.test(k))?.[1]
    return [
      {
        label: String(v.size ?? '').trim() || '?',
        inStock: /InStock|LimitedAvailability|PreOrder/i.test(String(offer.availability)),
        riderText: rider,
        price,
        isNew: !/Refurbished|Used/i.test(String(offer.itemCondition)),
        props,
      },
    ]
  })
  const image = Array.isArray(group.image) ? group.image[0] : group.image
  return {
    name: String(group.name ?? ''),
    description: textOf(decode(String(group.description ?? ''))),
    image: typeof image === 'string' ? image : undefined,
    offers,
  }
}
