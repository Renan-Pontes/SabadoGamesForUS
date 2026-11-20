import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makePlayers } from '../../engine/testkit'
import type { HInput, HPlayer, HalloweenViewProps } from '../../engine/types'
import { RESULT_SECONDS, engine, mesaOf, questionsOf, type State } from './engine'
import Phone from './Phone'
import { NOW, answered, ctxAt, start, toPhase, vote, voting } from './testing'
import Tv from './Tv'
import { REVEAL_TIMING } from './view'

const PLAYERS = makePlayers(15)
const noop = () => {}

/** Desenha a TV (viewer null) ou o celular de alguém, como o framework entrega. */
function draw(state: State, viewer: number | null = null, myInput: Record<string, unknown> | null = null, at?: number) {
  const { private: secrets, ...rest } = state
  const me: HPlayer | null = viewer === null ? null : PLAYERS[viewer - 1]
  const props: HalloweenViewProps<State> = {
    code: 'TEST',
    view: me ? 'player' : 'tv',
    state: rest as State,
    players: PLAYERS.slice(0, Math.max(...state.roster)),
    me,
    isHost: me?.isHost ?? false,
    myInput: myInput ? ({ ...myInput, k: state.inputKey } as HInput) : null,
    mine: me ? ((secrets[String(me.id)] ?? null) as HalloweenViewProps<State>['mine']) : null,
    now: () => at ?? (state.deadline ?? NOW) - 3000,
    send: noop,
    sendSlot: noop,
    command: noop,
    slots: {},
    options: {},
  }
  return renderToString(createElement(me ? Phone : Tv, props))
}

/** O texto como aparece no HTML (o React escapa as aspas). */
const html = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('telas da Pergunta Trocada em todas as fases', () => {
  it.each([3, 8, 15])(
    'desenha TV e celulares com %i jogadores',
    (players) => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: 4, options: { rounds: 3, talkSeconds: 45, chaos: true } })
      expect(result.phases).toEqual(expect.arrayContaining(['question', 'answers', 'talk', 'vote', 'result', 'scores', 'final']))
      expect(result.renders).toBeGreaterThan(0)
    },
    30_000,
  )

  it('desenha também com gente offline e o host pulando', () => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players: 9, seed: 2, offlineIds: [2, 5], skipProbability: 0.15, actProbability: 0.5, options: { rounds: 3 } })
    expect(result.renders).toBeGreaterThan(0)
  }, 30_000)
})

