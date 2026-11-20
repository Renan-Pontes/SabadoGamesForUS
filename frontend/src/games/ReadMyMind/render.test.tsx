import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scenarios } from './fixtures'
import HostView from './HostView'
import PlayerView from './PlayerView'
import TvView from './TvView'

/**
 * Teste de fumaça das três telas da Mente Natalina: cada momento da partida
 * (espera, jogo, erro, nível vencido, fim, versus, 15 pessoas) desenha sem
 * quebrar na TV, no painel do host e no celular de cada jogador.
 */

const noop = () => {}

function tv(state: ReturnType<typeof scenarios>[number][1]) {
  return renderToString(createElement(TvView, { roomCode: 'NATAL', gameState: state }))
}

describe('telas da Mente Natalina', () => {
  it.each(scenarios())('desenha TV, host e celulares: %s', (_label, state) => {
    expect(tv(state)).toContain('Mente Natalina')
    const host = renderToString(
      createElement(HostView, {
        roomCode: 'NATAL',
        gameState: state,
        onStartGame: noop,
        onNextRound: noop,
        onEndGame: noop,
        onRestartGame: noop,
        onChangeGame: noop,
        onPlayAsHost: noop,
        onBack: noop,
      }),
    )
    expect(host).toContain('MENTE NATALINA')
    for (const player of state.players) {
      for (const viewMode of ['player', 'host'] as const) {
        const html = renderToString(
          createElement(PlayerView, {
            roomCode: 'NATAL',
            playerId: player.id,
            gameState: state,
            onPlayCard: noop,
            viewMode,
            onBack: noop,
            onToggleView: noop,
          }),
        )
        expect(html).toContain('Mente Natalina')
      }
    }
  })

  it('o erro aparece na TV com as cartas escondidas reveladas', () => {
    const state = new Map(scenarios()).get('erro no co-op')!
    const html = tv(state)
    expect(html).toContain('OPS!')
    expect(html).toContain('Carta 22')
    expect(html).toContain('Carta 30')
  })

  it('o celular mostra a próxima carta e quem tinha a menor', () => {
    const state = new Map(scenarios()).get('erro no co-op')!
    const caio = renderToString(
      createElement(PlayerView, { roomCode: 'NATAL', playerId: '3', gameState: state, onPlayCard: noop }),
    )
    expect(caio).toContain('Sua próxima: 22')
    expect(caio).toContain('Era a sua vez')
  })
})
