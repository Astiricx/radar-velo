import { useCallback, useMemo, useState } from 'react'
import { AddListingDialog } from './components/AddListingDialog'
import { CriteriaPanel } from './components/CriteriaPanel'
import { DetailDrawer } from './components/DetailDrawer'
import { Header } from './components/Header'
import { KanbanBoard } from './components/KanbanBoard'
import { ListingCard } from './components/ListingCard'
import { ListingTable } from './components/ListingTable'
import { Reminders } from './components/Reminders'
import { Summary } from './components/Summary'
import { Toolbar } from './components/Toolbar'
import { useTheme } from './hooks/useTheme'
import { LAST_BATCH, listingsUpTo, runSearch } from './lib/aggregator'
import { DEFAULT_CRITERIA, rejectionReason } from './lib/criteria'
import { relativeDay } from './lib/format'
import { EMPTY_TRACKING } from './lib/pipeline'
import { scoreListing } from './lib/scoring'
import { clearAllStorage, useLocalStorage } from './lib/storage'
import { matchZone } from './lib/zones'
import type { Criteria, Filters, Listing, Row, SortKey, Status, SyncState, Tracking, ViewMode } from './types'

const NO_FILTERS: Filters = { query: '', zone: 'all', type: 'all', source: 'all', status: 'all', priceMin: '', priceMax: '' }
const FIRST_SYNC: SyncState = { batch: 1, lastRun: null, newIds: [] }
const NO_TRACKING: Record<string, Tracking> = {}
const NO_CUSTOM: Listing[] = []

