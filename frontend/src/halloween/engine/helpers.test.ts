import { describe, expect, it } from 'vitest'
import {
  CHAOS_CHANCE,
  GRACE_MS,
  actedIds,
  addScores,
  allOnlineActed,
  answerDeadline,
  chaosRoll,
  deadlineIn,
  emptyScores,
  fuzzyMatch,
  inputFor,
  isExpired,
  levenshtein,
  listNames,
  msLeft,
  nameOf,
  normalizeText,
  onlineRoster,
  optionDefaults,
  pick,
  randomInt,
  ranking,
  readOption,
  refreshActed,
  sameIds,
  sample,
  sanitizeOptions,
  secondsLeft,
  seededRng,
  shuffle,
  slotFor,
  tally,
  timeUp,
  topIds,
  topUnique,
  typoTolerance,
  withActed,
} from './helpers'
import { makeCtx, makePlayers } from './testkit'
import type { BaseState, HalloweenOption } from './types'

const base: BaseState = { phase: 'vote', inputKey: 'k1', deadline: 5000, roster: [1, 2, 3], over: false }

describe('normalizeText', () => {
  it('tira acento, maiúscula, pontuação e artigos', () => {
    expect(normalizeText('A Mansão do Drácula!')).toBe('mansao dracula')
    expect(normalizeText('  O   CEMITÉRIO  ')).toBe('cemiterio')
    expect(normalizeText('Saci-Pererê')).toBe('saci perere')
    expect(normalizeText("Olho d'água")).toBe('olho agua')
    expect(normalizeText('Coração')).toBe('coracao')
  })

  it('pode sobrar vazio', () => {
    expect(normalizeText('a de o')).toBe('')
    expect(normalizeText('?!')).toBe('')
  })
})

describe('levenshtein e tolerância', () => {
  it('conta edições', () => {
    expect(levenshtein('casa', 'casa')).toBe(0)
    expect(levenshtein('casa', 'caza')).toBe(1)
    expect(levenshtein('casa', 'casas')).toBe(1)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })

  it('1 erro até 5 letras, 2 acima, 0 em palavrinha', () => {
    expect(typoTolerance(2)).toBe(0)
    expect(typoTolerance(5)).toBe(1)
    expect(typoTolerance(6)).toBe(2)
  })
})

describe('fuzzyMatch', () => {
  const cemiterio = ['Cemitério']
  it('aceita acento, maiúscula e artigo', () => {
    expect(fuzzyMatch('o cemiterio', cemiterio)).toBe(true)
    expect(fuzzyMatch('CEMITÉRIO!!', cemiterio)).toBe(true)
  })

  it('tolera erro de digitação conforme o tamanho', () => {
    expect(fuzzyMatch('cemiterio', cemiterio)).toBe(true)
    expect(fuzzyMatch('semiterio', cemiterio)).toBe(true) // 1 erro
    expect(fuzzyMatch('semiteryo', cemiterio)).toBe(true) // 2 erros em 9 letras
    expect(fuzzyMatch('semitery', cemiterio)).toBe(false) // 3 erros
    expect(fuzzyMatch('caza', ['casa'])).toBe(true)
    expect(fuzzyMatch('cara', ['casa'])).toBe(true)
    expect(fuzzyMatch('coisa', ['casa'])).toBe(false) // 2 erros em 4 letras
  })

  it('aceita qualquer uma das respostas (apelidos)', () => {
    expect(fuzzyMatch('hospicio', ['Hospital Psiquiátrico', 'Hospício', 'Manicômio'])).toBe(true)
    expect(fuzzyMatch('escola', ['Hospital Psiquiátrico', 'Hospício'])).toBe(false)
  })

  it('nomes compostos: o chute que contém a resposta vale', () => {
    expect(fuzzyMatch('acho que é o cemitério', cemiterio)).toBe(true)
    expect(fuzzyMatch('é o navio fantasma com certeza', ['Navio Fantasma'])).toBe(true)
  })

  it('nomes compostos: pedaço grande vale, pedaço pequeno não', () => {
    const answer = ['Hospital Psiquiátrico Abandonado']
    expect(fuzzyMatch('hospital psiquiatrico', answer)).toBe(true)
    expect(fuzzyMatch('hospital psiquiatico', answer)).toBe(true) // com erro
    expect(fuzzyMatch('hospital', answer)).toBe(false)
    expect(fuzzyMatch('casa', ['Casa na Árvore Assombrada'])).toBe(false)
  })

  it('chute vazio nunca acerta', () => {
    expect(fuzzyMatch('', cemiterio)).toBe(false)
    expect(fuzzyMatch('o', cemiterio)).toBe(false)
    expect(fuzzyMatch('a', ['a'])).toBe(false)
  })
})

