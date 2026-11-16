/**
 * Vérifie l'analyse des annonces Apify sur des exemples, sans appeler Apify ni dépenser de crédit.
 * Lancement : `npm run test:apify` (aussi exécuté par la CI).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CRITERIA, rejectionReason } from '../../src/lib/criteria'
import { isDirectAdUrl } from '../../src/lib/links'
import { matchZone } from '../../src/lib/zones'
import type { Listing } from '../../src/types'
import { LEBONCOIN_ZONES } from './config'
import { normalizeLeboncoin, searchUrl } from './leboncoin'
import { toListing } from './parse'
import { normalizeDecathlon } from './decathlon'
import { BROWSER_PAGE_FUNCTION } from './browser-page-function'
import { PAGE_FUNCTION } from './page-function'
import { normalizeTrocVelo } from './trocvelo'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => JSON.parse(readFileSync(resolve(here, 'fixtures', name), 'utf8')) as unknown[]
const today = '2026-11-16'
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}
const verdict = (l: Listing) => rejectionReason(l, DEFAULT_CRITERIA, matchZone(l, DEFAULT_CRITERIA.zones))

test('les liens de recherche ne sont jamais des liens directs', () => {
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/ad/velos/3310839472'), true)
  assert.equal(isDirectAdUrl('https://www.troc-velo.com/fr-fr/annonce/van-rysel-ultra-rcr-dura-ace-di2-3826889'), true)
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/recherche?text=canyon%20aeroad'), false)
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/c/velos/bicycle_size:M'), false)
  assert.equal(isDirectAdUrl('https://www.troc-velo.com/fr-fr/categorie/velos-complets/route'), false)
  assert.equal(isDirectAdUrl('https://www.decathlon.fr/search?Ntt=van%20rysel'), false)
  assert.equal(isDirectAdUrl(''), false)
})

test('recherches Leboncoin ciblées : vélos de route, taille M, prix, zone, plus récentes d’abord', () => {
  const urls = LEBONCOIN_ZONES.map(searchUrl)
  assert.equal(urls.length, 2)
  const paris = new URL(urls[0])
  assert.equal(paris.searchParams.get('category'), '55')
  assert.equal(paris.searchParams.get('bicycle_type'), 'course')
  assert.equal(paris.searchParams.get('bicycle_size'), 'M')
  assert.equal(paris.searchParams.get('price'), '1500-4500')
  assert.equal(paris.searchParams.get('sort'), 'time')
  assert.match(paris.searchParams.get('locations')!, /^Paris_75000__48\.85661_2\.35222_10000_60000$/)
  assert.match(new URL(urls[1]).searchParams.get('locations')!, /^Saint-Nazaire_44600__47\.27346_-2\.21386_10000_60000$/)
})

const lbc = fixture('memo23~leboncoin-scraper.json').map(normalizeLeboncoin)

test('Leboncoin : lignes vendeur et liens de recherche ignorés', () => {
  assert.equal(lbc[1], null)
  assert.equal(lbc[5], null)
  assert.equal(lbc.filter(Boolean).length, 4)
})

test('Leboncoin (memo23) : Canyon Aeroad à Paris, retenu', () => {
  const l = toListing(lbc[0]!, today)
  assert.equal(l.id, 'lbc-3310839472')
  assert.equal(l.url, 'https://www.leboncoin.fr/ad/velos/3310839472')
  assert.equal(l.price, 3200)
  assert.equal(l.brand, 'Canyon')
  assert.equal(l.groupset, 'ultegra-di2')
  assert.equal(l.frame, 'carbone')
  assert.equal(l.brakes, 'disque')
  assert.equal(l.size, 'M')
  assert.equal(l.year, 2022)
  assert.equal(l.aero, true)
  assert.equal(l.powerMeter, true)
  assert.equal(l.wheelDepth, 62)
  assert.equal(l.km, 8000)
  assert.equal(l.condition, 'tres-bon')
  assert.equal(l.image, 'https://img.leboncoin.fr/api/v1/lbcpb1/images/aa/bb/cc1.jpg?rule=ad-large')
  assert.deepEqual(l.coords, { lat: 48.8589, lon: 2.3797 })
  assert.equal(l.toVerify, undefined)
  assert.equal(verdict(l), null)
})

test('Leboncoin (autre format) : Tarmac 105 Di2 taille 56 à Pornichet, retenu, freins à vérifier', () => {
  const l = toListing(lbc[2]!, today)
  assert.equal(l.size, '56')
  assert.equal(l.groupset, '105-di2')
  assert.equal(l.brand, 'Specialized')
  assert.equal(l.shipping, true)
  assert.equal(l.newPrice, 5200)
  assert.equal(l.wheelDepth, 38)
  assert.ok(l.toVerify?.includes('Type de freins non précisé'))
  const zone = matchZone(l, DEFAULT_CRITERIA.zones)
  assert.equal(zone.nearest?.id, 'saint-nazaire')
  assert.ok(zone.distance < 15)
  assert.equal(verdict(l), null)
})

test('Leboncoin : taille 58 écartée', () => {
  const l = toListing(lbc[3]!, today)
  assert.equal(l.size, '58')
  assert.equal(l.price, 4300)
  assert.match(verdict(l)!, /Taille 58/)
})

test('Leboncoin : cadre alu avec roues carbone écarté', () => {
  const l = toListing(lbc[4]!, today)
  assert.equal(l.frame, 'aluminium')
  assert.equal(l.groupset, '105')
  assert.equal(l.wheelDepth, 50)
  assert.ok(verdict(l))
})

const tv = fixture('apify~puppeteer-scraper.json').map(normalizeTrocVelo)

test('Troc-Vélo : Cervélo S5 près de Guérande, retenu, suggestions ignorées', () => {
  assert.equal(tv[0], null)
  const l = toListing(tv[1]!, today)
  assert.equal(l.id, 'tv-4251234')
  assert.equal(l.url, 'https://www.troc-velo.com/fr-fr/annonce/cervelo-s5-ultegra-di2-2022-4251234')
  assert.equal(l.title, 'Cervélo S5 Ultegra Di2 2022')
  assert.equal(l.price, 3990)
  assert.equal(l.brand, 'Cervélo')
  assert.equal(l.groupset, 'ultegra-di2')
  assert.equal(l.size, 'M')
  assert.equal(l.city, '44350, Loire-Atlantique')
  assert.equal(l.shipping, true)
  assert.equal(l.wheelDepth, 52)
  assert.equal(l.image, 'https://www.troc-velo.com/media/annonces/4251234/photo-1.jpg')
  assert.ok(l.toVerify?.some((v) => v.startsWith('Lieu approximatif')))
  assert.equal(verdict(l), null)
})

test('Troc-Vélo : Look à patins dans les Pyrénées, écarté', () => {
  const l = toListing(tv[2]!, today)
  assert.equal(l.price, 2150)
  assert.equal(l.brakes, 'patins')
  assert.equal(l.city, '65250')
  assert.ok(verdict(l))
})

test('Decathlon Occasion : Van Rysel RCR-F livré, retenu ; page de liste ignorée', () => {
  const ads = fixture('apify~cheerio-scraper.json').map(normalizeDecathlon).filter(Boolean)
  assert.equal(ads.length, 1)
  const l = toListing(ads[0]!, today)
  assert.equal(l.source, 'decathlon')
  assert.equal(l.id, 'dc-1f0c6a2e-5b8d-4d0e-9c47-2a7d3e8b9f10')
  assert.equal(l.price, 3299)
  assert.equal(l.newPrice, 5499)
  assert.equal(l.brand, 'Van Rysel')
  assert.equal(l.groupset, 'ultegra-di2')
  assert.equal(l.size, 'M')
  assert.equal(l.year, 2024)
  assert.equal(l.aero, true)
  assert.equal(l.shipping, true)
  assert.equal(isDirectAdUrl(l.url), true)
  assert.equal(verdict(l), null)
})

test('les fonctions de page (Cheerio et navigateur) sont du JavaScript valide', () => {
  assert.equal(typeof new Function(`return (${PAGE_FUNCTION})`)(), 'function')
  assert.equal(typeof new Function(`return (${BROWSER_PAGE_FUNCTION})`)(), 'function')
})

// Lecture directe (sans Apify) sur de petites pages servies en local. Demande la
// bibliothèque cheerio, installée par npm (absente seulement hors projet).
const cheerioReady = await import('cheerio').then(() => true, () => false)
if (cheerioReady) {
  const { createServer } = await import('node:http')
  const { directRunner } = await import('./direct')
  const pages: Record<string, string> = {
    '/liste': `<html><body><ul>
      <li><a href="/fr-fr/annonce/canyon-aeroad-ultegra-di2-111">Canyon Aeroad Ultegra Di2</a><span>3 200 €</span></li>
      <li><a href="/fr-fr/annonce/btwin-triban-100-222">Btwin Triban 100</a><span>150 €</span></li>
      <li><a href="/fr-fr/annonce/trek-madone-dura-ace-di2-333">Trek Madone Dura-Ace Di2</a><span>9 800 €</span></li>
      <li><a href="/fr-fr/aide">Aide</a></li></ul></body></html>`,
    '/fr-fr/annonce/canyon-aeroad-ultegra-di2-111': `<html><head><meta property="og:image" content="https://img.example/1.jpg">
      <script type="application/ld+json">{"@type":"Product","name":"Canyon Aeroad Ultegra Di2","offers":{"price":"3200"}}</script></head>
      <body><main><h1>Canyon Aeroad Ultegra Di2 - CANYON - 75011</h1><dl><dt>Taille</dt><dd>M</dd></dl><p>Cadre carbone, freins à disque.</p></main></body></html>`,
  }
  const server = createServer((req, res) => {
    const body = pages[req.url ?? '']
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }).end(body ?? 'introuvable')
  })
  await new Promise<void>((ok) => server.listen(0, ok))
  const port = (server.address() as { port: number }).port
  const items = await directRunner()('apify/cheerio-scraper', {
    startUrls: [{ url: `http://localhost:${port}/liste` }],
    pageFunction: PAGE_FUNCTION,
    customData: { label: 'Test', linkPattern: '/annonce/.+-\\d+/?$', maxListings: 5, prefilter: 'di2|ultegra|dura.?ace|\\b105\\b', priceMin: 1500, priceMax: 4500 },
    maxRequestsPerCrawl: 6,
  }, { timeoutSecs: 30 })
  server.close()
  test('lecture directe : pré-filtre sur la liste (groupe et prix), puis annonce lue', () => {
    const list = items.find((i) => (i as { kind: string }).kind === 'list') as { found: number; kept: number }
    assert.equal(list.found, 3)
    assert.equal(list.kept, 1)
    const ads = items.map((i) => normalizeTrocVelo({ ...(i as object), url: String((i as { url: string }).url).replace(`http://localhost:${port}`, 'https://www.troc-velo.com') })).filter(Boolean)
    assert.equal(ads.length, 1)
    const l = toListing(ads[0]!, today)
    assert.equal(l.price, 3200)
    assert.equal(l.size, 'M')
    assert.equal(l.city, '75011, Paris')
    assert.equal(verdict(l), null)
  })
} else {
  console.log('  – lecture directe non testée : bibliothèque cheerio absente')
}

console.log(`${passed} vérifications réussies.`)
