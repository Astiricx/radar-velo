import type { Criteria, ZoneMatch } from '../types'
import { TRAIN_TONE, ZONE_TONES } from '../lib/zones'

interface Props {
  zone: ZoneMatch
  criteria: Criteria
  shipping: boolean
  /** Version courte pour le tableau : « Zone Saint-Nazaire ». */
  short?: boolean
}

/** Pastille de zone : « Région parisienne », « Saint-Nazaire et Loire-Atlantique » ou « Hors zone, livraison ». */
export function ZoneBadge({ zone, criteria, shipping, short = false }: Props) {
  if (zone.train) {
    return (
      <span className={`chip ${TRAIN_TONE}`} title={`Gare de ${zone.train.station}`}>
        {short ? `Train, ${zone.train.station}` : `En train, via ${zone.train.station}`}
      </span>
    )
  }
  if (zone.inside && zone.nearest) {
    const index = criteria.zones.findIndex((z) => z.id === zone.nearest!.id)
    return (
      <span className={`chip ${ZONE_TONES[index] ?? ZONE_TONES[0]}`} title={zone.nearest.label}>
        {short ? `Zone ${zone.nearest.center}` : zone.nearest.label}
      </span>
    )
  }
  return <span className="chip border border-line text-muted">{shipping ? 'Hors zone, livraison' : 'Hors zone'}</span>
}
