import { Bike, Monitor, Moon, Plus, RefreshCw, SlidersHorizontal, Sun } from 'lucide-react'
import type { ThemeMode } from '../hooks/useTheme'

interface Props {
  searching: boolean
  /** Texte du bouton principal : « Actualiser » avec les vraies annonces. */
  searchLabel: string
  status: string
  onSearch: () => void
  onAdd: () => void
  onCriteria: () => void
  theme: ThemeMode
  onTheme: (mode: ThemeMode) => void
}

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Thème clair', icon: Sun },
  { id: 'dark', label: 'Thème sombre', icon: Moon },
  { id: 'system', label: 'Thème du système', icon: Monitor },
]

export function Header({ searching, searchLabel, status, onSearch, onAdd, onCriteria, theme, onTheme }: Props) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="gutter mx-auto flex max-w-[84rem] flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent text-on-accent">
            <Bike size={22} aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Radar vélo d'occasion</h1>
            <p className="mt-1 text-xs text-muted" aria-live="polite">{status}</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSearch} disabled={searching} className="btn btn-primary">
            <RefreshCw size={15} aria-hidden className={searching ? 'animate-spin' : ''} />
            {searching ? 'Chargement' : searchLabel}
          </button>
          <button type="button" onClick={onAdd} className="btn">
            <Plus size={15} aria-hidden /> Ajouter une annonce
          </button>
          <button type="button" onClick={onCriteria} className="btn">
            <SlidersHorizontal size={15} aria-hidden /> Critères
          </button>
          <div className="inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label="Thème">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={theme === id}
                onClick={() => onTheme(id)}
                className={`border-l border-line p-2 first:border-l-0 ${theme === id ? 'bg-ink text-surface' : 'bg-surface hover:bg-raised'}`}
              >
                <Icon size={16} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
