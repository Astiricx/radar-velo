/**
 * Materiel-velo.com (magasin en ligne français, Gleizé, Rhône) : tout son catalogue de vélos
 * de route neufs, environ 360 vélos sur 6 pages, toutes marques (BMC, Scott, Ridley, Focus,
 * Bianchi, Orbea…), au prix du jour, remisé ou non.
 *
 * La liste donne le nom (marque, modèle, groupe, année), le prix et le prix barré. On garde les
 * vélos à groupe Shimano Di2 ou Ultegra, dans le budget (marge du neuf comprise) et, si le cadre
 * aéro est exigé, dont le modèle est aéro. Leur fiche est ouverte pour lire, dans le JSON-LD,
 * le stock taille par taille et le type de freins.
 */
import { DEFAULT_CRITERIA, DEFAULT_NEW_BIKES } from '../../src/lib/criteria'
import { isAeroText } from '../apify/parse'
import { NEUF } from './config'
import { attr, blocks, decode, euros, getPage, jsonLd, pause, productGroup, textByClass } from './html'
import { normalizeSize, pickSize } from './sizes'
import type { NewBike, RetailerResult } from './types'

const BASE = 'https://www.materiel-velo.com'
export const MV_LIST = `${BASE}/c110503-velo-de-route.html`

export interface MvItem {
  id: string
  name: string
  url: string
  price: number
  originalPrice?: number
  image?: string
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Page de liste : le site répond tantôt en JSON (liste « products » de PrestaShop), tantôt
 * en HTML avec une liste JSON-LD. Les deux sont lus.
 */
export function parseMvList(body: string): { items: MvItem[]; pages: number | null } {
  const trimmed = body.trimStart()
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as { products?: Obj[]; pagination?: { pages_count?: number } }
    const items = (data.products ?? []).flatMap((p): MvItem[] => {
      const url = String(p.canonical_url ?? p.link ?? '').split('#')[0]
      const price = Number(p.price_amount)
      const regular = Number(p.regular_price_amount)
      const cover = isObj(p.cover) ? (p.cover as { large?: { url?: string }; bySize?: Record<string, { url?: string }> }) : undefined
      if (!url || !Number.isFinite(price) || price <= 0) return []
      return [
        {
          id: String(p.id_product ?? url.match(/\/(?:gb\/)?(\d+)-/)?.[1]),
          name: decode(String(p.name ?? '')),
          url,
          price: Math.round(price),
          originalPrice: Number.isFinite(regular) && regular > price + 1 ? Math.round(regular) : undefined,
          image: cover?.large?.url ?? cover?.bySize?.large_default?.url,
        },
      ]
    })
    return { items, pages: data.pagination?.pages_count ?? null }
  }
  const list = jsonLd(body).find((d) => isObj(d) && d['@type'] === 'CollectionPage') as Obj | undefined
  const elements = ((list?.mainEntity as Obj | undefined)?.itemListElement ?? []) as Obj[]
  const pages = Math.max(0, ...[...body.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1])))
  // Sans liste JSON-LD : les vignettes HTML de PrestaShop.
  if (elements.length === 0) {
    const items = blocks(body, /<article[^>]*js-product-miniature/).flatMap((tile): MvItem[] => {
      const id = attr(tile.slice(0, 400), 'data-id-product')
      const url = tile.match(/c-pdt-mini__heading">\s*<a href="([^"]+)"/)?.[1]
      const price = euros(textByClass(tile, 'c-price--current') ?? textByClass(tile, 'c-price--discount'))
      if (!id || !url || !price) return []
      const old = euros(textByClass(tile, 'c-price--old'))
      return [
        {
          id,
          name: textByClass(tile, 'c-pdt-mini__name') ?? '',
          url: decode(url),
          price,
          originalPrice: old && old > price ? old : undefined,
          image: tile.match(/<img src="(https:\/\/www\.materiel-velo\.com\/[^"]+)"/)?.[1],
        },
      ]
    })
    return { items, pages: pages || null }
  }
  const items = elements.flatMap((e): MvItem[] => {
    const p = (e.item ?? e) as Obj
    const offer = (p.offers ?? {}) as Obj
    const url = String(p.url ?? '')
    const price = Number(offer.price)
    if (!url || !price) return []
    return [{ id: url.match(/\/(?:gb\/)?(\d+)-/)?.[1] ?? url, name: decode(String(p.name ?? '')), url, price: Math.round(price), image: typeof p.image === 'string' ? p.image : undefined }]
  })
  return { items, pages: pages || null }
}

