/**
 * Último `fx` executado por sala, guardado no aparelho: recarregar a TV não
 * repete o susto que o host mandou antes.
 */

const PREFIX = 'sabado_hw_fx_seen_'

export function loadSeenFx(code: string): number | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + code.toUpperCase())
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export function saveSeenFx(code: string, id: number) {
  try {
    window.localStorage.setItem(PREFIX + code.toUpperCase(), String(id))
  } catch {
    // Sem localStorage: no pior caso, um susto repete ao recarregar.
  }
}
