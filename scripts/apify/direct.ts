/**
 * Lecture directe des pages, sans Apify : exécute la même fonction de page que le
 * Cheerio Scraper, mais depuis la machine GitHub, avec la bibliothèque cheerio.
 *
 * Gratuit et sans validation. Si le site bloque les serveurs de GitHub, la collecte
 * se rabat sur le Cheerio Scraper d'Apify (voir index.ts).
 */
import type { ActorRunner } from './client'

interface Request {
  url: string
  loadedUrl?: string
  userData: { label?: string }
}

interface ScraperInput {
  startUrls: { url: string }[]
  pageFunction: string
  customData: Record<string, unknown>
  maxRequestsPerCrawl: number
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6',
}

/** Pages de blocage anti-robot (DataDome, Cloudflare, Akamai…). */
const BLOCKED = /captcha-delivery|datadome|cf-chl|challenge-platform|access denied|accès refusé|px-captcha/i

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Imite le Cheerio Scraper : file de pages, fonction de page, résultats en liste. */
export function directRunner(): ActorRunner {
  return async (_actor, input) => {
    const { startUrls, pageFunction, customData, maxRequestsPerCrawl } = input as ScraperInput
    // Chargée à la demande : la veille fonctionne même si cheerio n'est pas installé.
    const { load } = await import('cheerio')
    const fn = new Function(`return (${pageFunction})`)() as (context: unknown) => Promise<unknown>
    const queue: Request[] = startUrls.map(({ url }) => ({ url, userData: {} }))
    const seen = new Set(queue.map((r) => r.url))
    const results: unknown[] = []
    let done = 0
    let failures = 0

    while (queue.length > 0 && done < maxRequestsPerCrawl) {
      const request = queue.shift()!
      done++
      try {
        const res = await fetch(request.url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
        const html = await res.text()
        if (!res.ok || BLOCKED.test(html.slice(0, 5000))) throw new Error(`HTTP ${res.status}${res.ok ? ', page anti-robot' : ''}`)
        request.loadedUrl = res.url
        const result = await fn({
          $: load(html),
          request,
          customData,
          log: { info: (m: string) => console.log(`    ${m}`), warning: (m: string) => console.warn(`    ${m}`) },
          enqueueRequest: async (r: { url: string; userData?: Request['userData'] }) => {
            if (!seen.has(r.url)) {
              seen.add(r.url)
              queue.push({ url: r.url, userData: r.userData ?? {} })
            }
          },
        })
        if (result) results.push(result)
      } catch (error) {
        failures++
        // Une liste illisible, c'est le site entier qui bloque : on laisse la main à Apify.
        if (!request.userData.label) throw new Error(`lecture directe impossible (${(error as Error).message})`)
      }
      await pause(800)
    }
    if (failures > 0) console.warn(`    ${failures} page(s) non lue(s) en lecture directe`)
    return results
  }
}
