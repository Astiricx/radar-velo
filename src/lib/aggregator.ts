import { MOCK_LISTINGS } from '../data/mockListings'
import { SOURCE_LIST, type SourceMeta } from '../data/sources'
import type { Listing } from '../types'

/** Nombre de vagues d'annonces prévues dans les données de démonstration. */
export const LAST_BATCH = Math.max(...MOCK_LISTINGS.map((l) => l.batch))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Annonces déjà remontées par les recherches précédentes. */
export function listingsUpTo(batch: number): Listing[] {
  return MOCK_LISTINGS.filter((l) => l.batch <= batch)
}

/**
 * Simule un passage sur chaque plateforme et renvoie les annonces de la vague demandée.
 *
 * Pour brancher de vraies données, c'est la fonction à remplacer : elle doit renvoyer
 * des objets `Listing`. Un navigateur ne peut pas lire Leboncoin directement (CORS et
 * protection anti-robots) : il faut un petit serveur, ou un fichier JSON produit par
 * un script, que cette fonction irait chercher avec fetch().
 */
export async function runSearch(batch: number, onProgress: (source: SourceMeta) => void): Promise<Listing[]> {
  const found: Listing[] = []
  for (const source of SOURCE_LIST) {
    onProgress(source)
    await wait(550)
    found.push(...MOCK_LISTINGS.filter((l) => l.batch === batch && l.source === source.id))
  }
  return found
}
