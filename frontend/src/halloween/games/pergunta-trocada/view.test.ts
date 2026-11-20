import { describe, expect, it } from 'vitest'
import { makePlayers } from '../../engine/testkit'
import type { PtResult } from './engine'
import { REVEAL_TIMING, answerText, clock, holdsScares, kindHint, myOutcome, narrationFor, revealCopy, revealMeme, tableColumns, trackFor } from './view'

const players = makePlayers(6)

function result(extra: Partial<PtResult> = {}): PtResult {
  return {
    impostor: 3,
    oddQuestion: 'Quantos copos de água você bebe por dia?',
    realQuestion: 'Quantas uvas você come na virada do ano?',
    votes: { 1: 3, 2: 3, 4: 1 },
    tally: [],
    top: [3],
    accused: 3,
    caught: true,
    sharp: [1, 2],
    gains: { 1: 2, 2: 2, 4: 1 },
    ...extra,
  }
}

const caught = result()
const innocent = result({ accused: 1, top: [1], caught: false, sharp: [], gains: { 3: 3 } })
const tie = result({ accused: null, top: [1, 3], caught: false, sharp: [2], gains: { 3: 3 } })
const silent = result({ accused: null, top: [], caught: false, sharp: [], votes: {}, gains: { 3: 3 } })
const nobody = result({ impostor: null, oddQuestion: null, accused: 2, top: [2], caught: false, sharp: [], gains: { 2: 2 } })

describe('textos das telas', () => {
  it('todo desfecho tem manchete, legenda, som e placa', () => {
    for (const r of [caught, innocent, tie, silent, nobody]) {
      const copy = revealCopy(r, players)
      expect(copy.title.length).toBeGreaterThan(5)
      expect(copy.subtitle.length).toBeGreaterThan(5)
      expect(copy.headline.length).toBeGreaterThan(3)
    }
    // Nomes: makePlayers → 1 Vlad, 2 Mortícia, 3 Gasparzinho.
    expect(revealCopy(caught, players).title).toBe('PEGARAM GASPARZINHO!')
    expect(revealCopy(innocent, players).title).toBe('VLAD ERA INOCENTE!')
    expect(revealCopy(innocent, players).subtitle).toContain('Gasparzinho')
    expect(revealCopy(tie, players).subtitle).toContain('empate')
    expect(revealCopy(silent, players).subtitle).toContain('Ninguém votou')
    expect(revealCopy(nobody, players).title).toBe('NÃO TINHA IMPOSTOR!')
    expect(revealCopy(nobody, players).subtitle).toContain('Mortícia')
  })

  it('desfecho do ponto de vista de cada um', () => {
    expect(myOutcome(caught, 1)).toMatchObject({ title: 'Você votou certo!', good: true })
    expect(myOutcome(caught, 4)).toMatchObject({ title: 'A mesa pegou o impostor!', good: true })
    expect(myOutcome(caught, 3)).toMatchObject({ title: 'Pegaram você…', good: false })
    expect(myOutcome(innocent, 3)).toMatchObject({ title: 'Você escapou!', good: true })
    expect(myOutcome(innocent, 1)).toMatchObject({ good: false })
    expect(myOutcome(nobody, 2)).toMatchObject({ title: 'Inocente injustiçado!', good: true })
    expect(myOutcome(nobody, 1)).toMatchObject({ good: null })
  })

  it('efeito depois da manchete: "bruh" no inocente, presentes na rodada sem impostor', () => {
    expect(revealMeme(innocent)).toBe('snowman')
    expect(revealMeme(nobody)).toBe('parachuteGift')
    expect(revealMeme(caught)).toBeNull()
    expect(revealMeme(tie)).toBeNull()
  })

  it('narração por fase (e a pergunta lida em voz alta na conversa)', () => {
    const base = { round: 1, totalRounds: 5, realQuestion: null, over: false }
    expect(narrationFor({ ...base, phase: 'question' })).toContain('Ho ho ho')
    expect(narrationFor({ ...base, round: 2, phase: 'question' })).toContain('Rodada 2')
    expect(narrationFor({ ...base, round: 5, phase: 'question' })).toContain('Última rodada')
    expect(narrationFor({ ...base, phase: 'talk', realQuestion: 'Qual a melhor parte do Natal?' })).toBe('E a pergunta era: Qual a melhor parte do Natal?')
    expect(narrationFor({ ...base, phase: 'vote' })).toContain('votar')
    expect(narrationFor({ ...base, phase: 'scores' })).toBe('')
    expect(narrationFor({ ...base, phase: 'vote', over: true })).toContain('Fim da festa')
  })

  it('trilha e efeitos por fase', () => {
    expect(trackFor('question', false)).toBe('jingle')
    expect(trackFor('talk', false)).toBe('natal')
    expect(trackFor('vote', true)).toBe('wish')
    expect(holdsScares('question', false)).toBe(false)
    expect(holdsScares('talk', false)).toBe(false)
    expect(holdsScares('vote', false)).toBe(true)
    expect(holdsScares('result', false)).toBe(true)
  })

  it('miudezas: relógio, dica do tipo, resposta e colunas da mesa', () => {
    expect(clock(61_000)).toBe('1:01')
    expect(clock(null)).toBe('–:––')
    expect(kindHint('numero')).toMatchObject({ inputMode: 'numeric', icon: '🔢' })
    expect(kindHint('nome').inputMode).toBe('text')
    expect(answerText({ 1: 'farofa' }, 1)).toBe('farofa')
    expect(answerText({ 1: 'farofa' }, 2)).toBeNull()
    expect(tableColumns(3)).toBe(2)
    expect(tableColumns(8)).toBe(3)
    expect(tableColumns(15)).toBe(5)
    expect(REVEAL_TIMING.zoomEnd).toBeLessThan(REVEAL_TIMING.drumEnd)
    expect(REVEAL_TIMING.drumEnd).toBeLessThan(REVEAL_TIMING.bigEnd)
  })
})
