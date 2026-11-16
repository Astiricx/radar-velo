import { Ban, MapPin, TrainFront } from 'lucide-react'
import { GROUPSET_LABELS, TYPE_LABELS } from '../lib/criteria'
import { eur, plural } from '../lib/format'
import { DEFAULT_TRAIN, TRAIN_TONE, TRAIN_ZONE_ID, ZONE_TONES } from '../lib/zones'
import type { Criteria, Row, ZoneFilter } from '../types'
import { BikeThumb } from './BikeThumb'

interface Props {
  criteria: Criteria
  kept: Row[]
  rejected: Row[]
  zoneFilter: ZoneFilter
  onZone: (zone: ZoneFilter) => void
  onOpen: (id: string) => void
  onCriteria: () => void
}

/** Rappel des critères appliqués et liste des annonces écartées par le filtre automatique. */
export function Summary({ criteria: c, kept, rejected, zoneFilter, onZone, onOpen, onCriteria }: Props) {
  const zones = c.zones.filter((z) => z.enabled)
  const countIn = (id: string) => kept.filter((r) => r.zone.inside && r.zone.nearest?.id === id).length
  const shippedOnly = kept.filter((r) => !r.zone.inside).length
  const byTrain = kept.filter((r) => r.zone.train).length
  const train = { ...DEFAULT_TRAIN, ...c.train }
  const lines = [
    c.types.map((t) => TYPE_LABELS[t]).join(', ') || 'Aucun type',
    `Taille ${c.sizes.join(', ') || 'indifférente'}`,
    `Idéal ${eur(c.budgetIdeal)}, maximum ${eur(c.budgetMax)}`,
    train.enabled ? `Train depuis Paris, moins de ${String(train.maxHours).replace('.', ',')} h` : '',
    c.acceptShipping ? 'Livraison acceptée hors zones' : 'Remise en main propre uniquement',
    [c.requireCarbon && 'Cadre carbone', c.requireDisc && 'Freins à disque'].filter(Boolean).join(', '),
    c.groupsets.map((g) => GROUPSET_LABELS[g]).join(', '),
  ].filter(Boolean)

  return (
    <section aria-label="Critères appliqués" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <p className="font-display text-2xl font-bold leading-tight">
          <span className="tnum">{kept.length}</span> {kept.length > 1 ? 'annonces retenues' : 'annonce retenue'},{' '}
          <span className="tnum text-muted">{rejected.length} {rejected.length > 1 ? 'écartées' : 'écartée'}</span>
        </p>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {lines.map((line) => (
            <li key={line} className="chip border border-line text-ink">{line}</li>
          ))}
        </ul>
        <button type="button" onClick={onCriteria} className="text-sm font-medium text-accent hover:underline">Modifier les critères</button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Annonces par zone">
        {zones.map((z) => {
          const index = c.zones.findIndex((x) => x.id === z.id)
          const active = zoneFilter === z.id
          return (
            <button
              key={z.id}
              type="button"
              aria-pressed={active}
              onClick={() => onZone(active ? 'all' : z.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${active ? 'border-ink' : 'border-line hover:bg-raised'}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded ${ZONE_TONES[index] ?? ZONE_TONES[0]}`}>
                <MapPin size={15} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold leading-tight">{z.label}</span>
                <span className="block text-xs text-muted">
                  <span className="tnum">{plural(countIn(z.id), 'annonce', 'annonces')}</span>, {z.radiusKm} km autour de {z.center}
                </span>
              </span>
            </button>
          )
        })}
        {train.enabled && (
          <button
            type="button"
            aria-pressed={zoneFilter === TRAIN_ZONE_ID}
            onClick={() => onZone(zoneFilter === TRAIN_ZONE_ID ? 'all' : TRAIN_ZONE_ID)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${zoneFilter === TRAIN_ZONE_ID ? 'border-ink' : 'border-line hover:bg-raised'}`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded ${TRAIN_TONE}`}>
              <TrainFront size={15} aria-hidden />
            </span>
            <span>
              <span className="block font-semibold leading-tight">Accessible en train</span>
              <span className="block text-xs text-muted">
                <span className="tnum">{plural(byTrain, 'annonce', 'annonces')}</span>, moins de {String(train.maxHours).replace('.', ',')} h depuis Paris
              </span>
            </span>
          </button>
        )}
        {c.acceptShipping && shippedOnly > 0 && (
          <button
            type="button"
            aria-pressed={zoneFilter === 'livraison'}
            onClick={() => onZone(zoneFilter === 'livraison' ? 'all' : 'livraison')}
            className={`rounded-md border px-3 py-2 text-left text-sm ${zoneFilter === 'livraison' ? 'border-ink' : 'border-line hover:bg-raised'}`}
          >
            <span className="block font-semibold leading-tight">Hors zone, livraison</span>
            <span className="block text-xs text-muted tnum">{plural(shippedOnly, 'annonce', 'annonces')}</span>
          </button>
        )}
      </div>

      {rejected.length > 0 && (
        <details className="text-sm">
          <summary className="font-medium text-muted">Voir les {rejected.length} annonces écartées et pourquoi</summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rejected.map(({ listing: l, rejection }) => (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(l.id)} className="flex w-full items-center gap-3 rounded-md border border-line p-2 text-left hover:bg-raised">
                  <BikeThumb listing={l} width={96} className="h-12 w-[4.75rem] shrink-0 rounded opacity-70" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.brand} {l.model}, {eur(l.price)}</span>
                    <span className="flex items-center gap-1 text-xs text-bad">
                      <Ban size={12} aria-hidden /> {rejection}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
