/**
 * Réglages de la veille du neuf (catalogue et promotions). Lecture directe des sites depuis
 * GitHub : gratuit, sans Apify. Chaque valeur se règle par une variable du dépôt GitHub.
 */
import { DEFAULT_CRITERIA, priceCap } from '../../src/lib/criteria'

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
  materielVelo: on(process.env.MATERIELVELO_ENABLED),
  veloBrival: on(process.env.VELOBRIVAL_ENABLED),
  /** Pages de 60 vélos lues sur Materiel-velo.com (le catalogue route en compte environ 6). */
  mvMaxPages: Math.max(1, Math.round(num(process.env.MATERIELVELO_MAX_PAGES, 8))),
  /** Fiches produit ouvertes au plus par magasin et par jour (stock par taille). */
  maxProductPages: Math.max(0, Math.round(num(process.env.NEUF_MAX_PRODUCT_PAGES, 15))),
  /** Pause entre deux pages d'un même site, en millisecondes : on reste discret. */
  delayMs: Math.round(num(process.env.NEUF_DELAY_MS, 1200)),
  /** En dessous, ce n'est pas un vélo carbone à groupe électronique ou Ultegra. */
  priceMin: num(process.env.NEUF_PRICE_MIN, 1500),
  /** Budget maximum, plus la marge acceptée pour un vélo neuf (10 % par défaut). */
  priceMax: priceCap({ market: 'neuf' }, DEFAULT_CRITERIA),
}
