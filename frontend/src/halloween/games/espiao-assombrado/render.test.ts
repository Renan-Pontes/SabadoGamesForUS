import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makePlayers } from '../../engine/testkit'
import type { HInput, HPlayer, HalloweenViewProps } from '../../engine/types'
import { PLACES } from './content'
import { engine, type EspiaoState } from './engine'
import Phone from './Phone'
import { RESULT_SECONDS, type Outcome } from './rules'
import { NOW, accuse, ctxAt, placeName, talking } from './testing'
import Tv from './Tv'

const PLAYERS = makePlayers(15)
const noop = () => {}

/** Desenha a TV (viewer null) ou o celular de alguém, como o framework entrega. */
function draw(state: EspiaoState, viewer: number | null = null, myInput: Record<string, unknown> | null = null, at?: number) {
  const { private: secrets, ...rest } = state
  const me: HPlayer | null = viewer === null ? null : PLAYERS[viewer - 1]
  const props: HalloweenViewProps<EspiaoState> = {
    code: 'TEST',
    view: me ? 'player' : 'tv',
    state: rest as EspiaoState,
    players: PLAYERS.slice(0, Math.max(...state.roster)),
    me,
    isHost: me?.isHost ?? false,
    myInput: myInput ? ({ ...myInput, k: state.inputKey } as HInput) : null,
    mine: me ? (secrets[String(me.id)] ?? null) : null,
    now: () => at ?? (state.deadline ?? NOW) - 3000,
    send: noop,
    sendSlot: noop,
    command: noop,
    slots: {},
    options: {},
  }
  return renderToString(createElement(me ? Phone : Tv, props))
}

describe('telas do Espião Assombrado em todas as fases', () => {
  // Semente 4: com 3, 8 e 15 jogadores a partida passa por acusação e última chance.
  it.each([3, 8, 15])(
    'desenha TV e celulares com %i jogadores',
    (players) => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: 4, options: { rounds: 3, talkMinutes: 5 } })
      expect(result.phases).toEqual(
        expect.arrayContaining(['reveal', 'talk', 'accuse', 'final_vote', 'last_chance', 'result', 'scores', 'final']),
      )
      expect(result.renders).toBeGreaterThan(0)
    },
    30_000,
  )
})

