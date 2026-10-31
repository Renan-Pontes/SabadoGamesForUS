import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput, HPlayer } from '../../engine/types'
import { THEMES } from './content'
import {
  ARRIVAL_GRACE_MS,
  BOOM_SECONDS,
  FIRST_THEME_SECONDS,
  HEAT_STEP_MS,
  LATE_MS,
  MAX_ROUNDS,
  MAX_WORD_LENGTH,
  MIN_HOLD_MS,
  THEME_SECONDS,
  aliveIds,
  autoFuseSeconds,
  cleanWord,
  engine,
  fuseLeftAt,
  gameDecided,
  heatRate,
  isAlive,
  mostBooms,
  nextAlive,
  nextInLine,
  realMsLeft,
  standings,
  winners,
  wordKey,
  wordUsed,
  type AbbState,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 4, options: Record<string, unknown> = {}, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx em `now`, com as respostas dadas (já com a chave da posse atual). */
function ctxAt(
  state: AbbState,
  now: number,
  inputs: Record<number, Record<string, unknown>> = {},
  extra: Partial<EngineCtx> = {},
): EngineCtx {
  const full: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(inputs)) full[Number(id)] = { k: state.inputKey, ...fields }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now, inputs: full, ...extra })
}

/** Pula o anúncio do tema: a abóbora acende em `now` (padrão: no prazo do tema). */
function play(state: AbbState, now = state.deadline!, extra: Partial<EngineCtx> = {}) {
  const next = engine.step(state, ctxAt(state, now, {}, extra))
  expect(next.phase).toBe('play')
  return next
}

/** Quem segura passa: toque em `at`, juiz vê em `seenAt`. */
function pass(state: AbbState, at: number, seenAt = at, fields: Record<string, unknown> = {}, extra: Partial<EngineCtx> = {}) {
  return engine.step(state, ctxAt(state, seenAt, { [state.holder!]: { at, ...fields } }, extra))
}

/** Deixa o pavio de quem segura acabar. */
function explode(state: AbbState) {
  return engine.step(state, ctxAt(state, state.deadline!))
}

/** Faz a abóbora estourar na mão do jogador `victim` na rodada atual. */
function explodeOn(state: AbbState, victim: number) {
  let s = state.phase === 'theme' ? play(state) : state
  let guard = 0
  while (s.holder !== victim && guard < 50) {
    s = pass(s, s.arrivedAt + 1500, s.arrivedAt + 1500)
    guard += 1
  }
  expect(s.holder).toBe(victim)
  return explode(s)
}

describe('início', () => {
  it('anuncia o tema da rodada 1 com pavios cheios e todo mundo com vidas', () => {
    const { state } = start(5)
    expect(state.phase).toBe('theme')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(MAX_ROUNDS)
    expect(state.inputKey).toBe('theme-1')
    expect(state.deadline).toBe(NOW + FIRST_THEME_SECONDS * 1000)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.lives).toEqual({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 })
    expect(state.fuseMs).toBe(15_000)
    expect(Object.values(state.fuse)).toEqual([15_000, 15_000, 15_000, 15_000, 15_000])
    expect(state.roster).toContain(state.holder)
    expect(state.fuseEnd).toBeNull()
    expect(state.theme.text).toBe(THEMES[state.theme.id].text)
    expect(state.over).toBe(false)
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('pavio automático: 15 s até 6, 12 s até 10, 10 s com mais', () => {
    expect(autoFuseSeconds(2)).toBe(15)
    expect(start(6).state.fuseMs).toBe(15_000)
    expect(start(7).state.fuseMs).toBe(12_000)
    expect(start(10).state.fuseMs).toBe(12_000)
    expect(start(11).state.fuseMs).toBe(10_000)
    expect(start(15).state.fuseMs).toBe(10_000)
  })

  it('opções: pavio 10/15/20, vidas 1/2/3, modo falar/digitar (lixo volta ao padrão)', () => {
    expect(start(4, { fuse: 20 }).state.fuseMs).toBe(20_000)
    expect(start(12, { fuse: 15 }).state.fuseMs).toBe(15_000)
    expect(start(4, { fuse: 7 }).state.fuseMs).toBe(15_000)
    expect(start(4, { fuse: '20' }).state.fuseMs).toBe(15_000)
    expect(start(4, { lives: 3 }).state.maxLives).toBe(3)
    expect(start(4, { lives: 9 }).state.maxLives).toBe(2)
    expect(start(4, { lives: 1 }).state.lives).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 })
    expect(start(4, { mode: 'digitar' }).state.mode).toBe('digitar')
    expect(start(4, { mode: 'cantar' }).state.mode).toBe('falar')
    const defaults = start(4, optionDefaults(meta.options)).state
    expect([defaults.fuseMs, defaults.maxLives, defaults.mode]).toEqual([15_000, 2, 'falar'])
  })

  it('12 temas sem repetir, alternando Halloween e dia a dia', () => {
    const { state } = start(4)
    expect(state.deck).toHaveLength(MAX_ROUNDS)
    expect(new Set(state.deck).size).toBe(MAX_ROUNDS)
    state.deck.forEach((id, index) => expect(THEMES[id].spooky).toBe(index % 2 === 0))
  })
})

