import { STATUSES, STATUS_BY_ID } from '../lib/pipeline'
import type { Status } from '../types'

interface Props {
  id: string
  value: Status
  onChange: (status: Status) => void
  className?: string
}

/** Liste déroulante du statut, colorée selon l'étape du pipeline. */
export function StatusSelect({ id, value, onChange, className = '' }: Props) {
  return (
    <select
      id={id}
      aria-label="Statut dans le pipeline"
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      onClick={(e) => e.stopPropagation()}
      className={`max-w-full rounded-full border border-transparent py-1 pl-3 pr-1 text-xs font-semibold ${STATUS_BY_ID[value].tone} ${className}`}
    >
      {STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  )
}