describe('cenas roteirizadas', () => {
  it('conversa: o celular do espião é igual ao dos outros (carta virada) e a TV não mostra o lugar', () => {
    const talk = talking(6, [2])
    const spy = draw(talk, 2)
    const other = draw(talk, 3)
    expect(spy).toBe(other)
    expect(spy).toContain('Toque para ver sua carta')
    expect(spy).toContain('Acusar alguém')
    const tv = draw(talk)
    expect(tv).not.toContain(placeName(talk))
    expect(tv).toContain('Quem começa perguntando')
    // Depois de agir: telas de espera.
    expect(draw(talk, 3, { accuse: 1 })).toContain('Você acusou')
    expect(draw(talk, 2, { guess: 'cemitério' })).toContain('Chute enviado')
  })

  it('acusação: TV com placar ao vivo; acusado, acusador e quem vota', () => {
    const acc = accuse(talking(6, [1]), 2, 1)
    const live = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: false } }))
    const tv = draw(live)
    expect(tv).toContain('ACUSAÇÃO')
    expect(tv).toContain('Conversa pausada')
    expect(draw(live, 1)).toContain('acusou você')
    expect(draw(live, 2)).toContain('Você acusou')
    expect(draw(live, 5)).toContain('é o espião?')
    expect(draw(live, 3, { yes: true })).toContain('Você votou SIM')
  })

  it('última chance: quem foi pego digita; os outros esperam', () => {
    const acc = accuse(talking(5, [1]), 2, 1)
    const caught = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: true }, 5: { yes: true } }))
    expect(caught.phase).toBe('last_chance')
    expect(draw(caught)).toContain('PEGO!')
    expect(draw(caught, 1)).toContain('Você foi pego')
    expect(draw(caught, 1, { guess: 'castelo' })).toContain('Chute enviado')
    expect(draw(caught, 3)).toContain('é espião!')
  })

  it('revelação: rufar, manchete e quadro de cada desfecho', () => {
    const outcomes = new Map<Outcome, EspiaoState>()
    const talk = talking(10, [1, 6])
    const right = engine.step(talk, ctxAt(talk, NOW + 30_000, { 6: { guess: placeName(talk) } }))
    outcomes.set('guess-right', right)
    const wrong = engine.step(talk, ctxAt(talk, NOW + 30_000, { 6: { guess: 'banana' } }))
    outcomes.set('guess-wrong', wrong)
    const everyone = talking(4, [1, 2, 3, 4], 'everyone')
    outcomes.set('everyone', engine.step(everyone, ctxAt(everyone, NOW + 30_000, { 2: { guess: 'x' } })))
    const nobody = talking(4, [], 'nobody')
    const vote = engine.step(nobody, ctxAt(nobody, nobody.deadline!))
    outcomes.set('nobody-free', engine.step(vote, ctxAt(vote, vote.deadline!)))
    const tieTalk = talking(4, [3])
    const tieVote = engine.step(tieTalk, ctxAt(tieTalk, tieTalk.deadline!))
    outcomes.set('tie', engine.step(tieVote, ctxAt(tieVote, tieVote.deadline!)))

    for (const [outcome, state] of outcomes) {
      expect(state.result?.outcome, outcome).toBe(outcome)
      const start = state.deadline! - RESULT_SECONDS * 1000
      expect(draw(state, null, null, start + 500)).toContain('E o espião era')
      const board = draw(state, null, null, start + 12_000)
      expect(board).toContain('O LUGAR ERA')
      expect(board).toContain(state.result!.place.name)
      for (const id of state.roster) expect(draw(state, id)).toContain('O lugar era')
    }
    expect(draw(outcomes.get('everyone')!, null, null, outcomes.get('everyone')!.deadline! - 2000)).toContain('TODO MUNDO')
  })

  it('placar e fim; "Encerrar" no meio da acusação mostra o fim, não a votação', () => {
    const talk = talking(5, [1])
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { guess: 'banana' } }))
    const scores = engine.step(result, ctxAt(result, result.deadline!))
    expect(draw(scores)).toContain('Placar da mesa')
    expect(draw(scores, 2)).toContain('Placar')
    expect(draw(scores, 2)).toContain('Próxima rodada')
    // Placar antes da última rodada (3 rodadas: depois da 2ª) avisa que é a última.
    expect(draw({ ...scores, round: 2 }, 2)).toContain('última rodada')

    const acc = accuse(talking(5, [1]), 2, 1)
    const ended = { ...acc, over: true }
    const tv = draw(ended)
    expect(tv).toContain('Campeão da noite')
    expect(tv).not.toContain('ACUSAÇÃO')
    expect(draw(ended, 3)).toContain('Fim da noite')
  })

  it('o lugar aparece por inteiro na revelação', () => {
    const talk = talking(4, [2])
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 2: { guess: 'banana' } }))
    const place = PLACES.find((entry) => entry.name === result.result?.place.name)
    expect(place).toBeDefined()
    expect(draw(result)).toContain(place!.icon)
  })

  it('empate na votação final: a revelação mostra os votos (por isso o espião escapou)', () => {
    const talk = talking(4, [3])
    const vote = engine.step(talk, ctxAt(talk, talk.deadline!))
    const tie = engine.step(vote, ctxAt(vote, vote.deadline!, { 1: { vote: 2 }, 2: { vote: 1 } }))
    expect(tie.result?.outcome).toBe('tie')
    const board = draw(tie, null, null, tie.deadline! - 2000)
    expect(board).toContain('Votação final')
    expect(board).toContain(`${PLAYERS[0].name} 1`)
    expect(board).toContain(`${PLAYERS[1].name} 1`)
    // Rodada que acabou no chute não tem votação final para mostrar.
    const guessed = engine.step(talk, ctxAt(talk, NOW + 30_000, { 3: { guess: 'banana' } }))
    expect(draw(guessed, null, null, guessed.deadline! - 2000)).not.toContain('Votação final')
  })
})
