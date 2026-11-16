import { Bell, Check } from 'lucide-react'
import type { Row } from '../types'

interface Props {
  rows: Row[]
  onOpen: (id: string) => void
  onDone: (id: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Rappels posés sur les annonces, du plus urgent au plus lointain. */
export function Reminders({ rows, onOpen, onDone }: Props) {
  const due = rows
    .filter((r) => r.tracking.reminderAt)
    .sort((a, b) => a.tracking.reminderAt.localeCompare(b.tracking.reminderAt))
  if (due.length === 0) return null

  return (
    <section aria-label="Rappels" className="rounded-lg border border-line bg-surface p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Bell size={15} aria-hidden /> Rappels
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {due.map(({ listing: l, tracking: t }) => {
          const late = t.reminderAt <= today()
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className={`chip tnum ${late ? 'bg-warn-soft text-warn' : 'border border-line text-muted'}`}>
                {new Date(`${t.reminderAt}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <button type="button" onClick={() => onOpen(l.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
                <span className="font-medium">{t.reminderText || 'Rappel'}</span>
                <span className="text-muted">, {l.brand} {l.model}</span>
              </button>
              <button type="button" onClick={() => onDone(l.id)} className="btn btn-quiet px-2 py-1">
                <Check size={14} aria-hidden /> Fait
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
