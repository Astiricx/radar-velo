import { BadgePercent, Sparkles } from 'lucide-react'
import { isNewBike, promoPct } from '../lib/format'
import type { Listing } from '../types'

interface Props {
  listing: Listing
  /** Sur la photo : fond plein pour rester lisible. */
  onImage?: boolean
}

/**
 * « Neuf, −15 % » ou « Neuf » pour un vélo vendu neuf par un magasin, « Occasion » sinon.
 * La remise est celle du magasin par rapport à son prix barré.
 */
export function MarketBadge({ listing, onImage = false }: Props) {
  if (!isNewBike(listing)) {
    return <span className={`chip ${onImage ? 'bg-surface text-ink' : 'border border-line text-muted'}`}>Occasion</span>
  }
  const promo = promoPct(listing)
  return (
    <span className={`chip font-semibold ${onImage ? 'bg-good text-surface' : 'bg-good-soft text-good'}`} title={promo !== null ? `Prix barré du magasin : remise de ${promo} %` : 'Vélo neuf, garantie constructeur'}>
      {promo !== null ? <BadgePercent size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
      {promo !== null ? `Neuf, promo −${promo} %` : 'Neuf'}
    </span>
  )
}
