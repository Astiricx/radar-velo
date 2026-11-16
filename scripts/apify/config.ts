/**
 * Réglages de la collecte Apify, pensés pour le plan gratuit (5 $ de crédit par mois).
 *
 * Coût estimé par jour, avec les valeurs par défaut :
 *   - Leboncoin : 2 recherches × 30 annonces au plus, à 0,79 $ les 1 000 annonces
 *     (acteur memo23/leboncoin-scraper)            → 0,05 $ au plus, ~1,40 $ par mois ;
 *   - Troc-Vélo : 1 page de liste + 12 annonces au plus, et
 *   - Decathlon Occasion : 4 pages de liste + 12 annonces au plus, avec l'acteur
 *     gratuit apify/cheerio-scraper (temps de calcul seul) → ~0,02 $, ~0,60 $ par mois.
 * Soit environ 2 $ par mois au maximum. Un garde-fou arrête la collecte si la
 * consommation du mois atteint APIFY_BUDGET_USD.
 *
 * Toutes les valeurs se règlent sans toucher au code, par des variables du dépôt
 * GitHub (Settings › Secrets and variables › Actions › Variables).
 */
import { DEFAULT_CRITERIA } from '../../src/lib/criteria'

const text = (value: string | undefined, fallback: string) => (value && value.trim() !== '' ? value.trim() : fallback)
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return value && value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : fallback
}

export const APIFY = {
  /** Clé d'API, dans le secret GitHub APIFY_TOKEN. Sans clé, aucune collecte. */
  token: text(process.env.APIFY_TOKEN, ''),
  /** La collecte s'arrête si la consommation du mois atteint ce montant, en dollars. */
  budgetUsd: num(process.env.APIFY_BUDGET_USD, 4),
}

export const LEBONCOIN = {
  enabled: text(process.env.LEBONCOIN_ENABLED, 'true') !== 'false',
  /** Acteur payé à l'annonce, sans frais de plateforme, proxy résidentiel inclus. */
  actor: text(process.env.APIFY_LEBONCOIN_ACTOR, 'memo23/leboncoin-scraper'),
  /** Annonces lues au plus par recherche (une recherche par zone), les plus récentes d'abord. */
  maxItemsPerSearch: Math.max(1, Math.round(num(process.env.APIFY_MAX_ITEMS, 30))),
  /** Plafond de dépense d'une exécution, en dollars : Apify arrête l'acteur au-delà. */
  maxChargeUsd: num(process.env.APIFY_MAX_CHARGE_USD, 0.1),
}

export const TROCVELO = {
  enabled: text(process.env.TROCVELO_ENABLED, 'true') !== 'false',
  /** Scraper générique gratuit d'Apify : on ne paie que quelques secondes de calcul. */
  actor: 'apify/cheerio-scraper',
  /** Page de liste à lire. Pour la changer, copie l'adresse de Troc-Vélo après avoir posé tes filtres. */
  startUrl: text(process.env.TROCVELO_SEARCH_URL, 'https://www.troc-velo.com/fr-fr/categorie/velos-complets/route'),
  /** Annonces ouvertes au plus à chaque exécution. */
  maxListings: Math.max(1, Math.round(num(process.env.TROCVELO_MAX_ITEMS, 12))),
}

export const DECATHLON = {
  enabled: text(process.env.DECATHLON_ENABLED, 'true') !== 'false',
  actor: 'apify/cheerio-scraper',
  /** Vélos de route d'occasion vendus et expédiés via Decathlon (marketplace et Seconde Vie), 40 par page. */
  startUrls: [0, 40, 80, 120].map((from) => `https://www.decathlon.fr/occasion/velo-route-occasion?from=${from}&size=40`),
  maxListings: Math.max(1, Math.round(num(process.env.DECATHLON_MAX_ITEMS, 12))),
}

/**
 * Pré-filtre des pages de liste Troc-Vélo et Decathlon (texte sans accents, en minuscules) :
 * on n'ouvre que les annonces dont la vignette cite un groupe Shimano retenu.
 */
export const PREFILTER = 'di2|ultegra|dura.?ace|\\b105\\b'

/** Filtres posés directement dans la recherche Leboncoin, pour ne payer que des annonces utiles. */
export const SEARCH = {
  /** Vélos de route (filtre « Type de vélo : Course » de Leboncoin). */
  bicycleType: 'course',
  /** Taille de cadre M, qui couvre le 56. */
  bicycleSize: text(process.env.LEBONCOIN_SIZE, 'M'),
  /** En dessous, ce n'est presque jamais un vélo carbone Di2 en bon état. */
  priceMin: num(process.env.SEARCH_PRICE_MIN, 1500),
  priceMax: DEFAULT_CRITERIA.budgetMax,
}

/**
 * Zones des recherches Leboncoin. Les rayons sont plus serrés que ceux de l'application
 * (220 et 120 km) : élargir coûte plus de crédits pour des annonces souvent hors de portée.
 */
export const LEBONCOIN_ZONES = [
  { id: 'paris', city: 'Paris', zipcode: '75000', lat: 48.85661, lon: 2.35222, radiusKm: num(process.env.PARIS_RADIUS_KM, 60) },
  {
    id: 'saint-nazaire',
    city: 'Saint-Nazaire',
    zipcode: '44600',
    lat: 47.27346,
    lon: -2.21386,
    radiusKm: num(process.env.SAINT_NAZAIRE_RADIUS_KM, 60),
  },
]
