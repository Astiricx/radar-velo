import { ArrowUpDown, ExternalLink } from 'lucide-react'
import { SOURCES } from '../data/sources'
import { distanceLabel, eur, isNewBike, promoPct, relativeDay } from '../lib/format'
import { directUrl } from '../lib/links'
import type { Criteria, Row, SortKey, Status } from '../types'
import { BikeThumb } from './BikeThumb'
import { MarketBadge } from './MarketBadge'
import { ScoreBib } from './ScoreBib'
import { StatusSelect } from './StatusSelect'
import { ZoneBadge } from './ZoneBadge'

interface Props {
  rows: Row[]
  criteria: Criteria
  sort: SortKey
  onSort: (sort: SortKey) => void
  onOpen: (id: string) => void
  onStatus: (id: string, status: Status) => void
}

export function ListingTable({ rows, criteria, sort, onSort, onOpen, onStatus }: Props) {
  const sortButton = (label: string, key: SortKey, alt?: SortKey) => {
    const active = sort === key || sort === alt
    return (
      <button
        type="button"
        onClick={() => onSort(alt && sort === key ? alt : key)}
        className={`inline-flex items-center gap-1 font-semibold ${active ? 'text-accent' : ''}`}
        aria-label={`Trier par ${label.toLowerCase()}`}
      >
        {label} <ArrowUpDown size={12} aria-hidden />
      </button>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-raised text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">Annonce</th>
            <th scope="col" className="px-3 py-2.5">{sortButton('Score', 'score')}</th>
            <th scope="col" className="px-3 py-2.5 text-right">{sortButton('Prix', 'price-asc', 'price-desc')}</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Taille</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Lieu et zone</th>
            <th scope="col" className="px-3 py-2.5">{sortButton('Publiée', 'date')}</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Statut</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Lien</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ listing: l, score, zone, tracking, isNew }) => (
            <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer border-t border-line hover:bg-raised">
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <BikeThumb listing={l} width={112} className="h-14 w-[5.5rem] shrink-0 rounded" />
                  <div className="min-w-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(l.id) }} className="block max-w-[19rem] truncate text-left font-semibold hover:underline">
                      {l.title}
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="truncate">
                        {l.brand} {l.model}{' '}
                        <span className={`ml-1 inline-block rounded px-1.5 py-px text-[11px] font-medium ${SOURCES[l.source].badge}`}>{SOURCES[l.source].label}</span>
                      </span>
                      {isNew && <span className="chip bg-gold-soft text-gold">Ajoutée aujourd'hui</span>}
                    </div>
                    <div className="mt-1">
                      <MarketBadge listing={l} />
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2"><ScoreBib score={score.total} size="sm" /></td>
              <td className="tnum px-3 py-2 text-right">
                <div className="font-display text-xl font-bold">{eur(l.price)}</div>
                {isNewBike(l) && l.originalPrice && promoPct(l) !== null && (
                  <div className="whitespace-nowrap text-xs text-muted">
                    <s>{eur(l.originalPrice)}</s> <span className="font-semibold text-good">−{promoPct(l)} %</span>
                  </div>
                )}
              </td>
              <td className="px-3 py-2">{l.size}</td>
              <td className="px-3 py-2">
                <div>{l.city}</div>
                <div className="text-xs text-muted first-letter:uppercase">
                  {isNewBike(l) ? 'expédié par le magasin' : `${distanceLabel(zone.distance, zone.nearest?.center, zone.train)}${l.shipping ? ', livraison' : ''}`}
                </div>
                <div className="mt-1">
                  <ZoneBadge zone={zone} criteria={criteria} shipping={l.shipping} short />
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{relativeDay(l.publishedAt)}</td>
              <td className="px-3 py-2">
                <StatusSelect id={`table-status-${l.id}`} value={tracking.status} onChange={(s) => onStatus(l.id, s)} className="w-40" />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {directUrl(l) ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-accent hover:underline" aria-label={`Voir l'annonce sur ${SOURCES[l.source].label}`}>
                    Ouvrir <ExternalLink size={14} aria-hidden />
                  </a>
                ) : (
                  <span className="text-muted">{l.demo ? 'Fictive' : '—'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
