import type { SourceId } from '../types'

export interface SourceMeta {
  id: SourceId
  label: string
  /** Page de recherche de la plateforme pour un modèle donné. */
  searchUrl: (query: string) => string
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  leboncoin: {
    id: 'leboncoin',
    label: 'Leboncoin',
    searchUrl: (q) => `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(q)}`,
  },
  'troc-velo': {
    id: 'troc-velo',
    label: 'Troc-Vélo',
    searchUrl: () => 'https://www.troc-velo.com/fr-fr/categorie/velos-complets/route',
  },
  decathlon: {
    id: 'decathlon',
    label: 'Decathlon Occasion',
    searchUrl: (q) => `https://www.decathlon.fr/search?Ntt=${encodeURIComponent(`${q} occasion`)}`,
  },
}

export const SOURCE_LIST = Object.values(SOURCES)
