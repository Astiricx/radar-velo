import { Trophy } from 'lucide-react'
import { SOURCES } from '../data/sources'
import { distanceLabel, eur, priceDrop } from '../lib/format'
import type { Row, ScorePart } from '../types'
import { BikeThumb } from './BikeThumb'
import { ScoreBib } from './ScoreBib'

interface Props {
  /** Annonces retenues et filtrées, déjà triées par score. */
  rows: Row[]
  onOpen: (id: string) => void
}

const PLACES = ['1er', '2e', '3e']

/** Critères où l'annonce marque presque tout, et ceux où elle perd le plus de points. */
function strengths(parts: ScorePart[]) {
  const ratio = (p: ScorePart) => (p.max > 0 ? p.points / p.max : 0)
  const best = parts.filter((p) => p.max > 0 && ratio(p) >= 0.8).sort((a, b) => b.max - a.max).slice(0, 3)
  const weak = parts
    .filter((p) => !best.includes(p) && p.max - p.points >= 3)
    .sort((a, b) => b.max - b.points - (a.max - a.points))
    .slice(0, 2)
  return { best, weak }
}

/**
 * Podium : les trois meilleures annonces selon le score, avec ce qui leur vaut leurs points
 * et ce qui leur en fait perdre. Il suit les filtres (zone, type, plateforme, prix).
 */
export function Podium({ rows, onOpen }: Props) {
  const top = [...rows].sort((a, b) => b.score.total - a.score.total || a.listing.price - b.listing.price).slice(0, 3)
  if (top.length === 0) return null
  return (
    <section aria-labelledby="podium-title" className="flex flex-col gap-3">
      <h2 id="podium-title" className="flex items-center gap-2 font-display text-xl font-bold">
        <Trophy size={18} aria-hidden className="text-gold" /> Podium
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {top.map((row, i) => {
          const { listing: l, score, zone } = row
          const { best, weak } = strengths(score.parts)
          const drop = priceDrop(l)
          return (
            <li key={l.id} className={`min-w-0 rounded-lg border bg-surface ${i === 0 ? 'border-gold' : 'border-line'}`}>
              <button type="button" onClick={() => onOpen(l.id)} className="flex h-full w-full flex-col gap-3 p-3 text-left hover:bg-raised" aria-label={`${PLACES[i]} : ${l.title}`}>
                <div className="flex items-start gap-3">
                  <span className={`tnum font-display text-2xl font-bold leading-none ${i === 0 ? 'text-gold' : 'text-muted'}`}>{PLACES[i]}</span>
                  <BikeThumb listing={l} width={128} className="h-16 w-24 shrink-0 rounded" />
                  <span className="ml-auto">
                    <ScoreBib score={score.total} size="sm" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-snug">{l.title}</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="tnum font-display text-lg font-bold">{eur(l.price)}</span>
                    {drop && <span className="text-good">−{eur(drop.amount)}</span>}
                    <span className={`rounded px-1.5 py-px text-[11px] font-medium ${SOURCES[l.source].badge}`}>{SOURCES[l.source].label}</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {l.shipping && !zone.inside ? `${l.city}, livraison` : `${l.city}, ${distanceLabel(zone.distance, zone.nearest?.center, zone.train)}`}
                  </p>
                </div>
                <ul className="mt-auto flex flex-col gap-1 text-xs">
                  {best.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2">
                      <span className="truncate">{p.label} : {p.detail}</span>
                      <span className="tnum shrink-0 text-good">{Math.round(p.points)}/{p.max}</span>
                    </li>
                  ))}
                  {weak.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2 text-muted">
                      <span className="truncate">{p.label} : {p.detail}</span>
                      <span className="tnum shrink-0 text-warn">{Math.round(p.points)}/{p.max}</span>
                    </li>
                  ))}
                </ul>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
