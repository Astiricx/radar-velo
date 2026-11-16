export type BikeType = 'route' | 'gravel' | 'urbain' | 'vae' | 'clm'
export type SourceId = 'leboncoin' | 'troc-velo' | 'decathlon'
export type Groupset =
  | 'dura-ace-di2'
  | 'ultegra-di2'
  | '105-di2'
  | 'ultegra'
  | '105'
  | 'sram-axs'
  | 'grx'
  | 'autre'
export type Frame = 'carbone' | 'aluminium' | 'acier'
export type Brakes = 'disque' | 'patins'
export type Condition = 'neuf' | 'tres-bon' | 'bon' | 'correct'
/** Peut-on monter des prolongateurs ? */
export type ExtensionFit = 'oui' | 'kit' | 'inconnu' | 'non'

export interface Listing {
  id: string
  source: SourceId
  /**
   * Lien direct vers l'annonce d'origine (…/ad/velos/123456 sur Leboncoin).
   * Vide pour les annonces de démonstration : elles n'existent pas.
   */
  url: string
  /** URL de la photo principale. */
  image: string
  /** Photo de secours si la première ne se charge pas. */
  fallbackImage?: string
  /** « annonce » : la photo du vendeur. « illustration » : un vélo comparable (données de démo). */
  imageKind: 'annonce' | 'illustration'
  title: string
  brand: string
  model: string
  /** 0 si l'annonce ne précise pas l'année. */
  year: number
  type: BikeType
  size: string
  price: number
  /** Prix neuf constaté, pour calculer la décote. */
  newPrice?: number
  description: string
  /** Ville de l'annonce. Sans `coords`, doit être connue de data/cities.ts pour calculer la distance. */
  city: string
  shipping: boolean
  publishedAt: string
  frame: Frame
  brakes: Brakes
  groupset: Groupset
  aero: boolean
  powerMeter: boolean
  /** Hauteur de jante en mm. 0 = roues aluminium classiques. */
  wheelDepth: number
  extensions: ExtensionFit
  condition: Condition
  km?: number
  /** Vague de recherche simulée qui fait apparaître l'annonce (0 = ajout manuel). */
  batch: number
  custom?: boolean
  /** Annonce inventée pour la démonstration. */
  demo?: boolean
  /** Coordonnées précises du lieu, fournies par la plateforme. Sinon, celles de `city`. */
  coords?: { lat: number; lon: number }
  /** Points que l'annonce ne précise pas et que l'analyse automatique a supposés. */
  toVerify?: string[]
  /** Date (AAAA-MM-JJ) à laquelle la veille quotidienne a trouvé l'annonce. */
  firstSeen?: string
}

/** Une zone de recherche : une ville centre et un rayon. */
export interface Zone {
  id: string
  /** Nom affiché : « Région parisienne ». */
  label: string
  /** Ville centre, connue de data/cities.ts. */
  center: string
  radiusKm: number
  enabled: boolean
}

export interface Criteria {
  types: BikeType[]
  sizes: string[]
  budgetIdeal: number
  budgetMax: number
  zones: Zone[]
  acceptShipping: boolean
  requireCarbon: boolean
  requireDisc: boolean
  groupsets: Groupset[]
  bonus: {
    aero: boolean
    powerMeter: boolean
    carbonWheels: boolean
    extensions: boolean
  }
}

export type Status = 'a-analyser' | 'contacte' | 'visite' | 'offre' | 'refuse' | 'coup-de-coeur'

/** Tout ce que tu saisis sur une annonce. Sauvegardé dans le navigateur. */
export interface Tracking {
  status: Status
  notes: string
  sellerName: string
  sellerContact: string
  meetingPlace: string
  meetingAt: string
  negotiatedPrice: string
  reminderAt: string
  reminderText: string
}

export interface ScorePart {
  label: string
  detail: string
  points: number
  max: number
}

export interface ScoreResult {
  total: number
  parts: ScorePart[]
}

/** Position d'une annonce par rapport à tes zones. */
export interface ZoneMatch {
  /** Zone la plus proche parmi les zones actives (null si aucune). */
  nearest: Zone | null
  /** Distance au centre de la zone la plus proche, en km. */
  distance: number
  /** Vrai si l'annonce est dans le rayon de cette zone. */
  inside: boolean
}

/** Une annonce enrichie : zone, score, motif d'exclusion et suivi. */
export interface Row {
  listing: Listing
  zone: ZoneMatch
  /** null si l'annonce respecte les critères stricts. */
  rejection: string | null
  score: ScoreResult
  tracking: Tracking
  isNew: boolean
}

export type ViewMode = 'cards' | 'table' | 'pipeline'
export type SortKey = 'score' | 'price-asc' | 'price-desc' | 'date'

/** Filtre de zone : une zone précise, les annonces livrables hors zones, ou tout. */
export type ZoneFilter = 'all' | 'livraison' | string

export interface Filters {
  query: string
  zone: ZoneFilter
  type: BikeType | 'all'
  source: SourceId | 'all'
  status: Status | 'all'
  priceMin: string
  priceMax: string
}

export interface SyncState {
  batch: number
  lastRun: string | null
  newIds: string[]
}
