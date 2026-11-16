import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'radar-velo:v1:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value = JSON.parse(raw)
    // Un objet enregistré par une ancienne version peut ne pas avoir tous les champs.
    if (isPlainObject(fallback) && isPlainObject(value)) return { ...fallback, ...value } as T
    return value as T
  } catch {
    return fallback
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * useState qui persiste dans localStorage à chaque changement.
 * Si le stockage est indisponible (navigation privée, quota), l'app continue en mémoire.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial))

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* stockage indisponible : on reste en mémoire */
    }
  }, [key, value])

  const reset = useCallback(() => setValue(initial), [initial])
  return [value, setValue, reset] as const
}

export function clearAllStorage() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* rien à effacer */
  }
}
