/**
 * Vélo Brival (magasin à Brive-la-Gaillarde, revendeur Orbea, Cube, Trek, Lapierre…) : ses
 * vélos de route « course » et « aéro » neufs, lus par l'API publique de sa boutique
 * WooCommerce (JSON), au prix du jour, remisé ou non.
 *
 * La description technique donne le groupe et les freins ; le stock est vérifié pour chaque
 * taille de tes critères (une variante par taille et par couleur).
 */
import { DEFAULT_CRITERIA, DEFAULT_NEW_BIKES } from '../../src/lib/criteria'
import { isAeroText } from '../apify/parse'
import { NEUF } from './config'
import { decode, getPage, pause, textOf } from './html'
import { normalizeSize, pickSize, type SizeOffer } from './sizes'
import type { NewBike, RetailerResult } from './types'

const API = 'https://www.velobrival.com/wp-json/wc/store/v1/products'
export const VB_CATEGORIES = ['route-course', 'route-triathlon-aero']

interface StoreProduct {
  id: number
  name: string
  permalink: string
  description?: string
  short_description?: string
  prices: { price: string; regular_price: string; currency_minor_unit?: number }
  is_in_stock: boolean
  images?: { src: string }[]
  attributes?: { name: string; terms: { name: string }[] }[]
  variations?: { id: number; attributes: { name: string; value: string }[] }[]
}

const amount = (p: StoreProduct, key: 'price' | 'regular_price') => Math.round(Number(p.prices[key]) / 10 ** (p.prices.currency_minor_unit ?? 2))
const ACCEPTED = DEFAULT_CRITERIA.sizes.map((s) => normalizeSize(s))

export interface VbCandidate {
  product: StoreProduct
  text: string
  price: number
  originalPrice?: number
  /** Variantes dans une taille de tes critères : identifiant et taille. */
  sizeVariants: { id: number; label: string }[]
  allSizes: string[]
}

/** Tri des produits de la boutique : Shimano Di2 ou Ultegra, budget, aéro, taille proposée. */
export function vbCandidates(products: StoreProduct[]): { candidates: VbCandidate[]; counts: { group: number; budget: number; aero: number } } {
  const aeroRequired = { ...DEFAULT_NEW_BIKES, ...DEFAULT_CRITERIA.newBikes }.aeroRequired
  const counts = { group: 0, budget: 0, aero: 0 }
  const candidates: VbCandidate[] = []
  for (const p of products) {
    const text = textOf(decode(`${p.name}\n${p.short_description ?? ''}\n${p.description ?? ''}`))
    if (!/di2|ultegra|dura[\s-]?ace/i.test(text) || /\bsram\b|\baxs\b|campagnolo|\bgrx\b/i.test(text)) continue
    counts.group++
    const price = amount(p, 'price')
    if (!p.is_in_stock || price < NEUF.priceMin || price > NEUF.priceMax) continue
    counts.budget++
    // Le nom seul : la fiche technique cite souvent un « cintre aéro » sur des cadres qui ne le sont pas.
    if (aeroRequired && !isAeroText(p.name)) continue
    counts.aero++
    const regular = amount(p, 'regular_price')
    const sizeVariants = (p.variations ?? []).flatMap((v) => {
      const raw = v.attributes.find((a) => /taille/i.test(a.name))?.value ?? ''
      const label = normalizeSize(raw)
      return ACCEPTED.includes(label) ? [{ id: v.id, label }] : []
    })
    const allSizes = p.attributes?.find((a) => /taille/i.test(a.name))?.terms.map((t) => normalizeSize(t.name)) ?? []
    candidates.push({ product: p, text, price, originalPrice: regular > price ? regular : undefined, sizeVariants, allSizes })
  }
  return { candidates, counts }
}

export async function fetchVeloBrival(): Promise<RetailerResult> {
  const notes: string[] = []
  const products = new Map<number, StoreProduct>()
  for (const category of VB_CATEGORIES) {
    for (let page = 1; page <= 4; page++) {
      let list: StoreProduct[]
      try {
        list = JSON.parse((await getPage(`${API}?category=${category}&per_page=100&page=${page}`)).html) as StoreProduct[]
      } catch (error) {
        // Au-delà de la dernière page, la boutique répond par une erreur : fin de la liste.
        if (page > 1) break
        throw error
      }
      for (const p of list) products.set(p.id, p)
      await pause(NEUF.delayMs)
      if (list.length < 100) break
    }
  }
  const { candidates, counts } = vbCandidates([...products.values()])
  const bikes: NewBike[] = []
  let checks = 0
  for (const c of candidates) {
    // Stock de chaque taille de tes critères (variantes de couleur comprises), dans la limite du jour.
    const offers: SizeOffer[] = []
    for (const v of c.sizeVariants) {
      if (checks >= NEUF.maxProductPages * 3) break
      try {
        const variant = JSON.parse((await getPage(`${API}/${v.id}`)).html) as { is_in_stock?: boolean }
        checks++
        offers.push({ label: v.label, inStock: !!variant.is_in_stock })
      } catch {
        // Variante illisible : on passe à la suivante.
      }
      await pause(Math.round(NEUF.delayMs / 2))
    }
    const pick = pickSize(offers.length > 0 ? offers : c.allSizes.map((label) => ({ label, inStock: true })), offers.length > 0)
    if (!pick) continue // épuisé dans tes tailles : la fiche ne serait qu'une fausse piste
    const p = c.product
    bikes.push({
      source: 'velobrival',
      id: `vb-${p.id}`,
      url: p.permalink,
      title: p.name,
      description: c.text.slice(0, 1400),
      price: c.price,
      originalPrice: c.originalPrice,
      images: (p.images ?? []).map((i) => i.src).slice(0, 2),
      seller: 'Vélo Brival',
      market: 'neuf',
      size: pick.size,
      sizesInStock: pick.inStock,
      toVerify: [...pick.doubts, 'Livraison ou retrait au magasin de Brive à confirmer'],
      attributes: { pratique: 'route' },
    })
  }
  notes.unshift(
    `${products.size} vélos de route course et aéro, ${counts.group} en Shimano Di2 ou Ultegra, ${counts.budget} en stock dans le budget, ` +
      `${counts.aero} au cadre aéro, ${checks} vérifications de stock par taille`,
  )
  return { bikes, notes }
}