const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  score: (a, b) => b.score.total - a.score.total || a.listing.price - b.listing.price,
  'price-asc': (a, b) => a.listing.price - b.listing.price,
  'price-desc': (a, b) => b.listing.price - a.listing.price,
  date: (a, b) => b.listing.publishedAt.localeCompare(a.listing.publishedAt),
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [criteria, setCriteria, resetCriteria] = useLocalStorage<Criteria>('criteria-zones', DEFAULT_CRITERIA)
  const [tracking, setTracking] = useLocalStorage<Record<string, Tracking>>('tracking', NO_TRACKING)
  const [custom, setCustom] = useLocalStorage<Listing[]>('custom', NO_CUSTOM)
  const [sync, setSync] = useLocalStorage<SyncState>('sync', FIRST_SYNC)
  const [filters, setFilters] = useLocalStorage<Filters>('filters', NO_FILTERS)
  const [sort, setSort] = useLocalStorage<SortKey>('sort', 'score')
  const [view, setView] = useLocalStorage<ViewMode>('view', 'cards')

  const [openId, setOpenId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'criteria' | 'add' | null>(null)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')

  // Toutes les annonces connues, enrichies : zone, filtre automatique, score, suivi.
  const rows = useMemo<Row[]>(() => {
    return [...custom, ...listingsUpTo(sync.batch)].map((listing) => {
      const zone = matchZone(listing, criteria.zones)
      return {
        listing,
        zone,
        rejection: rejectionReason(listing, criteria, zone),
        score: scoreListing(listing, criteria, zone),
        tracking: { ...EMPTY_TRACKING, ...tracking[listing.id] },
        isNew: sync.newIds.includes(listing.id),
      }
    })
  }, [custom, sync, criteria, tracking])

  const kept = useMemo(() => rows.filter((r) => !r.rejection), [rows])
  const rejected = useMemo(() => rows.filter((r) => r.rejection), [rows])

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const min = filters.priceMin === '' ? 0 : Number(filters.priceMin)
    const max = filters.priceMax === '' ? Number.POSITIVE_INFINITY : Number(filters.priceMax)
    return kept
      .filter(({ listing: l, tracking: t, zone }) => {
        if (filters.zone === 'livraison' && zone.inside) return false
        if (filters.zone !== 'all' && filters.zone !== 'livraison' && !(zone.inside && zone.nearest?.id === filters.zone)) return false
        if (filters.type !== 'all' && l.type !== filters.type) return false
        if (filters.source !== 'all' && l.source !== filters.source) return false
        if (filters.status !== 'all' && t.status !== filters.status) return false
        if (l.price < min || l.price > max) return false
        return q === '' || `${l.title} ${l.brand} ${l.model} ${l.city}`.toLowerCase().includes(q)
      })
      .sort(SORTERS[sort])
  }, [kept, filters, sort])

  const patchTracking = useCallback(
    (id: string, patch: Partial<Tracking>) =>
      setTracking((all) => ({ ...all, [id]: { ...EMPTY_TRACKING, ...all[id], ...patch } })),
    [setTracking],
  )
  const setStatus = useCallback((id: string, status: Status) => patchTracking(id, { status }), [patchTracking])
  const closeDrawer = useCallback(() => setOpenId(null), [])
  const closePanel = useCallback(() => setPanel(null), [])

  async function search() {
    if (searching) return
    if (sync.batch >= LAST_BATCH) {
      setSync({ ...sync, lastRun: new Date().toISOString(), newIds: [] })
      setMessage('Aucune nouvelle annonce depuis la dernière recherche.')
      return
    }
    setSearching(true)
    const next = sync.batch + 1
    const found = await runSearch(next, (source) => setMessage(`Recherche sur ${source.label}…`))
    const out = found.filter((l) => rejectionReason(l, criteria, matchZone(l, criteria.zones))).length
    setSync({ batch: next, lastRun: new Date().toISOString(), newIds: found.map((l) => l.id) })
    setMessage(
      `${found.length} nouvelles annonces trouvées` + (out > 0 ? `, dont ${out} ${out > 1 ? 'écartées' : 'écartée'} par tes critères.` : '.'),
    )
    setSearching(false)
  }

  function resetAll() {
    clearAllStorage()
    window.location.reload()
  }

  const opened = openId ? rows.find((r) => r.listing.id === openId) : undefined
  const zoneNames = criteria.zones.filter((z) => z.enabled).map((z) => z.center).join(' et ') || 'aucune zone active'
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  const status =
    message ||
    (sync.lastRun
      ? `Dernière recherche ${relativeDay(sync.lastRun)}, ${zoneNames}`
      : `Leboncoin, Troc-Vélo et Decathlon Occasion, ${zoneNames}`)

  return (
    <div className="min-h-full">
      <Header
        searching={searching}
        status={status}
        onSearch={search}
        onAdd={() => setPanel('add')}
        onCriteria={() => setPanel('criteria')}
        theme={theme}
        onTheme={setTheme}
      />

      <main className="gutter mx-auto flex max-w-[84rem] flex-col gap-5 py-5">
        <Summary
          criteria={criteria}
          kept={kept}
          rejected={rejected}
          zoneFilter={filters.zone}
          onZone={(zone) => setFilters((f) => ({ ...f, zone }))}
          onOpen={setOpenId}
          onCriteria={() => setPanel('criteria')}
        />
        <Reminders rows={rows} onOpen={setOpenId} onDone={(id) => patchTracking(id, { reminderAt: '', reminderText: '' })} />
        <Toolbar
          filters={filters}
          onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onResetFilters={() => setFilters(NO_FILTERS)}
          filtersActive={filtersActive}
          types={criteria.types}
          zones={criteria.zones}
          sort={sort}
          onSort={setSort}
          view={view}
          onView={setView}
          shown={visible.length}
          total={kept.length}
        />

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-muted">
            {kept.length === 0
              ? 'Aucune annonce ne respecte tes critères. Élargis le budget, les tailles ou le rayon dans « Critères ».'
              : 'Aucune annonce ne correspond à ces filtres. Efface-les pour tout revoir.'}
          </p>
        ) : view === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <ListingCard key={row.listing.id} row={row} criteria={criteria} onOpen={setOpenId} onStatus={setStatus} />
            ))}
          </div>
        ) : view === 'table' ? (
          <ListingTable rows={visible} criteria={criteria} sort={sort} onSort={setSort} onOpen={setOpenId} onStatus={setStatus} />
        ) : (
          <KanbanBoard rows={visible} onOpen={setOpenId} onStatus={setStatus} />
        )}

        <footer className="border-t border-line pt-4 text-xs text-muted">
          Les annonces fournies avec l'application sont des exemples réalistes, pas de vraies annonces : leur lien ouvre
          la recherche équivalente sur la plateforme, et leur photo montre un vélo comparable (photos Unsplash). Les
          annonces que tu ajoutes gardent la photo du vendeur. Tes statuts, notes, critères et annonces ajoutées restent
          dans ce navigateur.
        </footer>
      </main>

      {opened && (
        <DetailDrawer
          key={opened.listing.id}
          row={opened}
          criteria={criteria}
          onClose={closeDrawer}
          onStatus={setStatus}
          onPatch={patchTracking}
          onDelete={(id) => {
            setCustom((list) => list.filter((l) => l.id !== id))
            setOpenId(null)
          }}
        />
      )}
      {panel === 'criteria' && (
        <CriteriaPanel criteria={criteria} onChange={setCriteria} onResetCriteria={resetCriteria} onResetAll={resetAll} onClose={closePanel} />
      )}
      {panel === 'add' && (
        <AddListingDialog
          defaultCity={criteria.zones.find((z) => z.enabled)?.center ?? 'Paris'}
          onClose={closePanel}
          onAdd={(listing) => {
            setCustom((list) => [listing, ...list])
            setPanel(null)
            setOpenId(listing.id)
          }}
        />
      )}
    </div>
  )
}