describe('anúncio do tema', () => {
  it('no prazo, acende o pavio de quem começa (com a folga da chegada)', () => {
    const { state } = start(4)
    expect(engine.step(state, ctxAt(state, state.deadline! - 1))).toBe(state)
    const live = play(state)
    const t = state.deadline!
    expect(live.holder).toBe(state.holder)
    expect(live.inputKey).toBe('pass-1-0')
    expect(live.arrivedAt).toBe(t)
    expect(live.fuseEnd).toBe(t + ARRIVAL_GRACE_MS + 15_000)
    expect(live.deadline).toBe(live.fuseEnd! + LATE_MS)
    expect(live.heat).toBe(0)
    expect(live.startedAt).toBe(t)
  })

  it('"Pular" no anúncio começa na hora', () => {
    const { state } = start(4)
    const live = engine.step(state, ctxAt(state, NOW + 10, {}, { command: { id: 1, type: 'skip' } }))
    expect(live.phase).toBe('play')
    expect(live.arrivedAt).toBe(NOW + 10)
  })

  it('quem ia começar saiu da festa: começa o próximo vivo online', () => {
    const { state } = start(4)
    const planned = state.holder!
    const players = makePlayers(4, { offline: [planned] })
    const live = play(state, state.deadline!, { players })
    expect(live.holder).not.toBe(planned)
    expect(live.holder).toBe(nextAlive(state, planned, players))
  })
})

