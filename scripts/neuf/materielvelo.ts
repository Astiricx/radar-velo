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
import { decode, getPage, jsonLd, pause, productGroup } from './html'
import { pickSize } from './sizes'
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
  const items = elements.flatMap((e): MvItem[] => {
    const p = (e.item ?? e) as Obj
    const offer = (p.offers ?? {}) as Obj
    const url = String(p.url ?? '')
    const price = Number(offer.price)
    if (!url || !price) return []
    return [{ id: url.match(/\/(?:gb\/)?(\d+)-/)?.[1] ?? url, name: decode(String(p.name ?? '')), url, price: Math.round(price), image: typeof p.image === 'string' ? p.image : undefined }]
  })
  const pages = Math.max(0, ...[...body.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1])))
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
      const { html } = await getPage(`${MV_LIST}?page=${page}`)
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
  for (const it of candidates.slice(0, NEUF.maxProductPages)) {
    try {
      const product = productGroup((await getPage(it.url)).html)
      opened++
      if (!product || product.offers.length === 0) continue
      const pick = pickSize(product.offers)
      if (!pick) continue // épuisé
      const brakes = product.offers.map((o) => o.props['braking type'] ?? o.props['type de freinage'] ?? '').find(Boolean) ?? ''
      bikes.push({
        source: 'materiel-velo',
        id: `mv-${it.id}`,
        url: it.url,
        title: it.name.replace(/^V[ée]lo (?:de )?route\s+/i, ''),
        description: product.description,
        price: it.price,
        originalPrice: it.originalPrice,
        images: [it.image, product.image].filter((s): s is string => !!s),
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