describe('sorte', () => {
  it('seededRng é determinístico e fica em [0, 1)', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const values = Array.from({ length: 200 }, () => a())
    expect(values).toEqual(Array.from({ length: 200 }, () => b()))
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
    expect(seededRng(1)()).not.toBe(seededRng(2)())
  })

  it('shuffle é uma permutação e não mexe no original', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const copy = [...items]
    const shuffled = shuffle(items, seededRng(7))
    expect(items).toEqual(copy)
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items)
  })

  it('pick, sample e randomInt', () => {
    const rng = seededRng(3)
    expect([1, 2, 3]).toContain(pick([1, 2, 3], rng))
    expect(() => pick([], rng)).toThrow()
    const chosen = sample([1, 2, 3, 4, 5], 3, rng)
    expect(new Set(chosen).size).toBe(3)
    expect(sample([1, 2], 5, rng)).toHaveLength(2)
    for (let i = 0; i < 50; i += 1) {
      const value = randomInt(rng, 1, 3)
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(3)
    }
  })
})

describe('respostas', () => {
  const ctx = makeCtx({
    players: makePlayers(4, { offline: [4] }),
    inputs: { 1: { k: 'k1', vote: 2 }, 2: { k: 'velha', vote: 1 }, 3: { k: 'k1', vote: 1 } },
    slots: { draw: { 1: { k: 'k1', lines: [] }, 2: { k: 'k0', lines: [] } } },
  })

  it('inputFor ignora resposta de outra fase', () => {
    expect(inputFor(ctx, 'k1', 1)?.vote).toBe(2)
    expect(inputFor(ctx, 'k1', 2)).toBeUndefined()
    expect(inputFor(ctx, 'k1', 9)).toBeUndefined()
  })

  it('slotFor filtra pela chave quando pedido', () => {
    expect(slotFor(ctx, 'draw', 2)).toBeDefined()
    expect(slotFor(ctx, 'draw', 2, 'k1')).toBeUndefined()
    expect(slotFor(ctx, 'draw', 2, ['k0', 'k1'])).toBeDefined()
    expect(slotFor(ctx, 'nada', 1)).toBeUndefined()
  })

  it('actedIds, onlineRoster e allOnlineActed', () => {
    expect(actedIds(ctx, 'k1', [1, 2, 3, 4])).toEqual([1, 3])
    expect(onlineRoster(ctx)).toEqual([1, 2, 3])
    expect(onlineRoster(ctx, [4, 3, 1])).toEqual([3, 1])
    expect(allOnlineActed(ctx, 'k1', [1, 3, 4])).toBe(true) // o 4 está offline
    expect(allOnlineActed(ctx, 'k1', [1, 2, 3])).toBe(false)
    expect(allOnlineActed(ctx, 'k1', [4])).toBe(false) // ninguém online: o prazo decide
  })

  it('withActed e refreshActed devolvem o mesmo estado quando nada muda', () => {
    const state = { ...base, acted: [1, 3] }
    expect(withActed(state, [1, 3])).toBe(state)
    expect(withActed(state, [1])).toEqual({ ...state, acted: [1] })
    expect(refreshActed(state, ctx)).toBe(state)
    expect(refreshActed({ ...base }, ctx).acted).toEqual([1, 3])
    expect(sameIds(undefined, [])).toBe(true)
  })

  it('listNames junta nomes em português', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['Ana'])).toBe('Ana')
    expect(listNames(['Ana', 'Bia'])).toBe('Ana e Bia')
    expect(listNames(['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia e Caio')
  })

  it('nameOf tem fallback', () => {
    expect(nameOf(ctx.players, 1)).toBe(ctx.players[0].name)
    expect(nameOf(ctx.players, 99)).toBe('Alguém')
    expect(nameOf(ctx.players, null, '—')).toBe('—')
  })
})