describe('passar a abóbora', () => {
  it('desconta só o que queimou e entrega ao próximo da mesa', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    // Toca 2,5 s depois da chegada: 1,5 s de folga + 1 s queimando.
    const next = pass(live, live.arrivedAt + 2500, live.arrivedAt + 2700)
    expect(next.phase).toBe('play')
    expect(next.fuse['2']).toBe(15_000 - 1000)
    expect(next.holder).toBe(3)
    expect(next.from).toBe(2)
    expect(next.passes).toBe(1)
    expect(next.inputKey).toBe('pass-1-1')
    expect(next.arrivedAt).toBe(live.arrivedAt + 2700)
    expect(next.fuseEnd).toBe(next.arrivedAt + ARRIVAL_GRACE_MS + 15_000)
    expect(next.acted).toEqual([2])
    // O pavio do 3 começa cheio; o do 2 ficou pausado.
    expect(fuseLeftAt(next, 2, next.arrivedAt + 9000)).toBe(14_000)
    expect(fuseLeftAt(next, 3, next.arrivedAt + 3500)).toBe(13_000)
  })

  it('a abóbora dá a volta na mesa (o último passa para o primeiro)', () => {
    const { state } = start(3)
    let s = play({ ...state, holder: 3 })
    s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1300)
    expect(s.holder).toBe(1)
    s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1300)
    expect(s.holder).toBe(2)
    expect(s.acted).toEqual([1, 3])
  })

  it('passe dentro da folga de 1,5 s não queima nada', () => {
    const { state } = start(4)
    const live = play(state)
    const next = pass(live, live.arrivedAt + 1400, live.arrivedAt + 1450)
    expect(next.fuse[String(live.holder)]).toBe(15_000)
  })

  it('passe que chega com menos de 1 s de posse ainda não vale', () => {
    const { state } = start(4)
    const live = play(state)
    const early = { [live.holder!]: { at: live.arrivedAt + 300 } }
    expect(engine.step(live, ctxAt(live, live.arrivedAt + 800, early))).toBe(live)
    // Um passo depois, o mesmo passe vale — com o toque limitado a chegada + 1 s.
    const next = engine.step(live, ctxAt(live, live.arrivedAt + MIN_HOLD_MS + 100, early))
    expect(next.passes).toBe(1)
    expect(next.fuse[String(live.holder)]).toBe(15_000)
  })

  it('o toque vale pelo horário, limitado ao intervalo [chegada + 1 s, agora]', () => {
    const { state } = start(4)
    const live = play(state)
    const holder = String(live.holder)
    const seen = live.arrivedAt + 5000
    // Toque no futuro: vale o "agora" do juiz (3,5 s queimando).
    expect(pass(live, seen + 60_000, seen).fuse[holder]).toBe(15_000 - 3500)
    // Toque de antes da chegada: vale a chegada + 1 s (nada queimou).
    expect(pass(live, live.arrivedAt - 9000, seen).fuse[holder]).toBe(15_000)
    // Sem horário, texto ou NaN: vale o "agora".
    expect(pass(live, undefined as unknown as number, seen).fuse[holder]).toBe(11_500)
    expect(pass(live, 'ontem' as unknown as number, seen).fuse[holder]).toBe(11_500)
    expect(pass(live, Number.NaN, seen).fuse[holder]).toBe(11_500)
  })

  it('ignora passe de quem não está com a abóbora, de outra posse e de espectador', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 1 })
    const ctx = makeCtx({
      players: makePlayers(6),
      now: live.arrivedAt + 3000,
      inputs: {
        1: { k: 'pass-1-7', at: live.arrivedAt + 2000 }, // chave de outra posse
        2: { k: live.inputKey, at: live.arrivedAt + 2000 }, // não está com a abóbora
        5: { k: live.inputKey, at: live.arrivedAt + 2000 }, // espectador
      },
    })
    expect(engine.step(live, ctx)).toBe(live)
  })

  it('devolve o mesmo estado quando nada muda (idempotente)', () => {
    const { state } = start(4)
    const live = play(state)
    const ctx = ctxAt(live, live.arrivedAt + 2000)
    expect(engine.step(live, ctx)).toBe(live)
    const passed = pass(live, live.arrivedAt + 2000)
    expect(engine.step(passed, ctxAt(live, live.arrivedAt + 2000, { [live.holder!]: { at: live.arrivedAt + 2000 } }))).toBe(passed)
  })

  it('pula quem já virou fantasma; quem está offline também recebe (ninguém fica imune)', () => {
    const { state } = start(5)
    const live = play({ ...state, holder: 1, lives: { ...state.lives, 2: 0 } })
    expect(pass(live, live.arrivedAt + 1500).holder).toBe(3)
    // Celular bloqueado ou no Instagram não é escudo: a abóbora chega nele e
    // o pavio dele queima (a mesa grita o nome, ele volta e passa).
    const players = makePlayers(5, { offline: [3, 4] })
    expect(pass(live, live.arrivedAt + 1500, live.arrivedAt + 1500, {}, { players }).holder).toBe(3)
    expect(nextInLine(live, 1)).toBe(3)
    expect(nextInLine(live, 5)).toBe(1)
    expect(nextInLine({ ...live, lives: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 } }, 1)).toBeNull()
  })
})

