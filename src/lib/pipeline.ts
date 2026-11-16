import type { Status, Tracking } from '../types'

export interface StatusMeta {
  id: Status
  label: string
  /** Classes de la pastille (fond + texte). */
  tone: string
  /** Classe du point de couleur. */
  dot: string
}

/** Les étapes du pipeline d'achat, dans l'ordre des colonnes. */
export const STATUSES: StatusMeta[] = [
  { id: 'a-analyser', label: 'À analyser', tone: 'bg-raised text-muted', dot: 'bg-muted' },
  { id: 'contacte', label: 'Contacté', tone: 'bg-accent-soft text-accent', dot: 'bg-accent' },
  { id: 'visite', label: 'Visite / Essai planifié', tone: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  { id: 'offre', label: 'Offre envoyée', tone: 'bg-violet-soft text-violet', dot: 'bg-violet' },
  { id: 'refuse', label: 'Refusé', tone: 'bg-bad-soft text-bad', dot: 'bg-bad' },
  { id: 'coup-de-coeur', label: 'Coup de cœur / Acheté', tone: 'bg-good-soft text-good', dot: 'bg-good' },
]

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<Status, StatusMeta>

export const EMPTY_TRACKING: Tracking = {
  status: 'a-analyser',
  notes: '',
  sellerName: '',
  sellerContact: '',
  meetingPlace: '',
  meetingAt: '',
  negotiatedPrice: '',
  reminderAt: '',
  reminderText: '',
}
