import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makePlayers, runSimulation } from '../../engine/testkit'
import type { HInput, HPlayer, HalloweenViewProps } from '../../engine/types'
import { REVEAL_INTRO_MS, engine, revealEnd, truthAt, type MmState } from './engine'
import Phone from './Phone'
import Tv from './Tv'
import { TRUTH_FLIP_MS, truthShownAt } from './view'

describe('telas da Mentira Macabra em todas as fases', () => {
  it.each([3, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { rounds: 4 } })
    expect(result.phases).toEqual(expect.arrayContaining(['write', 'choose', 'reveal', 'scores', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })
})

const noop = () => {}

/** Como o React escreve o texto no HTML. */
function escape(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

/** Desenha a TV e um celular num instante qualquer, como o framework entrega (sem `private`). */
function draw(full: MmState, players: HPlayer[], at: number, me: HPlayer | null, myInput: HInput | null = null) {
  const { private: secrets, ...rest } = full
  const props = {
    code: 'TEST',
    state: rest as MmState,
    players,
    now: () => at,
    send: noop,
    sendSlot: noop,
    command: noop,
    options: {},
    slots: {},
    view: me ? 'player' : 'tv',
    me,
    isHost: false,
    myInput,
    mine: me ? (secrets?.[String(me.id)] ?? null) : null,
  } as HalloweenViewProps<MmState>
  return renderToString(createElement(me ? Phone : Tv, props))
}

describe('revelação, capítulo por capítulo', () => {
  const players = makePlayers(7)
  const sim = runSimulation(engine, { players, seed: 11, options: { rounds: 4 } })
  const reveals = sim.history.filter((state) => state.phase === 'reveal' && state.reveal)

  it('a simulação teve revelações com mentiras para mostrar', () => {
    expect(reveals.length).toBe(4)
    expect(reveals.some((state) => state.reveal!.steps.length > 1)).toBe(true)
  })

  it('a TV mostra a abertura, cada mentira (quem caiu, de quem era) e a verdade por último', () => {
    for (const full of reveals) {
      const reveal = full.reveal!
      expect(draw(full, players, reveal.at, null)).toContain('Hora da verdade')
      reveal.steps.forEach((item, index) => {
        const at = reveal.at + REVEAL_INTRO_MS + index * reveal.stepMs + 50
        const html = draw(full, players, at, null)
        expect(html).toContain(escape(item.text))
        if (item.kind === 'truth') {
          expect(html).toContain('E a verdade é')
        } else {
          expect(html).toContain(item.kind === 'house' ? 'MENTIRA DA CASA' : 'MENTIRA DE')
          expect(html).toMatch(/caiu|caíram/)
        }
      })
      expect(draw(full, players, revealEnd(reveal) - 1, null)).toContain('E a verdade é')
    }
  })

  it('a TV só completa a lacuna quando o cartão da verdade vira (o rufar não entrega antes)', () => {
    for (const full of reveals) {
      const reveal = full.reveal!
      // Durante o rufar, a lacuna do fato continua "???"…
      expect(draw(full, players, truthAt(reveal) + 100, null)).toContain('???')
      expect(draw(full, players, truthShownAt(reveal) - 1, null)).toContain('???')
      // …e só na pancada a verdade aparece no lugar dela.
      expect(draw(full, players, truthShownAt(reveal), null)).not.toContain('???')
    }
  })

  it('o celular só conta o resultado depois que a TV mostra a verdade', () => {
    for (const full of reveals) {
      const reveal = full.reveal!
      for (const player of players) {
        expect(draw(full, players, truthAt(reveal) - 1, player)).toContain('Olhe a TV')
        // O rufar ainda está tocando na TV: o celular não estraga a surpresa.
        expect(draw(full, players, truthAt(reveal) + 100, player)).toContain('Olhe a TV')
        expect(draw(full, players, truthShownAt(reveal) - 1, player)).toContain('Olhe a TV')
        const after = draw(full, players, truthShownAt(reveal), player)
        expect(after).toContain('nesta rodada')
        expect(after).not.toContain('Olhe a TV')
      }
    }
  })

  it('a verdade fica na tela tempo de sobra depois de virar', () => {
    for (const full of reveals) {
      const reveal = full.reveal!
      expect(revealEnd(reveal) - truthShownAt(reveal)).toBeGreaterThanOrEqual(TRUTH_FLIP_MS + 4000)
    }
  })
})

describe('outras situações', () => {
  const players = makePlayers(5)
  const sim = runSimulation(engine, { players, seed: 3, options: { rounds: 4 } })
  const choose = sim.history.find((state) => state.phase === 'choose' && Object.keys(state.private).length > 0)!

  it('na escolha, a TV mostra as opções sem marcar a verdade nem os autores', () => {
    const html = draw(choose, players, choose.deadline! - 5000, null)
    for (const option of choose.options) expect(html).toContain(escape(option.text))
    expect(html).not.toContain('✅')
    expect(html).not.toContain('MENTIRA DE')
  })

  it('no celular, a própria mentira some da lista de opções', () => {
    const [id, secret] = Object.entries(choose.private)[0]
    const me = players.find((player) => player.id === Number(id))!
    const html = draw(choose, players, choose.deadline! - 5000, me)
    expect(html).toContain('Sua mentira')
    const others = choose.options.filter((option) => option.id !== secret.own)
    for (const option of others) expect(html).toContain(escape(option.text))
    // O texto da própria opção só aparece no aviso "sua mentira está no meio", não como botão.
    const own = choose.options.find((option) => option.id === secret.own)!
    expect(html.split(escape(own.text)).length - 1).toBe(1)
  })

  it('celular depois de mandar a mentira: espera os outros e pode trocar', () => {
    const write = sim.history.find((state) => state.phase === 'write')!
    const me = players[0]
    const html = draw(write, players, write.deadline! - 5000, me, { k: write.inputKey, lie: 'Pudim de sangue' })
    expect(html).toContain('Mentira enviada')
    expect(html).toContain('Trocar mentira')
    expect(html).toContain('Esperando os outros')
  })

  it('placar no celular: só fala em "lidera" quando alguém pontuou', () => {
    const scores = sim.history.find((state) => state.phase === 'scores')!
    const zero = { ...scores, scores: Object.fromEntries(scores.roster.map((id) => [String(id), 0])) }
    expect(draw(zero, players, scores.deadline! - 1000, players[2])).not.toContain('lidera')
    const ahead = { ...zero, scores: { ...zero.scores, 3: 5 } }
    expect(draw(ahead, players, scores.deadline! - 1000, players[0])).toContain(`${players[2].name} lidera`)
  })

  it('"Encerrar" do host no meio da escolha: TV e celular desenham o fim', () => {
    const ended = { ...choose, over: true, deadline: null }
    const tv = draw(ended, players, Date.now(), null)
    expect(tv).toContain('Mestre da mentira')
    expect(tv).not.toContain('Qual delas é a VERDADE')
    expect(draw(ended, players, Date.now(), players[1])).toContain('Fim da noite')
  })
})