describe('BUM', () => {
  it('pavio acabou: quem segura perde uma vida e a rodada mostra o placar', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    expect(engine.step(live, ctxAt(live, live.deadline! - 1))).toBe(live)
    const boom = explode(live)
    expect(boom.phase).toBe('boom')
    expect(boom.inputKey).toBe('boom-1')
    expect(boom.deadline).toBe(live.deadline! + BOOM_SECONDS * 1000)
    expect(boom.lives).toEqual({ 1: 2, 2: 1, 3: 2, 4: 2 })
    expect(boom.fuse['2']).toBe(0)
    expect(boom.boom).toEqual({ victim: 2, livesLeft: 1, eliminated: false, passes: 0 })
    expect(boom.history).toEqual([{ round: 1, theme: state.theme.text, victim: 2, passes: 0 }])
    // Pavio poupado: quem não pegou a abóbora guardou o pavio inteiro.
    expect(boom.saved).toEqual({ 1: 15_000, 2: 0, 3: 15_000, 4: 15_000 })
    expect(boom.fuseEnd).toBeNull()
  })

  it('passe tocado antes do fim do pavio salva, mesmo chegando atrasado', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    const saved = pass(live, live.fuseEnd! - 100, live.fuseEnd! + 1000)
    expect(saved.phase).toBe('play')
    expect(saved.holder).toBe(3)
    expect(saved.fuse['2']).toBeGreaterThan(0)
    expect(saved.fuse['2']).toBeLessThanOrEqual(100)
    // Tocou depois do fim do pavio: não vale, e no prazo vem o BUM.
    const late = { 2: { at: live.fuseEnd! + 10 } }
    expect(engine.step(live, ctxAt(live, live.fuseEnd! + 500, late))).toBe(live)
    expect(engine.step(live, ctxAt(live, live.deadline!, late)).boom?.victim).toBe(2)
  })

  it('passe tocado em cima do laço e visto pelo juiz até 2 s depois ainda salva', () => {
    // A TV só enxerga o passe no próximo poll (~1 s + rede): o BUM espera a folga toda.
    expect(LATE_MS).toBeGreaterThanOrEqual(GRACE_MS)
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    expect(engine.step(live, ctxAt(live, live.fuseEnd! + 2000))).toBe(live)
    const saved = pass(live, live.fuseEnd! - 100, live.fuseEnd! + 2100)
    expect(saved.phase).toBe('play')
    expect(saved.holder).toBe(3)
  })

  it('o pavio de quem quase acabou some na próxima posse (sem reviver)', () => {
    const { state } = start(2)
    let s = play({ ...state, holder: 1 })
    s = pass(s, s.fuseEnd! - 1, s.fuseEnd! - 1)
    expect(s.fuse['1']).toBeGreaterThanOrEqual(1)
    s = pass(s, s.arrivedAt + 1000, s.arrivedAt + 1000)
    expect(s.holder).toBe(1)
    // Volta com quase nada: o BUM é logo depois da folga.
    expect(s.fuseEnd! - s.arrivedAt).toBeLessThanOrEqual(ARRIVAL_GRACE_MS + 2)
    expect(explode(s).boom?.victim).toBe(1)
  })

  it('sem vidas vira fantasma: não recebe mais a abóbora nem começa rodada', () => {
    const { state } = start(3, { lives: 1 })
    const boom = explodeOn({ ...state, holder: 2 }, 2)
    expect(boom.boom).toMatchObject({ victim: 2, livesLeft: 0, eliminated: true })
    expect(aliveIds(boom)).toEqual([1, 3])
    const round2 = engine.step(boom, ctxAt(boom, boom.deadline!))
    expect(round2.phase).toBe('theme')
    expect(round2.holder).toBe(3)
    expect(round2.fuse['2']).toBe(0)
    let s = play(round2)
    for (let i = 0; i < 6; i += 1) {
      expect(s.holder).not.toBe(2)
      s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200)
    }
  })

  it('próxima rodada: tema novo, pavios recarregados, começa o próximo vivo depois de quem explodiu', () => {
    const { state } = start(4, { mode: 'digitar' })
    let s = play({ ...state, holder: 1 })
    s = pass(s, s.arrivedAt + 4000, s.arrivedAt + 4000, { word: 'Lobisomem' })
    const boom = explode(s)
    expect(boom.boom?.victim).toBe(2)
    const round2 = engine.step(boom, ctxAt(boom, boom.deadline!))
    expect(round2.phase).toBe('theme')
    expect(round2.round).toBe(2)
    expect(round2.inputKey).toBe('theme-2')
    expect(round2.deadline).toBe(boom.deadline! + THEME_SECONDS * 1000)
    expect(round2.holder).toBe(3)
    expect(round2.theme.id).toBe(state.deck[1])
    expect(round2.fuse).toEqual({ 1: 15_000, 2: 15_000, 3: 15_000, 4: 15_000 })
    expect(round2.words).toEqual([])
    expect(round2.acted).toEqual([])
    expect(round2.passes).toBe(0)
    expect(round2.boom).toBeNull()
    // O pavio que o 1 poupou na rodada 1 conta no desempate.
    expect(round2.saved['1']).toBe(15_000 - 2500)
  })
})

