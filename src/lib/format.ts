const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dayMonthTime = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export const eur = (n: number) => euro.format(n)

/** « 1 annonce », « 3 annonces ». */
export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

/** « aujourd'hui », « hier », « il y a 5 jours ». */
export function relativeDay(iso: string): string {
  const d = daysSince(iso)
  if (d === 0) return "aujourd'hui"
  if (d === 1) return 'hier'
  return `il y a ${d} jours`
}

export const shortDate = (iso: string) => dayMonth.format(new Date(iso))

export function dateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dayMonthTime.format(d)
}

/** « à 12 km de Saint-Nazaire », « sur place à Paris ». */
export function distanceLabel(km: number, center: string | undefined): string {
  if (!center || !Number.isFinite(km)) return 'distance inconnue'
  if (km < 3) return `sur place à ${center}`
  return `à ${km} km de ${center}`
}

/** « 2023 », ou « année ? » quand l'annonce ne la donne pas. */
export const yearLabel = (year: number) => (year > 0 ? String(year) : 'année ?')

export function discountPct(price: number, newPrice?: number): number | null {
  if (!newPrice || newPrice <= price) return null
  return Math.round((1 - price / newPrice) * 100)
}
