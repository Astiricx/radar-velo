/**
 * Alltricks (grand revendeur en ligne français) : vélos de route neufs Shimano Di2 et Ultegra,
 * toutes marques (BMC, Trek, Scott, Lapierre, Cube, Van Rysel, Orbea…).
 *
 * Les fiches produit d'Alltricks refusent les serveurs de GitHub, mais ses pages de liste
 * suffisent : chaque vignette donne le prix, le prix barré pendant les promotions et les
 * tailles proposées à l'achat, avec la taille de cycliste conseillée (« 56 cm / 178-186 cm »).
 * Les produits reconditionnés (occasion) sont laissés de côté.
 */
import { NEUF } from './config'
import { attr, blocks, decode, euros, getPage, pause, textByClass, textOf } from './html'
import { pickSize, readSizeLabel } from './sizes'
import type { NewBike, RetailerResult } from './types'

/** Listes thématiques : Shimano Di2, Ultegra, vélos de route en carbone. */
export const ALLTRICKS_LISTS = [
  'https://www.alltricks.fr/v/velo-route-di2',
  'https://www.alltricks.fr/v/velo-route-ultegra',
  'https://www.alltricks.fr/v/velo-route-ultegra-di2',
  'https://www.alltricks.fr/v/velo-carbone-route',
]

export function parseAlltricksList(html: string): NewBike[] {
  const bikes: NewBike[] = []
  for (const tile of blocks(html, /<div class="products-item-wrapper/)) {
    const head = tile.slice(0, 600)
    const name = (attr(head, 'data-item-name') ?? '').trim()
    const link = tile.match(/<a href="(https:\/\/www\.alltricks\.fr\/[^"]*\/P-(\d+)-[^"]*)"/)
    if (!name || !link) continue
    // Seulement les vélos complets neufs (pas les pièces, pas le reconditionné).
    if (!/^v[ée]lo\b/i.test(name) || /reconditionn/i.test(name)) continue
    const sale = euros(textByClass(tile, 'first-price')) ?? euros(attr(head, 'data-price'))
    if (!sale) continue
    const crossedHtml = tile.match(/products-item__price--crossed">([\s\S]*?)<\/span>\s*<\/span>/)?.[1]
    const crossed = euros(crossedHtml ? textOf(crossedHtml) : textByClass(tile, 'products-item__recommended-price'))
    const offers = [...tile.matchAll(/<button class="size-item"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => {
      const { label, rider } = readSizeLabel(textByClass(m[1], 'size-name') ?? '')
      return { label, rider, inStock: true }
    })
    // Pas de liste de tailles : taille unique écrite dans le titre (« T.54 »), sinon inconnue.
    const titleSize = name.match(/\bT\.?\s?(\d{2}|XS|S|M|L|XL)\b/)?.[1]
    const pick = pickSize(offers.length > 0 ? offers : titleSize ? [{ label: titleSize, inStock: true }] : [])
    if (!pick) continue
    const seller = textOf(tile.match(/class="products-item__sold-by">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '').replace(/^Vendu par\s*/i, '')
    const label = textByClass(tile, 'products-item__label')
    const image = tile.match(/<img src="(https:\/\/product-cdn\.alltricks\.com\/[^"?]+)/)?.[1]
    bikes.push({
      source: 'alltricks',
      id: `at-${link[2]}`,
      url: decode(link[1]),
      title: name,
      description: [
        `Vélo neuf vendu par ${seller || 'Alltricks'}${label ? ` (${label})` : ''}.`,
        offers.length > 0 ? `Tailles proposées : ${offers.map((o) => (o.rider ? `${o.label} (${o.rider[0]}-${o.rider[1]} cm)` : o.label)).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      price: sale,
      originalPrice: crossed && crossed > sale ? crossed : undefined,
      images: image ? [image] : [],
      seller: seller && !/alltricks/i.test(seller) ? `Alltricks (${seller})` : 'Alltricks',
      market: 'neuf',
      size: pick.size,
      sizesInStock: pick.inStock,
      toVerify: [...pick.doubts, ...(offers.length === 0 ? ['Taille lue dans le titre : stock à confirmer'] : [])],
      attributes: {
        ...(/carbone|carbon/i.test(name) ? { 'matiere principale': 'carbone' } : {}),
        // Groupes Shimano Di2 à 12 vitesses des vélos neufs actuels : freins à disque hydrauliques.
        ...(/\b12\s?v\b/i.test(name) && /di2/i.test(name) ? { 'type de freinage': 'disque' } : {}),
      },
    })
  }
  return bikes
}

export async function fetchAlltricks(): Promise<RetailerResult> {
  const notes: string[] = []
  const byId = new Map<string, NewBike>()
  let read = 0
  for (const url of ALLTRICKS_LISTS) {
    try {
      const { html } = await getPage(url)
      read++
      const list = parseAlltricksList(html)
      // La liste « vélos en carbone » garantit le cadre carbone : on le retient pour ces vélos.
      for (const b of list) {
        const known = byId.get(b.id)
        if (/carbone/.test(url)) b.attributes = { ...b.attributes, 'matiere principale': 'carbone' }
        byId.set(b.id, known ? { ...known, attributes: { ...known.attributes, ...b.attributes } } : b)
      }
    } catch (error) {
      notes.push(`liste ${url} non lue (${(error as Error).message})`)
    }
    await pause(NEUF.delayMs)
  }
  if (read === 0) throw new Error(notes.join(' ; ') || 'aucune page lue')
  const bikes = [...byId.values()].filter((b) => b.price >= NEUF.priceMin)
  notes.unshift(`${byId.size} vélos neufs sur ${read} liste${read > 1 ? 's' : ''} (Di2, Ultegra, carbone), dont ${bikes.filter((b) => b.originalPrice).length} en promotion`)
  return { bikes, notes }
}
