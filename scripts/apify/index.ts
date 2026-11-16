/**
 * Collecte des vraies annonces sur Apify, en respectant le budget du plan gratuit.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { plural } from '../../src/lib/format'
import type { Listing } from '../../src/types'
import { apifyRunner, monthlyUsage, type ActorRunner } from './client'
import { APIFY, DECATHLON, LEBONCOIN, TROCVELO } from './config'
import { fetchDecathlon } from './decathlon'
import { directRunner } from './direct'
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

  // Troc-Vélo et Decathlon : lecture directe depuis GitHub (gratuite), puis Cheerio Scraper d'Apify si le site bloque.
  const scrapers = [
    { label: 'Troc-Vélo', enabled: TROCVELO.enabled, fetch: fetchTrocVelo, page: TROCVELO.startUrl, variable: 'TROCVELO_SEARCH_URL' },
    { label: 'Decathlon Occasion', enabled: DECATHLON.enabled, fetch: fetchDecathlon, page: DECATHLON.startUrls[0], variable: null },
  ]
  for (const s of scrapers) {
    if (!s.enabled) continue
    const attempts: { how: string; runner: ActorRunner }[] = fixtures
      ? [{ how: 'exemples', runner: run }]
      : [{ how: 'lecture directe', runner: directRunner() }, ...(APIFY.token ? [{ how: 'Cheerio Scraper d’Apify', runner: run }] : [])]
    const failures: string[] = []
    for (const { how, runner } of attempts) {
      try {
        const { ads, skipped, listed, pages } = await s.fetch(runner)
        for (const p of pages) {
          console.log(`    ${s.label} ${p.url} : « ${p.pageTitle ?? '?'} », ${p.size ?? '?'} caractères, ${p.found} annonces, ${p.kept} retenues`)
          for (const sample of p.samples ?? []) console.log(`      ${sample}`)
        }
        if (listed === null) throw new Error(`page de liste non lue (bloquée ou injoignable) : ${s.page}`)
        if (listed === 0 && ads.length === 0) {
          const title = pages[0]?.pageTitle ? ` (titre de la page : « ${pages[0].pageTitle} »)` : ''
          throw new Error(`aucune annonce trouvée sur ${s.page}${title}`)
        }
        listings.push(...ads.map((ad) => toListing(ad, today)))
        notes.push(
          `${s.label} (${how}) : ${plural(listed ?? ads.length, 'annonce sur la liste', 'annonces sur la liste')}, ` +
            `${plural(ads.length, 'prometteuse ouverte', 'prometteuses ouvertes')}${skipped ? `, ${plural(skipped, 'page illisible', 'pages illisibles')}` : ''}.`,
        )
        failures.length = 0
        break
      } catch (error) {
        failures.push(`${how} : ${(error as Error).message.replace(/[.\s]+$/, '')}`)
      }
    }
    if (failures.length > 0) {
      const empty = failures.some((f) => f.includes('aucune annonce trouvée'))
      const hint = s.variable && empty ? ` Si la page a changé, indique la bonne adresse dans la variable ${s.variable} du dépôt.` : ''
      warnings.push(`${s.label} non lu. ${failures.join(' ; ')}.${hint}`)
    }
  }

  return { listings, notes }
}
