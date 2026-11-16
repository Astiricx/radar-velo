/**
 * Collecte des vraies annonces sur Apify, en respectant le budget du plan gratuit.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { plural } from '../../src/lib/format'
import type { Listing } from '../../src/types'
import { apifyRunner, monthlyUsage, type ActorRunner } from './client'
import { APIFY, LEBONCOIN, TROCVELO } from './config'
import { fetchLeboncoin } from './leboncoin'
import { toListing } from './parse'
import { fetchTrocVelo } from './trocvelo'

export interface Collected {
  listings: Listing[]
  /** Phrases pour le journal : ce qui a été lu, sur quelle plateforme. */
  notes: string[]
}

/**
 * Pour les tests : APIFY_FIXTURES=dossier lit `<dossier>/<acteur>.json`
 * (par exemple memo23~leboncoin-scraper.json) au lieu d'appeler Apify.
 */
function fixtureRunner(dir: string): ActorRunner {
  return async (actor) => {
    const file = resolve(dir, `${actor.replace('/', '~')}.json`)
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[]) : []
  }
}

const usd = (n: number) => `${n.toFixed(2).replace('.', ',')} $`

export async function collectFromApify(today: string, warnings: string[]): Promise<Collected> {
  const notes: string[] = []
  const listings: Listing[] = []
  const fixtures = process.env.APIFY_FIXTURES

  if (!APIFY.token && !fixtures) {
    notes.push('Collecte Apify désactivée : le secret APIFY_TOKEN n’est pas renseigné.')
    return { listings, notes }
  }
  const run = fixtures ? fixtureRunner(fixtures) : apifyRunner(APIFY.token)

  // Garde-fou : on ne lance rien si le crédit du mois est presque consommé.
  if (!fixtures) {
    try {
      const { usedUsd, limitUsd } = await monthlyUsage(APIFY.token)
      if (usedUsd >= APIFY.budgetUsd) {
        warnings.push(
          `Collecte Apify sautée : ${usd(usedUsd)} déjà consommés ce mois-ci, pour un plafond fixé à ${usd(APIFY.budgetUsd)} (crédit du compte : ${usd(limitUsd)}).`,
        )
        return { listings, notes }
      }
      notes.push(`Crédit Apify consommé ce mois-ci avant la collecte : ${usd(usedUsd)} sur ${usd(limitUsd)}.`)
    } catch (error) {
      warnings.push(`Consommation Apify inconnue (${(error as Error).message}) ; collecte lancée quand même, avec ses plafonds.`)
    }
  }

  if (LEBONCOIN.enabled) {
    try {
      const { ads, skipped } = await fetchLeboncoin(run)
      listings.push(...ads.map((ad) => toListing(ad, today)))
      notes.push(
        `Leboncoin : ${plural(ads.length, 'annonce lue', 'annonces lues')} autour de Paris et de Saint-Nazaire (${LEBONCOIN.maxItemsPerSearch} au plus par zone)` +
          `${skipped ? `, ${plural(skipped, 'ligne ignorée', 'lignes ignorées')} (pas une annonce exploitable)` : ''}.`,
      )
    } catch (error) {
      warnings.push(`Leboncoin : ${(error as Error).message}`)
    }
  }

  if (TROCVELO.enabled) {
    try {
      const { ads, skipped, listed } = await fetchTrocVelo(run)
      listings.push(...ads.map((ad) => toListing(ad, today)))
      notes.push(`Troc-Vélo : ${plural(ads.length, 'annonce lue', 'annonces lues')}${skipped ? `, ${plural(skipped, 'page illisible', 'pages illisibles')}` : ''}.`)
      if (listed === 0) {
        warnings.push(
          `Troc-Vélo : aucune annonce trouvée sur ${TROCVELO.startUrl}. Si la page a changé, indique la bonne adresse dans la variable TROCVELO_SEARCH_URL du dépôt.`,
        )
      }
    } catch (error) {
      warnings.push(`Troc-Vélo : ${(error as Error).message}`)
    }
  }

  return { listings, notes }
}
