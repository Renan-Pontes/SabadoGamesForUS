import type { BaseState, HalloweenGameModule } from './types'

/**
 * Junta as peças de um jogo para o registro.
 *
 * Cada jogo tem o próprio tipo de estado, e o registro guarda os dez lado a
 * lado — o TypeScript não aceita misturar `HalloweenGameModule<A>` com
 * `<B>` (as telas recebem props diferentes). Aqui o tipo é conferido na
 * entrada, contra o estado do jogo, e só depois "esquecido".
 */
export function defineHalloweenGame<S extends BaseState>(game: HalloweenGameModule<S>): HalloweenGameModule {
  return game as unknown as HalloweenGameModule
}
