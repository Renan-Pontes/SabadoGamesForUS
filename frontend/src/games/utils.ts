import { useEffect, useRef, useState } from 'react'
import type { Player } from '../lib/types'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}

/** Segundos restantes até `deadlineTs` (timestamp em segundos), ou null. */
export function useCountdown(deadlineTs?: number | null, intervalMs = 1000) {
  const now = useNow(intervalMs)
  if (!deadlineTs) return null
  return Math.max(0, Math.ceil(deadlineTs - now / 1000))
}

/** ~16 quadros por segundo: suave o bastante para um anel, barato o bastante para o celular. */
const SMOOTH_TICK_MS = 60

/**
 * Contagem regressiva fracionária, para animar anéis e barras de tempo.
 *
 * O relógio vive num `now` alimentado por requestAnimationFrame; o tempo
 * restante é derivado no render, então trocar de prazo acerta o valor no
 * mesmo quadro em vez de piscar o anterior.
 */
export function useSmoothCountdown(deadlineTs?: number | null) {
  const [now, setNow] = useState(() => Date.now())
  const lastTick = useRef(0)

  useEffect(() => {
    if (!deadlineTs) return

    let frame = window.requestAnimationFrame(function tick(timestamp) {
      if (timestamp - lastTick.current >= SMOOTH_TICK_MS) {
        lastTick.current = timestamp
        setNow(Date.now())
      }
      frame = window.requestAnimationFrame(tick)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [deadlineTs])

  if (!deadlineTs) return null
  return Math.max(0, deadlineTs - now / 1000)
}

export function formatSeconds(totalSeconds: number | null) {
  if (totalSeconds === null) return '--:--'
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = Math.floor(clamped % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Nome de exibição do jogador, com todos os fallbacks. */
export function playerLabel(player: Player) {
  return player.name || player.user?.profile?.nickname || player.user?.username || 'Jogador'
}

/** Iniciais para avatares. */
export function playerInitials(player: Player) {
  const label = playerLabel(player).trim()
  const parts = label.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return label.slice(0, 2).toUpperCase() || '??'
}

/** Estado tipado de um jogador (o backend guarda JSON solto). */
export function playerState(player: Player | null | undefined): Record<string, unknown> {
  return (player?.state ?? {}) as Record<string, unknown>
}

export function readNumberArray(source: Record<string, unknown>, key: string): number[] {
  const value = source[key]
  return Array.isArray(value) ? (value.filter((item) => typeof item === 'number') as number[]) : []
}

/** Traduz uma lista de ids de jogador em nomes legíveis. */
export function namesFor(ids: number[], players: Player[]) {
  return ids
    .map((id) => {
      const player = players.find((item) => item.id === id)
      return player ? playerLabel(player) : `#${id}`
    })
    .join(', ')
}

/**
 * Cor estável por jogador, derivada do id — mantém a mesma identidade em
 * todas as telas (TV, host e celular) sem precisar guardar nada no backend.
 */
const PLAYER_COLORS = [
  '#f87171',
  '#fbbf24',
  '#34d399',
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#4ade80',
  '#60a5fa',
  '#e879f9',
]

export function playerColor(playerId: number) {
  return PLAYER_COLORS[playerId % PLAYER_COLORS.length]
}

/**
 * Cor de avatar para quem ainda não tem id de jogador (perfil, cabeçalhos).
 * Sai da mesma paleta para não destoar das telas de partida.
 */
export function avatarColor(name: string | undefined | null) {
  if (!name) return PLAYER_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 9973
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]
}

/**
 * Dispara vibração curta no celular (ignorado em desktop/TV).
 * Usado como feedback tátil ao enviar jogadas.
 */
export function haptic(pattern: number | number[] = 18) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

/** Detecta se o usuário pediu menos movimento — usado antes de animar com JS. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
