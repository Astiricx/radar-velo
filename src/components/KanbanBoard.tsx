import { useState } from 'react'
import { STATUSES } from '../lib/pipeline'
import { eur } from '../lib/format'
import type { Row, Status } from '../types'
import { BikeThumb } from './BikeThumb'
import { ScoreBib } from './ScoreBib'
import { StatusSelect } from './StatusSelect'

interface Props {
  rows: Row[]
  onOpen: (id: string) => void
  onStatus: (id: string, status: Status) => void
}

/** Pipeline d'achat : une colonne par statut. Les cartes se glissent d'une colonne à l'autre. */
export function KanbanBoard({ rows, onOpen, onStatus }: Props) {
  const [over, setOver] = useState<Status | null>(null)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {STATUSES.map((status) => {
          const items = rows.filter((r) => r.tracking.status === status.id)
          return (
            <section
              key={status.id}
              aria-label={status.label}
              onDragOver={(e) => { e.preventDefault(); setOver(status.id) }}
              onDragLeave={() => setOver((cur) => (cur === status.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain')
                if (id) onStatus(id, status.id)
                setOver(null)
              }}
              className={`flex w-[17rem] shrink-0 flex-col gap-2 rounded-lg border p-2 ${over === status.id ? 'border-accent bg-accent-soft' : 'border-line bg-raised'}`}
            >
              <header className="flex items-center gap-2 px-1 py-1">
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                <h3 className="text-sm font-semibold">{status.label}</h3>
                <span className="tnum ml-auto text-sm text-muted">{items.length}</span>
              </header>

              {items.length === 0 && <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Glisse une annonce ici</p>}

              {items.map(({ listing: l, score, tracking, zone }) => (
                <article
                  key={l.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move' }}
                  className="cursor-grab rounded-md border border-line bg-surface p-2 active:cursor-grabbing"
                >
                  <button type="button" onClick={() => onOpen(l.id)} className="flex w-full items-start gap-2 text-left">
                    <BikeThumb listing={l} width={96} className="h-12 w-[4.75rem] shrink-0 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug">{l.brand} {l.model}</span>
                      <span className="tnum font-display text-lg font-bold leading-tight">
                        {tracking.negotiatedPrice ? `${eur(Number(tracking.negotiatedPrice))} négocié` : eur(l.price)}
                      </span>
                    </span>
                    <ScoreBib score={score.total} size="sm" />
                  </button>
                  <p className="mt-1 text-xs text-muted">
                    {l.city}
                    {zone.nearest && zone.inside ? `, zone ${zone.nearest.center}` : l.shipping ? ', livraison' : ''}
                  </p>
                  {tracking.meetingAt && <p className="mt-1 text-xs text-muted">Rendez-vous : {new Date(tracking.meetingAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                  <StatusSelect id={`kanban-status-${l.id}`} value={tracking.status} onChange={(s) => onStatus(l.id, s)} className="mt-2 w-full" />
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
