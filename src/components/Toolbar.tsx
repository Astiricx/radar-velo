import { Kanban, LayoutGrid, RotateCcw, Search, Table2 } from 'lucide-react'
import { SOURCE_LIST } from '../data/sources'
import { TYPE_LABELS } from '../lib/criteria'
import { STATUSES } from '../lib/pipeline'
import type { BikeType, Filters, SortKey, ViewMode, Zone } from '../types'

interface Props {
  filters: Filters
  onFilters: (patch: Partial<Filters>) => void
  onResetFilters: () => void
  filtersActive: boolean
  types: BikeType[]
  zones: Zone[]
  sort: SortKey
  onSort: (sort: SortKey) => void
  view: ViewMode
  onView: (view: ViewMode) => void
  shown: number
  total: number
}

const VIEWS: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'cards', label: 'Cartes', icon: LayoutGrid },
  { id: 'table', label: 'Tableau', icon: Table2 },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
]

export function Toolbar(p: Props) {
  const { filters: f, onFilters } = p
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="q">Rechercher</label>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="q" type="search" className="field pl-9" value={f.query} onChange={(e) => onFilters({ query: e.target.value })} placeholder="Marque, modèle, ville" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-zone">Zone</label>
          <select id="f-zone" className="field" value={f.zone} onChange={(e) => onFilters({ zone: e.target.value })}>
            <option value="all">Toutes les zones</option>
            {p.zones.filter((z) => z.enabled).map((z) => (
              <option key={z.id} value={z.id}>{z.label}</option>
            ))}
            <option value="livraison">Hors zone, avec livraison</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-type">Type de vélo</label>
          <select id="f-type" className="field" value={f.type} onChange={(e) => onFilters({ type: e.target.value as Filters['type'] })}>
            <option value="all">Tous les types</option>
            {p.types.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="label" id="price-label">Prix (€)</span>
          <div className="flex items-center gap-1.5" role="group" aria-labelledby="price-label">
            <input id="f-min" aria-label="Prix minimum" type="number" min={0} step={100} inputMode="numeric" className="field w-24" value={f.priceMin} onChange={(e) => onFilters({ priceMin: e.target.value })} placeholder="Min" />
            <span className="text-muted">à</span>
            <input id="f-max" aria-label="Prix maximum" type="number" min={0} step={100} inputMode="numeric" className="field w-24" value={f.priceMax} onChange={(e) => onFilters({ priceMax: e.target.value })} placeholder="Max" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-status">Statut</label>
          <select id="f-status" className="field" value={f.status} onChange={(e) => onFilters({ status: e.target.value as Filters['status'] })}>
            <option value="all">Tous les statuts</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-source">Plateforme</label>
          <select id="f-source" className="field" value={f.source} onChange={(e) => onFilters({ source: e.target.value as Filters['source'] })}>
            <option value="all">Toutes</option>
            {SOURCE_LIST.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-sort">Trier par</label>
          <select id="f-sort" className="field" value={p.sort} onChange={(e) => p.onSort(e.target.value as SortKey)}>
            <option value="score">Score de pertinence</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="date">Plus récentes</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-line bg-surface" role="group" aria-label="Affichage">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={p.view === id}
              onClick={() => p.onView(id)}
              className={`inline-flex items-center gap-1.5 border-l border-line px-3 py-2 text-sm font-medium first:border-l-0 ${p.view === id ? 'bg-ink text-surface' : 'hover:bg-raised'}`}
            >
              <Icon size={15} aria-hidden /> {label}
            </button>
          ))}
        </div>
        {p.filtersActive && (
          <button type="button" onClick={p.onResetFilters} className="btn btn-quiet">
            <RotateCcw size={14} aria-hidden /> Effacer les filtres
          </button>
        )}
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {p.shown === p.total ? `${p.total} annonces` : `${p.shown} annonces sur ${p.total}`}
        </p>
      </div>
    </div>
  )
}
