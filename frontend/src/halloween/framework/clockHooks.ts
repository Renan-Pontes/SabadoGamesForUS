import { useEffect, useState } from 'react'
import { msLeft } from '../engine/helpers'

/**
 * Relógio para as telas: devolve o "agora" do servidor e redesenha o
 * componente a cada `intervalMs`. Use com a prop `now` das telas:
 * `const t = useServerNow(now)`.
 */
export function useServerNow(now: () => number, intervalMs = 250): number {
  const [value, setValue] = useState(now)
  useEffect(() => {
    const timer = setInterval(() => setValue(now()), intervalMs)
    return () => clearInterval(timer)
  }, [now, intervalMs])
  return value
}

/**
 * Tempo restante até o prazo, já redesenhando sozinho. Nas fases de
 * resposta passe `graceMs = GRACE_MS`: o relógio zera na hora prometida, e a
 * folga fica escondida para quem respondeu em cima do laço.
 */
export function useCountdown(deadline: number | null | undefined, now: () => number, graceMs = 0) {
  const current = useServerNow(now)
  const ms = msLeft(deadline, current, graceMs)
  return { ms, seconds: ms === null ? null : Math.ceil(ms / 1000) }
}
