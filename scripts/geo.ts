/**
 * Position d'une commune à partir de son code postal, par la base officielle
 * geo.api.gouv.fr (gratuite, sans clé). Les réponses sont gardées dans
 * data/geocache.json : chaque code postal n'est demandé qu'une fois.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DEPARTMENTS, departmentCode } from './apify/departments'

export interface Place {
  lat: number
  lon: number
  /** Nom officiel de la commune, ou du département si la position est approximative. */
  name: string
  /** Vrai : centre de la commune. Faux : préfecture du département, faute de mieux. */
  exact: boolean
}

interface Commune {
  nom: string
  centre?: { coordinates?: [number, number] }
}

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bst(e?)\b\.?/g, 'saint$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export class Geocoder {
  private cache: Record<string, Commune[]> = {}
  private dirty = false

  /** @param offline vrai pour ne jamais appeler le réseau (tests) */
  constructor(
    private readonly file: string | null,
    private readonly offline = false,
  ) {
    if (file && existsSync(file)) {
      try {
        this.cache = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Commune[]>
      } catch {
        this.cache = {}
      }
    }
  }

  private async communes(postal: string): Promise<Commune[] | null> {
    if (this.cache[postal]) return this.cache[postal]
    if (this.offline) return null
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postal}&fields=nom,centre&format=json`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      const list = ((await res.json()) as Commune[]).filter((c) => c.centre?.coordinates?.length === 2).map((c) => ({ nom: c.nom, centre: c.centre }))
      this.cache[postal] = list
      this.dirty = true
      return list
    } catch {
      return null
    }
  }

  /**
   * Position pour un code postal français, en préférant la commune nommée `name`.
   * Renvoie 'unknown' si la base officielle ne connaît pas ce code postal (annonce de
   * l'étranger, par exemple 08227 pour Terrassa en Espagne), null si le format est invalide.
   */
  async locate(postal: string, name?: string): Promise<Place | 'unknown' | null> {
    if (!/^\d{5}$/.test(postal)) return null
    const list = await this.communes(postal)
    if (list && list.length === 0) return 'unknown'
    if (list && list.length > 0) {
      const wanted = name ? key(name) : ''
      const match = list.find((c) => key(c.nom) === wanted) ?? list.find((c) => wanted && (key(c.nom).includes(wanted) || wanted.includes(key(c.nom)))) ?? list[0]
      const [lon, lat] = match.centre!.coordinates!
      // Plusieurs communes partagent un code postal : elles sont voisines, l'écart reste de quelques km.
      return { lat, lon, name: match.nom, exact: true }
    }
    const code = departmentCode(postal)
    if (!code) return null
    const [deptName, lat, lon] = DEPARTMENTS[code]
    return { lat, lon, name: deptName, exact: false }
  }

  save() {
    if (this.file && this.dirty) writeFileSync(this.file, `${JSON.stringify(this.cache)}\n`)
  }
}
