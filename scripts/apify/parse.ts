/**
 * Transforme une annonce brute (titre, texte, attributs de la plateforme) en `Listing`.
 *
 * Les plateformes ne donnent ni le groupe, ni le matériau du cadre, ni le type de
 * freins : on les lit dans le titre et la description. Quand l'annonce ne dit rien,
 * on suppose la valeur la plus probable et on l'inscrit dans `toVerify`, que
 * l'application affiche (« À vérifier auprès du vendeur »).
 */
import { DEFAULT_CRITERIA } from '../../src/lib/criteria'
import type { BikeType, Brakes, Condition, ExtensionFit, Frame, Groupset, Listing, SourceId } from '../../src/types'

/** Annonce telle que lue sur la plateforme, avant analyse. */
export interface RawAd {
  source: SourceId
  /** Identifiant stable, préfixé par la plateforme : « lbc-3310839472 ». */
  id: string
  /** Lien direct de l'annonce. */
  url: string
  title: string
  description: string
  price: number
  images: string[]
  city: string
  coords?: { lat: number; lon: number }
  /** Attributs structurés de la plateforme, clés en minuscules. */
  attributes: Record<string, string>
  shipping?: boolean
  publishedAt?: string
  newPrice?: number
  /** Code postal et nom de commune lus sur l'annonce, pour calculer la position exacte. */
  postalCode?: string
  placeName?: string
  /** Extraits bruts de la page (prix de l'en-tête, caractéristiques), pour le journal de contrôle. */
  debug?: string
  /** Points déjà connus comme incertains (lieu approximatif…). */
  toVerify?: string[]
}

/** Minuscules, sans accents, espaces normalisés : le texte sur lequel on cherche. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .toLowerCase()

// ───────────── Marque et modèle ─────────────

const BRANDS: [string, RegExp][] = [
  ['Canyon', /\bcanyon\b/],
  ['Specialized', /\bspecialized\b|\bs-?works\b/],
  ['Trek', /\btrek\b/],
  ['Giant', /\bgiant\b/],
  ['Cervélo', /\bcervelo\b/],
  ['Cannondale', /\bcannondale\b/],
  ['Scott', /\bscott\b/],
  ['BMC', /\bbmc\b/],
  ['Orbea', /\borbea\b/],
  ['Lapierre', /\blapierre\b/],
  ['Look', /\blook\b/],
  ['Time', /\btime\b(?! ?trial)/],
  ['Van Rysel', /\bvan ?rysel\b/],
  ['Triban', /\btriban\b/],
  ['Pinarello', /\bpinarello\b/],
  ['Bianchi', /\bbianchi\b/],
  ['Cube', /\bcube\b/],
  ['Ridley', /\bridley\b/],
  ['Factor', /\bfactor\b/],
  ['Wilier', /\bwill?ier\b/],
  ['Colnago', /\bcolnago\b/],
  ['Merida', /\bmerida\b/],
  ['Felt', /\bfelt\b/],
  ['Rose', /\brose (?:bikes|x-?lite|reveal|xeon)\b/],
  ['Focus', /\bfocus\b/],
  ['Argon 18', /\bargon ?18\b/],
  ['De Rosa', /\bde ?rosa\b/],
  ['Basso', /\bbasso\b/],
  ['3T', /\b3t\b/],
  ['Storck', /\bstorck\b/],
  ['Ribble', /\bribble\b/],
  ['Vitus', /\bvitus\b/],
  ['BH', /\bbh\b/],
  ['Fuji', /\bfuji\b/],
  ['Kuota', /\bkuota\b/],
  ['Stevens', /\bstevens\b/],
  ['Simplon', /\bsimplon\b/],
  ['Cipollini', /\bcipollini\b/],
  ['Ventum', /\bventum\b/],
  ['Enve', /\benve\b(?! ?ses)/],
  ['Sunn', /\bsunn\b/],
  ['Bottecchia', /\bbottecchia\b/],
  ['KTM', /\bktm\b/],
]

function findBrand(...texts: string[]): string | null {
  for (const t of texts) {
    let best: { brand: string; at: number } | null = null
    for (const [brand, re] of BRANDS) {
      const at = t.search(re)
      if (at >= 0 && (!best || at < best.at)) best = { brand, at }
    }
    if (best) return best.brand
  }
  return null
}

/** Modèle : le titre sans la marque, la taille, l'année ni le prix. */
function modelFrom(title: string, brand: string | null): string {
  let m = title
  if (brand) m = m.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/é/g, '[eé]'), 'i'), ' ')
  m = m
    .replace(/\b(taille|size|t\.?)\s*:?\s*(xxs|xs|s|m\/l|m|l|xl|\d{2})\b/gi, ' ')
    .replace(/\b20[12]\d\b/g, ' ')
    .replace(/\d[\d\s.]*\s?(€|eur)/gi, ' ')
    .replace(/\bv[ée]lo( de)?( route| course)?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:/–—-]+|[\s,;:/–—-]+$/g, '')
  return (m || title).slice(0, 60)
}