describe('cenas roteirizadas', () => {
  it('pergunta: cada celular vê a sua; a TV não vê nenhuma; o impostor não sabe', () => {
    const { state } = start(5)
    const q = questionsOf(mesaOf(state))
    const impostor = mesaOf(state).impostor!
    const other = state.roster.find((id) => id !== impostor)!
    const tv = draw(state)
    expect(tv).toContain('Pergunta no celular')
    expect(tv).not.toContain(html(q.group))
    expect(tv).not.toContain(html(q.odd))
    expect(tv).toContain('escrevendo')
    const mine = draw(state, impostor)
    const theirs = draw(state, other)
    expect(mine).toContain(html(q.odd))
    expect(theirs).toContain(html(q.group))
    // Fora o texto da pergunta, os dois celulares são iguaizinhos.
    expect(mine.replace(html(q.odd), 'X')).toBe(theirs.replace(html(q.group), 'X'))
    expect(theirs).toContain('Enviar resposta')
    // Depois de responder: a resposta e o botão de mudar.
    const sent = draw(state, other, { answer: 'panetone' })
    expect(sent).toContain('Resposta enviada')
    expect(sent).toContain('panetone')
    expect(sent).toContain('Mudar resposta')
  })

  it('respostas na mesa: a TV mostra todas (e quem não respondeu), sem a pergunta', () => {
    const { state } = start(4)
    const shown = engine.step(state, ctxAt(state, state.deadline!, { 1: { answer: 'farofa' }, 2: { answer: '12' }, 3: { answer: 'Tia Cleide' } }))
    expect(shown.phase).toBe('answers')
    const tv = draw(shown)
    expect(tv).toContain('As respostas!')
    expect(tv).toContain('farofa')
    expect(tv).toContain('Tia Cleide')
    expect(tv).toContain('não respondeu')
    expect(tv).not.toContain(html(questionsOf(mesaOf(shown)).group))
    expect(draw(shown, 1)).toContain('Olhe a mesa')
  })

  it('conversa: a pergunta de verdade na TV; o celular conta para o impostor (do mesmo jeito para todos)', () => {
    const talk = toPhase(answered(5, 2), 'talk')
    const tv = draw(talk)
    expect(tv).toContain('A pergunta da mesa era')
    expect(tv).toContain(html(talk.realQuestion!))
    expect(tv).toContain('resposta 2')
    const impostor = draw(talk, 2)
    expect(impostor).toContain('você é o impostor')
    expect(impostor).toContain(html(questionsOf(mesaOf(talk)).odd))
    const group = draw(talk, 3)
    expect(group).toContain('Igual à sua')
    expect(group).toContain('Bora votar')
    expect(draw(talk, 3, { ready: true })).toContain('Pronto para votar')
  })

  it('votação: botões com o nome e a resposta de cada um (menos a própria)', () => {
    const v = voting(4, 1)
    const phone = draw(v, 2)
    expect(phone).toContain('Quem recebeu a pergunta trocada')
    expect(phone).toContain(PLAYERS[0].name)
    expect(phone).toContain('resposta 1')
    expect(phone).not.toContain('resposta 2')
    expect(draw(v, 2, { vote: 1 })).toContain(`Voto em ${PLAYERS[0].name}`)
    expect(draw(v)).toContain('Votem no celular')
  })

  it('revelação: a mesa aponta, o rufar, e o quadro com as duas perguntas', () => {
    const v = voting(5, 3)
    const result = vote(v, { 1: 3, 2: 3, 4: 3, 5: 1 })
    const begin = result.deadline! - RESULT_SECONDS * 1000
    expect(REVEAL_TIMING.bigEnd).toBeLessThan(RESULT_SECONDS * 1000)
    const pointing = draw(result, null, null, begin + 500)
    expect(pointing).toContain('A mesa apontou')
    expect(pointing).toContain(PLAYERS[2].name)
    expect(draw(result, null, null, begin + REVEAL_TIMING.zoomEnd + 100)).toContain('E o impostor era')
    const board = draw(result, null, null, begin + REVEAL_TIMING.bigEnd + 500)
    expect(board).toContain('A mesa venceu')
    expect(board).toContain(html(result.result!.oddQuestion!))
    expect(board).toContain(html(result.result!.realQuestion))
    expect(draw(result, 1)).toContain('Você votou certo')
    expect(draw(result, 3)).toContain('Pegaram você')

    // Empate e rodada sem impostor.
    const tie = vote(voting(4, 1), { 1: 2, 2: 1 })
    expect(draw(tie, null, null, tie.deadline! - RESULT_SECONDS * 1000 + 300)).toContain('EMPATE')
    const nobody = vote(voting(4, null), { 1: 2 })
    expect(draw(nobody, null, null, nobody.deadline! - 2000)).toContain('Ninguém recebeu pergunta trocada')
    expect(draw(nobody, 2)).toContain('Inocente injustiçado')
  })

  it('placar e fim; "Encerrar" no meio da votação mostra o fim, não a votação', () => {
    const result = vote(voting(4, 1), { 2: 1, 3: 1, 4: 1 })
    const scores = engine.step(result, ctxAt(result, result.deadline!))
    expect(scores.phase).toBe('scores')
    expect(draw(scores)).toContain('Placar da mesa')
    expect(draw(scores, 2)).toContain('Placar')
    expect(draw({ ...scores, round: 2 }, 2)).toContain('última rodada')

    const ended: State = { ...voting(4, 1), over: true }
    const tv = draw(ended)
    expect(tv).toContain('Campeão da festa')
    expect(tv).not.toContain('Votem no celular')
    expect(draw(ended, 3)).toContain('Fim da festa')
  })
})
