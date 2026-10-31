/**
 * Em que tipo de tela estamos? A TV toca música e solta sustos; o celular
 * fica quieto. A decisão sai só da URL, para valer antes de qualquer
 * chamada à API.
 */

/** TV = `/tv/:code` ou qualquer rota com `?view=tv` (as telas de jogo). */
export function isTvLocation(pathname: string, search: string): boolean {
  if (/^\/tv\/[^/]+/i.test(pathname)) return true
  try {
    return new URLSearchParams(search).get('view') === 'tv'
  } catch {
    return false
  }
}

/** Código da sala em `/tv/:code`, `/game/:code/...`, `/host/:code` e `/play/:code`. */
export function roomCodeFromPath(pathname: string): string | null {
  const match = /^\/(?:tv|game|host|play)\/([^/?#]+)/i.exec(pathname)
  if (!match) return null
  let raw = match[1]
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // URL malformada: usa o trecho cru mesmo.
  }
  const code = raw.trim().toUpperCase()
  return code || null
}
