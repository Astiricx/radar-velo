import type { Market, SourceId } from '../../src/types'

/** Vélo lu chez un magasin ou une marque, avant analyse (voir toListing dans scripts/apify/parse.ts). */
export interface NewBike {
  source: SourceId
  id: string
  /** Fiche produit du magasin (jamais une page de liste). */
  url: string
  title: string
  description: string
  price: number
  /** Prix barré affiché par le magasin. */
  originalPrice?: number
  images: string[]
  /** Nom du vendeur affiché : « Canyon », « Alltricks »… */
  seller: string
  market: Market
  /** Taille retenue (une taille de tes critères en stock, sinon les tailles en stock). */
  size: string
  sizesInStock: string[]
  attributes: Record<string, string>
  toVerify?: string[]
}

export interface RetailerResult {
  bikes: NewBike[]
  /** Ce qui a été lu, pour le journal. */
  notes: string[]
}
