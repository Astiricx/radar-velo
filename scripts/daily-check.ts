/**
 * Veille quotidienne : collecte les nouvelles annonces, les analyse et met à jour data/.
 *
 * Lancement : `npm run daily-check` (en local ou par la GitHub Action
 * .github/workflows/daily-analysis.yml).
 *
 * 1. Rassemble les annonces candidates :
 *    - Leboncoin et Troc-Vélo via Apify (scripts/apify), si le secret APIFY_TOKEN existe ;
 *    - data/inbox.json : annonces déposées à la main ;
 *    - la simulation du jour (scripts/simulation.ts), seulement si VEILLE_SIMULATION=true.
 * 2. Ignore celles déjà vues (data/state.json).
 * 3. Applique le filtre strict et le score de l'application (src/lib), pour les
 *    deux zones : région parisienne et Saint-Nazaire / Loire-Atlantique.
 * 4. Écrit data/listings.json (vraies annonces retenues, lues par le site),
 *    data/journal.md (une entrée par jour) et le résumé de l'exécution GitHub.
 *
 * Variables d'environnement :
 *   VEILLE_DATE        date analysée, AAAA-MM-JJ (par défaut : aujourd'hui, UTC)
 *   VEILLE_SIMULATION  « true » pour ajouter des annonces inventées (tests, jamais publiées)
 *   VEILLE_RESCAN      « true » pour réanalyser aussi les annonces déjà vues
 *   APIFY_TOKEN        clé d'API Apify ; réglages fins dans scripts/apify/config.ts
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CITIES } from '../src/data/cities'
import { SOURCES } from '../src/data/sources'
import { DEFAULT_CRITERIA, GROUPSET_LABELS, rejectionReason } from '../src/lib/criteria'
import { eur, plural } from '../src/lib/format'
import { isDirectAdUrl } from '../src/lib/links'
import { scoreListing } from '../src/lib/scoring'
import { matchZone } from '../src/lib/zones'
import type { Listing, ScoreResult, ZoneMatch } from '../src/types'
import { collectFromApify } from './apify'
import { PARSER_VERSION } from './apify/parse'
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
/** Une annonce qui n'a pas été revue depuis ce nombre de jours est retirée du site (vendue ou retirée). */
const MAX_AGE_DAYS = 45

const date = process.env.VEILLE_DATE?.match(/^\d{4}-\d{2}-\d{2}$/) ? process.env.VEILLE_DATE : new Date().toISOString().slice(0, 10)
const simulation = (process.env.VEILLE_SIMULATION ?? 'false').toLowerCase() === 'true'
/** « true » : réanalyse toutes les annonces collectées, même déjà vues (après un changement de règles). */
const rescan = (process.env.VEILLE_RESCAN ?? 'false').toLowerCase() === 'true'
const criteria = DEFAULT_CRITERIA

// ───────────── Types des fichiers de données ─────────────

interface State {
  lastRun: string | null
  /** Identifiant d'annonce → date à laquelle elle a été vue pour la première fois. */
  seen: Record<string, string>
}

