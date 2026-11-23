import { ExternalLink, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { CONDITION_LABELS, TYPE_LABELS } from '../lib/criteria'
import { discountPct, distanceLabel, eur, isNewBike, promoPct, relativeDay, shortDate } from '../lib/format'
import { directUrl } from '../lib/links'
import type { Criteria, Row, Status, Tracking } from '../types'
import { AttributeChips } from './AttributeChips'
import { BikeThumb } from './BikeThumb'
import { MarketBadge } from './MarketBadge'
import { ScoreBib } from './ScoreBib'
import { StatusSelect } from './StatusSelect'
import { ZoneBadge } from './ZoneBadge'

interface Props {
  row: Row
  criteria: Criteria
  onClose: () => void
  onStatus: (id: string, status: Status) => void
  onPatch: (id: string, patch: Partial<Tracking>) => void
  onDelete: (id: string) => void
}

/** Fiche complète d'une annonce : détails, score expliqué et suivi personnel. */
export function DetailDrawer({ row, criteria, onClose, onStatus, onPatch, onDelete }: Props) {
  const { listing: l, score, zone, tracking: t, rejection } = row
  const discount = discountPct(l.price, l.newPrice)
  const brandNew = isNewBike(l)
  const promo = promoPct(l)
  const patch = (p: Partial<Tracking>) => onPatch(l.id, p)
  const href = directUrl(l)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const facts: [string, string][] = [
    ['Type', TYPE_LABELS[l.type]],
    ['Taille', l.size],
    ['Année', l.year > 0 ? String(l.year) : 'Non précisée'],
    ['Marché', brandNew ? `Neuf, vendu par ${SOURCES[l.source].label}` : 'Occasion'],
    ...(brandNew && l.sizesInStock?.length ? [['Tailles en stock', l.sizesInStock.join(', ')] as [string, string]] : []),
    ['État', CONDITION_LABELS[l.condition]],
    ['Kilométrage', l.km ? `${l.km.toLocaleString('fr-FR')} km` : brandNew ? 'Neuf, jamais roulé' : 'Non précisé'],
    ['Cadre', `${l.frame}, freins à ${l.brakes}`],
    ['Lieu', `${l.city}, ${distanceLabel(zone.distance, zone.nearest?.center, zone.train)}`],
    ['Livraison', l.shipping ? 'Possible' : 'Remise en main propre'],
    [brandNew ? 'Promotion vue le' : 'Publiée', `${shortDate(l.publishedAt)} (${relativeDay(l.publishedAt)})`],
    ['Source', SOURCES[l.source].label],
  ]

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={l.title}>
      <button type="button" aria-label="Fermer la fiche" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-bg shadow-2xl">
        <div className="relative">
          <BikeThumb listing={l} width={640} showKind className="aspect-[16/10] w-full" />
          <button type="button" onClick={onClose} aria-label="Fermer" className="btn absolute right-3 top-3 p-2">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <header className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold leading-snug">{l.title}</h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                <span className="tnum font-display text-4xl font-bold leading-none">{eur(l.price)}</span>
                {brandNew && promo !== null && (
                  <span className="text-sm text-muted">
                    au lieu de <s>{eur(l.originalPrice!)}</s>, soit <span className="font-semibold text-good">{promo} % de remise</span>
                  </span>
                )}
                {!brandNew && discount !== null && <span className="text-sm text-muted">neuf {eur(l.newPrice!)}, soit {discount} % de décote</span>}
              </div>
            </div>
            <ScoreBib score={score.total} />
          </header>

          {rejection && <p className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">Écartée automatiquement : {rejection}.</p>}

          <div className="flex flex-wrap items-center gap-3">
            <StatusSelect id="drawer-status" value={t.status} onChange={(s) => onStatus(l.id, s)} className="py-1.5 text-sm" />
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                {brandNew ? 'Voir le vélo' : "Voir l'annonce"} sur {SOURCES[l.source].label} <ExternalLink size={15} aria-hidden />
              </a>
            ) : (
              <span className="text-sm text-muted">
                {l.demo ? "Annonce de démonstration inventée : il n'y a pas d'annonce à ouvrir." : "Pas de lien direct vers l'annonce."}
              </span>
            )}
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <MarketBadge listing={l} />
              <ZoneBadge zone={zone} criteria={criteria} shipping={l.shipping} />
            </div>
            <AttributeChips listing={l} />
            {l.toVerify && l.toVerify.length > 0 && (
              <div className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                <p className="font-medium">À vérifier auprès du vendeur</p>
                <ul className="mt-1 list-disc pl-5">
                  {l.toVerify.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{l.description}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-medium first-letter:uppercase">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="score-title" className="rounded-lg border border-line bg-surface p-4">
            <h3 id="score-title" className="text-sm font-semibold">Pourquoi {score.total} sur 100</h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {score.parts.map((p) => (
                <li key={p.label} className="grid grid-cols-[1fr_auto] gap-x-3 text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span className="tnum text-muted">{(Math.round(p.points * 10) / 10).toLocaleString('fr-FR')} / {p.max}</span>
                  <span className="col-span-2 text-xs text-muted">{p.detail}</span>
                  <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(p.points / p.max) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="suivi-title" className="flex flex-col gap-4">
            <div>
              <h3 id="suivi-title" className="text-sm font-semibold">Mon suivi</h3>
              <p className="text-xs text-muted">Enregistré automatiquement dans ce navigateur.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="f-seller">Nom du vendeur</label>
                <input id="f-seller" className="field" value={t.sellerName} onChange={(e) => patch({ sellerName: e.target.value })} placeholder="Julien" />
              </div>
              <div>
                <label className="label" htmlFor="f-contact">Téléphone ou e-mail</label>
                <input id="f-contact" className="field" value={t.sellerContact} onChange={(e) => patch({ sellerContact: e.target.value })} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label className="label" htmlFor="f-place">Lieu du rendez-vous</label>
                <input id="f-place" className="field" value={t.meetingPlace} onChange={(e) => patch({ meetingPlace: e.target.value })} placeholder="Devant la gare" />
              </div>
              <div>
                <label className="label" htmlFor="f-meeting">Date de la visite ou de l'essai</label>
                <input id="f-meeting" type="datetime-local" className="field" value={t.meetingAt} onChange={(e) => patch({ meetingAt: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="f-price">Prix négocié (€)</label>
                <input id="f-price" type="number" min={0} step={10} inputMode="numeric" className="field" value={t.negotiatedPrice} onChange={(e) => patch({ negotiatedPrice: e.target.value })} placeholder={String(l.price)} />
              </div>
              <div>
                <label className="label" htmlFor="f-reminder-date">Rappel le</label>
                <input id="f-reminder-date" type="date" className="field" value={t.reminderAt} onChange={(e) => patch({ reminderAt: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="f-reminder-text">Objet du rappel</label>
                <input id="f-reminder-text" className="field" value={t.reminderText} onChange={(e) => patch({ reminderText: e.target.value })} placeholder="Relancer le vendeur, demander la facture" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="f-notes">Notes personnelles</label>
                <textarea id="f-notes" rows={4} className="field" value={t.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Questions à poser, impressions après l'essai, défauts repérés" />
              </div>
            </div>
          </section>

          {l.imageKind === 'illustration' && (
            <p className="text-xs text-muted">
              Photo d'illustration : un vélo de route comparable, pas le vélo exact de l'annonce. Les annonces que
              tu ajoutes affichent la photo du vendeur.
            </p>
          )}

          {l.custom && (
            <button type="button" onClick={() => onDelete(l.id)} className="btn self-start text-bad">
              <Trash2 size={15} aria-hidden /> Supprimer cette annonce
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
