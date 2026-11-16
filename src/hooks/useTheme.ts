import { useEffect } from 'react'
import { useLocalStorage } from '../lib/storage'

export type ThemeMode = 'system' | 'light' | 'dark'

function systemPrefersDark(): boolean {
  // Certains hébergeurs imposent un thème via data-theme sur <html> : il passe avant le réglage du système.
  const forced = document.documentElement.dataset.theme
  if (forced === 'dark') return true
  if (forced === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Thème clair, sombre ou calé sur le système. Le choix est mémorisé. */
export function useTheme() {
  const [mode, setMode] = useLocalStorage<ThemeMode>('theme', 'system')

  useEffect(() => {
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media.removeEventListener('change', apply)
      observer.disconnect()
    }
  }, [mode])

  return [mode, setMode] as const
}
