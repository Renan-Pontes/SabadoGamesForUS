/**
 * Pilha de pedidos de trilha.
 *
 * Várias telas podem pedir música ao mesmo tempo (a tela do jogo pede
 * 'tension', a revelação por cima pede 'victory'). Vale o pedido montado por
 * último; quando ele desmonta, volta o anterior. Um pedido `null` também
 * conta: é silêncio enquanto estiver no topo.
 *
 * Detalhe do React: num mesmo commit os efeitos rodam do filho para o pai.
 * Se a moldura (pai) e o jogo (filho) montam juntos, uma pilha ingênua daria
 * a vitória ao pai. Por isso os pedidos do mesmo "lote" (mesma rodada
 * síncrona de efeitos) são desempatados a favor de quem chegou primeiro — o
 * filho, que é o mais específico.
 *
 * Trocar a trilha de um pedido já montado não muda a ordem — senão um
 * componente antigo que muda de fase passaria na frente de um mais novo.
 */

export type StackId = string | number

type Entry<T> = { id: StackId; track: T | null; batch: number; index: number }

export type MusicStack<T> = {
  /** Cria ou atualiza o pedido `id` (pedido novo entra no topo). */
  set(id: StackId, track: T | null): void
  /** Remove o pedido (desmontou). Ids desconhecidos são ignorados. */
  remove(id: StackId): void
  /** O que vale agora: `requested` é false quando ninguém pediu nada. */
  top(): { track: T | null; requested: boolean }
  size(): number
  /** Avisa a cada mudança efetiva do topo. Devolve a função que cancela. */
  subscribe(listener: () => void): () => void
}

/**
 * `defer` agenda o fim do lote atual (padrão: microtask, que roda depois de
 * todos os efeitos síncronos do commit). Os testes passam uma função manual.
 */
export function createMusicStack<T>(defer: (fn: () => void) => void = queueMicrotask): MusicStack<T> {
  const entries: Entry<T>[] = []
  const listeners = new Set<() => void>()
  let batch = 0
  let inBatch = 0
  let batchOpen = false

  function topEntry(): Entry<T> | undefined {
    let best: Entry<T> | undefined
    for (const entry of entries) {
      if (
        !best ||
        entry.batch > best.batch ||
        (entry.batch === best.batch && entry.index < best.index)
      ) {
        best = entry
      }
    }
    return best
  }

  function keyOf() {
    const top = topEntry()
    return top ? `1:${String(top.track)}` : '0:'
  }

  let lastKey = keyOf()

  function changed() {
    const key = keyOf()
    if (key === lastKey) return
    lastKey = key
    for (const listener of [...listeners]) listener()
  }

  return {
    set(id, track) {
      const existing = entries.find((entry) => entry.id === id)
      if (existing) {
        existing.track = track
      } else {
        if (!batchOpen) {
          batchOpen = true
          batch += 1
          inBatch = 0
          defer(() => {
            batchOpen = false
          })
        }
        entries.push({ id, track, batch, index: inBatch })
        inBatch += 1
      }
      changed()
    },
    remove(id) {
      const index = entries.findIndex((entry) => entry.id === id)
      if (index === -1) return
      entries.splice(index, 1)
      changed()
    },
    top() {
      const top = topEntry()
      return top ? { track: top.track, requested: true } : { track: null, requested: false }
    },
    size() {
      return entries.length
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