/** Une annonce retenue, telle qu'enregistrée dans data/listings.json et lue par le site. */
type SavedListing = Listing & {
  firstSeen: string
  /** Dernière date où la collecte a encore vu l'annonce en ligne. */
  lastSeen: string
  score: number
  zone: string | null
  distanceKm: number | null
  scoreDetail: ScoreResult['parts']
  /** Motif d'exclusion selon les critères par défaut, ou null si retenue. */
  rejection: string | null
  /** Version des règles de lecture qui ont produit cette fiche. */
  parser?: number
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

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

// ───────────── Annonces déposées dans data/inbox.json ─────────────

const REQUIRED = ['id', 'source', 'url', 'title', 'brand', 'model', 'year', 'size', 'price', 'city', 'frame', 'brakes', 'groupset'] as const

/** Lit data/inbox.json. Les entrées incomplètes ou sans lien direct sont ignorées et signalées. */
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
    if (!isDirectAdUrl(String(e.url))) {
      warnings.push(`inbox.json, « ${String(e.title)} » ignorée : le lien n'ouvre pas une annonce précise (${String(e.url)}).`)
      return
    }
    if (!(String(e.city) in CITIES) && !e.coords) {
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
      firstSeen: date,
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

function journalEntry(relevant: Analysed[], rejected: Analysed[], notes: string[], warnings: string[]): string {
  const lines = [`## ${longDate(date)}`, '']
  for (const n of notes) lines.push(`- ${n}`)
  if (notes.length > 0) lines.push('')
  lines.push(
    `${plural(relevant.length + rejected.length, 'nouvelle annonce analysée', 'nouvelles annonces analysées')} : ` +
      `${plural(relevant.length, 'pertinente', 'pertinentes')}, ${plural(rejected.length, 'écartée', 'écartées')}.`,
    '',
  )
  if (relevant.length > 0) {
    lines.push('| Score | Annonce | Prix | Taille | Transmission | Zone | Lieu | Source |')
    lines.push('| ---: | --- | ---: | --- | --- | --- | --- | --- |')
    for (const a of relevant) {
      const l = a.listing
      const name = a.simulated || !l.url ? `${cell(l.title)} *(simulée)*` : `[${cell(l.title)}](${l.url})`
      lines.push(
        `| **${a.score.total}** | ${name} | ${eur(l.price)} | ${cell(l.size)} | ${GROUPSET_LABELS[l.groupset]}${l.powerMeter ? ', capteur' : ''} | ${a.zone.inside && a.zone.nearest ? cell(a.zone.nearest.label) : 'Hors zone'} | ${place(a)} | ${SOURCE_LABEL(l.source)} |`,
      )
    }
    lines.push('')
    const doubts = relevant.filter((a) => a.listing.toVerify?.length)
    if (doubts.length > 0) {
      lines.push('À vérifier avant de contacter le vendeur :', '')
      for (const a of doubts) lines.push(`- ${cell(a.listing.title)} : ${a.listing.toVerify!.join(' ; ').toLowerCase()}`)
      lines.push('')
    }
  }
  if (rejected.length > 0) {
    lines.push('Écartées :', '')
    for (const a of rejected) {
      const name = a.listing.url && !a.simulated ? `[${cell(a.listing.title)}](${a.listing.url})` : cell(a.listing.title)
      lines.push(`- ${name}, ${eur(a.listing.price)} : ${a.rejection}`)
    }
    lines.push('')
  }
  if (warnings.length > 0) {
    lines.push('Avertissements :', '')
    for (const w of warnings) lines.push(`- ${w}`)
    lines.push('')
  }
  return lines.join('\n')
}

function toSaved(a: Analysed, firstSeen: string): SavedListing {
  return {
    ...a.listing,
    firstSeen,
    lastSeen: date,
    parser: PARSER_VERSION,
    score: a.score.total,
    zone: a.zone.inside && a.zone.nearest ? a.zone.nearest.label : null,
    distanceKm: Number.isFinite(a.zone.distance) ? a.zone.distance : null,
    scoreDetail: a.score.parts,
    rejection: a.rejection,
  }
}

function analyse(listing: Listing, simulated: boolean): Analysed {
  const zone = matchZone(listing, criteria.zones)
  return { listing, simulated, zone, rejection: rejectionReason(listing, criteria, zone), score: scoreListing(listing, criteria, zone) }
}

// ───────────── Programme principal ─────────────

async function main() {
  mkdirSync(DATA, { recursive: true })
  const warnings: string[] = []
  const state = readJson<State>(FILES.state, { lastRun: null, seen: {} })
  state.seen ??= {}

  // Fiches Troc-Vélo et Decathlon lues avec d'anciennes règles : on les oublie pour qu'elles
  // soient rouvertes et relues (elles ne sont rouvertes que si elles ne sont plus « déjà vues »).
  const saved = readJson<{ listings?: SavedListing[] }>(FILES.listings, {}).listings ?? []
  const outdated = new Set(saved.filter((s) => s.source !== 'leboncoin' && s.parser !== PARSER_VERSION).map((s) => s.id))
  for (const id of outdated) delete state.seen[id]
  if (outdated.size > 0) console.log(`${outdated.size} fiche(s) lue(s) avec d'anciennes règles : à relire.`)

  // En réanalyse complète, on rouvre aussi les fiches déjà vues.
  const collected = await collectFromApify(date, warnings, rescan ? [] : Object.keys(state.seen))
  const inbox = readInbox(warnings)
  const real = [...collected.listings, ...inbox].map((listing) => ({ listing, simulated: false }))
  const simulated = simulation ? simulateDay(date).map((listing) => ({ listing, simulated: true })) : []

  // Une seule fois par identifiant, même si deux recherches renvoient la même annonce.
  const candidates = [...new Map([...real, ...simulated].map((c) => [c.listing.id, c])).values()]
  const fresh = rescan ? candidates : candidates.filter(({ listing }) => !state.seen[listing.id])
  const analysed = fresh.map(({ listing, simulated: sim }) => analyse(listing, sim))
  const relevant = analysed.filter((a) => !a.rejection).sort((a, b) => b.score.total - a.score.total)
  const rejected = analysed.filter((a) => a.rejection)

  console.log(`Veille du ${date}${simulation ? ' — avec simulation' : ''}`)
  for (const n of collected.notes) console.log(`  · ${n}`)
  console.log(`Candidates : ${candidates.length} (dont ${inbox.length} de data/inbox.json), nouvelles : ${fresh.length}`)
  for (const { listing } of candidates) if (!fresh.some((f) => f.listing.id === listing.id) && listing.source !== 'leboncoin') console.log(`  = déjà analysée, mise à jour : ${listing.title}  ${listing.url}`)
  for (const a of relevant) console.log(`  ✓ ${a.score.total}/100  ${a.listing.title}  ${eur(a.listing.price)}  ${a.listing.city}  ${a.listing.url}`)
  for (const a of rejected) console.log(`  ✗ ${a.listing.title} : ${a.rejection}`)
  for (const w of warnings) console.warn(`  ! ${w}`)

  // État : les annonces analysées ne seront plus retraitées.
  for (const { listing } of fresh) state.seen[listing.id] = date
  state.lastRun = date
  writeJson(FILES.state, state)

  // Annonces publiées sur le site : vraies annonces avec un lien direct, retenues ou écartées
  // (le site affiche les écartées avec leur motif).
  const byId = new Map(
    saved.filter((s) => !(s as { simulated?: boolean }).simulated && s.frame && isDirectAdUrl(s.url) && !outdated.has(s.id)).map((s) => [s.id, s]),
  )
  for (const a of analysed) {
    if (a.simulated || !isDirectAdUrl(a.listing.url)) continue
    byId.set(a.listing.id, toSaved(a, byId.get(a.listing.id)?.firstSeen ?? date))
  }
  // Annonce déjà retenue et toujours en ligne : prix, photos et texte du jour.
  let refreshed = 0
  for (const { listing } of real) {
    const saved = byId.get(listing.id)
    if (!saved || fresh.some((f) => f.listing.id === listing.id)) continue
    byId.set(listing.id, toSaved(analyse({ ...listing, firstSeen: saved.firstSeen }, false), saved.firstSeen))
    refreshed++
  }
  const kept = [...byId.values()]
    .filter((s) => daysBetween(s.lastSeen ?? s.firstSeen, date) <= MAX_AGE_DAYS)
    .sort((a, b) => Number(!!a.rejection) - Number(!!b.rejection) || b.score - a.score || a.price - b.price)
  writeJson(FILES.listings, {
    updatedAt: date,
    criteria: {
      budgetMax: criteria.budgetMax,
      sizes: criteria.sizes,
      zones: criteria.zones.filter((z) => z.enabled).map((z) => `${z.label} (${z.radiusKm} km autour de ${z.center})`),
    },
    count: kept.length,
    retained: kept.filter((s) => !s.rejection).length,
    listings: kept,
  })

  // Journal : une entrée par jour avec de nouvelles annonces ou un message utile, la plus récente en haut.
  const entry = fresh.length > 0 || warnings.length > 0 ? journalEntry(relevant, rejected, collected.notes, warnings) : ''
  if (entry) {
    const old = existsSync(FILES.journal) ? readFileSync(FILES.journal, 'utf8').replace(JOURNAL_TITLE, '').trim() : ''
    writeFileSync(FILES.journal, `${JOURNAL_TITLE}\n\n${entry}\n${old ? `${old}\n` : ''}`)
  }

  // Sorties pour la GitHub Action.
  const message =
    `Veille du ${date} : ${plural(relevant.length, 'annonce pertinente', 'annonces pertinentes')} ` +
    `sur ${fresh.length}${simulation ? ' (simulation)' : ''}${refreshed ? `, ${plural(refreshed, 'annonce mise à jour', 'annonces mises à jour')}` : ''}`
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `analysed=${fresh.length}\nrelevant=${relevant.length}\ncommit_message=${message}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      entry || `## ${longDate(date)}\n\n${collected.notes.map((n) => `- ${n}\n`).join('')}\nAucune nouvelle annonce depuis la dernière exécution.\n`,
    )
  }
  console.log(message)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
