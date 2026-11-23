/**
 * Rose (vente directe de la marque) : vélos en promotion et fins de série.
 *
 * La page « Vélos en promotion » donne le nom, le prix, le prix barré (« au lieu de ») et
 * la catégorie de chaque vélo. Pour les vélos de route dans le budget, la fiche est ouverte
 * pour lire la description (groupe, cadre, capteur) et les tailles proposées avec la taille
 * de cycliste conseillée. Rose n'affiche pas le stock par taille dans la page : il est noté
 * « à confirmer ».
 */
import { NEUF } from './config'
import { attr, blocks, decode, euros, getPage, jsonLd, pause, textByClass, textOf } from './html'
import { normalizeSize, pickSize, type SizeOffer } from './sizes'
import type { NewBike, RetailerResult } from './types'

const BASE = 'https://www.rosebikes.fr'
export const ROSE_LISTS = [`${BASE}/fr/promotions/cycles`]

export interface RoseTile {
  id: string
  name: string
  url: string
  price: number
  originalPrice?: number
  category: string
  image?: string
}

export function parseRoseList(html: string): RoseTile[] {
  const tiles: RoseTile[] = []
  for (const tile of blocks(html, /<a\s[^>]*class=['"]catalog-product-tile__link['"]/)) {
    const tag = tile.slice(0, tile.indexOf('>') + 1)
    const href = attr(tag, 'href') ?? ''
    let product: Record<string, string> = {}
    try {
      const push = (attr(tag, 'onclick') ?? '').match(/push\(([\s\S]*)\)\s*;?\s*$/)?.[1]
      product = (JSON.parse(push ?? '{}') as { ecommerce?: { click?: { products?: Record<string, string>[] } } }).ecommerce?.click?.products?.[0] ?? {}
    } catch {
      // Pas de données de suivi : nom et prix lus dans le HTML.
    }
    const name = (product.name ?? attr(tag, 'title') ?? '').trim()
    const id = href.match(/-(\d+)\/?$/)?.[1]
    const price = euros(textByClass(tile, 'product-tile-price__current-value')) ?? (Number(product.price) || null)
    if (!name || !id || !price || !href.startsWith('/fr/p/')) continue
    tiles.push({
      id,
      name,
      url: `${BASE}${href}`,
      price,
      originalPrice: euros(textByClass(tile, 'product-tile-price__old-value')) ?? undefined,
      category: product.category ?? '',
      // Adresse complète, avec ses paramètres de redimensionnement (sans eux, le CDN refuse l'image).
      image: decode(tile.match(/<img[^>]*src=['"](https:\/\/cdn\.rosebikes\.de\/images\/[^'"]+)/)?.[1] ?? '') || undefined,
    })
  }
  return tiles
}

/** Fiche Rose : description (JSON-LD) et tailles proposées avec la taille de cycliste conseillée. */
export function parseRoseProduct(html: string): { description: string; offers: SizeOffer[] } {
  const product = jsonLd(html).find((d) => (d as { '@type'?: string })?.['@type'] === 'Product') as { description?: string } | undefined
  const offers: SizeOffer[] = []
  for (const m of html.matchAll(/data-test="bike-step-value-size-([\w-]+)"[\s\S]*?Taille\s*:\s*(\d{3})\s*-\s*(\d{3})\s*cm/g)) {
    const label = normalizeSize(m[1])
    if (!offers.some((o) => o.label === label)) offers.push({ label, inStock: true, rider: [Number(m[2]), Number(m[3])] })
  }
  return { description: textOf(product?.description ?? '').replace(/Fabricant:.*$/s, '').trim(), offers }
}

export async function fetchRose(): Promise<RetailerResult> {
  const notes: string[] = []
  const tiles: RoseTile[] = []
  for (const url of ROSE_LISTS) {
    const { html } = await getPage(url)
    tiles.push(...parseRoseList(html))
    await pause(NEUF.delayMs)
  }
  // Vélos de route seulement (pas les gravel ni les vélos électriques), dans le budget.
  const road = tiles.filter((t) => /\/Route\//i.test(`/${t.category}/`) && !/gravel|e-?bike|electri/i.test(t.name))
  const candidates = road.filter((t) => t.price >= NEUF.priceMin && t.price <= NEUF.priceMax)
  const bikes: NewBike[] = []
  let opened = 0
  for (const t of candidates.slice(0, NEUF.maxProductPages)) {
    let description = ''
    let offers: SizeOffer[] = []
    try {
      const page = parseRoseProduct((await getPage(t.url)).html)
      opened++
      description = page.description
      offers = page.offers
    } catch (error) {
      notes.push(`fiche ${t.url} non lue (${(error as Error).message})`)
    }
    await pause(NEUF.delayMs)
    // Sans liste de tailles, on suppose la gamme habituelle de Rose (XS à XL).
    const pick = pickSize(offers.length > 0 ? offers : ['XS', 'S', 'M', 'L', 'XL'].map((label) => ({ label, inStock: true })), false)
    if (!pick) continue
    bikes.push({
      source: 'rose',
      id: `ro-${t.id}`,
      url: t.url,
      title: `Rose ${t.name}`,
      description: [description, pick.rider ? `Taille ${pick.size} conseillée par Rose de ${pick.rider[0]} à ${pick.rider[1]} cm.` : ''].filter(Boolean).join('\n\n'),
      price: t.price,
      originalPrice: t.originalPrice && t.originalPrice > t.price ? t.originalPrice : undefined,
      images: t.image ? [t.image] : [],
      seller: 'Rose',
      market: 'neuf',
      size: pick.size,
      sizesInStock: pick.inStock,
      toVerify: pick.doubts,
      attributes: { pratique: 'route' },
    })
  }
  notes.unshift(`${tiles.length} vélos en promotion, ${road.length} de route, ${candidates.length} dans le budget, ${opened} fiche${opened > 1 ? 's' : ''} ouverte${opened > 1 ? 's' : ''}`)
  return { bikes, notes }
}
