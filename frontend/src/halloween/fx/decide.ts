import { RANDOM_SCARES_OFF, RANDOM_SCARES_ON } from './api'
import type { RoomFx } from './api'

/**
 * O que a TV faz com o `fx` da sala. Função pura: recebe o último id já
 * executado e devolve o novo id e as ações.
 *
 * - Id igual ao visto: nada (o poll repete a mesma resposta o tempo todo).
 * - Id menor: a sala foi recriada com o mesmo código; recomeça a contagem
 *   sem executar nada.
 * - Primeira vez que esta TV vê a sala (sem id guardado): liga/desliga
 *   (música, sustos aleatórios) valem — é a última decisão do host —, mas
 *   susto só se for recente. Ninguém quer o susto de uma hora atrás ao
 *   recarregar a página.
 * - Id novo: executa; susto só se não estiver velho (aba que ficou
 *   escondida um tempão não despeja sustos atrasados).
 */

export type FxAction =
  | { type: 'scare'; kind: string; name?: string }
  | { type: 'music'; on: boolean }
  | { type: 'randomScares'; on: boolean }

/** Susto mais velho do que isso (relógio do servidor) não é executado. */
export const FX_FRESH_MS = 20_000

export function decideFx(
  fx: Partial<RoomFx> | null | undefined,
  serverNow: number | null | undefined,
  lastSeen: number | null,
): { lastSeen: number; actions: FxAction[] } {
  const id = typeof fx?.id === 'number' && Number.isFinite(fx.id) ? fx.id : 0
  if (lastSeen !== null && id <= lastSeen) return { lastSeen: id, actions: [] }
  if (!fx || id <= 0) return { lastSeen: Math.max(0, id), actions: [] }

  const firstSight = lastSeen === null
  const hasClock = typeof fx.at === 'number' && typeof serverNow === 'number'
  const fresh = hasClock ? (serverNow as number) - (fx.at as number) <= FX_FRESH_MS : !firstSight

  const actions: FxAction[] = []
  if (fx.music === 'on' || fx.music === 'off') {
    actions.push({ type: 'music', on: fx.music === 'on' })
  }
  if (typeof fx.scare === 'string' && fx.scare.trim()) {
    const scare = fx.scare.trim()
    if (scare === RANDOM_SCARES_ON || scare === RANDOM_SCARES_OFF) {
      actions.push({ type: 'randomScares', on: scare === RANDOM_SCARES_ON })
    } else if (fresh) {
      const name = typeof fx.name === 'string' && fx.name.trim() ? fx.name.trim() : undefined
      actions.push(name ? { type: 'scare', kind: scare, name } : { type: 'scare', kind: scare })
    }
  }
  return { lastSeen: id, actions }
}