describe('"Pular" do host', () => {
  it('no meio da rodada apaga o pavio: ninguém perde vida, mas a rodada conta', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    const skipped = engine.step(live, ctxAt(live, live.arrivedAt + 4500, {}, { command: { id: 3, type: 'skip' } }))
    expect(skipped.phase).toBe('boom')
    expect(skipped.boom).toEqual({ victim: null, livesLeft: 0, eliminated: false, passes: 0 })
    expect(skipped.lives).toEqual(state.lives)
    // O que já tinha queimado fica queimado (3 s).
    expect(skipped.fuse['2']).toBe(12_000)
    expect(skipped.history).toEqual([{ round: 1, theme: state.theme.text, victim: null, passes: 0 }])
    const next = engine.step(skipped, ctxAt(skipped, skipped.arrivedAt + 4600, {}, { command: { id: 4, type: 'skip' } }))
    expect(next.phase).toBe('theme')
    expect(next.round).toBe(2)
    expect(next.holder).toBe(3)
  })

  it('comando desconhecido não faz nada em fase nenhuma', () => {
    const { state } = start(3)
    const odd = { command: { id: 9, type: 'dançar' } }
    expect(engine.step(state, ctxAt(state, NOW + 1, {}, odd))).toBe(state)
    const live = play(state)
    expect(engine.step(live, ctxAt(live, live.arrivedAt + 1, {}, odd))).toBe(live)
    const boom = explode(live)
    expect(engine.step(boom, ctxAt(boom, boom.deadline! - 1, {}, odd))).toBe(boom)
  })
})

describe('a abóbora esquenta', () => {
  it('a cada 30 s de rodada o pavio de quem pega queima mais rápido (até 3×)', () => {
    expect([0, 1, 2, 3, 4, 9].map(heatRate)).toEqual([1, 1.5, 2, 2.5, 3, 3])
    const { state } = start(2, { fuse: 20 })
    let s = play({ ...state, holder: 1 })
    // Passa de mão em mão sem queimar até a rodada fazer 30 s.
    while (s.arrivedAt - s.startedAt < HEAT_STEP_MS) s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200)
    expect(s.heat).toBe(1)
    const holder = String(s.holder)
    expect(s.fuseEnd).toBe(s.arrivedAt + ARRIVAL_GRACE_MS + Math.ceil(s.fuse[holder] / 1.5))
    const before = s.fuse[holder]
    const after = pass(s, s.arrivedAt + ARRIVAL_GRACE_MS + 2000, s.arrivedAt + ARRIVAL_GRACE_MS + 2000)
    expect(after.fuse[holder]).toBe(before - 3000)
    // Os segundos de verdade mostrados encolhem com o calor.
    expect(realMsLeft(after, Number(holder), after.arrivedAt)).toBeCloseTo((before - 3000) / heatRate(after.heat), 0)
    while (s.arrivedAt - s.startedAt < HEAT_STEP_MS * 6) s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200)
    expect(s.heat).toBe(4)
  })
})

