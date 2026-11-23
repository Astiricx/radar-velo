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
  buycycle: { id: 'buycycle', label: 'buycycle', badge: 'bg-[#334155] text-white' },
  decathlon: { id: 'decathlon', label: 'Decathlon Occasion', badge: 'bg-[#1d4ed8] text-white' },
  // Magasins et marques : vélos neufs (et reconditionnés Canyon).
  canyon: { id: 'canyon', label: 'Canyon', badge: 'bg-[#111827] text-white' },
  alltricks: { id: 'alltricks', label: 'Alltricks', badge: 'bg-[#b91c1c] text-white' },
  rose: { id: 'rose', label: 'Rose', badge: 'bg-[#9d174d] text-white' },
  'materiel-velo': { id: 'materiel-velo', label: 'Materiel-velo.com', badge: 'bg-[#0e7490] text-white' },
  velobrival: { id: 'velobrival', label: 'Vélo Brival', badge: 'bg-[#6d28d9] text-white' },
}

export const SOURCE_LIST = Object.values(SOURCES)
