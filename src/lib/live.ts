import { useCallback, useEffect, useState } from 'react'
import type { Listing } from '../types'
import { isDirectAdUrl } from './links'

/** Fichier produit par la veille quotidienne (scripts/daily-check.ts), publié avec le site. */
const LISTINGS_URL = `${import.meta.env?.BASE_URL ?? '/'}data/listings.json`

export interface LiveData {
  status: 'loading' | 'ready' | 'error'
  /** Annonces réelles retenues par la veille, avec lien direct. */
  listings: Listing[]
  /** Date (AAAA-MM-JJ) de la dernière veille. */
  updatedAt: string | null
}

const SOURCES = new Set(['leboncoin', 'troc-velo', 'buycycle', 'decathlon', 'canyon', 'alltricks', 'rose', 'materiel-velo', 'velobrival'])

/** Garde les entrées complètes : un fichier abîmé ne doit pas casser l'application. */
function isListing(x: unknown): x is Listing {
  const l = x as Partial<Listing> | null
  return (
    !!l &&
    typeof l.id === 'string' &&
    typeof l.url === 'string' &&
    typeof l.title === 'string' &&
    typeof l.price === 'number' &&
    typeof l.size === 'string' &&
    typeof l.groupset === 'string' &&
    SOURCES.has(String(l.source)) &&
    // Seules les vraies annonces, ouvrables directement, sont affichées.
    isDirectAdUrl(l.url) &&
    !(l as { simulated?: boolean }).simulated
  )
}

/** Charge les vraies annonces trouvées par la veille quotidienne. */
export function useLiveListings() {
  const [data, setData] = useState<LiveData>({ status: 'loading', listings: [], updatedAt: null })

  const load = useCallback(async (): Promise<LiveData> => {
    try {
      const res = await fetch(LISTINGS_URL, { cache: 'no-cache' })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { updatedAt?: string; listings?: unknown[] }
      const listings = (json.listings ?? []).filter(isListing).map((l) => ({ ...l, batch: l.batch ?? 0, demo: false }))
      const next: LiveData = { status: 'ready', listings, updatedAt: json.updatedAt ?? null }
      setData(next)
      return next
    } catch {
      const next: LiveData = { status: 'error', listings: [], updatedAt: null }
      setData(next)
      return next
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return [data, load] as const
}