describe('modo digitar', () => {
  function typed(n = 4) {
    const { state } = start(n, { mode: 'digitar' })
    return play({ ...state, holder: 1 })
  }

  it('passa com uma palavra nova, que vai para a TV', () => {
    const live = typed()
    const next = pass(live, live.arrivedAt + 2000, live.arrivedAt + 2000, { word: '  Múmia   egípcia ' })
    expect(next.holder).toBe(2)
    expect(next.words).toEqual([{ by: 1, word: 'Múmia egípcia' }])
  })

  it('sem palavra, palavra vazia ou que não é texto: não passa', () => {
    const live = typed()
    for (const word of [undefined, '', '   ', '?!', 42, { w: 'x' }]) {
      expect(pass(live, live.arrivedAt + 2000, live.arrivedAt + 2000, { word })).toBe(live)
    }
  })

  it('palavra repetida na rodada (sem ligar para acento, maiúscula ou plural) não passa', () => {
    let s = typed(3)
    s = pass(s, s.arrivedAt + 2000, s.arrivedAt + 2000, { word: 'Maçã' })
    for (const word of ['maca', 'MAÇÃS', ' maçã ']) {
      expect(pass(s, s.arrivedAt + 2000, s.arrivedAt + 2000, { word })).toBe(s)
    }
    expect(pass(s, s.arrivedAt + 2000, s.arrivedAt + 2000, { word: 'Banana' }).words).toHaveLength(2)
  })

  it('texto gigante vira uma palavra de até 32 letras', () => {
    const live = typed()
    const next = pass(live, live.arrivedAt + 2000, live.arrivedAt + 2000, { word: 'abracadabra '.repeat(500) })
    expect(next.words[0].word.length).toBeLessThanOrEqual(MAX_WORD_LENGTH)
    expect(next.words[0].word.startsWith('abracadabra')).toBe(true)
  })

  it('no modo falar a palavra não importa', () => {
    const { state } = start(3)
    const live = play(state)
    const next = pass(live, live.arrivedAt + 2000, live.arrivedAt + 2000, { word: '' })
    expect(next.passes).toBe(1)
    expect(next.words).toEqual([])
  })

  it('ferramentas de palavra', () => {
    expect(cleanWord('  Pé   de moleque ')).toBe('Pé de moleque')
    expect(cleanWord(null)).toBe('')
    expect(wordKey('Pé-de-Moleque')).toBe(wordKey('pe de moleque'))
    expect(wordKey('Morcegos')).toBe(wordKey('morcego'))
    expect(wordUsed([{ by: 1, word: 'Vampiro' }], 'VAMPIROS')).toBe(true)
    expect(wordUsed([{ by: 1, word: 'Vampiro' }], 'vampira')).toBe(false)
  })
})

describe('fim', () => {
  it('sobrou um vivo: o BUM decide e a partida acaba no fim do placar', () => {
    const { state } = start(2, { lives: 1 })
    const boom = explodeOn({ ...state, holder: 1 }, 1)
    expect(gameDecided(boom)).toBe(true)
    const final = engine.step(boom, ctxAt(boom, boom.deadline!))
    expect(final.phase).toBe('final')
    expect(final.over).toBe(true)
    expect(final.deadline).toBeNull()
    expect(winners(final)).toEqual([2])
    expect(engine.step(final, ctxAt(final, NOW * 3))).toBe(final)
  })

  it('12 rodadas: acaba mesmo com vários vivos, e vence quem tem mais vidas', () => {
    const { state } = start(3, { lives: 3 })
    // O 3 explode nas rodadas 1 e 2, o 1 na 5; nas outras o host apaga o pavio.
    const schedule: Record<number, number> = { 1: 3, 2: 3, 5: 1 }
    let s = state
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      expect(s.phase).toBe('theme')
      expect(s.round).toBe(round)
      const victim = schedule[round]
      if (victim) {
        s = explodeOn(s, victim)
      } else {
        const live = play(s)
        s = engine.step(live, ctxAt(live, live.arrivedAt + 2000, {}, { command: { id: round, type: 'skip' } }))
      }
      expect(s.phase).toBe('boom')
      s = engine.step(s, ctxAt(s, s.deadline!))
    }
    expect(s.over).toBe(true)
    expect(s.phase).toBe('final')
    expect(s.round).toBe(MAX_ROUNDS)
    expect(aliveIds(s)).toEqual([1, 2, 3])
    expect(standings(s).map((row) => [row.id, row.lives, row.booms, row.place])).toEqual([
      [2, 3, 0, 1],
      [1, 2, 1, 2],
      [3, 1, 2, 3],
    ])
    expect(winners(s)).toEqual([2])
    expect(mostBooms(s)).toEqual({ ids: [3], count: 2 })
  })

  it('empate em vidas e pavio poupado divide a posição', () => {
    const { state } = start(4)
    const tied: AbbState = {
      ...state,
      lives: { 1: 1, 2: 2, 3: 2, 4: 0 },
      saved: { 1: 50_000, 2: 30_000, 3: 30_000, 4: 90_000 },
    }
    expect(standings(tied).map((row) => [row.id, row.place])).toEqual([
      [2, 1],
      [3, 1],
      [1, 3],
      [4, 4],
    ])
    expect(winners(tied)).toEqual([2, 3])
    // Empate em vidas, desempate pelo pavio poupado.
    expect(winners({ ...tied, saved: { ...tied.saved, 3: 30_001 } })).toEqual([3])
  })

  it('sem ninguém explodir, "explodiu mais" fica vazio', () => {
    const { state } = start(3)
    expect(mostBooms(state)).toEqual({ ids: [], count: 0 })
  })
})

