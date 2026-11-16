import type { SourceId } from '../types'

export interface SourceMeta {
  id: SourceId
  label: string
}

/**
 * Plateformes suivies. L'application n'ouvre jamais de page de recherche : seulement
 * le lien direct d'une annonce (voir lib/links.ts).
 */
export const SOURCES: Record<SourceId, SourceMeta> = {
  leboncoin: { id: 'leboncoin', label: 'Leboncoin' },
  'troc-velo': { id: 'troc-velo', label: 'Troc-Vélo' },
  decathlon: { id: 'decathlon', label: 'Decathlon Occasion' },
}

export const SOURCE_LIST = Object.values(SOURCES)
