/**
 * Photos de vélos de route, hébergées par Unsplash.
 *
 * Licence Unsplash : utilisation libre, y compris commerciale, sans autorisation
 * ni mention obligatoire (https://unsplash.com/license). Chaque identifiant vient
 * d'une photo publique ; la page d'origine est https://unsplash.com/photos/<slug>.
 *
 * Ce sont des photos d'illustration : un vélo comparable, pas le vélo exact de
 * l'annonce. Une annonce ajoutée à la main utilise la vraie photo du vendeur.
 */
const PHOTO_IDS = {
  canyonOnStand: '1779043750145-cbfc339d713e', // vélo de route carbone noir sur pied d'atelier
  canyonDisc: '1779043750169-bbbe14e52f9d', // Canyon noir à freins à disque
  blueSilverModern: '1785155155228-9e9144c962ee', // bleu et argent, façade moderne
  darkBlueModern: '1785155155184-2e8ec6480748', // bleu nuit, façade moderne
  greyIvy: '1781168593835-4ba4609e5396', // gris contre un mur de lierre
  tealBianchi: '1772276050900-5a2bb20150a4', // Bianchi céleste contre un mur bleu
  turquoiseDeck: '1783693558027-f11925c59e3b', // turquoise sur un ponton en bois
  whiteBottles: '1786916901401-338c6ce2e6de', // blanc, roues noires, deux bidons
  blackClassic: '1532298229144-0ec0c57515c7', // noir
  blackWoodWall: '1576435728678-68d0fbf94e91', // noir contre un bardage bois
  grey: '1571068316344-75bc76f77890', // gris
  blackStudio: '1503669678209-c68d00b3765d', // noir
  blackRoad: '1559348349-86f1f65817fe', // noir
  blackSand: '1531608139434-1912ae0713cd', // noir sur le sable
  greyBlack: '1530143584546-02191bc84eb5', // gris et noir
  giantWhite: '1525379241313-7d584a5c09a6', // Giant blanc et noir
  blackGreyRoad: '1592745392512-6581adbbfc64', // noir et gris sur la route
  blackBuilding: '1649651244819-79b28e4a9ce1', // noir devant un immeuble
  blackSunsetWater: '1609398078690-6b15f6eb551e', // noir au bord de l'eau, coucher de soleil
  monochrome: '1497515098781-e965764ab601', // noir et blanc
  monochrome2: '1561642445-b789b9a7e6f0', // noir et blanc
  heldByRider: '1762014594439-3271cc8a7e3f', // tenu par un cycliste
  repairStand: '1764675108462-ed119b2a7d25', // sur pied d'atelier, en extérieur
  gravelBeige: '1788206491992-b4e9f615c155', // gravel beige
  redFixie: '1577106901574-4629d3108efc', // rouge
  beach: '1663698829856-0d1ad0b9d49c', // garé sur une plage
  blueWall: '1718292454436-ab9c7e7ffb17', // bleu contre un mur bleu
} as const

export type PhotoName = keyof typeof PHOTO_IDS

export const PHOTO_NAMES = Object.keys(PHOTO_IDS) as PhotoName[]

/** URL Unsplash d'une photo, recadrée à la largeur demandée. */
export function photo(name: PhotoName, width = 800): string {
  return unsplashUrl(`https://images.unsplash.com/photo-${PHOTO_IDS[name]}`, width)
}

const UNSPLASH = /^https:\/\/images\.unsplash\.com\//

/**
 * Ajoute à une URL Unsplash les paramètres de recadrage et de compression.
 * Les autres URL sont renvoyées telles quelles.
 */
export function unsplashUrl(url: string, width: number): string {
  if (!UNSPLASH.test(url)) return url
  const base = url.split('?')[0]
  return `${base}?auto=format&fit=crop&w=${width}&h=${Math.round(width * 0.625)}&q=70`
}

/** srcSet pour les écrans haute densité, uniquement pour les photos Unsplash. */
export function srcSet(url: string, width: number): string | undefined {
  if (!UNSPLASH.test(url)) return undefined
  return `${unsplashUrl(url, width)} 1x, ${unsplashUrl(url, width * 2)} 2x`
}
