import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { CITY_NAMES } from '../data/cities'
import { SOURCE_LIST } from '../data/sources'
import { isDirectAdUrl } from '../lib/links'
import { CONDITION_LABELS, EXTENSION_LABELS, GROUPSET_LABELS, TYPE_LABELS } from '../lib/criteria'
import type { BikeType, Brakes, Condition, ExtensionFit, Frame, Groupset, Listing, SourceId } from '../types'
import { Modal } from './Modal'

interface Props {
  /** Ville proposée par défaut : le centre de ta première zone. */
  defaultCity: string
  onAdd: (listing: Listing) => void
  onClose: () => void
}

/** Ajout manuel d'une vraie annonce repérée sur une plateforme. */
export function AddListingDialog({ defaultCity, onAdd, onClose }: Props) {
  const [form, setForm] = useState({
    url: '',
    image: '',
    brand: '',
    model: '',
    year: String(new Date().getFullYear() - 2),
    size: 'M',
    price: '',
    newPrice: '',
    type: 'route' as BikeType,
    source: 'leboncoin' as SourceId,
    city: defaultCity,
    shipping: false,
    frame: 'carbone' as Frame,
    brakes: 'disque' as Brakes,
    groupset: 'ultegra-di2' as Groupset,
    aero: true,
    powerMeter: false,
    wheelDepth: '50',
    extensions: 'inconnu' as ExtensionFit,
    condition: 'tres-bon' as Condition,
    description: '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onAdd({
      id: `perso-${Date.now()}`,
      custom: true,
      batch: 0,
      source: form.source,
      url: form.url.trim(),
      image: form.image.trim(),
      imageKind: 'annonce',
      title: `${form.brand} ${form.model}, taille ${form.size}`.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      type: form.type,
      size: form.size.trim(),
      price: Number(form.price),
      newPrice: form.newPrice ? Number(form.newPrice) : undefined,
      description: form.description.trim() || 'Annonce ajoutée à la main.',
      city: form.city,
      shipping: form.shipping,
      publishedAt: new Date().toISOString(),
      frame: form.frame,
      brakes: form.brakes,
      groupset: form.groupset,
      aero: form.aero,
      powerMeter: form.powerMeter,
      wheelDepth: Number(form.wheelDepth) || 0,
      extensions: form.extensions,
      condition: form.condition,
    })
  }

  const select = <T extends string>(id: string, label: string, value: T, options: Record<string, string>, onPick: (v: T) => void) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onPick(e.target.value as T)}>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
    </div>
  )
  const text = (id: string, label: string, key: 'url' | 'image' | 'brand' | 'model' | 'year' | 'size' | 'price' | 'newPrice' | 'wheelDepth', extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
    </div>
  )
  const check = (id: string, label: string, key: 'shipping' | 'aero' | 'powerMeter') => (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={form[key]} onChange={() => set({ [key]: !form[key] })} className="h-4 w-4 accent-[var(--accent)]" />
      {label}
    </label>
  )

  return (
    <Modal title="Ajouter une annonce" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {text('a-url', "Lien de l'annonce", 'url', {
            type: 'url',
            required: true,
            placeholder: 'https://www.leboncoin.fr/ad/velos/…',
            // Refuse les liens de recherche : seul le lien de l'annonce elle-même est accepté.
            onInput: (e) => {
              const v = e.currentTarget.value.trim()
              e.currentTarget.setCustomValidity(
                v === '' || isDirectAdUrl(v) ? '' : "Colle le lien de l'annonce elle-même (par exemple …/ad/velos/1234567890), pas celui d'une recherche.",
              )
            },
          })}
          {text('a-image', 'Lien de la photo', 'image', { type: 'url', required: true, placeholder: 'Clic droit sur la photo › Copier l’adresse de l’image' })}
          {text('a-brand', 'Marque', 'brand', { required: true, placeholder: 'Canyon' })}
          {text('a-model', 'Modèle', 'model', { required: true, placeholder: 'Aeroad CF SLX 8 Di2' })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {text('a-price', 'Prix (€)', 'price', { type: 'number', min: 1, required: true })}
          {text('a-new-price', 'Prix neuf (€)', 'newPrice', { type: 'number', min: 0 })}
          {text('a-year', 'Année', 'year', { type: 'number', min: 1990, max: 2100, required: true })}
          {text('a-size', 'Taille', 'size', { required: true })}
          {select('a-type', 'Type', form.type, TYPE_LABELS, (v) => set({ type: v }))}
          {select('a-source', 'Plateforme', form.source, Object.fromEntries(SOURCE_LIST.map((s) => [s.id, s.label])), (v) => set({ source: v }))}
          {select('a-city', 'Ville', form.city, Object.fromEntries(CITY_NAMES.map((n) => [n, n])), (v) => set({ city: v }))}
          {select('a-condition', 'État', form.condition, CONDITION_LABELS, (v) => set({ condition: v }))}
          {select('a-frame', 'Cadre', form.frame, { carbone: 'Carbone', aluminium: 'Aluminium', acier: 'Acier' }, (v) => set({ frame: v }))}
          {select('a-brakes', 'Freins', form.brakes, { disque: 'Disque', patins: 'Patins' }, (v) => set({ brakes: v }))}
          {select('a-group', 'Transmission', form.groupset, GROUPSET_LABELS, (v) => set({ groupset: v }))}
          {text('a-depth', 'Jantes carbone (mm)', 'wheelDepth', { type: 'number', min: 0, max: 100 })}
        </div>
        {select('a-ext', 'Prolongateurs', form.extensions, EXTENSION_LABELS, (v) => set({ extensions: v }))}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {check('a-aero', 'Cadre aéro', 'aero')}
          {check('a-power', 'Capteur de puissance', 'powerMeter')}
          {check('a-shipping', 'Livraison possible', 'shipping')}
        </div>
        <div>
          <label className="label" htmlFor="a-description">Description</label>
          <textarea id="a-description" rows={3} className="field" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">Ajouter l'annonce</button>
        </div>
      </form>
    </Modal>
  )
}
