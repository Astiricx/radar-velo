/**
 * Canyon (vente directe de la marque) : toute la gamme aéro Aeroad au prix du jour, et les
 * vélos de route de l'Outlet (fins de série, promotions, reconditionnés par Canyon).
 *
 * Lecture directe depuis GitHub, sans Apify. Chaque vignette de liste donne le nom, le prix,
 * le prix barré et souvent les seules tailles restantes (« Disponible uniquement en XL ») :
 * ces vélos sont triés sans ouvrir leur fiche. Les autres sont ouverts (au plus `maxPages`)
 * pour lire, dans le JSON-LD de la fiche, le stock taille par taille et la taille de
 * cycliste conseillée pour chacune.
 */
import { DEFAULT_CRITERIA, DEFAULT_NEW_BIKES } from '../../src/lib/criteria'
import { isAeroText } from '../apify/parse'
import { NEUF } from './config'
import { attr, blocks, euros, getPage, pause, productGroup, textByClass } from './html'
import type { NewBike, RetailerResult } from './types'
import { normalizeSize, pickSize, riderRange, type SizeOffer } from './sizes'

const BASE = 'https://www.canyon.com'

/** Vélos de route en promotion (96 par page) et gamme Aeroad (vélos aéro). */
export const CANYON_LISTS = [`${BASE}/fr-fr/promo-velos/route/?sz=96`, `${BASE}/fr-fr/promo-velos/route/?start=96&sz=96`, `${BASE}/fr-fr/velos-de-route/velos-aero/aeroad/`]

/** Modèles hors sujet : cadres seuls, gravel, cyclo-cross, contre-la-montre, vélos électriques. */
const OFF_TOPIC = /frame|kit cadre|grail|inflite|speedmax|pathlite|roadlite|commuter|precede|young hero|:on\b|\bon:/i

export interface CanyonTile {
  id: string
  name: string
  url: string
  price: number
  originalPrice?: number
  image?: string
  highlights: string
  /** « Disponible uniquement en S | M » : les seules tailles restantes. */
  onlySizes?: string[]
  /** Vélo reconditionné par Canyon, dans une seule taille. */
  refurbishedSize?: string
  outlet: boolean
}