describe('bot', () => {
  it('só quem segura a abóbora passa, com o horário do toque', () => {
    const { state, ctx } = start(4)
    const live = play(state)
    const replies = Array.from({ length: 40 }, () => engine.bot(live, live.holder!, { ...ctx, now: 5 }))
    expect(replies.some((reply) => reply === null)).toBe(true)
    expect(replies.filter(Boolean).every((reply) => reply?.at === 5)).toBe(true)
    const other = live.roster.find((id) => id !== live.holder)!
    expect(engine.bot(live, other, ctx)).toBeNull()
    expect(engine.bot(state, state.holder!, ctx)).toBeNull()
  })

  it('no modo digitar manda uma palavra que vale', () => {
    const { state, ctx } = start(3, { mode: 'digitar' })
    const live = play(state)
    let reply = null
    for (let i = 0; i < 40 && !reply; i += 1) reply = engine.bot(live, live.holder!, ctx)
    expect(typeof reply?.word).toBe('string')
    expect(pass(live, live.arrivedAt + 1500, live.arrivedAt + 1500, { word: reply?.word }).words).toHaveLength(1)
  })
})

describe('simulações', () => {
  function check(result: { state: AbbState }) {
    const s = result.state
    expect(s.over).toBe(true)
    expect(s.round).toBeLessThanOrEqual(MAX_ROUNDS)
    expect(s.history).toHaveLength(s.round)
    // Cada BUM tirou exatamente uma vida de alguém.
    const booms = s.history.filter((entry) => entry.victim !== null).length
    const lost = s.roster.reduce((sum, id) => sum + (s.maxLives - (s.lives[String(id)] ?? 0)), 0)
    expect(lost).toBe(booms)
    expect(gameDecided(s)).toBe(true)
  }

  for (const players of [2, 3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        check(runSimulation(engine, { players, seed, options: optionDefaults(meta.options) }))
      })
    }
  }

  it('modo digitar, 1 vida e pavio de 10 s', () => {
    check(runSimulation(engine, { players: 6, seed: 9, options: { mode: 'digitar', lives: 1, fuse: 10 } }))
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    check(result)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando para passar', () => {
    check(runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5 }))
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.4, seed: 8 })
    check(result)
    expect(result.state.round).toBe(MAX_ROUNDS)
  })

  it('ninguém nunca passa: explode na mão de quem começa, e acaba', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, seed: 2 })
    check(result)
    expect(result.state.history.every((entry) => entry.passes === 0 && entry.victim !== null)).toBe(true)
  })

  it('quem sai da festa no meio não trava: o pavio dele queima, BUM, e a roda segue', () => {
    const { state } = start(4)
    const live = play({ ...state, holder: 2 })
    // O 2 some com a abóbora na mão: o pavio dele queima e o prazo traz o BUM.
    const gone: HPlayer[] = makePlayers(4, { offline: [2] })
    expect(engine.step(live, ctxAt(live, live.deadline! - 1, {}, { players: gone }))).toBe(live)
    const boom = engine.step(live, ctxAt(live, live.deadline!, {}, { players: gone }))
    expect(boom.boom?.victim).toBe(2)
    // A rodada nova não começa com quem sumiu...
    const round2 = engine.step(boom, ctxAt(boom, boom.deadline!, {}, { players: gone }))
    expect(round2.holder).toBe(3)
    // ...mas a abóbora chega nele de novo na volta da mesa, até virar fantasma.
    let s = play(round2, round2.deadline!, { players: gone })
    s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200, {}, { players: gone })
    s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200, {}, { players: gone })
    expect(s.holder).toBe(1)
    s = pass(s, s.arrivedAt + 1200, s.arrivedAt + 1200, {}, { players: gone })
    expect(s.holder).toBe(2)
    const second = engine.step(s, ctxAt(s, s.deadline!, {}, { players: gone }))
    expect(second.boom).toMatchObject({ victim: 2, eliminated: true })
  })

  it('quem some com o celular logo no começo não ganha a partida (vira fantasma)', () => {
    // Mesa grande: as 12 rodadas acabam com muita gente viva, e vence quem
    // tem mais vidas. O 8 bloqueou o celular e sumiu; os outros passam 2 s
    // depois de receber. Pulado para sempre, ele terminaria com todas as
    // vidas e todo o pavio poupado — campeão sem ter jogado.
    const { state } = start(8, { lives: 3 })
    const players = makePlayers(8, { offline: [8] })
    let s = state
    let now = NOW
    for (let i = 0; i < 40_000 && !s.over; i += 1) {
      const inputs: Record<number, HInput> = {}
      const holder = s.holder
      if (s.phase === 'play' && holder !== null && holder !== 8 && now >= s.arrivedAt + 2000) {
        inputs[holder] = { k: s.inputKey, at: s.arrivedAt + 2000 }
      }
      s = engine.step(s, makeCtx({ players, now, inputs }))
      now += 500
    }
    expect(s.over).toBe(true)
    expect(isAlive(s, 8)).toBe(false)
    expect(winners(s)).not.toContain(8)
    expect(standings(s)[0].id).not.toBe(8)
  })

  it('sala vazia (ninguém online no começo) termina sozinha', () => {
    const ctx = makeCtx({ players: makePlayers(3, { offline: [1, 2, 3] }), now: NOW })
    let s = engine.init(ctx)
    expect(s.roster).toEqual([])
    for (let i = 0; i < 5 && !s.over; i += 1) s = engine.step(s, { ...ctx, now: (s.deadline ?? NOW) + 1 })
    expect(s.over).toBe(true)
  })
})

