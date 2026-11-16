import { useState } from 'react'
import { CITY_NAMES } from '../data/cities'
import { GROUPSET_LABELS, TYPE_LABELS } from '../lib/criteria'
import { DEFAULT_TRAIN } from '../lib/zones'
import type { BikeType, Criteria, Groupset, Zone } from '../types'
import { Modal } from './Modal'

interface Props {
  criteria: Criteria
  onChange: (criteria: Criteria) => void
  onResetCriteria: () => void
  onResetAll: () => void
  onClose: () => void
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

const BONUS_LABELS: Record<keyof Criteria['bonus'], string> = {
  aero: 'Cadre et cintre aéro',
  powerMeter: 'Capteur de puissance',
  carbonWheels: 'Roues carbone profilées',
  extensions: 'Prolongateurs montables',
}

/** Réglage des critères. Chaque changement s'applique tout de suite et est mémorisé. */
export function CriteriaPanel({ criteria: c, onChange, onResetCriteria, onResetAll, onClose }: Props) {
  const set = (patch: Partial<Criteria>) => onChange({ ...c, ...patch })
  const setZone = (id: string, patch: Partial<Zone>) =>
    set({ zones: c.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) })
  const [sizesText, setSizesText] = useState(c.sizes.join(', '))
  const train = { ...DEFAULT_TRAIN, ...c.train }
  const [confirmReset, setConfirmReset] = useState(false)

  const check = (id: string, label: string, checked: boolean, onToggle: () => void) => (
    <label key={id} htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-[var(--accent)]" />
      {label}
    </label>
  )

  return (
    <Modal title="Mes critères" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="label">Type de vélo</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(TYPE_LABELS) as BikeType[]).map((t) =>
              check(`c-type-${t}`, TYPE_LABELS[t], c.types.includes(t), () => set({ types: toggle(c.types, t) })),
            )}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="c-sizes">Tailles acceptées</label>
            <input
              id="c-sizes"
              className="field"
              value={sizesText}
              onChange={(e) => {
                setSizesText(e.target.value)
                set({ sizes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
              }}
              placeholder="M, 56"
            />
            <p className="mt-1 text-xs text-muted">Séparées par des virgules. Vide : toutes les tailles.</p>
          </div>
          <div>
            <label className="label" htmlFor="c-ideal">Budget idéal (€)</label>
            <input id="c-ideal" type="number" min={0} step={100} className="field" value={c.budgetIdeal} onChange={(e) => set({ budgetIdeal: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="c-max">Budget maximum (€)</label>
            <input id="c-max" type="number" min={0} step={100} className="field" value={c.budgetMax} onChange={(e) => set({ budgetMax: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-muted">Au-delà, l'annonce est écartée.</p>
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="label">Zones de recherche</legend>
          <p className="-mt-1 text-xs text-muted">
            Une annonce est retenue si elle se trouve dans le rayon d'une zone active, ou si elle peut être livrée.
          </p>
          {c.zones.map((z) => (
            <div key={z.id} className="grid items-end gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-[auto_1fr_10rem_8rem]">
              <div className="pb-2">
                {check(`c-zone-on-${z.id}`, 'Active', z.enabled, () => setZone(z.id, { enabled: !z.enabled }))}
              </div>
              <div>
                <label className="label" htmlFor={`c-zone-label-${z.id}`}>Nom de la zone</label>
                <input id={`c-zone-label-${z.id}`} className="field" value={z.label} onChange={(e) => setZone(z.id, { label: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor={`c-zone-center-${z.id}`}>Ville centre</label>
                <select id={`c-zone-center-${z.id}`} className="field" value={z.center} onChange={(e) => setZone(z.id, { center: e.target.value })}>
                  {CITY_NAMES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`c-zone-radius-${z.id}`}>Rayon (km)</label>
                <input id={`c-zone-radius-${z.id}`} type="number" min={0} step={10} className="field" value={z.radiusKm} onChange={(e) => setZone(z.id, { radiusKm: Number(e.target.value) })} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {check('c-train', 'Accepter aussi les annonces accessibles en train depuis Paris, en moins de', train.enabled, () => set({ train: { ...train, enabled: !train.enabled } }))}
            <label htmlFor="c-train-hours" className="sr-only">Temps de trajet maximal, en heures</label>
            <select id="c-train-hours" className="field w-24" value={train.maxHours} disabled={!train.enabled} onChange={(e) => set({ train: { ...train, maxHours: Number(e.target.value) } })}>
              {[1.5, 2, 2.5, 3, 3.5, 4].map((h) => (
                <option key={h} value={h}>{String(h).replace('.', ',')} h</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted">Porte à porte estimé : meilleur train direct depuis Paris, puis la route depuis la gare (45 km au plus).</p>
          {check('c-shipping', 'Accepter aussi les annonces hors zones avec livraison', c.acceptShipping, () => set({ acceptShipping: !c.acceptShipping }))}
        </fieldset>

        <fieldset>
          <legend className="label">Obligatoire</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {check('c-carbon', 'Cadre carbone', c.requireCarbon, () => set({ requireCarbon: !c.requireCarbon }))}
            {check('c-disc', 'Freins à disque', c.requireDisc, () => set({ requireDisc: !c.requireDisc }))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Transmissions acceptées</legend>
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
            {(Object.keys(GROUPSET_LABELS) as Groupset[]).map((g) =>
              check(`c-group-${g}`, GROUPSET_LABELS[g], c.groupsets.includes(g), () => set({ groupsets: toggle(c.groupsets, g) })),
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Bonus pris en compte dans le score</legend>
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
            {(Object.keys(BONUS_LABELS) as (keyof Criteria['bonus'])[]).map((b) =>
              check(`c-bonus-${b}`, BONUS_LABELS[b], c.bonus[b], () => set({ bonus: { ...c.bonus, [b]: !c.bonus[b] } })),
            )}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            className="btn"
            onClick={() => {
              onResetCriteria()
              onClose()
            }}
          >
            Rétablir mes critères de départ
          </button>
          <button type="button" className="btn text-bad" onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}>
            {confirmReset ? 'Confirmer : tout effacer' : 'Réinitialiser la démo'}
          </button>
          {confirmReset && <p className="text-xs text-muted">Efface statuts, notes, annonces ajoutées et recherches.</p>}
          <button type="button" className="btn btn-primary ml-auto" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </Modal>
  )
}