/** Lit les vignettes d'une page de liste Canyon. */
export function parseCanyonList(html: string): CanyonTile[] {
  const tiles: CanyonTile[] = []
  for (const tile of blocks(html, /<div role="group"[^>]*data-pid="/)) {
    const gtm = attr(tile.slice(0, 4000), 'data-gtm-impression')
    let item: Record<string, unknown> = {}
    try {
      item = (JSON.parse(gtm ?? '[]') as { ecommerce?: { items?: Record<string, unknown>[] } }[])[0]?.ecommerce?.items?.[0] ?? {}
    } catch {
      // Vignette sans données de suivi : on lit le HTML seul.
    }
    const linkTag = tile.match(/<a[^>]*js-productTileLink[^>]*>/)?.[0] ?? ''
    const href = attr(linkTag, 'href') ?? ''
    const label = attr(linkTag, 'aria-label') ?? ''
    const name = String(item.item_name ?? attr(linkTag, 'title') ?? '').trim()
    const url = new URL(href.split('?')[0] || '/', BASE).href
    if (!name || !/^https:\/\/www\.canyon\.com\/fr-fr\/.+\.html$/.test(url)) continue
    const price = euros(textByClass(tile, 'productTile__priceSale')) ?? (Number(item.gross_price) || null)
    if (!price) continue
    const only = label.match(/Disponible uniquement en ([^,]+)/i)?.[1]
    const refurbished = label.match(/V[ée]lo reconditionn[ée] en ([^,]+)/i)?.[1]
    tiles.push({
      id: String(url.match(/\/(\d+)\.html$/)?.[1] ?? item.item_id ?? name),
      name,
      url,
      price,
      originalPrice: euros(textByClass(tile, 'productTile__priceOriginal')) ?? undefined,
      image: tile.match(/https:\/\/dma\.canyon\.com\/image\/upload\/[^"'&\s]+/)?.[0],
      highlights: textByClass(tile, 'productTileDefault__info--highlights') ?? '',
      onlySizes: only ? only.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
      refurbishedSize: refurbished?.trim(),
      outlet: String(item.item_outlet_flag) === 'true' || /promo-velos/.test(url),
    })
  }
  return tiles
}

export interface CanyonProduct {
  name: string
  description: string
  image?: string
  offers: (SizeOffer & { price: number; isNew: boolean })[]
}

/** Lit le JSON-LD d'une fiche Canyon : une variante par couleur et par taille, avec stock et prix. */
export function parseCanyonProduct(html: string): CanyonProduct | null {
  const group = productGroup(html)
  if (!group) return null
  return { ...group, offers: group.offers.map((o) => ({ ...o, rider: riderRange(o.riderText) })) }
}

/** Prix « à partir de » ou prix d'une configuration : sans intérêt pour la veille. */
const inBudget = (price: number) => price >= NEUF.priceMin && price <= NEUF.priceMax

export async function fetchCanyon(): Promise<RetailerResult> {
  const notes: string[] = []
  const tiles = new Map<string, CanyonTile>()
  let pagesRead = 0
  for (const url of CANYON_LISTS) {
    try {
      const { html } = await getPage(url)
      pagesRead++
      for (const t of parseCanyonList(html)) if (!tiles.has(t.id)) tiles.set(t.id, t)
    } catch (error) {
      notes.push(`liste ${url} non lue (${(error as Error).message})`)
    }
    await pause(NEUF.delayMs)
  }
  if (pagesRead === 0) throw new Error(notes.join(' ; ') || 'aucune page lue')

  const bikes: NewBike[] = []
  let off = 0
  let budget = 0
  const toOpen: CanyonTile[] = []
  for (const t of tiles.values()) {
    if (OFF_TOPIC.test(t.name) || /velos-(gravel|cyclo-cross|electriques|triathlon)/.test(t.url)) {
      off++
      continue
    }
    if (!inBudget(t.price)) {
      budget++
      continue
    }
    const base = {
      source: 'canyon' as const,
      id: `cy-${t.id}`,
      url: t.url,
      title: `Canyon ${t.name}`,
      description: t.highlights,
      price: t.price,
      originalPrice: t.originalPrice && t.originalPrice > t.price ? t.originalPrice : undefined,
      images: t.image ? [t.image] : [],
      seller: 'Canyon',
      attributes: { pratique: 'route' } as Record<string, string>,
    }
    if (t.refurbishedSize) {
      // Reconditionné par Canyon : une seule taille, vendu comme occasion révisée et garantie.
      const pick = pickSize([{ label: t.refurbishedSize, inStock: true }])!
      bikes.push({ ...base, market: 'occasion', size: pick.size, sizesInStock: pick.inStock, toVerify: pick.doubts, attributes: { ...base.attributes, etat: 'Très bon état' } })
      continue
    }
    if (t.onlySizes) {
      // Tailles restantes connues : pas besoin d'ouvrir la fiche.
      const pick = pickSize(t.onlySizes.map((label) => ({ label, inStock: true })))!
      bikes.push({ ...base, market: 'neuf', size: pick.size, sizesInStock: pick.inStock, toVerify: pick.doubts })
      continue
    }
    // Fiche ouverte seulement si le modèle peut convenir : aéro, quand c'est exigé pour le neuf.
    if ({ ...DEFAULT_NEW_BIKES, ...DEFAULT_CRITERIA.newBikes }.aeroRequired && !isAeroText(t.name)) {
      off++
      continue
    }
    toOpen.push(t)
  }

  // Au-delà du plafond, on ouvre chaque jour une autre partie de la liste (rotation).
  const day = Math.floor(Date.now() / 86_400_000)
  const start = toOpen.length > NEUF.maxProductPages ? (day * NEUF.maxProductPages) % toOpen.length : 0
  const batch = [...toOpen.slice(start), ...toOpen.slice(0, start)].slice(0, NEUF.maxProductPages)
  let opened = 0
  for (const t of batch) {
    try {
      const { html } = await getPage(t.url)
      opened++
      const product = parseCanyonProduct(html)
      if (!product || product.offers.length === 0) continue
      const pick = pickSize(product.offers.map((o) => ({ ...o, label: normalizeSize(o.label) })))
      if (!pick) continue // épuisé dans toutes les tailles
      const sizeOffer = product.offers.filter((o) => o.inStock && o.label === pick.size).sort((a, b) => a.price - b.price)[0]
      const price = sizeOffer?.price ?? t.price
      bikes.push({
        source: 'canyon',
        id: `cy-${t.id}`,
        url: t.url,
        title: `Canyon ${product.name || t.name}`,
        description: [product.description, t.highlights, pick.rider ? `Taille ${pick.size} conseillée par Canyon de ${pick.rider[0]} à ${pick.rider[1]} cm.` : '']
          .filter(Boolean)
          .join('\n\n'),
        price: Math.round(price),
        originalPrice: t.originalPrice && t.originalPrice > price ? t.originalPrice : undefined,
        images: [t.image, product.image].filter((s): s is string => !!s),
        seller: 'Canyon',
        market: sizeOffer && !sizeOffer.isNew ? 'occasion' : 'neuf',
        size: pick.size,
        sizesInStock: pick.inStock,
        toVerify: pick.doubts,
        attributes: { pratique: 'route' },
      })
    } catch (error) {
      notes.push(`fiche ${t.url} non lue (${(error as Error).message})`)
    }
    await pause(NEUF.delayMs)
  }
  const left = Math.max(0, toOpen.length - NEUF.maxProductPages)
  notes.unshift(
    `${tiles.size} vélos sur ${pagesRead} page${pagesRead > 1 ? 's' : ''} de liste, ${off} hors sujet (gravel, cadre seul, neuf non aéro…), ${budget} hors budget, ` +
      `${opened} fiche${opened > 1 ? 's' : ''} ouverte${opened > 1 ? 's' : ''} pour le stock par taille${left ? `, ${left} lue${left > 1 ? 's' : ''} les jours suivants` : ''}`,
  )
  return { bikes, notes }
}