describe('conteúdo', () => {
  it('40+ temas, metade de Halloween e metade do dia a dia, curtos e sem repetir', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(40)
    expect(new Set(THEMES.map((theme) => theme.text)).size).toBe(THEMES.length)
    const spooky = THEMES.filter((theme) => theme.spooky).length
    expect(spooky).toBeGreaterThanOrEqual(20)
    expect(THEMES.length - spooky).toBeGreaterThanOrEqual(20)
    for (const theme of THEMES) {
      expect(theme.text.length).toBeGreaterThan(3)
      expect(theme.text.length).toBeLessThanOrEqual(40)
      expect(theme.icon.length).toBeGreaterThan(0)
    }
  })

  it('nenhum tema convida piada com a cor de alguém da mesa', () => {
    // "Coisas pretas" numa festa de 15 vira piada com gente — melhor nem abrir a porta.
    expect(THEMES.filter((theme) => /\bpret[oa]s?\b/i.test(theme.text))).toEqual([])
  })

  it('o meta mantém slug, limites e chaves das opções', () => {
    expect(meta.slug).toBe('abobora-bomba')
    expect([meta.minPlayers, meta.maxPlayers]).toEqual([2, 15])
    expect(meta.options.map((option) => option.key)).toEqual(['fuse', 'lives', 'mode'])
    expect(meta.phonePollMs).toBeLessThanOrEqual(800)
    expect(meta.music).toBe('chase')
  })
})
