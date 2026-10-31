/**
 * O visual do Quiz do Terror que a TV e o celular dividem: as quatro
 * alternativas (cor E símbolo, para quem não distingue cores), números do
 * jeito brasileiro e a vibração protegida. Mora fora de `Tv.tsx`/`Phone.tsx`
 * porque essas exportam só o componente (regra do react-refresh).
 */

export type OptionLook = {
  symbol: string
  /** Como a alternativa é chamada em voz alta (leitor de tela, "foi no triângulo!"). */
  name: string
  color: string
  /** Tom escuro para sombra e borda. */
  deep: string
  /** Cor do texto em cima de `color` (contraste alto). */
  ink: string
}

/** Na ordem das alternativas: ▲ vermelho, ◆ azul, ● amarelo, ■ verde — iguais na TV e no celular. */
export const OPTION_LOOKS: readonly OptionLook[] = [
  { symbol: '▲', name: 'triângulo vermelho', color: '#dc2626', deep: '#7f1d1d', ink: '#ffffff' },
  { symbol: '◆', name: 'losango azul', color: '#2563eb', deep: '#1e3a8a', ink: '#ffffff' },
  { symbol: '●', name: 'círculo amarelo', color: '#facc15', deep: '#a16207', ink: '#1c1404' },
  { symbol: '■', name: 'quadrado verde', color: '#22c55e', deep: '#166534', ink: '#04160b' },
]

export function lookOf(index: number): OptionLook {
  return OPTION_LOOKS[index] ?? OPTION_LOOKS[0]
}

/**
 * Suspense da revelação: o rufar de tambor dura isso; só depois a certa
 * acende na TV e o resultado aparece no celular.
 */
export const SUSPENSE_MS = 1700

/** 12500 → "12.500". */
export function formatPoints(points: number): string {
  const rounded = Math.round(Number.isFinite(points) ? points : 0)
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return rounded < 0 ? `-${digits}` : digits
}

/** 2340 → "2,3 s". */
export function formatSeconds(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0
  return `${(safe / 1000).toFixed(1).replace('.', ',')} s`
}

const MEDALS = ['🥇', '🥈', '🥉']

/** Medalha do 1º ao 3º lugar ('' do 4º em diante). */
export function medalFor(place: number): string {
  return MEDALS[place - 1] ?? ''
}

/** Vibra o celular quando dá (Android); no iPhone e no computador, nada acontece. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Sem vibração: tudo bem.
  }
}
