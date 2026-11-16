/**
 * Veille quotidienne : analyse les nouvelles annonces et met à jour data/.
 *
 * Lancement : `npm run daily-check` (en local ou par la GitHub Action
 * .github/workflows/daily-analysis.yml).
 *
 * 1. Rassemble les annonces candidates :
 *    - data/inbox.json : annonces réelles déposées à la main ou par un autre outil ;
 *    - la simulation du jour (scripts/simulation.ts), si VEILLE_SIMULATION n'est pas « false ».
 * 2. Ignore celles déjà vues (data/state.json).
 * 3. Applique le filtre strict et le score de l'application (src/lib), pour les
 *    deux zones : région parisienne et Saint-Nazaire / Loire-Atlantique.
 * 4. Écrit data/listings.json (annonces retenues), data/journal.md (une entrée
 *    par jour) et le résumé de l'exécution GitHub.
 *
 * Variables d'environnement :
 *   VEILLE_DATE        date analysée, AAAA-MM-JJ (par défaut : aujourd'hui, UTC)
 *   VEILLE_SIMULATION  « false » pour ne traiter que data/inbox.json
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CITIES } from '../src/data/cities'
import { SOURCES } from '../src/data/sources'
import { DEFAULT_CRITERIA, GROUPSET_LABELS, rejectionReason } from '../src/lib/criteria'
import { eur, plural } from '../src/lib/format'
import { scoreListing } from '../src/lib/scoring'
import { matchZone } from '../src/lib/zones'
import type { Listing, ScoreResult, ZoneMatch } from '../src/types'
import { simulateDay } from './simulation'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(ROOT, 'data')
const FILES = {
  inbox: resolve(DATA, 'inbox.json'),
  state: resolve(DATA, 'state.json'),
  listings: resolve(DATA, 'listings.json'),
  journal: resolve(DATA, 'journal.md'),
}
const JOURNAL_TITLE = '# Journal de la veille quotidienne'

const date = process.env.VEILLE_DATE?.match(/^\d{4}-\d{2}-\d{2}$/) ? process.env.VEILLE_DATE : new Date().toISOString().slice(0, 10)
const simulation = (process.env.VEILLE_SIMULATION ?? 'true').toLowerCase() !== 'false'
const criteria = DEFAULT_CRITERIA

// ───────────── Types des fichiers de données ─────────────

interface State {
  lastRun: string | null
  /** Identifiant d'annonce → date à laquelle elle a été vue pour la première fois. */
  seen: Record<string, string>
}

/** Une annonce retenue, telle qu'enregistrée dans data/listings.json. */
interface SavedListing {
  id: string
  firstSeen: string
  simulated: boolean
  score: number
  zone: string | null
  distanceKm: number | null
  title: string
  brand: string
  model: string
  year: number
  size: string
  price: number
  newPrice?: number
  city: string
  shipping: boolean
  source: string
  url: string
  image: string
  groupset: string
  powerMeter: boolean
  wheelDepth: number
  scoreDetail: ScoreResult['parts']
}

interface Analysed {
  listing: Listing
  simulated: boolean
  zone: ZoneMatch
  rejection: string | null
  score: ScoreResult
}

// ───────────── Lecture et écriture ─────────────

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (error) {
    throw new Error(`${path} n'est pas un JSON valide : ${(error as Error).message}`)
  }
}

const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

// ───────────── Annonces déposées dans data/inbox.json ─────────────

const REQUIRED = ['id', 'source', 'url', 'title', 'brand', 'model', 'year', 'size', 'price', 'city', 'frame', 'brakes', 'groupset'] as const

