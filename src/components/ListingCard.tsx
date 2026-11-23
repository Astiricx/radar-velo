import { Calendar, ExternalLink, MapPin, Ruler, TrendingDown, Truck } from 'lucide-react'
import { SOURCES } from '../data/sources'
import { discountPct, distanceLabel, eur, isNewBike, priceDrop, promoPct, relativeDay, shortDate, yearLabel } from '../lib/format'
import { directUrl } from '../lib/links'
import type { Criteria, Row, Status } from '../types'
import { AttributeChips } from './AttributeChips'
import { BikeThumb } from './BikeThumb'
import { MarketBadge } from './MarketBadge'
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
  const { listing: l, score, zone, tracking } = row
  const brandNew = isNewBike(l)
  const discount = discountPct(l.price, l.newPrice)
  const promo = promoPct(l)
  const href = directUrl(l)
  const drop = priceDrop(l)

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <button type="button" onClick={() => onOpen(l.id)} className="relative block w-full text-left" aria-label={`Ouvrir la fiche : ${l.title}`}>
        <BikeThumb listing={l} width={420} showKind className="aspect-[16/10] w-full" />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className={`chip border-0 ${SOURCES[l.source].badge}`}>{SOURCES[l.source].label}</span>
          <MarketBadge listing={l} onImage />
          {row.isNew && <span className="chip bg-gold-soft text-gold">Ajoutée aujourd'hui</span>}
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
          {brandNew && l.originalPrice && promo !== null && (
            <span className="text-sm text-muted">
              <s className="tnum">{eur(l.originalPrice)}</s> <span className="font-semibold text-good">−{promo} %</span>
            </span>
          )}
          {!brandNew && discount !== null && <span className="text-sm text-muted">{discount} % sous le prix neuf</span>}
          {drop && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-good" title={`Prix relevé le ${shortDate(`${drop.since}T12:00:00Z`)}`}>
              <TrendingDown size={14} aria-hidden /> −{eur(drop.amount)}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Ruler size={14} aria-hidden />
            <dt className="sr-only">Taille</dt>
            <dd>
              Taille {l.size}, {brandNew && l.year === 0 ? 'neuf' : yearLabel(l.year)}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            <dt className="sr-only">{brandNew ? 'Repérée' : 'Publiée'}</dt>
            <dd>{brandNew ? `En vente, vue ${relativeDay(l.publishedAt)}` : `Publiée ${relativeDay(l.publishedAt)}`}</dd>
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-1.5">
            <MapPin size={14} aria-hidden className="shrink-0" />
            <dt className="sr-only">Lieu</dt>
            <dd className="min-w-0 truncate">
              {l.city}, {distanceLabel(zone.distance, zone.nearest?.center, zone.train)}
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

        {brandNew && l.sizesInStock && l.sizesInStock.length > 0 && (
          <p className="text-xs text-muted">En stock : {l.sizesInStock.join(', ')}</p>
        )}
        <AttributeChips listing={l} />
        {l.toVerify && l.toVerify.length > 0 && (
          <p className="text-xs text-warn">À vérifier : {l.toVerify.join(', ').toLowerCase()}.</p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <StatusSelect id={`card-status-${l.id}`} value={tracking.status} onChange={(s) => onStatus(l.id, s)} />
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              {brandNew ? 'Voir le vélo' : "Voir l'annonce"} <ExternalLink size={14} aria-hidden />
            </a>
          ) : (
            <span className="text-sm text-muted">{l.demo ? 'Annonce fictive' : 'Lien manquant'}</span>
          )}
        </div>
      </div>
    </article>
  )
}
