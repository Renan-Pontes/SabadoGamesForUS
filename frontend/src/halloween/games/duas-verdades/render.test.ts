import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HInput, HalloweenViewProps } from '../../engine/types'
import { cardOrder, engine, revealSeconds, type DvState } from './engine'
import Phone from './Phone'
import Tv from './Tv'
import { DRUM_MS } from './view'

describe('telas do Duas Verdades em todas as fases', () => {
  it.each([3, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { turns: 0, talkSeconds: 30 } })
    expect(result.phases).toEqual(expect.arrayContaining(['write', 'vote', 'reveal', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })

  it('desenha com o host pulando, gente sem responder e limite de vezes', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players: 7, seed, actProbability: 0.2, skipProbability: 0.25, options: { turns: 6, talkSeconds: 45 } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['write', 'final']))
    }
  })
})

/** Só o texto do HTML: sem o CSS do emotion, sem tags e sem entidades. */
function textOf(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Desenha uma tela num estado montado à mão (fora da simulação). */
function draw(screen: 'tv' | 'phone', state: DvState, me: number | null = null, myInput: HInput | null = null, at: number = (state.deadline ?? 1_000_000) - 3000) {
  const players = makePlayers(Math.max(...state.roster))
  const { private: secrets, ...publicState } = state
  const props = {
    code: 'TEST',
    view: screen === 'tv' ? 'tv' : 'player',
    state: publicState as DvState,
    players,
    me: players.find((candidate) => candidate.id === me) ?? null,
    isHost: false,
    myInput,
    mine: me === null ? null : (secrets[String(me)] ?? null),
    now: () => at,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    slots: {},
    options: {},
  } as HalloweenViewProps<DvState>
  return textOf(renderToString(createElement(screen === 'tv' ? Tv : Phone, props)))
}

const FACTS = (id: number) => [`Verdade A de ${id}`, `Verdade B de ${id}`, `Lorota de ${id}`]

function firstTurn(n: number): DvState {
  const write = engine.init(makeCtx({ players: makePlayers(n) }))
  const inputs = Object.fromEntries(write.roster.map((id) => [id, { k: write.inputKey, facts: FACTS(id), lie: 2 }]))
  return engine.step(write, makeCtx({ players: makePlayers(n), inputs }))
}

describe('telas: casos especiais', () => {
  it('escrita: celular com cartinhas e ideias; depois de enviar, o resumo com a mentira marcada', () => {
    const write = engine.init(makeCtx({ players: makePlayers(4) }))
    const empty = draw('phone', write, 1)
    expect(empty).toContain('Cartinha 1')
    expect(empty).toContain('amigo secreto')
    expect(empty).toContain('Escreva as três frases')
    const sent = draw('phone', write, 1, { k: write.inputKey, facts: FACTS(1), lie: 2 })
    expect(sent).toContain('Cartinhas na meia')
    expect(sent).toContain('Lorota de 1')
    expect(sent).toContain('MENTIRA')
    expect(sent).toContain('Esperando os outros')
    // A TV mostra as meias com os nomes, nunca as frases.
    const tv = draw('tv', { ...write, acted: [1] })
    expect(tv).toContain('Hora de mentir')
    expect(tv).toContain('Vlad')
    expect(tv).toContain('1/4')
  })

  it('vez: a TV e quem vota veem as 3 frases sem a mentira; o autor vê a dele marcada', () => {
    const turn = firstTurn(4)
    const author = turn.author!
    const voter = turn.roster.find((id) => id !== author)!
    const tv = draw('tv', turn)
    for (const fact of FACTS(author)) expect(tv).toContain(fact)
    expect(tv).not.toContain('MENTIRA')
    const voterPhone = draw('phone', turn, voter)
    expect(voterPhone).toContain('Qual é a mentira de')
    expect(voterPhone).not.toContain('MENTIRA')
    const authorPhone = draw('phone', turn, author)
    expect(authorPhone).toContain('É a sua vez')
    expect(authorPhone).toContain('MENTIRA')
    // Depois de votar, o celular mostra o voto e a espera.
    const voted = draw('phone', turn, voter, { k: turn.inputKey, card: 1 })
    expect(voted).toContain('Você votou na B')
    expect(voted).toContain('Esperando os outros')
  })

  it('revelação: o celular segura o resultado no rufar; depois mostra acerto e erro', () => {
    const turn = firstTurn(4)
    const author = turn.author!
    const lie = cardOrder(turn.seed, 1).indexOf(2)
    const [right, wrong] = turn.roster.filter((id) => id !== author)
    const inputs = { [right]: { k: turn.inputKey, card: lie }, [wrong]: { k: turn.inputKey, card: (lie + 1) % 3 } }
    const reveal = engine.step(turn, makeCtx({ players: makePlayers(4), inputs, now: turn.deadline! }))
    expect(reveal.phase).toBe('reveal')
    const startedAt = reveal.deadline! - revealSeconds(reveal.reveal!.outcome) * 1000
    const early = draw('phone', reveal, right, null, startedAt + 500)
    expect(early).toContain('Olhe a TV!')
    expect(early).not.toContain('Acertou')
    const late = startedAt + DRUM_MS + 1000
    expect(draw('phone', reveal, right, null, late)).toContain('Acertou')
    expect(draw('phone', reveal, wrong, null, late)).toContain('Caiu na lorota')
    expect(draw('phone', reveal, author, null, late)).toContain('Você enganou 1')
    const tvEarly = draw('tv', reveal, null, null, startedAt + 500)
    expect(tvEarly).toContain('E a mentira de')
    expect(tvEarly).not.toContain('MENTIRA!')
    const tvLate = draw('tv', reveal, null, null, late)
    expect(tvLate).toContain('MENTIRA!')
    expect(tvLate).toContain('caiu na conversa')
  })

  it('ninguém acertou: TV mostra "ENGANOU TODO MUNDO!"', () => {
    const turn = firstTurn(3)
    const lie = cardOrder(turn.seed, 1).indexOf(2)
    const others = turn.roster.filter((id) => id !== turn.author)
    const inputs = Object.fromEntries(others.map((id) => [id, { k: turn.inputKey, card: (lie + 1) % 3 }]))
    const reveal = engine.step(turn, makeCtx({ players: makePlayers(3), inputs, now: turn.deadline! }))
    expect(reveal.reveal!.outcome).toBe('fooled-all')
    expect(draw('tv', reveal, null, null, reveal.deadline! - 1000)).toContain('ENGANOU TODO MUNDO!')
  })

  it('fim sem cartinhas e "Encerrar" no meio da vez', () => {
    const write = engine.init(makeCtx({ players: makePlayers(3) }))
    const empty = engine.step(write, makeCtx({ players: makePlayers(3), now: write.deadline! }))
    expect(draw('tv', empty)).toContain('Ninguém escreveu')
    expect(draw('phone', empty, 1)).toContain('Ninguém escreveu')
    const ended = { ...firstTurn(3), over: true, deadline: null }
    expect(draw('tv', ended)).toContain('Campeão da lareira')
    expect(draw('phone', ended, 1)).toContain('Fim das histórias')
  })
})