/** Lit data/inbox.json. Les entrées incomplètes sont ignorées et signalées. */
function readInbox(warnings: string[]): Listing[] {
  const raw = readJson<unknown>(FILES.inbox, [])
  if (!Array.isArray(raw)) {
    warnings.push('data/inbox.json doit contenir une liste d’annonces ; fichier ignoré.')
    return []
  }
  const listings: Listing[] = []
  raw.forEach((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>
    const missing = REQUIRED.filter((key) => e[key] === undefined || e[key] === '')
    if (missing.length > 0) {
      warnings.push(`inbox.json, entrée ${index + 1} ignorée : champs manquants (${missing.join(', ')}).`)
      return
    }
    if (!(String(e.source) in SOURCES)) {
      warnings.push(`inbox.json, entrée ${index + 1} ignorée : plateforme inconnue « ${String(e.source)} ».`)
      return
    }
    if (!(String(e.city) in CITIES)) {
      warnings.push(`inbox.json, « ${String(e.title)} » : ville « ${String(e.city)} » absente de src/data/cities.ts, distance inconnue.`)
    }
    listings.push({
      type: 'route',
      image: '',
      imageKind: 'annonce',
      description: '',
      shipping: false,
      aero: false,
      powerMeter: false,
      wheelDepth: 0,
      extensions: 'inconnu',
      condition: 'bon',
      publishedAt: `${date}T08:00:00.000Z`,
      batch: 0,
      ...(e as Partial<Listing>),
      id: String(e.id),
      year: Number(e.year),
      price: Number(e.price),
      size: String(e.size),
    } as Listing)
  })
  return listings
}

// ───────────── Mise en forme ─────────────

const SOURCE_LABEL = (id: string) => SOURCES[id as keyof typeof SOURCES]?.label ?? id