// ───────────── Équipement ─────────────

function detectGroupset(t: string): { groupset: Groupset; doubt?: string } {
  if (/dura[\s-]?ace[^.;]{0,30}di2|di2[^.;]{0,20}dura[\s-]?ace|\br9[12][57]0\b|\br92[57]0\b/.test(t)) return { groupset: 'dura-ace-di2' }
  if (/ultegra[^.;]{0,30}di2|di2[^.;]{0,20}ultegra|\br8[01][57]0\b|\br8050\b/.test(t)) return { groupset: 'ultegra-di2' }
  if (/\b105\b[^.;]{0,30}di2|di2[^.;]{0,20}\b105\b|\br71[57]0\b/.test(t)) return { groupset: '105-di2' }
  if (/\bsram\b|\baxs\b|\betap\b/.test(t)) return { groupset: 'sram-axs' }
  if (/\bdi2\b/.test(t)) return { groupset: '105-di2', doubt: 'Gamme du groupe Di2 non précisée (105, Ultegra ou Dura-Ace)' }
  if (/\bgrx\b/.test(t)) return { groupset: 'grx' }
  if (/\bultegra\b|\br8[01][02]0\b|\br6800\b/.test(t)) return { groupset: 'ultegra' }
  if (/\b105\b(?!\s?(?:km|€|eur|kg|mm|cm))|\br7[01][02]0\b|\b5800\b/.test(t)) return { groupset: '105' }
  // Dura-Ace mécanique : au-dessus de l'Ultegra mécanique, que tes critères acceptent.
  if (/\bdura[\s-]?ace\b/.test(t)) return { groupset: 'ultegra', doubt: 'Groupe Dura-Ace mécanique, classé avec l’Ultegra mécanique' }
  return { groupset: 'autre' }
}

/**
 * Groupe : le champ « Groupe » rempli par le vendeur prime sur le texte libre, où une pièce
 * isolée (« dérailleur SRAM », « étriers Dura-Ace ») fausserait la lecture.
 */
function groupsetFrom(attrs: Record<string, string>, t: string): { groupset: Groupset; doubt?: string } {
  const fromText = detectGroupset(t)
  let declared = fold(attrs.groupe ?? attrs.groupset ?? '')
  if (!declared) return fromText
  const electric = fold(Object.entries(attrs).find(([k]) => k.startsWith('groupe electrique'))?.[1] ?? '')
  if (/^oui/.test(electric) && /shimano|ultegra|dura|105/.test(declared) && !/di2/.test(declared)) declared += ' di2'
  if (/^non/.test(electric)) declared = declared.replace(/\bdi2\b/g, ' ')
  const fromField = detectGroupset(declared)
  if (fromField.groupset === 'autre') return fromText
  // Champ « Ultegra » sans précision, description « Ultegra Di2 » : la description complète le champ.
  if (!/^non/.test(electric) && fromText.groupset === `${fromField.groupset}-di2`) return fromText
  return fromField
}

/** Retire les pièces en carbone qui ne sont pas le cadre (roues, cintre…). */
const NOT_FRAME = /(roues?|jantes?|cintre|tige de selle|tige|potence|selle|fourche|manivelles?|pedalier|guidon|wheels?|handlebar|seatpost|fork)\s+(?:\w+\s+){0,3}?(en\s+)?carbone?\b/g

