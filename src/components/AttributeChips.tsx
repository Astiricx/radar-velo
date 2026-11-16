import { EXTENSION_LABELS, GROUPSET_LABELS } from '../lib/criteria'
import type { Listing } from '../types'

const GOOD = 'bg-good-soft text-good'
const NEUTRAL = 'border border-line text-muted'
const WARN = 'bg-warn-soft text-warn'

/** Les équipements qui comptent pour le choix, en un coup d'œil. */
export function AttributeChips({ listing: l }: { listing: Listing }) {
  const chips: { label: string; tone: string }[] = [
    { label: GROUPSET_LABELS[l.groupset], tone: l.groupset.endsWith('di2') ? GOOD : NEUTRAL },
    { label: l.aero ? 'Cadre aéro' : 'Cadre polyvalent', tone: l.aero ? GOOD : NEUTRAL },
    { label: l.powerMeter ? 'Capteur de puissance' : 'Sans capteur', tone: l.powerMeter ? GOOD : NEUTRAL },
    {
      label: l.wheelDepth > 0 ? `Jantes carbone ${l.wheelDepth} mm` : 'Roues alu',
      tone: l.wheelDepth >= 45 ? GOOD : NEUTRAL,
    },
    {
      label: EXTENSION_LABELS[l.extensions],
      tone: l.extensions === 'oui' ? GOOD : l.extensions === 'non' ? WARN : NEUTRAL,
    },
  ]
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.label} className={`chip ${c.tone}`}>
          {c.label}
        </li>
      ))}
    </ul>
  )
}
