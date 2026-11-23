/**
 * Réglages de la veille du neuf (promotions, déstockages). Lecture directe des sites depuis
 * GitHub : gratuit, sans Apify. Chaque valeur se règle par une variable du dépôt GitHub.
 */
import { DEFAULT_CRITERIA } from '../../src/lib/criteria'

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return value && value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : fallback
}
const on = (value: string | undefined) => (value ?? 'true').trim().toLowerCase() !== 'false'

export const NEUF = {
  /** NEUF_ENABLED=false coupe toute la veille du neuf. */
  enabled: on(process.env.NEUF_ENABLED),
  canyon: on(process.env.CANYON_ENABLED),
  alltricks: on(process.env.ALLTRICKS_ENABLED),
  rose: on(process.env.ROSE_ENABLED),
  /** Fiches produit ouvertes au plus par magasin et par jour (stock par taille). */
  maxProductPages: Math.max(0, Math.round(num(process.env.NEUF_MAX_PRODUCT_PAGES, 12))),
  /** Pause entre deux pages d'un même site, en millisecondes : on reste discret. */
  delayMs: Math.round(num(process.env.NEUF_DELAY_MS, 1200)),
  /** En dessous, ce n'est pas un vélo carbone à groupe électronique ou Ultegra. */
  priceMin: num(process.env.NEUF_PRICE_MIN, 1500),
  priceMax: DEFAULT_CRITERIA.budgetMax,
}