function longDate(iso: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Échappe le texte destiné à une cellule de tableau Markdown. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function place(a: Analysed): string {
  const { zone, listing: l } = a
  if (!zone.nearest || !Number.isFinite(zone.distance)) return cell(l.city)
  const where = zone.distance < 3 ? `sur place à ${zone.nearest.center}` : `${zone.distance} km de ${zone.nearest.center}`
  return cell(`${l.city} (${where}${l.shipping ? ', livraison' : ''})`)
}

function journalEntry(relevant: Analysed[], rejected: Analysed[], warnings: string[]): string {
  const lines = [`## ${longDate(date)}`, '']
  const origin = simulation ? 'simulation et data/inbox.json' : 'data/inbox.json uniquement'
  lines.push(
    `${plural(relevant.length + rejected.length, 'nouvelle annonce analysée', 'nouvelles annonces analysées')} ` +
      `(${origin}) : ${plural(relevant.length, 'pertinente', 'pertinentes')}, ${plural(rejected.length, 'écartée', 'écartées')}.`,
    '',
  )
  if (relevant.length > 0) {
    lines.push('| Score | Annonce | Prix | Taille | Transmission | Zone | Lieu | Source |')
    lines.push('| ---: | --- | ---: | --- | --- | --- | --- | --- |')
    for (const a of relevant) {
      const l = a.listing
      const tag = a.simulated ? ' *(simulée)*' : ''
      lines.push(
        `| **${a.score.total}** | [${cell(l.title)}](${l.url})${tag} | ${eur(l.price)} | ${cell(l.size)} | ${GROUPSET_LABELS[l.groupset]}${l.powerMeter ? ', capteur' : ''} | ${a.zone.inside && a.zone.nearest ? cell(a.zone.nearest.label) : 'Hors zone'} | ${place(a)} | ${SOURCE_LABEL(l.source)} |`,
      )
    }
    lines.push('')
  }
  if (rejected.length > 0) {
    lines.push('Écartées :', '')
    for (const a of rejected) lines.push(`- ${cell(a.listing.title)}, ${eur(a.listing.price)} : ${a.rejection}`)
    lines.push('')
  }
  if (warnings.length > 0) {
    lines.push('Avertissements :', '')
    for (const w of warnings) lines.push(`- ${w}`)
    lines.push('')
  }
  return lines.join('\n')
}

function toSaved(a: Analysed): SavedListing {
  const l = a.listing
  return {
    id: l.id,
    firstSeen: date,
    simulated: a.simulated,
    score: a.score.total,
    zone: a.zone.inside && a.zone.nearest ? a.zone.nearest.label : null,
    distanceKm: Number.isFinite(a.zone.distance) ? a.zone.distance : null,
    title: l.title,
    brand: l.brand,
    model: l.model,
    year: l.year,
    size: l.size,
    price: l.price,
    newPrice: l.newPrice,
    city: l.city,
    shipping: l.shipping,
    source: l.source,
    url: l.url,
    image: l.image,
    groupset: l.groupset,
    powerMeter: l.powerMeter,
    wheelDepth: l.wheelDepth,
    scoreDetail: a.score.parts,
  }
}

// ───────────── Programme principal ─────────────

function main() {
  mkdirSync(DATA, { recursive: true })
  const warnings: string[] = []
  const state = readJson<State>(FILES.state, { lastRun: null, seen: {} })
  state.seen ??= {}

  const inbox = readInbox(warnings).map((listing) => ({ listing, simulated: false }))
  const simulated = simulation ? simulateDay(date).map((listing) => ({ listing, simulated: true })) : []
  const candidates = [...inbox, ...simulated]
  const fresh = candidates.filter(({ listing }) => !state.seen[listing.id])

  const analysed: Analysed[] = fresh.map(({ listing, simulated: sim }) => {
    const zone = matchZone(listing, criteria.zones)
    return { listing, simulated: sim, zone, rejection: rejectionReason(listing, criteria, zone), score: scoreListing(listing, criteria, zone) }
  })
  const relevant = analysed.filter((a) => !a.rejection).sort((a, b) => b.score.total - a.score.total)
  const rejected = analysed.filter((a) => a.rejection)

  console.log(`Veille du ${date} — ${simulation ? 'avec' : 'sans'} simulation`)
  console.log(`Candidates : ${candidates.length} (dont ${inbox.length} de data/inbox.json), nouvelles : ${fresh.length}`)
  for (const a of relevant) console.log(`  ✓ ${a.score.total}/100  ${a.listing.title}  ${eur(a.listing.price)}  ${a.listing.city}`)
  for (const a of rejected) console.log(`  ✗ ${a.listing.title} : ${a.rejection}`)
  for (const w of warnings) console.warn(`  ! ${w}`)

  // État : les annonces analysées ne seront plus retraitées.
  for (const { listing } of fresh) state.seen[listing.id] = date
  state.lastRun = date
  writeJson(FILES.state, state)

  // Annonces retenues, de la meilleure à la moins bonne.
  const saved = readJson<{ listings: SavedListing[] }>(FILES.listings, { listings: [] }).listings ?? []
  const byId = new Map(saved.map((s) => [s.id, s]))
  for (const a of relevant) byId.set(a.listing.id, toSaved(a))
  const all = [...byId.values()].sort((a, b) => b.score - a.score || a.price - b.price)
  writeJson(FILES.listings, {
    updatedAt: date,
    criteria: {
      budgetMax: criteria.budgetMax,
      sizes: criteria.sizes,
      zones: criteria.zones.filter((z) => z.enabled).map((z) => `${z.label} (${z.radiusKm} km autour de ${z.center})`),
    },
    count: all.length,
    listings: all,
  })

  // Journal : une entrée par jour avec de nouvelles annonces, la plus récente en haut.
  const entry = fresh.length > 0 || warnings.length > 0 ? journalEntry(relevant, rejected, warnings) : ''
  if (entry) {
    const previous = existsSync(FILES.journal) ? readFileSync(FILES.journal, 'utf8').replace(JOURNAL_TITLE, '').trim() : ''
    writeFileSync(FILES.journal, `${JOURNAL_TITLE}\n\n${entry}\n${previous ? `${previous}\n` : ''}`)
  }

  // Sorties pour la GitHub Action.
  const message =
    `Veille du ${date} : ${plural(relevant.length, 'annonce pertinente', 'annonces pertinentes')} ` +
    `sur ${fresh.length}${simulation ? ' (simulation)' : ''}`
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `analysed=${fresh.length}\nrelevant=${relevant.length}\ncommit_message=${message}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      entry || `## ${longDate(date)}\n\nAucune nouvelle annonce depuis la dernière exécution.\n`,
    )
  }
  console.log(message)
}

main()