/** Vélos de route Shimano Di2 ou Ultegra, sans SRAM, gravel ni électrique. */
const GROUP = /di2|ultegra|dura[\s-]?ace/i
const OFF = /sram|campagnolo|\bgrx\b|gravel|e-?bike|électrique|electrique|cadre seul|kit cadre|frameset/i

export async function fetchMaterielVelo(): Promise<RetailerResult> {
  const notes: string[] = []
  const all = new Map<string, MvItem>()
  let pages = 1
  let read = 0
  for (let page = 1; page <= Math.min(pages, NEUF.mvMaxPages); page++) {
    try {
      // Demande « AJAX » de PrestaShop : la liste revient en JSON, avec prix barré et nombre de pages.
      const { html } = await getPage(`${MV_LIST}?page=${page}&from-xhr`, { Accept: 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' })
      const { items, pages: count } = parseMvList(html)
      read++
      if (count) pages = count
      for (const it of items) all.set(it.id, it)
      if (items.length === 0) break
    } catch (error) {
      notes.push(`page ${page} non lue (${(error as Error).message})`)
      if (page === 1) throw new Error(notes.join(' ; '))
    }
    await pause(NEUF.delayMs)
  }

  const aeroRequired = { ...DEFAULT_NEW_BIKES, ...DEFAULT_CRITERIA.newBikes }.aeroRequired
  const items = [...all.values()]
  const group = items.filter((i) => GROUP.test(i.name) && !OFF.test(i.name))
  const budget = group.filter((i) => i.price >= NEUF.priceMin && i.price <= NEUF.priceMax)
  const candidates = budget.filter((i) => !aeroRequired || isAeroText(i.name))
  // Le plus prometteur d'abord : remisé, puis le moins cher.
  candidates.sort((a, b) => Number(!!b.originalPrice) - Number(!!a.originalPrice) || a.price - b.price)

  const bikes: NewBike[] = []
  let opened = 0
  // Au-delà du plafond de fiches, on en ouvre chaque jour une autre partie (rotation).
  const day = Math.floor(Date.now() / 86_400_000)
  const start = candidates.length > NEUF.maxProductPages ? (day * NEUF.maxProductPages) % candidates.length : 0
  const batch = [...candidates.slice(start), ...candidates.slice(0, start)].slice(0, NEUF.maxProductPages)
  for (const it of batch) {
    try {
      const product = productGroup((await getPage(it.url)).html)
      opened++
      if (!product || product.offers.length === 0) continue
      const pick = pickSize(product.offers.map((o) => ({ ...o, label: normalizeSize(o.label) })))
      if (!pick) continue // épuisé
      const brakes = product.offers.flatMap((o) => Object.entries(o.props).filter(([k]) => /frein|brak/.test(k)).map(([, v]) => v)).find(Boolean) ?? ''
      bikes.push({
        source: 'materiel-velo',
        id: `mv-${it.id}`,
        url: it.url,
        title: it.name.replace(/^V[ée]lo (?:de )?route\s+/i, ''),
        description: product.description,
        price: it.price,
        originalPrice: it.originalPrice,
        // Le site refuse l'affichage de ses photos sur d'autres sites : relais d'images public en secours.
        images: [it.image, ...(it.image ? [`https://images.weserv.nl/?url=${encodeURIComponent(it.image.replace(/^https?:\/\//, ''))}&w=800`] : [])],
        seller: 'Materiel-velo.com',
        market: 'neuf',
        size: pick.size,
        sizesInStock: pick.inStock,
        toVerify: pick.doubts,
        attributes: {
          pratique: 'route',
          ...(brakes ? { 'type de freinage': /disc|disque/i.test(brakes) ? 'disque' : 'patins' } : {}),
        },
      })
    } catch (error) {
      notes.push(`fiche ${it.url} non lue (${(error as Error).message})`)
    }
    await pause(NEUF.delayMs)
  }
  notes.unshift(
    `${items.length} vélos de route sur ${read} page${read > 1 ? 's' : ''}, ${group.length} en Shimano Di2 ou Ultegra, ${budget.length} dans le budget` +
      `${aeroRequired ? `, ${candidates.length} au cadre aéro` : ''}, ${opened} fiche${opened > 1 ? 's' : ''} ouverte${opened > 1 ? 's' : ''} pour le stock par taille`,
  )
  return { bikes, notes }
}