function detectFrame(t: string): { frame: Frame; doubt?: string } {
  // « Cadre et roues carbone », « cadre en carbone » : le cadre est nommé, pas de doute.
  if (/\bcadre (?:et [a-z]+ )?(?:en |full |tout )?carbone?\b/.test(t)) return { frame: 'carbone' }
  const frameOnly = t.replace(NOT_FRAME, ' ')
  if (/\bcarbone?\b|\bcf\b|\bfull carbon/.test(frameOnly)) return { frame: 'carbone' }
  if (/\balu(minium)?\b/.test(frameOnly)) return { frame: 'aluminium' }
  if (/\bacier\b|\bsteel\b|\breynolds\b|\bcolumbus\b/.test(frameOnly)) return { frame: 'acier' }
  return { frame: 'carbone', doubt: 'Matériau du cadre non précisé' }
}

function detectBrakes(t: string): { brakes: Brakes; doubt?: string } {
  if (/\bdis(c|que)s?\b|disc ?brake|freins? (a |hydrauliques? a )?disques?|\bhydrauliques?\b|flat ?mount|\b(?:rd|st)-?r\d{4}\b|\br[789]1[27]0\b/.test(t))
    return { brakes: 'disque' }
  if (/\bpatins?\b|\betriers?\b|\bcalipers?\b|freins? sur jantes?|rim brakes?|direct ?mount/.test(t)) return { brakes: 'patins' }
  return { brakes: 'disque', doubt: 'Type de freins non précisé' }
}

/** Modèles et mentions de vélos de contre-la-montre ou de triathlon : ce ne sont pas des vélos de route. */
const TIME_TRIAL = /\b(aerium|speedmax|shiv|plasma|trinity|speed ?concept|p-?series|p5x?|p3x?|cervelo p\d|quintana roo|velo de (?:triathlon|clm|chrono|contre[- ]la[- ]montre)|velo (?:triathlon|clm|chrono))\b/

function detectType(t: string, typeAttr: string): BikeType {
  const a = fold(typeAttr)
  if (TIME_TRIAL.test(t)) return 'clm'
  // La pratique déclarée par le vendeur prime sur le texte (« je passe au gravel » ne fait pas un gravel).
  if (/route|course|endurance|clm|triathlon/.test(a)) return 'route'
  if (/gravel/.test(a)) return 'gravel'
  if (/electri|vae|assistance/.test(a) || /\bvae\b|\bassistance electrique\b/.test(t)) return 'vae'
  if (/vtt|vtc|ville|enfant|bmx/.test(a)) return 'urbain'
  if (/\bgravel\b/.test(t)) return 'gravel'
  return 'route'
}

const sizeKey = (v: string) => fold(v).replace(/\s|cm/g, '')
const ACCEPTED_SIZES = DEFAULT_CRITERIA.sizes.map(sizeKey)
const ACCEPTED_NUMERIC = ACCEPTED_SIZES.filter((v) => /^\d{2}$/.test(v)).map(Number)

/**
 * Taille : celle déclarée par le vendeur dans le champ prévu (attribut) et celle écrite dans
 * le titre ou la description. Si elles divergent (« M » déclaré, « T54/M » dans le texte),
 * on garde celle qui correspond à tes critères et on le signale ; un écart net (M déclaré,
 * 52 écrit) retient la taille chiffrée, plus précise.
 */
