import type { Listing } from '../types'
import { photo, type PhotoName } from './photos'
import { SOURCES } from './sources'

/**
 * Annonces de démonstration.
 *
 * Elles sont inventées mais réalistes (modèles, prix et équipements du marché de
 * l'occasion fin 2026), réparties entre tes deux zones : la région parisienne et
 * Saint-Nazaire / Loire-Atlantique. Le lien de chaque annonce ouvre la recherche
 * équivalente sur la plateforme d'origine. Les photos sont de vrais vélos de route
 * (Unsplash), comparables mais pas identiques au modèle de l'annonce.
 *
 * `batch` simule l'arrivée progressive des annonces : la vague 1 est là au premier
 * lancement, les suivantes arrivent quand on clique sur « Lancer une recherche ».
 */

type Seed = Omit<Listing, 'url' | 'publishedAt' | 'type' | 'frame' | 'brakes' | 'image' | 'fallbackImage' | 'imageKind'> &
  Partial<Pick<Listing, 'type' | 'frame' | 'brakes'>> & {
    daysAgo: number
    /** Photo principale, puis photo de secours. */
    photos: [PhotoName, PhotoName]
  }

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 3_600_000).toISOString()

const SEEDS: Seed[] = [
  // ═════════ Vague 1 : présente au premier lancement ═════════

  // ── Région parisienne ──
  {
    id: 'lbc-aeroad-slx8-2023', source: 'leboncoin', batch: 1, daysAgo: 2, photos: ['canyonOnStand', 'blackClassic'],
    title: 'Canyon Aeroad CF SLX 8 Di2 2023, taille M, DT Swiss ARC 1400',
    brand: 'Canyon', model: 'Aeroad CF SLX 8 Di2', year: 2023, size: 'M',
    price: 3890, newPrice: 6499, city: 'Boulogne-Billancourt', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'kit',
    condition: 'tres-bon', km: 6200,
    description:
      "Acheté neuf en mars 2023, facture à l'appui. Ultegra Di2 12 vitesses, roues DT Swiss ARC 1400 de 62 mm montées en tubeless. Chaîne et cassette changées à 5 000 km. Aucune chute, vélo toujours rangé à l'intérieur.",
  },
  {
    id: 'dec-rcrf-pro-105-2025', source: 'decathlon', batch: 1, daysAgo: 1, photos: ['greyIvy', 'grey'],
    title: 'Van Rysel RCR-F Pro 105 Di2 avec capteur de puissance, reconditionné',
    brand: 'Van Rysel', model: 'RCR-F Pro 105 Di2', year: 2025, size: 'M',
    price: 3650, newPrice: 4500, city: 'Paris', shipping: true,
    groupset: '105-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui',
    condition: 'tres-bon', km: 2100,
    description:
      'Vélo reconditionné en atelier Decathlon, garanti 2 ans. Cadre aéro développé avec Swiss Side, capteur de puissance intégré au pédalier, roues carbone de 50 mm. Quelques micro-rayures sur la base arrière.',
  },
  {
    id: 'tv-propel-pro0-2023', source: 'troc-velo', batch: 1, daysAgo: 4, photos: ['giantWhite', 'darkBlueModern'],
    title: 'Giant Propel Advanced Pro 0 Di2 2023, M/L, capteur Giant Power Pro',
    brand: 'Giant', model: 'Propel Advanced Pro 0 Di2', year: 2023, size: 'M/L',
    price: 4200, newPrice: 6900, city: 'Lille', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'kit',
    condition: 'tres-bon', km: 4800,
    description:
      'Propel dernière génération, Ultegra Di2 12 vitesses, capteur de puissance double face, roues Giant SLR 1 de 50 mm. Entretien suivi en magasin Giant, carnet fourni. Envoi possible en carton vélo.',
  },
  {
    id: 'lbc-madone-sl6-2023', source: 'leboncoin', batch: 1, daysAgo: 6, photos: ['blackWoodWall', 'blackStudio'],
    title: 'Trek Madone SL 6 Gen 7, taille 56, 105 Di2, roues Aeolus Pro 51',
    brand: 'Trek', model: 'Madone SL 6 Gen 7', year: 2023, size: '56',
    price: 3400, newPrice: 5499, city: 'Versailles', shipping: false,
    groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 51, extensions: 'inconnu',
    condition: 'bon', km: 9500,
    description:
      "Madone avec l'IsoFlow sous la selle. 105 Di2 12 vitesses, roues Bontrager Aeolus Pro 51. Un éclat de peinture sur le hauban gauche, visible sur les photos. Essai possible le week-end à Versailles.",
  },
  {
    id: 'lbc-s5-2020', source: 'leboncoin', batch: 1, daysAgo: 3, photos: ['blackStudio', 'blackRoad'],
    title: 'Cervélo S5 Disc Ultegra Di2, taille 56, capteur 4iiii',
    brand: 'Cervélo', model: 'S5 Disc Ultegra Di2', year: 2020, size: '56',
    price: 3950, newPrice: 7999, city: 'Lyon', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 62, extensions: 'non',
    condition: 'tres-bon', km: 12000,
    description:
      'S5 avec sa potence en V et son cintre intégré. Ultegra Di2 11 vitesses, capteur 4iiii sur la manivelle gauche, roues carbone de 62 mm. Révision complète faite en septembre. Expédition soignée possible.',
  },
  {
    id: 'tv-foil-rc20-2023', source: 'troc-velo', batch: 1, daysAgo: 8, photos: ['greyBlack', 'monochrome'],
    title: 'Scott Foil RC 20 2023, taille 56, Ultegra Di2',
    brand: 'Scott', model: 'Foil RC 20', year: 2023, size: '56',
    price: 3990, newPrice: 5999, city: 'Reims', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'inconnu',
    condition: 'tres-bon', km: 5400,
    description:
      'Foil nouvelle génération, cockpit Syncros intégré, roues Syncros Capital 1.0 de 50 mm. Pneus neufs. Vendu pour passer sur un vélo de chrono.',
  },
  {
    id: 'lbc-reacto-7000-2022', source: 'leboncoin', batch: 1, daysAgo: 10, photos: ['blackGreyRoad', 'blackClassic'],
    title: 'Merida Reacto 7000-E Ultegra Di2, taille M, roues Reynolds 58',
    brand: 'Merida', model: 'Reacto 7000-E', year: 2022, size: 'M',
    price: 2950, newPrice: 4799, city: 'Orléans', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 58, extensions: 'oui',
    condition: 'bon', km: 11000,
    description:
      'Reacto avec cintre et potence séparés, donc prolongateurs faciles à monter. Ultegra Di2 12 vitesses, roues Reynolds AR 58. Traces d’usage normales sur les manivelles.',
  },
  {
    id: 'lbc-aeroad-sl8-2021', source: 'leboncoin', batch: 1, daysAgo: 12, photos: ['whiteBottles', 'grey'],
    title: 'Canyon Aeroad CF SL 8 Disc 2021, taille M, Ultegra mécanique',
    brand: 'Canyon', model: 'Aeroad CF SL 8 Disc', year: 2021, size: 'M',
    price: 2600, newPrice: 3999, city: 'Vincennes', shipping: false,
    groupset: 'ultegra', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'kit',
    condition: 'bon', km: 14000,
    description:
      'Aeroad en Ultegra mécanique 11 vitesses, roues Reynolds AR de 58 et 62 mm. Câbles et gaines refaits cet été. À venir voir à Vincennes, près du bois.',
  },
  {
    id: 'tv-tarmac-sl7-2022', source: 'troc-velo', batch: 1, daysAgo: 7, photos: ['blackBuilding', 'monochrome2'],
    title: 'Specialized Tarmac SL7 Expert Ultegra Di2, taille 56',
    brand: 'Specialized', model: 'Tarmac SL7 Expert', year: 2022, size: '56',
    price: 4350, newPrice: 7000, city: 'Rouen', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 38, extensions: 'oui',
    condition: 'tres-bon', km: 7300,
    description:
      'Tarmac SL7 en Ultegra Di2 12 vitesses, roues Roval C38. Potence et cintre classiques. Vélo suivi par un atelier Specialized, factures disponibles.',
  },
  {
    id: 'lbc-aircode-2022', source: 'leboncoin', batch: 1, daysAgo: 14, photos: ['blueSilverModern', 'blueWall'],
    title: 'Lapierre Aircode DRS 8.0, taille 56, Ultegra Di2',
    brand: 'Lapierre', model: 'Aircode DRS 8.0', year: 2022, size: '56',
    price: 3100, newPrice: 5399, city: 'Amiens', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 45, extensions: 'inconnu',
    condition: 'bon', km: 10500,
    description:
      "Aircode aux couleurs de l'équipe Groupama-FDJ. Ultegra Di2, roues carbone de 45 mm. Guidoline récente. Prix légèrement négociable sur place.",
  },
  {
    id: 'lbc-litening-2021', source: 'leboncoin', batch: 1, daysAgo: 9, photos: ['monochrome', 'greyBlack'],
    title: 'Cube Litening C:68X Pro 2021, taille 56, Ultegra Di2',
    brand: 'Cube', model: 'Litening C:68X Pro', year: 2021, size: '56',
    price: 3200, newPrice: 5199, city: 'Le Mans', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 48, extensions: 'inconnu',
    condition: 'bon', km: 13000,
    description:
      'Litening avec cockpit intégré ICR. Ultegra Di2 11 vitesses, roues Newmen de 48 mm. Batterie Di2 remplacée en 2025. Visible au Mans, à 55 minutes de Paris en TGV.',
  },

  // ── Saint-Nazaire et Loire-Atlantique ──
  {
    id: 'lbc-aeroad-slx7-2024-stn', source: 'leboncoin', batch: 1, daysAgo: 1, photos: ['blackRoad', 'canyonDisc'],
    title: 'Canyon Aeroad CF SLX 7 Di2 2024, taille M, capteur 4iiii',
    brand: 'Canyon', model: 'Aeroad CF SLX 7 Di2', year: 2024, size: 'M',
    price: 3700, newPrice: 4799, city: 'Saint-Nazaire', shipping: false,
    groupset: '105-di2', aero: true, powerMeter: true, wheelDepth: 55, extensions: 'kit',
    condition: 'tres-bon', km: 4300,
    description:
      'Aeroad SLX 7 en 105 Di2 avec le capteur 4iiii de série et les roues DT Swiss ARC 1600 de 55 mm. Roulé sur la côte, rincé après chaque sortie. Visible quartier Méan-Penhoët.',
  },
  {
    id: 'tv-propel-adv1-2023-labaule', source: 'troc-velo', batch: 1, daysAgo: 3, photos: ['blackSand', 'giantWhite'],
    title: 'Giant Propel Advanced 1 2023, taille M, 105 Di2',
    brand: 'Giant', model: 'Propel Advanced 1', year: 2023, size: 'M',
    price: 2900, newPrice: 4199, city: 'La Baule-Escoublac', shipping: true,
    groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'kit',
    condition: 'tres-bon', km: 5200,
    description:
      'Propel en 105 Di2 12 vitesses, roues Giant SLR 2 de 50 mm. Révisé chez Giant Saint-Nazaire en octobre. Envoi possible ou essai à La Baule.',
  },
  {
    id: 'dec-rcrf-105-2025-herblain', source: 'decathlon', batch: 1, daysAgo: 2, photos: ['grey', 'greyIvy'],
    title: 'Van Rysel RCR-F 105 Di2 2025, taille M, reconditionné à Decathlon Atlantis',
    brand: 'Van Rysel', model: 'RCR-F 105 Di2', year: 2025, size: 'M',
    price: 3150, newPrice: 3800, city: 'Saint-Herblain', shipping: true,
    groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'oui',
    condition: 'tres-bon', km: 1600,
    description:
      'Le cadre aéro RCR-F en version 105 Di2 sans capteur. Contrôlé et garanti 2 ans par Decathlon. Retrait au magasin Atlantis de Saint-Herblain ou livraison.',
  },
  {
    id: 'lbc-oltre-pro-2023-pornic', source: 'leboncoin', batch: 1, daysAgo: 5, photos: ['tealBianchi', 'turquoiseDeck'],
    title: 'Bianchi Oltre Pro Ultegra Di2 2023, taille 57, vert céleste',
    brand: 'Bianchi', model: 'Oltre Pro Ultegra Di2', year: 2023, size: '57',
    price: 4200, newPrice: 6900, city: 'Pornic', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'inconnu',
    condition: 'tres-bon', km: 6900,
    description:
      'Oltre Pro en Ultegra Di2 12 vitesses, roues Reparto Corse de 50 mm. Cockpit intégré. Couleur céleste classique, aucun choc. Essai possible à Pornic.',
  },
  {
    id: 'lbc-madone-slr7-2022-nantes', source: 'leboncoin', batch: 1, daysAgo: 8, photos: ['blackSunsetWater', 'blackStudio'],
    title: 'Trek Madone SLR 7 Gen 7, taille 56, Ultegra Di2, Aeolus RSL 51',
    brand: 'Trek', model: 'Madone SLR 7 Gen 7', year: 2022, size: '56',
    price: 4400, newPrice: 9499, city: 'Nantes', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 51, extensions: 'inconnu',
    condition: 'bon', km: 15500,
    description:
      'Madone SLR, carbone OCLV 800, roues Aeolus RSL 51. Beaucoup de kilomètres mais transmission révisée et roulements changés. Visible à Nantes, quartier Chantenay.',
  },
  {
    id: 'dec-rcr-pro-ultegra-2024', source: 'decathlon', batch: 1, daysAgo: 5, photos: ['repairStand', 'blackRoad'],
    title: 'Van Rysel RCR Pro Ultegra Di2 vert abysse, taille M, reconditionné',
    brand: 'Van Rysel', model: 'RCR Pro Ultegra Di2', year: 2024, size: 'M',
    price: 3300, newPrice: 5000, city: 'Nantes', shipping: true,
    groupset: 'ultegra-di2', aero: false, powerMeter: false, wheelDepth: 50, extensions: 'oui',
    condition: 'tres-bon', km: 3900,
    description:
      'Le vélo de l’équipe Decathlon AG2R en version Ultegra Di2. Cadre polyvalent plutôt que pur aéro, cintre et potence séparés, roues Swiss Side Hadron 500. Garantie 2 ans, livraison en magasin.',
  },

  // ── Vague 1 : annonces que le filtre automatique écarte ──
  {
    id: 'lbc-dogma-62', source: 'leboncoin', batch: 1, daysAgo: 3, photos: ['monochrome2', 'monochrome'],
    title: 'Pinarello Dogma Dura-Ace Di2, cadre 62 cm',
    brand: 'Pinarello', model: 'Dogma', year: 2021, size: '62',
    price: 4300, newPrice: 11000, city: 'Paris', shipping: false,
    groupset: 'dura-ace-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'non',
    condition: 'bon', km: 16000,
    description: 'Dogma en très grande taille, pour cycliste de 1,90 m et plus. Dura-Ace Di2 et capteur de puissance.',
  },
  {
    id: 'dec-ncr-apex', source: 'decathlon', batch: 1, daysAgo: 2, photos: ['heldByRider', 'blackClassic'],
    title: 'Van Rysel NCR CF Apex, taille M, reconditionné',
    brand: 'Van Rysel', model: 'NCR CF Apex', year: 2024, size: 'M',
    price: 1700, newPrice: 2200, city: 'Paris', shipping: true,
    groupset: 'sram-axs', aero: false, powerMeter: false, wheelDepth: 0, extensions: 'oui',
    condition: 'tres-bon', km: 1800,
    description: 'Vélo d’endurance carbone en SRAM Apex AXS 12 vitesses. Reconditionné et garanti 2 ans.',
  },
  {
    id: 'lbc-speedster-alu', source: 'leboncoin', batch: 1, daysAgo: 11, photos: ['blueWall', 'grey'],
    title: 'Scott Speedster S50, cadre alu, taille 56',
    brand: 'Scott', model: 'Speedster S50', year: 2012, size: '56',
    price: 550, city: 'Versailles', shipping: false,
    frame: 'aluminium', brakes: 'patins',
    groupset: 'autre', aero: false, powerMeter: false, wheelDepth: 0, extensions: 'oui',
    condition: 'correct', km: 22000,
    description: 'Vélo de route pour débuter, cadre aluminium et freins à patins. Révisé, pneus neufs.',
  },
  {
    id: 'tv-tcx-cyclocross', source: 'troc-velo', batch: 1, daysAgo: 6, photos: ['gravelBeige', 'monochrome'],
    title: 'Giant TCX Advanced cyclo-cross et gravel, taille M',
    brand: 'Giant', model: 'TCX Advanced', year: 2021, size: 'M', type: 'gravel',
    price: 1900, newPrice: 3200, city: 'Rennes', shipping: true,
    groupset: 'grx', aero: false, powerMeter: false, wheelDepth: 0, extensions: 'oui',
    condition: 'bon', km: 6000,
    description: 'Cadre carbone, Shimano GRX mono-plateau, pneus de 38 mm. Parfait pour les chemins.',
  },
  {
    id: 'lbc-madone-2005', source: 'leboncoin', batch: 1, daysAgo: 20, photos: ['blackRoad', 'monochrome2'],
    title: 'Trek Madone 5.2 carbone OCLV, taille 56, Ultegra',
    brand: 'Trek', model: 'Madone 5.2', year: 2005, size: '56',
    price: 900, city: 'Tours', shipping: false,
    brakes: 'patins',
    groupset: 'ultegra', aero: false, powerMeter: false, wheelDepth: 0, extensions: 'oui',
    condition: 'correct', km: 35000,
    description: 'Un classique de collection, cadre carbone OCLV fabriqué aux États-Unis. Freins à patins.',
  },
  {
    id: 'lbc-tarmac-sl8-sworks', source: 'leboncoin', batch: 1, daysAgo: 1, photos: ['blackClassic', 'blackStudio'],
    title: 'Specialized S-Works Tarmac SL8 Dura-Ace Di2, taille 56',
    brand: 'Specialized', model: 'S-Works Tarmac SL8', year: 2024, size: '56',
    price: 7900, newPrice: 13500, city: 'Paris', shipping: false,
    groupset: 'dura-ace-di2', aero: true, powerMeter: true, wheelDepth: 51, extensions: 'oui',
    condition: 'tres-bon', km: 5200,
    description: 'Le haut de gamme Specialized, 6,8 kg. Dura-Ace Di2 avec capteur double face, roues Roval Rapide CLX II.',
  },
  {
    id: 'lbc-allez-sprint-guerande', source: 'leboncoin', batch: 1, daysAgo: 4, photos: ['redFixie', 'blackRoad'],
    title: 'Specialized Allez Sprint Comp, cadre alu, taille 56',
    brand: 'Specialized', model: 'Allez Sprint Comp', year: 2022, size: '56',
    price: 1600, newPrice: 2600, city: 'Guérande', shipping: false,
    frame: 'aluminium',
    groupset: '105', aero: true, powerMeter: false, wheelDepth: 0, extensions: 'oui',
    condition: 'bon', km: 8000,
    description: 'Cadre aluminium de course, Shimano 105 mécanique 11 vitesses, freins à disque.',
  },
  {
    id: 'lbc-addict-xs-pornichet', source: 'leboncoin', batch: 1, daysAgo: 2, photos: ['beach', 'whiteBottles'],
    title: 'Scott Addict RC 15 2022, taille XS, Ultegra Di2',
    brand: 'Scott', model: 'Addict RC 15', year: 2022, size: 'XS',
    price: 3200, newPrice: 5599, city: 'Pornichet', shipping: true,
    groupset: 'ultegra-di2', aero: false, powerMeter: false, wheelDepth: 35, extensions: 'non',
    condition: 'tres-bon', km: 4000,
    description: 'Très léger, mais en taille XS : pour un cycliste de 1,55 à 1,65 m.',
  },

  // ═════════ Vague 2 : arrive à la première recherche ═════════
  {
    id: 'lbc-aeroad-slx7-2025', source: 'leboncoin', batch: 2, daysAgo: 0, photos: ['canyonDisc', 'canyonOnStand'],
    title: 'Canyon Aeroad CF SLX 7 Di2 2025, taille M, capteur 4iiii, 1 200 km',
    brand: 'Canyon', model: 'Aeroad CF SLX 7 Di2', year: 2025, size: 'M',
    price: 4100, newPrice: 4799, city: 'Issy-les-Moulineaux', shipping: false,
    groupset: '105-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui',
    condition: 'tres-bon', km: 1200,
    description:
      'Reçu en avril 2025, très peu roulé pour cause de blessure. 105 Di2, capteur 4iiii de série, roues DT Swiss ARC 1600. Cockpit récent compatible avec les prolongateurs Canyon. Facture et carton d’origine.',
  },
  {
    id: 'tv-orca-aero-2023', source: 'troc-velo', batch: 2, daysAgo: 0, photos: ['turquoiseDeck', 'blueSilverModern'],
    title: 'Orbea Orca Aero M20i LTD 2023, taille 57, Ultegra Di2',
    brand: 'Orbea', model: 'Orca Aero M20i LTD', year: 2023, size: '57',
    price: 3700, newPrice: 5999, city: 'Tours', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 55, extensions: 'oui',
    condition: 'tres-bon', km: 6800,
    description:
      'Orca Aero en peinture MyO. Ultegra Di2 12 vitesses, roues Vision SC 55. Le kit prolongateurs Orbea se fixe sur le cintre d’origine. Envoi possible.',
  },
  {
    id: 'dec-rcrf-pro-ultegra-2026', source: 'decathlon', batch: 2, daysAgo: 1, photos: ['blackClassic', 'blackWoodWall'],
    title: 'Van Rysel RCR-F Pro Ultegra Di2 2026, taille M, retour client',
    brand: 'Van Rysel', model: 'RCR-F Pro Ultegra Di2', year: 2026, size: 'M',
    price: 4480, newPrice: 5500, city: 'Lille', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: true, wheelDepth: 50, extensions: 'oui',
    condition: 'neuf', km: 150,
    description:
      'Retour client après 150 km, contrôlé en atelier. Ultegra Di2, capteur de puissance, roues carbone de 50 mm, kit prolongateurs officiel disponible en option. Garantie constructeur complète.',
  },
  {
    id: 'lbc-s5-105di2-vannes', source: 'leboncoin', batch: 2, daysAgo: 0, photos: ['monochrome2', 'blackStudio'],
    title: 'Cervélo S5 105 Di2 2024, taille 56, roues Reserve 52',
    brand: 'Cervélo', model: 'S5 105 Di2', year: 2024, size: '56',
    price: 4300, newPrice: 6499, city: 'Vannes', shipping: false,
    groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 52, extensions: 'non',
    condition: 'tres-bon', km: 3100,
    description:
      'S5 dernière génération en 105 Di2, roues Reserve 52|63. Cockpit en V intégré, donc pas de prolongateurs classiques. Remise en main propre à Vannes, 1 h de Saint-Nazaire.',
  },
  {
    id: 'tv-look-795-stbrevin', source: 'troc-velo', batch: 2, daysAgo: 1, photos: ['heldByRider', 'blueSilverModern'],
    title: 'Look 795 Blade RS 2022, taille M, Ultegra Di2',
    brand: 'Look', model: '795 Blade RS', year: 2022, size: 'M',
    price: 3600, newPrice: 6200, city: 'Saint-Brevin-les-Pins', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 45, extensions: 'inconnu',
    condition: 'bon', km: 9800,
    description:
      'Le vélo aéro de Look, cadre fabriqué à Nevers. Ultegra Di2 12 vitesses, roues Corima 47. De l’autre côté du pont de Saint-Nazaire.',
  },
  {
    id: 'tv-aeroad-slx8-taille-s', source: 'troc-velo', batch: 2, daysAgo: 0, photos: ['canyonDisc', 'blackClassic'],
    title: 'Canyon Aeroad CF SLX 8 Di2 2024, taille S',
    brand: 'Canyon', model: 'Aeroad CF SLX 8 Di2', year: 2024, size: 'S',
    price: 3600, newPrice: 6299, city: 'Lyon', shipping: true,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'kit',
    condition: 'tres-bon', km: 5000,
    description: 'Très belle affaire, mais en taille S : pour un cycliste de 1,66 à 1,72 m.',
  },
  {
    id: 'lbc-timemachine-nice', source: 'leboncoin', batch: 2, daysAgo: 1, photos: ['blackStudio', 'monochrome'],
    title: 'BMC Timemachine Road 01 Three, taille 56, Ultegra Di2',
    brand: 'BMC', model: 'Timemachine Road 01 Three', year: 2022, size: '56',
    price: 3900, newPrice: 7499, city: 'Nice', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'non',
    condition: 'bon', km: 9000,
    description: 'Remise en main propre uniquement, à Nice. Pas d’envoi.',
  },
  {
    id: 'lbc-xelius-bordeaux', source: 'leboncoin', batch: 2, daysAgo: 0, photos: ['greyBlack', 'grey'],
    title: 'Lapierre Xelius SL 7.0 2023, taille M, Ultegra Di2',
    brand: 'Lapierre', model: 'Xelius SL 7.0', year: 2023, size: 'M',
    price: 3400, newPrice: 5299, city: 'Bordeaux', shipping: false,
    groupset: 'ultegra-di2', aero: false, powerMeter: false, wheelDepth: 45, extensions: 'oui',
    condition: 'tres-bon', km: 5600,
    description: 'Remise en main propre à Bordeaux uniquement.',
  },

  // ═════════ Vague 3 : arrive à la deuxième recherche ═════════
  {
    id: 'lbc-propel-adv1-2024', source: 'leboncoin', batch: 3, daysAgo: 0, photos: ['darkBlueModern', 'giantWhite'],
    title: 'Giant Propel Advanced 1 2024, taille M, 105 Di2',
    brand: 'Giant', model: 'Propel Advanced 1', year: 2024, size: 'M',
    price: 3150, newPrice: 4200, city: 'Chantilly', shipping: false,
    groupset: '105-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'kit',
    condition: 'tres-bon', km: 3600,
    description:
      'Propel en 105 Di2 12 vitesses, roues Giant SLR 2 de 50 mm. Première main, acheté chez Giant Chantilly. Visible en semaine après 18 h.',
  },
  {
    id: 'lbc-aeroad-cfr-2022', source: 'leboncoin', batch: 3, daysAgo: 0, photos: ['blueWall', 'canyonOnStand'],
    title: 'Canyon Aeroad CFR Dura-Ace Di2 2022, taille M, capteur, DT Swiss ARC 1100',
    brand: 'Canyon', model: 'Aeroad CFR Di2', year: 2022, size: 'M',
    price: 4450, newPrice: 8999, city: 'Saint-Germain-en-Laye', shipping: false,
    groupset: 'dura-ace-di2', aero: true, powerMeter: true, wheelDepth: 62, extensions: 'kit',
    condition: 'bon', km: 18000,
    description:
      'Le cadre des pros en Dura-Ace Di2 12 vitesses avec capteur de puissance Shimano. Roues DT Swiss ARC 1100. Beaucoup roulé mais entretenu sans compter : transmission complète neuve en 2026.',
  },
  {
    id: 'lbc-aeroad-slx8-2025-reze', source: 'leboncoin', batch: 3, daysAgo: 0, photos: ['canyonOnStand', 'canyonDisc'],
    title: 'Canyon Aeroad CF SLX 8 Di2 2025, taille M, cockpit CP0048',
    brand: 'Canyon', model: 'Aeroad CF SLX 8 Di2', year: 2025, size: 'M',
    price: 4490, newPrice: 6499, city: 'Rezé', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 62, extensions: 'oui',
    condition: 'neuf', km: 600,
    description:
      'Gagné lors d’un tirage au sort, 600 km au compteur. Ultegra Di2, roues DT Swiss ARC 1400 de 62 mm, cockpit CP0048 compatible avec les prolongateurs Canyon. Facture fournie.',
  },
  {
    id: 'lbc-fcr-guerande', source: 'leboncoin', batch: 3, daysAgo: 0, photos: ['grey', 'greyBlack'],
    title: 'Van Rysel FCR Ultegra Di2 2023, taille M',
    brand: 'Van Rysel', model: 'FCR Ultegra Di2', year: 2023, size: 'M',
    price: 2800, newPrice: 4500, city: 'Guérande', shipping: false,
    groupset: 'ultegra-di2', aero: true, powerMeter: false, wheelDepth: 50, extensions: 'inconnu',
    condition: 'bon', km: 12000,
    description:
      'L’ancien vélo aéro de Van Rysel. Ultegra Di2 12 vitesses, roues carbone de 50 mm. Révisé, pneus neufs. Visible à Guérande, 20 minutes de Saint-Nazaire.',
  },
  {
    id: 'lbc-aeroad-axs', source: 'leboncoin', batch: 3, daysAgo: 0, photos: ['canyonOnStand', 'blackClassic'],
    title: 'Canyon Aeroad CF SLX 8 AXS 2024, taille M, SRAM Force',
    brand: 'Canyon', model: 'Aeroad CF SLX 8 AXS', year: 2024, size: 'M',
    price: 3800, newPrice: 6299, city: 'Paris', shipping: false,
    groupset: 'sram-axs', aero: true, powerMeter: true, wheelDepth: 62, extensions: 'kit',
    condition: 'tres-bon', km: 4100,
    description: 'Version SRAM Force AXS avec capteur de puissance Quarq.',
  },
]

export const MOCK_LISTINGS: Listing[] = SEEDS.map(({ daysAgo: age, photos: [main, backup], ...seed }): Listing => ({
  type: 'route',
  frame: 'carbone',
  brakes: 'disque',
  ...seed,
  image: photo(main),
  fallbackImage: photo(backup),
  imageKind: 'illustration',
  url: SOURCES[seed.source].searchUrl(`${seed.brand} ${seed.model}`),
  publishedAt: daysAgo(age),
}))
