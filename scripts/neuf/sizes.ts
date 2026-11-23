/**
 * Choix de la taille d'un vélo neuf : parmi les tailles en stock, celle qui correspond à
 * tes critères (M, M/L, 56, 57), de préférence celle dont la plage de taille de cycliste
 * indiquée par le magasin couvre ta taille (1,80 m).
 */
import { DEFAULT_CRITERIA } from '../../src/lib/criteria'

/** Ta taille, en cm. */
export const RIDER_CM = Number(process.env.RIDER_HEIGHT_CM ?? 180) || 180

export interface SizeOffer {
  /** « M », « 56 », « 2XL »… */
  label: string
  inStock: boolean
  /** Plage de taille de cycliste conseillée par le magasin, en cm. */
  rider?: [number, number]
}

/** « ML » (Trek), « M-L » (Rose) → « M/L », la forme de tes critères. */
export const normalizeSize = (label: string) => label.trim().toUpperCase().replace(/^([SML])-?([LMX]L?)$/, (all, a: string, b: string) => (a === b ? all : `${a}/${b}`))

const key = (s: string) => normalizeSize(s).replace(/\s|CM/g, '')
const ACCEPTED = DEFAULT_CRITERIA.sizes.map(key)

/** « 56 cm / 178-186 cm » → { label: '56', rider: [178, 186] } ; « M » → { label: 'M' }. */
export function readSizeLabel(text: string): { label: string; rider?: [number, number] } {
  const t = text.replace(/[  ]/g, ' ').trim()
  const range = t.match(/(\d{3})\s*[-–à]\s*(\d{3})\s*cm/)
  const label =
    t.match(/^\s*(\d{2})\s*(?:cm)?\b/)?.[1] ?? t.match(/\b(M\/L|S\/M|L\/XL|\d?X{0,3}[SL]|M)\b/i)?.[1]?.toUpperCase() ?? t.split(/[\s/]/)[0]
  return { label: normalizeSize(label), rider: range ? [Number(range[1]), Number(range[2])] : undefined }
}


/** « ≤ 166 », « 175 - 181 », « 187 ≥ » (Canyon) → plage en cm. */
export function riderRange(text: string | number | undefined): [number, number] | undefined {
  const t = String(text ?? '')
  const two = t.match(/(\d{3})\s*[-–]\s*(\d{3})/)
  if (two) return [Number(two[1]), Number(two[2])]
  const n = Number(t.match(/\d{3}/)?.[0])
  if (!n) return undefined
  return /≤|</.test(t) ? [0, n] : [n, 250]
}

export interface SizePick {
  /** Taille retenue pour l'analyse : une taille de tes critères en stock, sinon les tailles en stock. */
  size: string
  inStock: string[]
  /** Ce qui reste à vérifier (stock non confirmé, plage de taille…). */
  doubts: string[]
  /** Plage de taille de cycliste de la taille retenue, pour la description. */
  rider?: [number, number]
}

/**
 * @param stockKnown faux si le magasin donne les tailles proposées sans le stock.
 * @returns null si aucune taille n'est en stock (vélo épuisé, inutile de l'afficher).
 */
export function pickSize(offers: SizeOffer[], stockKnown = true): SizePick | null {
  const available = offers.filter((o) => o.inStock)
  if (available.length === 0) return null
  const accepted = available.filter((o) => ACCEPTED.includes(key(o.label)))
  const fits = (o: SizeOffer) => !!o.rider && o.rider[0] <= RIDER_CM && RIDER_CM <= o.rider[1]
  const inStock = [...new Set(available.map((o) => o.label))]
  const doubts: string[] = []
  if (!stockKnown) doubts.push('Stock dans ta taille à confirmer auprès du magasin')
  if (accepted.length === 0) return { size: inStock.join(', '), inStock, doubts }
  // Sinon la taille de tes critères la plus proche de ta taille de cycliste (M/L plutôt que M chez Trek).
  const gap = (o: SizeOffer) => (o.rider ? Math.max(0, o.rider[0] - RIDER_CM, RIDER_CM - o.rider[1]) : 99)
  const best = accepted.find(fits) ?? [...accepted].sort((a, b) => gap(a) - gap(b))[0]
  if (best.rider && !fits(best)) {
    const other = available.find((o) => fits(o) && o !== best)
    doubts.push(
      `Taille ${best.label} prévue pour ${best.rider[0]} à ${best.rider[1]} cm selon le magasin${other ? ` (il conseille la ${other.label} pour ${RIDER_CM} cm)` : ''}`,
    )
  }
  return { size: best.label, inStock, doubts, rider: best.rider }
}
