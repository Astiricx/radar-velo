/**
 * Collecte des vraies annonces sur Apify, en respectant le budget du plan gratuit.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { plural } from '../../src/lib/format'
import type { Listing } from '../../src/types'
import { apifyRunner, lastRunLog, monthlyUsage, type ActorRunner } from './client'
import { APIFY, DECATHLON, LEBONCOIN, PROXY, TROCVELO, TROCVELO_PROXY } from './config'
import { fetchDecathlon } from './decathlon'
import { directRunner } from './direct'
import { fetchLeboncoin } from './leboncoin'
import { toListing } from './parse'
import { Geocoder } from '../geo'
import { APPROXIMATE_PLACE, fetchTrocVelo } from './trocvelo'

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

/** VEILLE_DEBUG=true : extraits bruts des fiches et décision prise pour chaque vignette. */
const DEBUG = (process.env.VEILLE_DEBUG ?? 'false').toLowerCase() === 'true'

const usd = (n: number) => `${n.toFixed(2).replace('.', ',')} $`

/**
 * @param seenIds identifiants déjà analysés (« tv-123 »…) : leurs fiches ne sont pas rouvertes.
 */
export async function collectFromApify(today: string, warnings: string[], seenIds: string[] = []): Promise<Collected> {
  const notes: string[] = []
  const listings: Listing[] = []
  const fixtures = process.env.APIFY_FIXTURES

  if (!APIFY.token && !fixtures) {
    notes.push('Collecte Apify désactivée : le secret APIFY_TOKEN n’est pas renseigné.')
    return { listings, notes }
  }
  const run = fixtures ? fixtureRunner(fixtures) : apifyRunner(APIFY.token)
  // Hors ligne pendant les tests : la position reste celle de la préfecture.
  const geocoder = new Geocoder(resolve('data/geocache.json'), Boolean(fixtures))

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

  // Decathlon : lecture directe depuis GitHub (gratuite), puis Cheerio Scraper d'Apify si le site bloque.
  // Troc-Vélo : uniquement Puppeteer Scraper d'Apify (le site exige un vrai navigateur).
  const scrapers = [
    {
      label: 'Troc-Vélo',
      enabled: TROCVELO.enabled,
      fetch: fetchTrocVelo,
      page: TROCVELO.startUrl,
      variable: 'TROCVELO_SEARCH_URL',
      direct: false,
      apifyHow: 'navigateur Puppeteer Scraper d’Apify',
      actor: TROCVELO.actor,
      proxy: TROCVELO_PROXY,
    },
    {
      label: 'Decathlon Occasion',
      enabled: DECATHLON.enabled,
      fetch: fetchDecathlon,
      page: DECATHLON.startUrls[0],
      variable: null,
      direct: true,
      apifyHow: 'Cheerio Scraper d’Apify',
      actor: DECATHLON.actor,
      proxy: PROXY,
    },
  ]
  for (const s of scrapers) {
    if (!s.enabled) continue
    const attempts: { how: string; runner: ActorRunner }[] = fixtures
      ? [{ how: 'exemples', runner: run }]
      : [
          ...(s.direct ? [{ how: 'lecture directe', runner: directRunner() }] : []),
          ...(APIFY.token ? [{ how: s.apifyHow, runner: run }] : []),
        ]
    if (attempts.length === 0) {
      notes.push(`${s.label} non lu : il faut le secret APIFY_TOKEN.`)
      continue
    }
    const failures: string[] = []
    const proxyLabel = (p: { useApifyProxy: boolean; apifyProxyGroups?: string[]; apifyProxyCountry?: string }) =>
      p.apifyProxyGroups?.length ? `proxy Apify ${p.apifyProxyGroups.join('+')}${p.apifyProxyCountry ? ` (${p.apifyProxyCountry})` : ''}` : 'proxy Apify automatique'
    for (const { how, runner } of attempts) {
      const viaApify = runner === run && !fixtures
      if (viaApify) console.log(`  ${s.label} : ${how}, ${proxyLabel(s.proxy)}`)
      try {
        const skipIds = seenIds.filter((id) => id.startsWith('tv-')).map((id) => id.slice(3))
        const { ads, skipped, listed, pages } = await s.fetch(runner, { skipIds })
        for (const p of pages) {
          console.log(
            `    ${s.label} ${p.url}${p.status ? ` (HTTP ${p.status})` : ''} : « ${p.pageTitle ?? '?'} », ${p.size ?? '?'} caractères, ` +
              `${p.found} annonces${p.fromJson ? ' lues dans les réponses JSON du site' : ''}, ${p.kept} retenues`,
          )
          for (const sample of p.samples ?? []) console.log(`      ${sample}`)
          if (p.apis?.length) {
            console.log(`      Appels JSON du site (pistes d'API interne) :`)
            for (const api of p.apis) console.log(`        ${api}`)
          }
        }
        const apis = [...new Set(pages.flatMap((p) => p.apis ?? []))]
        if (apis.length > 0) notes.push(`${s.label} : appels JSON relevés sur la page de liste (piste d'API interne) : ${apis.slice(0, 5).join(', ')}.`)
        if (listed === null) throw new Error(`page de liste non lue (bloquée ou injoignable) : ${s.page}`)
        if (listed === 0 && ads.length === 0) {
          const title = pages[0]?.pageTitle ? ` (titre de la page : « ${pages[0].pageTitle} »)` : ''
          throw new Error(`aucune annonce trouvée sur ${s.page}${title}`)
        }
        // Position exacte de la commune à partir du code postal lu sur l'annonce.
        for (const ad of ads) {
          if (!ad.postalCode) continue
          const place = await geocoder.locate(ad.postalCode, ad.placeName)
          if (place === 'unknown') {
            ad.coords = undefined
            ad.toVerify = [...(ad.toVerify ?? []).filter((v) => v !== APPROXIMATE_PLACE), 'Code postal inconnu en France : lieu à vérifier']
          } else if (place?.exact) {
            ad.coords = { lat: place.lat, lon: place.lon }
            ad.toVerify = (ad.toVerify ?? []).filter((v) => v !== APPROXIMATE_PLACE)
          }
        }
        const read = ads.map((ad) => toListing(ad, today))
        listings.push(...read)
        // Ce que le robot a lu sur chaque fiche, pour contrôle dans le journal de l'exécution.
        read.forEach((l, n) => {
          const { title, price, newPrice, size, year, groupset, frame, brakes, type, city, coords, shipping, condition, km, toVerify, url } = l
          console.log(`    Fiche ${s.label} : ${JSON.stringify({ title, price, newPrice, size, year, groupset, frame, brakes, type, city, coords, shipping, condition, km, toVerify, url })}`)
          if (DEBUG && ads[n].debug) console.log(`      brut : ${ads[n].debug}`)
        })
        if (DEBUG) for (const p of pages) for (const d of p.decisions ?? []) console.log(`      vignette p.${p.page ?? 1} : ${d}`)
        const st = pages.reduce(
          (acc, p) => ({
            known: acc.known + (p.stats?.known ?? 0),
            price: acc.price + (p.stats?.price ?? 0),
            size: acc.size + (p.stats?.size ?? 0),
            group: acc.group + (p.stats?.group ?? 0),
            far: acc.far + (p.stats?.far ?? 0),
            repeat: acc.repeat + (p.stats?.repeat ?? 0),
            candidates: acc.candidates + (p.candidates ?? 0),
          }),
          { known: 0, price: 0, size: 0, group: 0, far: 0, repeat: 0, candidates: 0 },
        )
        const sorted = pages.some((p) => p.stats)
          ? ` Tri de la liste : ${st.known} déjà analysées, ${st.price} hors budget, ${st.size} d'une autre taille, ${st.group} sans taille ni groupe cité, ${st.far} trop loin sans livraison, ${st.candidates} à ouvrir${st.repeat ? ` (${st.repeat} annonces « à la une » répétées d'une page à l'autre, comptées une fois)` : ''}.`
          : ''
        notes.push(
          `${s.label} (${how}) : ${plural((listed ?? ads.length) - st.repeat, 'annonce sur la liste', 'annonces sur la liste')}${pages.length > 1 ? ` (${pages.length} pages)` : ''}, ` +
            `${plural(ads.length, 'fiche ouverte', 'fiches ouvertes')}${skipped ? `, ${plural(skipped, 'page illisible', 'pages illisibles')}` : ''}.${sorted}`,
        )
        failures.length = 0
        break
      } catch (error) {
        let message = `${how} (${viaApify ? proxyLabel(s.proxy) : 'sans proxy'}) : ${(error as Error).message.replace(/[.\s]+$/, '')}`
        // La cause d'une page non lue n'est que dans le journal de l'exécution Apify : on le rapatrie.
        if (viaApify && /non lue|aucune annonce/.test(message)) {
          try {
            const log = await lastRunLog(APIFY.token, s.actor)
            for (const line of log) console.log(`      [Apify] ${line}`)
            if (log.length > 0) message += `. Journal Apify : ${log.slice(-2).join(' / ').slice(0, 400)}`
          } catch {
            // Journal indisponible : on garde le message d'origine.
          }
        }
        failures.push(message)
      }
    }
    if (failures.length > 0) {
      const empty = failures.some((f) => f.includes('aucune annonce trouvée'))
      const hint = s.variable && empty ? ` Si la page a changé, indique la bonne adresse dans la variable ${s.variable} du dépôt.` : ''
      warnings.push(`${s.label} non lu. ${failures.join(' ; ')}.${hint}`)
    }
  }

  geocoder.save()
  return { listings, notes }
}
