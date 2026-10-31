import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HInput, HalloweenViewProps } from '../../engine/types'
import { engine, revealSeconds, type RdaState } from './engine'
import Phone from './Phone'
import Tv from './Tv'

describe('telas do Resposta do Além em todas as fases', () => {
  it.each([3, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { rounds: 3 } })
    expect(result.phases).toEqual(expect.arrayContaining(['write', 'vote', 'reveal', 'scores', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })

  it('desenha com o host pulando e gente sem responder (W.O., ninguém respondeu, ninguém votou)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players: 6, seed, actProbability: 0.15, skipProbability: 0.25, options: { rounds: 7 } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['write', 'reveal', 'final']))
    }
  })
})

/** Texto como o React escreve no HTML. */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Só o texto do HTML: sem o CSS que o emotion põe no meio, sem tags e sem os comentários do React. */
function textOf(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Desenha uma tela num estado montado à mão (fora da simulação). */
function draw(
  screen: 'tv' | 'phone',
  state: RdaState,
  me: number | null = null,
  myInput: HInput | null = null,
  at: number = (state.deadline ?? 1_000_000) - 3000,
) {
  const players = makePlayers(Math.max(...state.roster))
  const { private: secrets, ...publicState } = state
  const player = players.find((candidate) => candidate.id === me) ?? null
  const props = {
    code: 'TEST',
    view: screen === 'tv' ? 'tv' : 'player',
    state: publicState as RdaState,
    players,
    me: player,
    isHost: false,
    myInput,
    mine: me === null ? null : (secrets[String(me)] ?? null),
    now: () => at,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    slots: {},
    options: {},
  } as HalloweenViewProps<RdaState>
  return renderToString(createElement(screen === 'tv' ? Tv : Phone, props))
}

describe('telas: casos especiais', () => {
  const start = (n: number) => engine.init(makeCtx({ players: makePlayers(n), options: { rounds: 3 } }))
  const closeWith = (state: RdaState, inputs: Record<number, HInput>) =>
    engine.step(state, makeCtx({ players: makePlayers(state.roster.length), inputs, now: state.deadline! }))

  it('votação: a TV não mostra autor; o celular mostra a própria resposta sem deixar votar nela', () => {
    const write = start(3)
    const vote = closeWith(write, {
      1: { k: write.inputKey, text: 'Um zumbi de pijama' },
      2: { k: write.inputKey, text: 'Pudim' },
      3: { k: write.inputKey, text: 'O tio do pavê' },
    })
    expect(vote.phase).toBe('vote')
    const tv = draw('tv', vote)
    expect(tv).toContain('Um zumbi de pijama')
    expect(tv).not.toContain('sua resposta')
    const phone = draw('phone', vote, 1)
    expect(phone).toContain('sua resposta')
    // Celular de quem já votou mostra a espera.
    const other = vote.cards.find((card) => card.id !== vote.private['2'].card)!
    const voted = textOf(draw('phone', vote, 2, { k: vote.inputKey, card: other.id }))
    expect(voted).toContain('Esperando os outros')
    // A espera fica embaixo da lista: com 15 respostas, quem votou no fim da lista não vê o topo.
    const lastCard = vote.cards[vote.cards.length - 1].text
    expect(voted.indexOf('Esperando os outros')).toBeGreaterThan(voted.indexOf(lastCard))
  })

  it('escrita: depois de enviar, o celular mostra a resposta e a espera', () => {
    const write = start(3)
    const html = draw('phone', write, 1, { k: write.inputKey, text: 'Pudim' })
    expect(html).toContain('Resposta enviada')
    expect(html).toContain('Esperando os outros')
    expect(draw('phone', write, 2)).toContain('Enviar')
  })

  it('ninguém respondeu: TV e celular mostram a resposta do além', () => {
    const empty = closeWith(start(3), {})
    expect(empty.reveal?.kind).toBe('empty')
    expect(draw('tv', empty)).toContain(escapeHtml(empty.reveal!.alem!))
    expect(draw('phone', empty, 2)).toContain('Ninguém respondeu')
  })

  it('só uma resposta: vitória por W.O. na TV e no celular de quem respondeu', () => {
    const write = start(4)
    const solo = closeWith(write, { 3: { k: write.inputKey, text: 'Só eu' } })
    expect(solo.reveal?.kind).toBe('solo')
    expect(draw('tv', solo)).toContain('W.O.')
    expect(draw('phone', solo, 3)).toContain('W.O.')
    expect(draw('phone', solo, 1)).toContain('Só eu')
  })

  it('o celular segura o resultado enquanto a TV rufa os tambores', () => {
    const write = start(4)
    const solo = closeWith(write, { 3: { k: write.inputKey, text: 'Só eu' } })
    const startedAt = solo.deadline! - revealSeconds(solo.reveal!) * 1000
    const early = draw('phone', solo, 3, null, startedAt + 500)
    expect(early).toContain('Olhe a TV!')
    expect(early).not.toContain('W.O.')
    expect(draw('phone', solo, 3, null, startedAt + 5000)).toContain('W.O.')
  })

  it('W.O. de quem escreveu igual: a TV não diz "só uma alma" e o celular conjuga no plural', () => {
    const write = start(4)
    const solo = closeWith(write, { 1: { k: write.inputKey, text: 'Pudim' }, 3: { k: write.inputKey, text: 'pudim!' } })
    expect(solo.reveal?.kind).toBe('solo')
    const tv = textOf(draw('tv', solo))
    expect(tv).not.toContain('Só uma alma')
    expect(tv).toContain('2 almas escreveram igual')
    const late = solo.deadline! - 1000
    expect(textOf(draw('phone', solo, 2, null, late))).toContain('Vlad e Gasparzinho responderam')
    expect(textOf(draw('phone', solo, 1, null, late))).toContain('W.O.')
  })

  it('a frase preenchida com a resposta não fica com ponto dobrado', () => {
    const write = start(3)
    const solo = closeWith(write, { 2: { k: write.inputKey, text: 'Esquece de pagar a luz.' } })
    expect(textOf(draw('tv', solo))).toContain('Esquece de pagar a luz.')
    expect(textOf(draw('tv', solo))).not.toContain('a luz..')
    // A prévia ao vivo do celular também.
    const typing = textOf(draw('phone', write, 1, { k: write.inputKey, text: 'Socorro!' }))
    expect(typing).not.toContain('Socorro!.')
  })

  it('empate no topo: o celular diz que empatou, não que a sua foi "a mais votada"', () => {
    const write = start(5)
    const answers: Record<number, HInput> = {}
    for (const id of [1, 2, 3, 4, 5]) answers[id] = { k: write.inputKey, text: `resposta ${id}` }
    const vote = closeWith(write, answers)
    const card = (id: number) => vote.private[String(id)].card
    // A do 1 e a do 2 levam 2 votos cada.
    const votes: Record<number, HInput> = {
      3: { k: vote.inputKey, card: card(1) },
      4: { k: vote.inputKey, card: card(1) },
      1: { k: vote.inputKey, card: card(2) },
      5: { k: vote.inputKey, card: card(2) },
      2: { k: vote.inputKey, card: card(3) },
    }
    const revealed = engine.step(vote, makeCtx({ players: makePlayers(5), inputs: votes, now: vote.deadline! }))
    expect(revealed.reveal!.results.filter((result) => result.top)).toHaveLength(2)
    const phone = textOf(draw('phone', revealed, 1, null, revealed.deadline! - 1000))
    expect(phone).toContain('Empatou')
    expect(phone).not.toContain('A sua foi a mais votada')
  })

  it('"Encerrar" no meio da votação: TV e celular desenham o fim', () => {
    const write = start(3)
    const vote = closeWith(write, { 1: { k: write.inputKey, text: 'a' }, 2: { k: write.inputKey, text: 'b' } })
    const ended = { ...vote, over: true, deadline: null }
    expect(draw('tv', ended)).toContain('Fim da noite')
    expect(draw('phone', ended, 1)).toContain('Fim da noite')
  })
})
