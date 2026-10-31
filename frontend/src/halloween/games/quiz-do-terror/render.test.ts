import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HalloweenViewProps } from '../../engine/types'
import { engine, type QuizState } from './engine'
import Phone from './Phone'
import Tv from './Tv'

describe('telas do Quiz do Terror em todas as fases', () => {
  it.each([1, 3, 8, 15])('desenha TV e celulares com %i jogador(es)', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { questions: 8, seconds: 15 } })
    expect(result.phases).toEqual(expect.arrayContaining(['question', 'reveal', 'scores', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })

  it('desenha quando ninguém responde nada (revelação vazia e fim sem pontos)', () => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players: 4, seed: 9, actProbability: 0, options: { questions: 8 } })
    expect(result.phases).toEqual(expect.arrayContaining(['question', 'reveal', 'scores', 'final']))
  })

  it('desenha com gente demorando e o host pulando', () => {
    const result = renderAllPhases(
      { engine, Tv, Phone },
      { players: 9, seed: 4, actProbability: 0.4, skipProbability: 0.2, options: { questions: 15, seconds: 20 } },
    )
    expect(result.phases).toEqual(expect.arrayContaining(['question', 'reveal', 'final']))
  })

  it('"Encerrar" no meio da pergunta: TV e celular desenham o fim sem gabarito', () => {
    const players = makePlayers(5)
    const started = engine.init(makeCtx({ players, now: 1_000_000, options: { questions: 8 } }))
    // Como o framework entrega: sem o `private` (o gabarito).
    const { private: secret, ...visible } = { ...started, over: true }
    expect(secret?.gabarito).toEqual(expect.any(Number))
    const state = visible as QuizState
    const base = {
      code: 'TEST',
      state,
      players,
      now: () => 1_000_500,
      send: () => {},
      sendSlot: () => {},
      command: () => {},
      options: {},
      slots: {},
      myInput: null,
      mine: null,
    }
    const tv = renderToString(createElement(Tv, { ...base, view: 'tv', me: null, isHost: false } as HalloweenViewProps<QuizState>))
    expect(tv).toContain('FIM DO QUIZ')
    const phone = renderToString(createElement(Phone, { ...base, view: 'player', me: players[1], isHost: false } as HalloweenViewProps<QuizState>))
    expect(phone).toContain('Fim do quiz!')
  })

  it('celular: segura o resultado durante o rufar e depois mostra acerto, erro ou "não respondeu"', () => {
    const players = makePlayers(3)
    const started = engine.init(makeCtx({ players, now: 1_000_000, options: { questions: 8 } }))
    const right = started.private!.gabarito
    const inputs = {
      1: { k: started.inputKey, choice: right, at: 1_001_000 },
      2: { k: started.inputKey, choice: (right + 1) % 4, at: 1_001_000 },
    }
    const revealed = engine.step(started, makeCtx({ players, now: started.deadline!, inputs }))
    expect(revealed.phase).toBe('reveal')
    const { private: secret, ...visible } = revealed
    expect(secret).toBeDefined()
    const phoneAt = (who: number, at: number) =>
      renderToString(
        createElement(Phone, {
          code: 'TEST',
          view: 'player',
          state: visible as QuizState,
          players,
          me: players[who - 1],
          isHost: false,
          myInput: null,
          mine: null,
          now: () => at,
          send: () => {},
          sendSlot: () => {},
          command: () => {},
          slots: {},
          options: {},
        } as HalloweenViewProps<QuizState>),
      )
    const opened = started.deadline!
    expect(phoneAt(1, opened + 300)).toContain('Olhe a TV')
    expect(phoneAt(1, opened + 300)).not.toContain('Acertou')
    expect(phoneAt(1, opened + 2500)).toContain('Acertou!')
    expect(phoneAt(2, opened + 2500)).toContain('Errou!')
    expect(phoneAt(2, opened + 2500)).toContain('A certa era')
    expect(phoneAt(3, opened + 2500)).toContain('Não respondeu')
    // Quem não respondeu não "errou": a provocação é outra.
    for (const round of [1, 2, 3, 4, 5, 6]) {
      const html = renderToString(
        createElement(Phone, {
          code: 'TEST',
          view: 'player',
          state: { ...(visible as QuizState), round },
          players,
          me: players[2],
          isHost: false,
          myInput: null,
          mine: null,
          now: () => opened + 2500,
          send: () => {},
          sendSlot: () => {},
          command: () => {},
          slots: {},
          options: {},
        } as HalloweenViewProps<QuizState>),
      )
      expect(html).toContain('Não respondeu')
      expect(html).not.toMatch(/erraria|sabia|vergonha/)
    }
  })

  it('revelação com 15 na mesma alternativa: a TV mostra os mais rápidos e "e mais N", sem estourar a tela', () => {
    const players = makePlayers(15)
    const started = engine.init(makeCtx({ players, now: 1_000_000, options: { questions: 8 } }))
    const right = started.private!.gabarito
    // Todo mundo na certa, um segundo depois do outro: o 1 é o mais rápido.
    const inputs = Object.fromEntries(
      players.map((player) => [player.id, { k: started.inputKey, choice: right, at: 1_000_000 + player.id * 1000 }]),
    )
    const revealed = engine.step(started, makeCtx({ players, now: 1_016_000, inputs }))
    expect(revealed.phase).toBe('reveal')
    const { private: secret, ...visible } = revealed
    expect(secret).toBeDefined()
    const html = renderToString(
      createElement(Tv, {
        code: 'TEST',
        view: 'tv',
        state: visible as QuizState,
        players,
        me: null,
        isHost: false,
        myInput: null,
        mine: null,
        now: () => 1_017_000,
        send: () => {},
        sendSlot: () => {},
        command: () => {},
        slots: {},
        options: {},
      } as HalloweenViewProps<QuizState>),
    )
    expect(html).toContain('e mais 7')
    // Os oito mais rápidos aparecem com os pontos; o 15º só no próprio celular.
    expect(html).toContain('Vlad')
    expect(html).not.toContain('Zé do Caixão')
  })

  it('a TV da pergunta mostra as quatro alternativas e nenhuma marcada como certa', () => {
    const players = makePlayers(3)
    const started = engine.init(makeCtx({ players, now: 1_000_000, options: { questions: 8 } }))
    const { private: secret, ...visible } = started
    expect(secret?.gabarito).toEqual(expect.any(Number))
    const html = renderToString(
      createElement(Tv, {
        code: 'TEST',
        view: 'tv',
        state: visible as QuizState,
        players,
        me: null,
        isHost: false,
        myInput: null,
        mine: null,
        now: () => 1_000_500,
        send: () => {},
        sendSlot: () => {},
        command: () => {},
        slots: {},
        options: {},
      } as HalloweenViewProps<QuizState>),
    )
    for (const option of started.question.options) expect(html).toContain(option.replace(/'/g, '&#x27;'))
    expect(html).not.toContain('CERTA')
  })
})
