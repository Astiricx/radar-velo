interface Props {
  score: number
  size?: 'sm' | 'md'
}

/** Le score de pertinence, présenté comme un dossard de course. */
export function ScoreBib({ score, size = 'md' }: Props) {
  const tone = score >= 75 ? 'border-accent text-accent' : score >= 55 ? 'border-ink text-ink' : 'border-muted text-muted'
  const dims = size === 'sm' ? 'h-9 w-11 text-xl' : 'h-12 w-14 text-3xl'
  return (
    <span
      title={`Score de pertinence : ${score} sur 100`}
      aria-label={`Score de pertinence : ${score} sur 100`}
      className={`tnum relative grid shrink-0 place-items-center rounded border-2 bg-surface font-display font-bold leading-none ${tone} ${dims}`}
    >
      <i aria-hidden className="absolute left-1 top-1 h-1 w-1 rounded-full bg-line" />
      <i aria-hidden className="absolute right-1 top-1 h-1 w-1 rounded-full bg-line" />
      {score}
    </span>
  )
}
