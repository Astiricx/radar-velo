/**
 * Liens d'annonces.
 *
 * Le bouton « Voir l'annonce » ne doit ouvrir que la page d'une annonce précise,
 * jamais une recherche ou une catégorie. Ce module décide si un lien est direct.
 */

/** Pages qui listent plusieurs annonces : recherche, catégorie, résultats filtrés. */
const LIST_PAGES = [
  /\/recherche(\/|\?|$)/i,
  /\/search(\/|\?|$)/i,
  /\/categorie\//i,
  /^https?:\/\/(www\.)?leboncoin\.fr\/(c|ck|cl)\//i,
  /[?&](text|q|Ntt|query)=/i,
]

/** Formes connues d'une page d'annonce, par plateforme. */
const AD_PAGES: Record<string, RegExp> = {
  'leboncoin.fr': /^\/(ad\/[^/]+\/\d+|vi\/\d+|[a-z_]+\/\d+\.htm)/i,
  'troc-velo.com': /\/annonce\/.+-\d+\/?$/i,
}

/** Vrai si `url` ouvre une annonce précise. */
export function isDirectAdUrl(url: string | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (LIST_PAGES.some((re) => re.test(url))) return false
  const host = parsed.hostname.replace(/^www\./, '')
  const pattern = Object.entries(AD_PAGES).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1]
  // Plateforme connue : le chemin doit avoir la forme d'une annonce. Autre site : on fait confiance.
  return pattern ? pattern.test(parsed.pathname) : parsed.pathname.length > 1
}

/** Lien direct de l'annonce, ou null s'il n'y en a pas (annonce de démonstration, lien de recherche). */
export const directUrl = (listing: { url: string; demo?: boolean }): string | null =>
  !listing.demo && isDirectAdUrl(listing.url) ? listing.url : null
