/**
 * Relógio do servidor.
 *
 * Todo prazo dos jogos é em ms do relógio do servidor (vem como `t` em toda
 * resposta do sync). Cada aparelho mede a diferença para o próprio relógio
 * e a suaviza: uma resposta lenta da rede não pode fazer o cronômetro da TV
 * pular para trás e para a frente.
 */

export type ServerClock = {
  /** Registra uma resposta: `serverMs` chegou entre `sentAt` e `receivedAt` (relógio local). */
  sample(serverMs: number, sentAt: number, receivedAt: number): void
  /** Agora, em ms do servidor. */
  now(): number
  /** Diferença atual (servidor − local), em ms. */
  offset(): number
  /** Já recebeu pelo menos uma amostra? */
  ready(): boolean
}

/** Diferença acima disso é relógio que mudou de verdade: pula direto. */
const JUMP_MS = 3000

export function createServerClock(localNow: () => number = () => Date.now()): ServerClock {
  let offset = 0
  let hasSample = false

  return {
    sample(serverMs, sentAt, receivedAt) {
      if (!Number.isFinite(serverMs) || !Number.isFinite(sentAt) || !Number.isFinite(receivedAt)) return
      const rtt = Math.max(0, receivedAt - sentAt)
      // O servidor carimbou `t` mais ou menos no meio da viagem.
      const estimate = serverMs + rtt / 2 - receivedAt
      if (!hasSample || Math.abs(estimate - offset) > JUMP_MS) {
        offset = estimate
        hasSample = true
        return
      }
      // Viagem rápida = amostra confiável; viagem lenta quase não mexe.
      const weight = rtt < 300 ? 0.3 : rtt < 1000 ? 0.12 : 0.04
      offset += (estimate - offset) * weight
    },
    // Milissegundo inteiro: prazos e contratos ficam legíveis no JSON.
    now: () => Math.round(localNow() + offset),
    offset: () => offset,
    ready: () => hasSample,
  }
}

/** O relógio do app (um servidor só, então um relógio só). */
export const serverClock = createServerClock()
