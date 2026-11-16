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
import { locate } from '../../src/lib/zones'
import type { Listing } from '../../src/types'
import { LEBONCOIN_ZONES } from './config'
import { normalizeLeboncoin, searchUrl, searchUrls } from './leboncoin'
import { buycycleInput, normalizeBuycycle } from './buycycle'
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
const verdict = (l: Listing) => rejectionReason(l, DEFAULT_CRITERIA, locate(l, DEFAULT_CRITERIA))

test('les liens de recherche ne sont jamais des liens directs', () => {
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/ad/velos/3310839472'), true)
  assert.equal(isDirectAdUrl('https://www.troc-velo.com/fr-fr/annonce/van-rysel-ultra-rcr-dura-ace-di2-3826889'), true)
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/recherche?text=canyon%20aeroad'), false)
  assert.equal(isDirectAdUrl('https://www.leboncoin.fr/c/velos/bicycle_size:M'), false)
  assert.equal(isDirectAdUrl('https://www.troc-velo.com/fr-fr/categorie/velos-complets/route'), false)
  assert.equal(isDirectAdUrl('https://www.decathlon.fr/search?Ntt=van%20rysel'), false)
  assert.equal(isDirectAdUrl(''), false)
})

test('recherche Leboncoin : toute la France par défaut, vélos de route, taille M, prix, plus récentes d’abord', () => {
  const urls = searchUrls()
  assert.equal(urls.length, 1)
  const france = new URL(urls[0])
  assert.equal(france.searchParams.get('locations'), null)
  assert.equal(france.searchParams.get('bicycle_size'), 'M')
  assert.equal(france.searchParams.get('sort'), 'time')
  // Recherche par zone, si LEBONCOIN_SCOPE=zones.
  const zoned = LEBONCOIN_ZONES.map((z) => searchUrl(z))
  assert.equal(zoned.length, 2)
  const paris = new URL(zoned[0])
  assert.equal(paris.searchParams.get('category'), '55')
  assert.equal(paris.searchParams.get('bicycle_type'), 'course')
  assert.equal(paris.searchParams.get('bicycle_size'), 'M')
  assert.equal(paris.searchParams.get('price'), '1500-4500')
  assert.equal(paris.searchParams.get('sort'), 'time')
  assert.match(paris.searchParams.get('locations')!, /^Paris_75000__48\.85661_2\.35222_10000_60000$/)
  assert.match(new URL(zoned[1]).searchParams.get('locations')!, /^Saint-Nazaire_44600__47\.27346_-2\.21386_10000_60000$/)
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
  const zone = locate(l, DEFAULT_CRITERIA)
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
  assert.equal(l.size, '56')
  assert.equal(l.city, '44350, Loire-Atlantique')
  assert.equal(l.shipping, true)
  assert.equal(l.wheelDepth, 52)
  assert.equal(l.image, 'https://www.troc-velo.com/media/annonces/4251234/photo-1.jpg')
  assert.ok(l.toVerify?.some((v) => v.startsWith('Lieu approximatif')))
  assert.equal(verdict(l), null)
})

test('Troc-Vélo (format réel) : caractéristiques, lieu, prix neuf, livraison ; suggestions ignorées', () => {
  const l = toListing(tv[3]!, today)
  assert.equal(l.id, 'tv-4320001')
  assert.equal(l.title, 'Canyon Ultimate CF SL 8 Ultegra Di2')
  assert.equal(l.price, 2890)
  assert.equal(l.newPrice, 4999)
  assert.equal(l.city, 'Saint-Herblain (44800)')
  assert.equal(l.size, 'M')
  assert.equal(l.year, 2023)
  assert.equal(l.groupset, 'ultegra-di2')
  assert.equal(l.frame, 'carbone')
  assert.equal(l.brakes, 'disque')
  assert.equal(l.type, 'route')
  assert.equal(l.condition, 'tres-bon')
  assert.equal(l.shipping, true)
  assert.equal(l.km, 3200)
  assert.equal(l.wheelDepth, 50)
  assert.equal(l.image, 'https://media-cdn.troc-velo.com/full/main/bikeAds/001/20001/4320001/4320001-canyon-4320001-1.jpg')
  assert.equal(l.fallbackImage, 'https://media-cdn.troc-velo.com/full/main/bikeAds/001/20001/4320001/4320001-canyon-4320001-2.jpg')
  assert.ok(!l.description.includes('Pinarello'))
  assert.equal(verdict(l), null)
})

// Cas relevés sur de vraies fiches Troc-Vélo (contenu abrégé).
const fiche = (slug: string, title: string, head: string, desc: string, carac: string) =>
  toListing(
    normalizeTrocVelo({
      kind: 'ad',
      url: `https://www.troc-velo.com/fr-fr/annonce/${slug}`,
      title,
      jsonLd: [],
      attributes: {},
      images: [],
      text: `${title} ${head} Accueil / Route 1 / 5 Voir les annonces similaires Date de publication Aujourd'hui, 21h44 Description ${desc} Référence de l'annonce : 1 Caractéristiques ${carac} Annonces similaires Pinarello Dura-Ace Di2 9000 €`,
    })!,
    today,
  )