describe('votos e pontos', () => {
  it('tally ordena por votos e depois pelo menor id', () => {
    const entries = tally({ 1: 3, 2: 3, 3: 2, 4: 2, 5: null, 6: undefined })
    expect(entries.map((entry) => [entry.id, entry.count])).toEqual([
      [2, 2],
      [3, 2],
    ])
    expect(entries[0].voters).toEqual([3, 4])
  })

  it('topIds e topUnique', () => {
    expect(topIds(tally({ 1: 2, 2: 2, 3: 1 }))).toEqual([2])
    expect(topUnique(tally({ 1: 2, 2: 2, 3: 1 }))).toBe(2)
    expect(topIds(tally({ 1: 2, 2: 1 }))).toEqual([1, 2])
    expect(topUnique(tally({ 1: 2, 2: 1 }))).toBeNull()
    expect(topIds([])).toEqual([])
    expect(topUnique([])).toBeNull()
  })

  it('addScores não mexe no original', () => {
    const scores = emptyScores([1, 2])
    const next = addScores(scores, { 1: 2, 3: 1, 2: 0 })
    expect(scores).toEqual({ 1: 0, 2: 0 })
    expect(next).toEqual({ 1: 2, 2: 0, 3: 1 })
    expect(addScores(undefined, { 5: 1 })).toEqual({ 5: 1 })
  })

  it('ranking divide a posição no empate', () => {
    expect(ranking({ 1: 5, 2: 7, 3: 5, 4: 1 }, [1, 2, 3, 4])).toEqual([
      { id: 2, score: 7, place: 1 },
      { id: 1, score: 5, place: 2 },
      { id: 3, score: 5, place: 2 },
      { id: 4, score: 1, place: 4 },
    ])
    expect(ranking(undefined, [1])).toEqual([{ id: 1, score: 0, place: 1 }])
  })
})

describe('prazos', () => {
  it('answerDeadline soma a folga', () => {
    expect(deadlineIn(1000, 8)).toBe(9000)
    expect(answerDeadline(1000, 25)).toBe(1000 + 25000 + GRACE_MS)
  })

  it('isExpired e timeUp (skip conta como prazo vencido)', () => {
    expect(isExpired(null, 10)).toBe(false)
    expect(isExpired(10, 10)).toBe(true)
    expect(timeUp(base, makeCtx({ now: 4999 }))).toBe(false)
    expect(timeUp(base, makeCtx({ now: 5000 }))).toBe(true)
    expect(timeUp(base, makeCtx({ now: 0, command: { id: 1, type: 'skip' } }))).toBe(true)
    expect(timeUp(base, makeCtx({ now: 0, command: { id: 1, type: 'outro' } }))).toBe(false)
  })

  it('msLeft e secondsLeft escondem a folga quando pedido', () => {
    expect(msLeft(null, 0)).toBeNull()
    expect(secondsLeft(10_000, 0)).toBe(10)
    expect(secondsLeft(10_000, 0, GRACE_MS)).toBe(8)
    expect(secondsLeft(10_000, 9_500, GRACE_MS)).toBe(0)
    expect(secondsLeft(10_000, 8_001)).toBe(2)
  })
})

describe('opções', () => {
  const options: HalloweenOption[] = [
    { key: 'rounds', label: 'Rodadas', choices: [{ value: 3, label: '3' }, { value: 5, label: '5' }], default: 5 },
    { key: 'chaos', label: 'Malucas', choices: [{ value: true, label: 'Sim' }, { value: false, label: 'Não' }], default: true },
  ]

  it('optionDefaults e sanitizeOptions', () => {
    expect(optionDefaults(options)).toEqual({ rounds: 5, chaos: true })
    expect(sanitizeOptions(options, { rounds: 3, chaos: false, extra: 1 })).toEqual({ rounds: 3, chaos: false })
    expect(sanitizeOptions(options, { rounds: 4, chaos: 'sim' })).toEqual({ rounds: 5, chaos: true })
    expect(sanitizeOptions(options, null)).toEqual({ rounds: 5, chaos: true })
  })

  it('readOption cai no padrão com tipo ou valor errado', () => {
    expect(readOption({ rounds: 3 }, 'rounds', 5)).toBe(3)
    expect(readOption({ rounds: '3' }, 'rounds', 5)).toBe(5)
    expect(readOption<number>({ rounds: 4 }, 'rounds', 5, [3, 5])).toBe(5)
    expect(readOption(undefined, 'rounds', 5)).toBe(5)
  })
})

describe('chaosRoll', () => {
  const always = () => 0
  const never = () => 0.99

  it('nunca na 1ª rodada nem desligado', () => {
    expect(chaosRoll(always, 1, true, [])).toBeNull()
    expect(chaosRoll(always, 3, false, [])).toBeNull()
  })

  it('no máximo uma de cada por partida', () => {
    expect(chaosRoll(always, 2, true, [])).not.toBeNull()
    expect(chaosRoll(always, 2, true, ['everyone'])).toBe('nobody')
    expect(chaosRoll(always, 2, true, ['everyone', 'nobody'])).toBeNull()
    expect(chaosRoll(never, 2, true, [])).toBeNull()
  })

  it('sai em mais ou menos 18% das rodadas', () => {
    const rng = seededRng(99)
    let hits = 0
    for (let i = 0; i < 4000; i += 1) if (chaosRoll(rng, 2, true, [])) hits += 1
    expect(hits / 4000).toBeGreaterThan(CHAOS_CHANCE - 0.03)
    expect(hits / 4000).toBeLessThan(CHAOS_CHANCE + 0.03)
  })
})
