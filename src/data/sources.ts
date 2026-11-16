import type { SourceId } from '../types'

export interface SourceMeta {
  id: SourceId
  label: string
  /** Couleurs du badge : fond et texte, assez contrastés dans les deux thèmes. */
  badge: string
}

/**
 * Plateformes suivies. L'application n'ouvre jamais de page de recherche : seulement
 * le lien direct d'une annonce (voir lib/links.ts).
 */
export const SOURCES: Record<SourceId, SourceMeta> = {
  leboncoin: { id: 'leboncoin', label: 'Leboncoin', badge: 'bg-[#c2410c] text-white' },
  'troc-velo': { id: 'troc-velo', label: 'Troc-Vélo', badge: 'bg-[#15803d] text-white' },
  decathlon: { id: 'decathlon', label: 'Decathlon Occasion', badge: 'bg-[#1d4ed8] text-white' },
}

export const SOURCE_LIST = Object.values(SOURCES)
