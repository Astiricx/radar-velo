import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Fenêtre centrée, fermée par Échap, par la croix ou par un clic à côté. */
export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="gutter fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" onClick={onClose} className="fixed inset-0 cursor-default bg-ink/40" />
      <div className="relative w-full max-w-2xl rounded-lg border border-line bg-bg shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="btn btn-quiet p-2">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
