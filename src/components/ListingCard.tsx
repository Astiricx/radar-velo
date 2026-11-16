import { Calendar, ExternalLink, MapPin, Ruler, Truck } from 'lucide-react'
import { SOURCES } from '../data/sources'
import { discountPct, distanceLabel, eur, relativeDay } from '../lib/format'
import type { Criteria, Row, Status } from '../types'
import { AttributeChips } from './AttributeChips'
import { BikeThumb } from './BikeThumb'
import { ScoreBib } from './ScoreBib'
import { StatusSelect } from './StatusSelect'
import { ZoneBadge } from './ZoneBadge'

interface Props {
  row: Row
  criteria: Criteria
  onOpen: (id: string) => void
  onStatus: (id: string, status: Status) => void
}

export function ListingCard({ row, criteria, onOpen, onStatus }: Props) {
  const { listing: l, score, zone, tracking, isNew } = row
  const discount = discountPct(l.price, l.newPrice)

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <button type="button" onClick={() => onOpen(l.id)} className="relative block w-full text-left" aria-label={`Ouvrir la fiche : ${l.title}`}>
        <BikeThumb listing={l} width={420} showKind className="aspect-[16/10] w-full" />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="chip bg-surface/90 text-ink">{SOURCES[l.source].label}</span>
          {isNew && <span className="chip bg-gold-soft text-gold">Nouveau</span>}
        </span>
        <span className="absolute -bottom-5 right-3">
          <ScoreBib score={score.total} />
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="pr-16">
          <h3 className="text-base font-semibold leading-snug">
            <button type="button" onClick={() => onOpen(l.id)} className="text-left hover:underline">
              {l.title}
            </button>
          </h3>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="tnum font-display text-3xl font-bold leading-none">{eur(l.price)}</span>
          {discount !== null && <span className="text-sm text-muted">{discount} % sous le prix neuf</span>}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Ruler size={14} aria-hidden />
            <dt className="sr-only">Taille</dt>
            <dd>
              Taille {l.size}, {l.year}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            <dt className="sr-only">Publiée</dt>
            <dd>Publiée {relativeDay(l.publishedAt)}</dd>
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-1.5">
            <MapPin size={14} aria-hidden className="shrink-0" />
            <dt className="sr-only">Lieu</dt>
            <dd className="min-w-0 truncate">
              {l.city}, {distanceLabel(zone.distance, zone.nearest?.center)}
            </dd>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5">
            <dt className="sr-only">Zone</dt>
            <dd className="contents">
              <ZoneBadge zone={zone} criteria={criteria} shipping={l.shipping} />
              {l.shipping && (
                <span className="chip border border-line text-muted">
                  <Truck size={12} aria-hidden /> Livraison possible
                </span>
              )}
            </dd>
          </div>
        </dl>

        <AttributeChips listing={l} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <StatusSelect id={`card-status-${l.id}`} value={tracking.status} onChange={(s) => onStatus(l.id, s)} />
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Voir l'annonce <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}
