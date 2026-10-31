import type { Transport } from '../net/sync'

/**
 * Peças dos testes ponta a ponta contra um Django de verdade. Eles só rodam
 * com a variável apontando para o backend (com ou sem o `/api` no fim):
 *
 *   cd backend && py manage.py migrate && py manage.py seed_games
 *   py manage.py runserver 127.0.0.1:8765
 *   cd frontend && HALLOWEEN_E2E_API=http://127.0.0.1:8765 npx vitest run src/halloween/e2e
 *
 * Sem a variável, os testes aparecem como pulados (`describe.skipIf`).
 */

function readEnv(name: string): string | undefined {
  // Vitest roda em Node: a variável vem do processo. `import.meta.env` cobre
  // quem preferir o prefixo VITE_ (o app não tem os tipos do Node).
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const fromMeta = (import.meta.env as Record<string, unknown>)[name]
  return processEnv?.[name] ?? (typeof fromMeta === 'string' ? fromMeta : undefined)
}

function normalizeApi(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, '')
  if (!value) return null
  return value.endsWith('/api') ? value : `${value}/api`
}

/** Base da API (`http://host:porta/api`) ou null quando os e2e não devem rodar. */
export const E2E_API = normalizeApi(readEnv('HALLOWEEN_E2E_API') ?? readEnv('VITE_E2E_API'))

export class E2eHttpError extends Error {
  status: number

  constructor(status: number, body: string) {
    super(`${status} ${body.slice(0, 300)}`)
    this.status = status
  }
}

/** Transport do `net/sync` contra o backend do e2e (com o token, se houver). */
export function e2eTransport(token?: string): Transport {
  return async <T>(path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    if (init?.body !== undefined && init.body !== null) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Token ${token}`
    const response = await fetch(`${E2E_API}${path}`, { ...init, headers })
    if (!response.ok) throw new E2eHttpError(response.status, await response.text())
    return (await response.json()) as T
  }
}

export type Guest = { token: string; nickname: string; userId: number; t: Transport }

/** Cria um convidado (POST /auth/guest/), como a entrada só com apelido faz. */
export async function createGuest(nickname: string): Promise<Guest> {
  const body = await e2eTransport()<{ token: string; user: { id: number; profile?: { nickname?: string } } }>(
    '/auth/guest/',
    { method: 'POST', body: JSON.stringify({ nickname }) },
  )
  return {
    token: body.token,
    nickname: body.user.profile?.nickname ?? nickname,
    userId: body.user.id,
    t: e2eTransport(body.token),
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
