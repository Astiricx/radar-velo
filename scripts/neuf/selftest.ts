/**
 * Vérifie la lecture des magasins (vélos neufs) sur des extraits de leurs vraies pages,
 * enregistrés dans scripts/neuf/fixtures, sans aller sur Internet.
 * Lancement : `npm run test:apify` (aussi exécuté par la CI).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CRITERIA, rejectionReason } from '../../src/lib/criteria'
import { isDirectAdUrl } from '../../src/lib/links'
import { scoreListing } from '../../src/lib/scoring'
import { locate } from '../../src/lib/zones'
import { toListing } from '../apify/parse'
import { parseAlltricksList } from './alltricks'
import { parseCanyonList, parseCanyonProduct } from './canyon'
import { euros } from './html'
import { newBikeToRaw } from './index'
import { parseRoseList, parseRoseProduct } from './rose'
import { normalizeSize, pickSize, readSizeLabel } from './sizes'
import type { NewBike } from './types'

const here = dirname(fileURLToPath(import.meta.url))
const page = (name: string) => readFileSync(resolve(here, 'fixtures', name), 'utf8')
const today = '2026-11-23'
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}
const analyse = (b: NewBike) => {
  const l = toListing(newBikeToRaw(b), today)
  const zone = locate(l, DEFAULT_CRITERIA)
  return { l, rejection: rejectionReason(l, DEFAULT_CRITERIA, zone), score: scoreListing(l, DEFAULT_CRITERIA, zone) }
}

test('prix écrits à la française et à l’allemande', () => {
  assert.equal(euros('2&#x202F;799,99 &#x20AC;'), 2800)
  assert.equal(euros('5.799 €'), 5799)
  assert.equal(euros('au lieu de 5 050,00 €'), 5050)
  assert.equal(euros('4199.00'), 4199)
  assert.equal(euros(''), null)
})

test('tailles : « 56 cm / 178-186 cm », « ML » de Trek, « M-L » de Rose', () => {
  assert.deepEqual(readSizeLabel('56 cm / 178-186 cm'), { label: '56', rider: [178, 186] })
  assert.equal(readSizeLabel('ML / 173-179 cm').label, 'M/L')
  assert.equal(normalizeSize('m-l'), 'M/L')
  assert.equal(normalizeSize('XL'), 'XL')
  // Taille de tes critères la plus proche de 1,80 m quand aucune ne la couvre.
  const pick = pickSize([
    { label: 'M', inStock: true, rider: [162, 173] },
    { label: 'M/L', inStock: true, rider: [173, 179] },
    { label: 'L', inStock: true, rider: [179, 188] },
  ])!
  assert.equal(pick.size, 'M/L')
  assert.match(pick.doubts[0], /conseille la L/)
  assert.equal(pickSize([{ label: 'M', inStock: false }]), null)
})

test('Canyon : vignettes de la liste Outlet (prix barré, tailles restantes, reconditionné)', () => {
  const tiles = parseCanyonList(page('canyon-list.html'))
  assert.equal(tiles.length, 5)
  const aeroad = tiles.find((t) => t.id === '4034')!
  assert.equal(aeroad.name, 'Aeroad CF SLX 7 Di2')
  assert.equal(aeroad.price, 4199)
  assert.equal(aeroad.originalPrice, 4499)
  assert.deepEqual(aeroad.onlySizes, ['XL'])
  assert.equal(aeroad.url, 'https://www.canyon.com/fr-fr/promo-velos/route/aeroad-cf-slx-7-di2/4034.html')
  assert.ok(isDirectAdUrl(aeroad.url))
  const refurbished = tiles.find((t) => t.id === '50053633')!
  assert.equal(refurbished.refurbishedSize, 'M')
  const ultimate = tiles.find((t) => t.id === '4065')!
  assert.equal(ultimate.onlySizes, undefined)
  assert.ok(ultimate.image?.startsWith('https://dma.canyon.com/image/upload/'))
})

test('Canyon : fiche produit, stock taille par taille et taille de cycliste conseillée', () => {
  const product = parseCanyonProduct(page('canyon-product.html'))!
  assert.equal(product.name, 'Aeroad CF SLX 7 Di2')
  const m = product.offers.filter((o) => o.label === 'M')
  assert.ok(m.length > 0 && m.every((o) => !o.inStock), 'taille M épuisée sur cette fiche')
  assert.deepEqual(m[0].rider, [178, 184])
  const pick = pickSize(product.offers)!
  assert.equal(pick.size, 'L, XL')
  assert.match(product.description, /105 Di2/)
})

test('Alltricks : vélos neufs, prix barré, tailles proposées, reconditionné écarté', () => {
  const bikes = parseAlltricksList(page('alltricks-list.html'))
  assert.equal(bikes.length, 5, 'le Scott Foil reconditionné est laissé de côté')
  const bmc = bikes.find((b) => /Teammachine SLR Three/.test(b.title))!
  assert.equal(bmc.price, 2800)
  assert.equal(bmc.size, '56')
  assert.equal(bmc.market, 'neuf')
  assert.ok(isDirectAdUrl(bmc.url))
  const scott = bikes.find((b) => /Addict 40/.test(b.title))!
  assert.equal(scott.price, 2500)
  assert.equal(scott.originalPrice, 2800)
  const trek = bikes.find((b) => /Madone/.test(b.title))!
  assert.equal(trek.size, 'M/L')
  const { l, rejection, score } = analyse(scott)
  assert.equal(rejection, null)
  assert.equal(l.groupset, '105-di2')
  assert.equal(l.condition, 'neuf')
  assert.equal(l.originalPrice, 2800)
  assert.match(score.parts.find((p) => p.label === 'Remise')!.detail, /^11 % de remise \(prix barré 2\s800\s€\)$/)
  assert.equal(score.parts.find((p) => p.label === 'État et âge')!.points, 8)
  assert.match(analyse(bikes.find((b) => /T\.54/.test(b.title))!).rejection!, /Taille 54/)
  assert.match(analyse(bikes.find((b) => /Xelius DRS 8\.0/.test(b.title))!).rejection!, /budget/)
})

test('Rose : liste des promotions et fiche (tailles proposées)', () => {
  const tiles = parseRoseList(page('rose-list.html'))
  const shave = tiles.find((t) => /Shave Ultegra Di2/.test(t.name))!
  assert.equal(shave.price, 4440)
  assert.equal(shave.originalPrice, 5050)
  assert.match(shave.category, /Route/)
  assert.ok(isDirectAdUrl(shave.url))
  const product = parseRoseProduct(page('rose-product.html'))
  assert.ok(product.offers.some((o) => o.label === 'M/L' && o.rider?.[0] === 177))
  const pick = pickSize(product.offers, false)!
  assert.equal(pick.size, 'M/L')
  assert.match(pick.doubts.join(' '), /Stock dans ta taille à confirmer/)
  assert.match(product.description, /Ultegra Di2/)
})

test('pages de liste des magasins : jamais des liens directs', () => {
  assert.equal(isDirectAdUrl('https://www.canyon.com/fr-fr/promo-velos/route/?sz=96'), false)
  assert.equal(isDirectAdUrl('https://www.alltricks.fr/v/velo-route-di2'), false)
  assert.equal(isDirectAdUrl('https://www.rosebikes.fr/fr/promotions/cycles'), false)
})

console.log(`${passed} vérifications réussies (magasins, vélos neufs).`)