test('Troc-Vélo : taille déclarée M et « 54 » dans la description → retenue, taille à confirmer', () => {
  const a = fiche('supersix-1', 'Cannondale Supersix evo 2', '4500 €6300 € Réserver', 'Supersix evo2 full carbone T54/M. Shimano ultegra Di2.', "Marque CANNONDALE Année2025 GroupeShimano Ultegra Di2 Taille du cadreM Matière principaleCarbone Type de freinageDisques PratiqueRoute Localisation de l'article : Orvault (44700)")
  const b = fiche('slr-2', 'Bmc slr 01', '2400 € Acheter', 'Taille du cadre : M (54) - Taille des roues : 700c - Étrier Freins : Shimano Dura-Ace', "Marque BMC GroupeShimano Ultegra Di2 Taille du cadreM Matière principaleCarbone Type de freinageDisques PratiqueRoute Localisation de l'article : SOUMOULOU (64420)")
  for (const l of [a, b]) {
    assert.equal(l.size, 'M')
    assert.ok(l.toVerify?.includes('Taille à confirmer : M déclarée, 54 dans la description'))
  }
  assert.equal(a.year, 2025)
  assert.equal(b.year, 0)
  assert.equal(b.groupset, 'ultegra-di2')
  // Un écart net garde la taille chiffrée : M déclarée, 52 écrite → écartée.
  const c = fiche('petit-3', 'Trek Emonda', '2400 € Acheter', 'Taille 52, Ultegra Di2.', 'Marque TREK GroupeShimano Ultegra Di2 Taille du cadreM Matière principaleCarbone Type de freinageDisques PratiqueRoute')
  assert.equal(c.size, '52')
  assert.match(verdict(c)!, /Taille 52/)
})

test('Troc-Vélo : le champ « Groupe » prime sur une pièce citée dans la description', () => {
  const l = fiche('kom-4', 'Kuota kom carbone', '1700 € Réserver', 'dérailleur AR SRAM force neuf - freins Shimano Durace - poignées SRAM force', "Marque KUOTA Année2022 GroupeShimano Dura Ace Taille du cadreM Matière principaleCarbone Type de freinagePatins PratiqueRoute Nombres de vitesses10 vitesses Localisation de l'article : AUBERVILLIERS (93300)")
  assert.equal(l.groupset, 'ultegra')
  assert.equal(l.brakes, 'patins')
  assert.equal(verdict(l), 'Freins à patins')
  const m = fiche('cento-5', 'Wilier Cento 10 sl', '2250 € Acheter', 'Di2 possible en option chez le revendeur.', 'Marque WILIER GroupeShimano Ultegra Taille du cadreM Matière principaleCarbone Type de freinageDisques PratiqueRoute Groupe électrique (AXS, Di2, eTap, ..)Non')
  assert.equal(m.groupset, 'ultegra')
})

test('Troc-Vélo : « Caractéristiques techniques » dans la description, vélo de triathlon écarté', () => {
  const l = fiche('aerium-6', 'Cube Aerium C:68 SLT (Taille M / Low) - SRAM Red AXS', '4000 € Acheter', 'Vélo de triathlon Cube Aerium, modèle 2021 en taille M. Caractéristiques techniques : • Cadre : Aerium C:68 • Groupe : SRAM Red eTap AXS', "Marque CUBE Année2021 GroupeSRAM Red AXS Taille du cadreM Matière principaleCarbone Type de freinageDisques PratiqueRoute Localisation de l'article : Strasbourg (67000)")
  assert.equal(l.city, 'Strasbourg (67000)')
  assert.equal(l.year, 2021)
  assert.equal(l.type, 'clm')
  assert.equal(l.toVerify?.some((v) => /Matériau|freins/.test(v)) ?? false, false)
  assert.match(verdict(l)!, /Contre-la-montre/)
})

