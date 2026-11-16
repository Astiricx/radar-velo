import { useState } from 'react'
import { srcSet, unsplashUrl } from '../data/photos'
import type { Listing } from '../types'

interface Props {
  listing: Listing
  /** Largeur d'affichage en pixels CSS, pour charger une image à la bonne taille. */
  width: number
  className?: string
  /** Affiche la mention « Photo d'illustration » sur les données de démo. */
  showKind?: boolean
}

/**
 * Vignette d'une annonce.
 *
 * Une plaque typographique (marque et modèle) est toujours posée dessous : elle
 * s'affiche pendant le chargement de la photo, et reste seule si la photo et sa
 * photo de secours ne se chargent pas. Aucun dessin de vélo.
 */
export function BikeThumb({ listing, width, className = '', showKind = false }: Props) {
  const sources = [listing.image, listing.fallbackImage].filter((s): s is string => Boolean(s))
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const src = sources[index]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <BrandPlate listing={listing} compact={width < 160} />
      {src && (
        <img
          key={src}
          src={unsplashUrl(src, width)}
          srcSet={srcSet(src, width)}
          alt={`${listing.brand} ${listing.model}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setIndex((i) => i + 1)
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {showKind && src && loaded && listing.imageKind === 'illustration' && (
        <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
          Photo d'illustration
        </span>
      )}
    </div>
  )
}

/**
 * Teinte stable par marque, choisie dans une plage froide (bleu-vert à bleu-violet) :
 * chaque marque garde la même couleur de fond, et toutes restent sobres.
 */
function brandHue(brand: string): number {
  let h = 0
  for (const ch of brand) h = (h * 31 + ch.charCodeAt(0)) % 997
  return 185 + (h % 70)
}

/**
 * Plaque sobre : fond sombre légèrement teinté selon la marque, marque en grand,
 * modèle en dessous. Identique en thème clair et sombre.
 */
function BrandPlate({ listing: l, compact }: { listing: Listing; compact: boolean }) {
  const hue = brandHue(l.brand)
  const background = `linear-gradient(135deg, hsl(${hue} 22% 20%) 0%, hsl(${hue} 18% 13%) 100%)`

  if (compact) {
    return (
      <div aria-hidden className="absolute inset-0 grid place-items-center px-1.5" style={{ background }}>
        <span className="line-clamp-2 text-center font-display text-sm font-bold leading-none tracking-wide text-white/90">
          {l.brand}
        </span>
      </div>
    )
  }

  return (
    <div aria-hidden className="absolute inset-0 flex flex-col justify-end gap-1 p-5" style={{ background }}>
      <span className="font-display text-[2.6rem] font-bold leading-[0.9] tracking-wide text-white">{l.brand}</span>
      <span className="line-clamp-2 max-w-[90%] text-sm font-medium leading-snug text-white/75">{l.model}</span>
      <span className="mt-2 h-px w-10 bg-white/35" />
      <span className="tnum text-xs text-white/60">
        {l.year}, taille {l.size}
      </span>
    </div>
  )
}
