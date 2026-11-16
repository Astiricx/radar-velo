/**
 * Client minimal de l'API Apify (https://docs.apify.com/api/v2), sans dépendance.
 */

const API = 'https://api.apify.com/v2'

export interface RunOptions {
  /** Nombre maximal de résultats facturés (acteurs payés au résultat). */
  maxItems?: number
  /** Dépense maximale de l'exécution, en dollars (acteurs payés à l'événement). */
  maxTotalChargeUsd?: number
  /** Mémoire allouée, en Mo. Plus elle est basse, moins le temps de calcul coûte. */
  memoryMbytes?: number
  /** Durée maximale de l'exécution, en secondes (300 au plus en mode synchrone). */
  timeoutSecs: number
}

/** Lance un acteur, attend la fin et renvoie les éléments de son jeu de données. */
export type ActorRunner = (actor: string, input: unknown, options: RunOptions) => Promise<unknown[]>

export class ApifyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

async function call(token: string, path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    const hint =
      res.status === 401
        ? ' (clé APIFY_TOKEN invalide)'
        : res.status === 402 || res.status === 403
          ? ' (crédit épuisé ou acteur non autorisé sur ton plan)'
          : res.status === 408
            ? " (l'acteur a dépassé le temps imparti)"
            : ''
    throw new ApifyError(`Apify ${res.status}${hint} : ${body}`, res.status)
  }
  return res
}

/** Consommation du mois en cours et limite du compte, en dollars. */
export async function monthlyUsage(token: string): Promise<{ usedUsd: number; limitUsd: number }> {
  const res = await call(token, '/users/me/limits')
  const json = (await res.json()) as { data?: { current?: { monthlyUsageUsd?: number }; limits?: { maxMonthlyUsageUsd?: number } } }
  return {
    usedUsd: Number(json.data?.current?.monthlyUsageUsd ?? 0),
    limitUsd: Number(json.data?.limits?.maxMonthlyUsageUsd ?? 5),
  }
}

/** Exécution réelle sur Apify, en mode synchrone. */
export function apifyRunner(token: string): ActorRunner {
  return async (actor, input, options) => {
    const params = new URLSearchParams({ timeout: String(options.timeoutSecs), format: 'json', clean: 'true' })
    if (options.maxItems !== undefined) params.set('maxItems', String(options.maxItems))
    if (options.maxTotalChargeUsd !== undefined) params.set('maxTotalChargeUsd', String(options.maxTotalChargeUsd))
    if (options.memoryMbytes !== undefined) params.set('memory', String(options.memoryMbytes))
    const id = actor.replace('/', '~')
    const res = await call(
      token,
      `/acts/${id}/run-sync-get-dataset-items?${params}`,
      { method: 'POST', body: JSON.stringify(input) },
      (options.timeoutSecs + 60) * 1000,
    )
    const items = (await res.json()) as unknown
    if (!Array.isArray(items)) throw new ApifyError(`Réponse inattendue de ${actor} : une liste était attendue.`)
    return items
  }
}