function detectSize(title: string, t: string, sizeAttr: string): { size: string | null; doubt?: string } {
  const explicit = (s: string) =>
    // « Taille du cadre : M (54) », « taille M/54 » : la valeur chiffrée précise la lettre.
    s.match(/\b(?:taille|size)(?: du cadre| cadre)?\s*:?\s*(?:xxs|xs|s|m|l|xl|xxl)\s*[(/]\s*(\d{2})\b/)?.[1] ??
    s.match(/\b(?:taille|size)(?: du cadre| cadre)?\s*:?\s*(xxs|xs|s\/m|m\/l|l\/xl|s|m|l|xl|xxl|\d{2})\b/)?.[1] ??
    s.match(/\bt\.?\s?(4[6-9]|5\d|6[0-4])\b/)?.[1]
  const written = (explicit(fold(title)) ?? explicit(t))?.toUpperCase() ?? null
  const declared = fold(sizeAttr).match(/\b(xxs|xs|s\/m|m\/l|l\/xl|s|m|l|xl|xxl|\d{2})\b/)?.[1]?.toUpperCase() ?? null
  if (!declared || !written || declared === written) {
    // Dernier recours : une taille en majuscules isolée dans le titre (« Esker 8.0 GRX XL Carbon »).
    return { size: written ?? declared ?? title.match(/(?:^|\s)(XXS|XS|S|M|L|XL|XXL)(?=\s|$|,)/)?.[1] ?? null }
  }
  const ok = (v: string) => ACCEPTED_SIZES.includes(sizeKey(v))
  const number = /^\d{2}$/.test(written) ? Number(written) : null
  const near = number !== null && ACCEPTED_NUMERIC.some((n) => Math.abs(n - number) <= 2)
  const doubt = `Taille à confirmer : ${declared} déclarée, ${written} dans la description`
  // Les deux conviennent (« M » et « 56 ») : pas de contradiction, on garde la plus précise.
  if (ok(declared) && ok(written)) return { size: number !== null ? written : declared }
  if (ok(declared) && (number === null || near)) return { size: declared, doubt }
  if (!ok(declared) && ok(written)) return { size: written, doubt }
  return { size: written }
}

function detectYear(t: string): number {
  const max = new Date().getFullYear() + 1
  for (const m of t.matchAll(/\b(20[12]\d)\b(?!\s?(?:km|€|eur|g\b))/g)) {
    const y = Number(m[1])
    if (y >= 2012 && y <= max) return y
  }
  return 0
}

const AERO = /\baero\b|\baeroad\b|\bvenge\b|\bmadone\b|\bpropel\b|\bsystemsix\b|\bs5\b|\breacto\b|\bfoil\b|\baircode\b|\bnoah\b|\baerofly\b|\brcr-?f\b|\bfcr\b|\baeromax\b|\bdogma f\b|\bostro\b|\bizalco max\b|\bstrade bianche\b/

const POWER =
  /capteurs? de puissance|power ?meter|powermeter|\b4iiii\b|\bstages\b|\bassioma\b|\bquarq\b|\bfavero\b|\bpower2max\b|\bp2m\b|\bsigeyi\b|\bxcadey\b|\binpower\b|\brally\b|\br9[12]00-p\b|\br8100-p\b|\bpower pro\b|\bpioneer\b/

function wheelDepth(t: string): number {
  const named: [RegExp, number][] = [
    [/\bzipp ?(?:404|454)\b/, 58],
    [/\bzipp ?808\b/, 80],
    [/\bzipp ?(?:303|353)\b/, 42],
    [/\bzipp ?202\b/, 32],
  ]
  for (const [re, depth] of named) if (re.test(t)) return depth
  const near =
    t.match(/\b(?:roues?|jantes?|wheels?|aeolus|arc|bora|cosmic|hed|reynolds|vision|fulcrum|scope|hunt|prime|roval|rapide|ec ?90|ccu|slr)\b[^.;]{0,40}?(?:\b|[a-z])([3-9]\d)(?:\s?mm)?\b/) ??
    t.match(/\b([3-9]\d)\s?mm[^.;]{0,25}(?:roues?|jantes?)/)
  if (near) return Number(near[1])
  if (/(roues?|jantes?) (\w+ )?(en )?carbone?\b|(cosmic|aeolus|roval|zipp|bora|reynolds|hunt|scope|prime|ccu)[^.;]{0,30}carbon/.test(t)) return 40
  return 0
}

function extensionsFit(t: string): ExtensionFit {
  return /prolongateurs?|\baero ?bars?\b|\bclip-?on\b|\bprolongs?\b|barres? de triathlon/.test(t) ? 'kit' : 'inconnu'
}

function condition(t: string, attr: string): Condition {
  const a = fold(attr)
  const s = a || t
  if (/comme neuf|tres bon/.test(s)) return 'tres-bon'
  if (/etat neuf|\bneuf\b|jamais (servi|roule)/.test(s)) return 'neuf'
  if (/bon etat/.test(s)) return 'bon'
  if (/satisfaisant|correct|pour pieces|use/.test(s)) return 'correct'
  return 'bon'
}

function kilometres(t: string): number | undefined {
  for (const m of t.matchAll(/(?<!\ba\s)(?<!\bde\s)\b(\d{1,3}(?:[ .]\d{3})+|\d{3,6})\s?(?:km|kms|kilometres)\b/g)) {
    const km = Number(m[1].replace(/[ .]/g, ''))
    if (km >= 50 && km <= 150_000) return km
  }
  return undefined
}

function newPrice(t: string, price: number): number | undefined {
  const m = t.match(/(?:prix (?:neuf|d'achat|achat)|achete|valeur neuve?)[^\d]{0,20}(\d{1,2}[ .]?\d{3})\s?(?:€|eur|euros)?/)
  const n = m ? Number(m[1].replace(/[ .]/g, '')) : NaN
  return Number.isFinite(n) && n > price && n < 20_000 ? n : undefined
}

function clean(text: string, max: number): string {
  const t = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

// ───────────── Annonce complète ─────────────

/** Transforme une annonce brute en `Listing`, prêt pour le filtre et le score. */
export function toListing(raw: RawAd, today: string): Listing {
  const attrs = raw.attributes
  const t = fold(`${raw.title}\n${raw.description}\n${Object.values(attrs).join(' ')}`)
  const doubts = [...(raw.toVerify ?? [])]

  const brand = findBrand(fold(raw.title), t)
  const { groupset, doubt: g } = groupsetFrom(attrs, t)
  // Matière et freinage : le champ rempli par le vendeur prime sur le texte libre.
  const material = fold(attrs['matiere principale'] ?? attrs.matiere ?? '')
  const braking = fold(attrs['type de freinage'] ?? attrs.freinage ?? '')
  const { frame, doubt: f } = material ? detectFrame(`cadre ${material}`) : detectFrame(t)
  const { brakes, doubt: b } = braking ? detectBrakes(braking) : detectBrakes(t)
  const { size, doubt: sz } = detectSize(raw.title, t, attrs.bicycle_size ?? attrs['taille du cadre'] ?? attrs.taille ?? attrs.size ?? '')
  const declaredYear = Number((attrs.annee ?? attrs.year ?? '').match(/\b(19[89]\d|20[0-3]\d)\b/)?.[1] ?? 0)
  const year = declaredYear || detectYear(t)
  for (const d of [g, f, b, sz]) if (d) doubts.push(d)
  if (!size) doubts.push('Taille non précisée')
  if (!year) doubts.push('Année non précisée')

  return {
    id: raw.id,
    source: raw.source,
    url: raw.url,
    image: raw.images[0] ?? '',
    fallbackImage: raw.images[1],
    imageKind: 'annonce',
    title: clean(raw.title, 140),
    brand: brand ?? 'Vélo de route',
    model: modelFrom(raw.title, brand),
    year,
    type: detectType(t, attrs.bicycle_type ?? attrs['type de velo'] ?? attrs.pratique ?? attrs.type ?? ''),
    size: size ?? '?',
    price: Math.round(raw.price),
    newPrice: raw.newPrice ?? newPrice(t, raw.price),
    description: clean(raw.description, 1500),
    city: raw.city || 'Lieu inconnu',
    coords: raw.coords,
    shipping: raw.shipping ?? false,
    publishedAt: raw.publishedAt && !Number.isNaN(Date.parse(raw.publishedAt)) ? new Date(raw.publishedAt).toISOString() : `${today}T08:00:00.000Z`,
    frame,
    brakes,
    groupset,
    aero: AERO.test(t),
    powerMeter: POWER.test(t),
    wheelDepth: wheelDepth(t),
    extensions: extensionsFit(t),
    condition: condition(t, attrs.condition ?? attrs.etat ?? attrs['etat'] ?? ''),
    km: kilometres(t),
    batch: 0,
    toVerify: doubts.length > 0 ? doubts : undefined,
    firstSeen: today,
  }
}