test('Troc-Vélo : Look à patins dans les Pyrénées, écarté', () => {
  const l = toListing(tv[2]!, today)
  assert.equal(l.price, 2150)
  assert.equal(l.brakes, 'patins')
  assert.equal(l.city, '65250, Hautes-Pyrénées')
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

// Code postal → position : commune exacte, secours par département, code postal étranger.
{
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { Geocoder } = await import('../geo')
  const { DEPARTMENTS, departmentCode, departmentsNear } = await import('./departments')
  const file = resolve(mkdtempSync(resolve(tmpdir(), 'geo-')), 'cache.json')
  writeFileSync(
    file,
    JSON.stringify({
      '64420': [
        { nom: 'Andoins', centre: { coordinates: [-0.2258, 43.3008] } },
        { nom: 'Soumoulou', centre: { coordinates: [-0.1869, 43.2647] } },
      ],
      '08227': [],
    }),
  )
  const geo = new Geocoder(file, true)
  const soumoulou = await geo.locate('64420', 'SOUMOULOU')
  const foreign = await geo.locate('08227', 'Terrassa, Barcelone')
  const fallback = await geo.locate('59800', 'Lille')
  test('code postal → position : commune exacte, département en secours, étranger reconnu', () => {
    assert.deepEqual(soumoulou, { lat: 43.2647, lon: -0.1869, name: 'Soumoulou', exact: true })
    assert.equal(foreign, 'unknown')
    assert.deepEqual(fallback, { lat: 50.6292, lon: 3.0573, name: 'Nord', exact: false })
    assert.equal(Object.keys(DEPARTMENTS).length, 96)
    assert.equal(departmentCode('20000'), '2A')
    assert.equal(departmentCode('20200'), '2B')
    assert.equal(departmentCode('97400'), null)
    const near = departmentsNear(DEFAULT_CRITERIA.zones)
    for (const d of ['75', '93', '44', '35', '56', '85', '59']) assert.ok(near.includes(d), d)
    for (const d of ['64', '31', '13', '69', '68']) assert.ok(!near.includes(d), d)
    // Avec le train : Lyon (69) et Marseille (13) deviennent à portée, Toulouse (31) non.
    const reach = departmentsNear(DEFAULT_CRITERIA.zones, DEFAULT_CRITERIA.train)
    for (const d of ['69', '86', '33', '67', '13']) assert.ok(reach.includes(d), d)
    for (const d of ['31', '64', '66', '06']) assert.ok(!reach.includes(d), d)
  })
}

test('Troc-Vélo : le vendeur qui refuse l’envoi n’est pas compté comme livrable', () => {
  const raw = structuredClone(fixture('apify~puppeteer-scraper.json')[3]) as { text: string }
  raw.text = raw.text.replace('Je passe au gravel.', 'Je passe au gravel. Pas d\'envoi, remise en main propre uniquement.')
  const l = toListing(normalizeTrocVelo(raw)!, today)
  assert.equal(l.shipping, false)
  assert.equal(l.type, 'route')
})

test('buycycle : prix avec protection, taille chiffrée, groupe, livraison, triathlon écarté', () => {
  const ads = fixture('solidcode~buycycle-scraper.json').map(normalizeBuycycle)
  assert.equal(ads[4], null) // équipement, pas un vélo
  const [aeroad, tarmac, propel, speedmax] = ads.map((a) => (a ? toListing(a, today) : null))
  assert.equal(aeroad!.id, 'bc-21966')
  assert.equal(aeroad!.url, 'https://buycycle.com/fr-fr/product/aeroad-cf-slx-8-di2-2023-21966')
  assert.equal(isDirectAdUrl(aeroad!.url), true)
  assert.equal(aeroad!.source, 'buycycle')
  assert.equal(aeroad!.title, 'Canyon Aeroad CF SLX 8 Di2 2023')
  assert.equal(aeroad!.price, 3783)
  assert.equal(aeroad!.newPrice, 6500)
  assert.equal(aeroad!.size, 'M')
  assert.equal(aeroad!.groupset, 'ultegra-di2')
  assert.equal(aeroad!.condition, 'tres-bon')
  assert.equal(aeroad!.shipping, true)
  assert.equal(aeroad!.aero, true)
  assert.equal(aeroad!.wheelDepth, 62)
  assert.equal(aeroad!.city, 'Eybens, France (livraison buycycle)')
  assert.equal(verdict(aeroad!), null)
  assert.equal(tarmac!.price, 2425)
  assert.equal(tarmac!.size, '54')
  assert.equal(tarmac!.groupset, 'ultegra')
  assert.match(verdict(tarmac!)!, /Taille 54/)
  assert.equal(propel!.size, '56')
  assert.equal(propel!.groupset, 'ultegra-di2')
  assert.equal(verdict(propel!), null)
  assert.equal(speedmax!.type, 'clm')
  assert.ok(verdict(speedmax!))
  const input = buycycleInput()
  assert.deepEqual(input.frameSizes, ['m', 'l'])
  assert.equal(input.country, 'fr')
  assert.equal(input.maxPrice, 4500)
})

test('accès en train : Poitiers et Lyon retenus, Toulouse non, Paris reste en zone', () => {
  const at = (lat: number, lon: number) => locate({ ...toListing(tv[3]!, today), coords: { lat, lon } }, DEFAULT_CRITERIA)
  const lussac = at(46.4045, 0.7253) // Lussac-les-Châteaux, 35 km de Poitiers
  assert.equal(lussac.inside, true)
  assert.equal(lussac.train?.station, 'Poitiers')
  assert.ok(lussac.train!.minutes > 100 && lussac.train!.minutes < 140, String(lussac.train?.minutes))
  assert.equal(at(45.764, 4.8357).train?.station, 'Lyon')
  assert.equal(at(43.6047, 1.4442).inside, false) // Toulouse : 4 h 20 de train
  const paris = at(48.8566, 2.3522)
  assert.equal(paris.train, undefined)
  assert.equal(paris.nearest?.id, 'paris')
  // Désactivé dans les critères : Lyon redevient hors zone.
  assert.equal(locate({ ...toListing(tv[3]!, today), coords: { lat: 45.764, lon: 4.8357 } }, { ...DEFAULT_CRITERIA, train: { enabled: false, maxHours: 3 } }).inside, false)
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
