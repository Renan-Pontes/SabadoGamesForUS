/**
 * Conteúdo da Cozinha da Ceia: as estações, os pratos da ceia brasileira
 * (receitas curtinhas) e os imprevistos entre as rodadas. Tudo original.
 *
 * Uma receita é uma lista de componentes; cada componente é uma fila de
 * passos, cada passo numa estação. Quando todos os componentes ficam
 * prontos, o prato vai para o Balcão, onde alguém monta e entrega.
 */

export const STATIONS = ['tabua', 'tigela', 'fogao', 'forno', 'balcao'] as const
export type Station = (typeof STATIONS)[number]

/** Estações de fogo: o item fica lá cozinhando e pode QUEIMAR. */
export const HEAT_STATIONS: readonly Station[] = ['fogao', 'forno']

export type StationInfo = {
  name: string
  emoji: string
  /** O que se faz lá, para o celular e o "como funciona" da rodada. */
  hint: string
}

export const STATION_INFO: Record<Station, StationInfo> = {
  tabua: { name: 'Tábua', emoji: '🔪', hint: 'Toque rápido para cortar.' },
  tigela: { name: 'Tigela', emoji: '🥣', hint: 'Toque para temperar e misturar.' },
  fogao: { name: 'Fogão', emoji: '🍳', hint: 'Ponha no fogo e tire na hora certa!' },
  forno: { name: 'Forno', emoji: '🔥', hint: 'Ponha para assar e tire antes de queimar!' },
  balcao: { name: 'Balcão', emoji: '🎁', hint: 'Prato completo? Monte e entregue!' },
}

/**
 * Ordem de distribuição das estações: com 2 pessoas, uma fica no "frio"
 * (balcão, tábua, tigela) e a outra no "quente" (fogão, forno).
 */
export const STATION_ORDER: readonly Station[] = ['balcao', 'fogao', 'tabua', 'forno', 'tigela']
/** Com mais de 5 no time, quem sobra reforça estas (na ordem). */
export const EXTRA_ORDER: readonly Station[] = ['tabua', 'fogao', 'forno', 'tigela', 'balcao']

export type Step = {
  st: Station
  /** "Cortar", "Assar"... */
  verb: string
  /** "o pão", "a farofa"... (aparece depois do verbo) */
  what: string
}

export type Dish = {
  id: string
  name: string
  emoji: string
  /** O prêmio de quem mais fez este prato ("Realeza da Rabanada"). */
  crown: string
  /** Pontos da entrega (a gorjeta vem por cima). */
  points: number
  comps: Step[][]
}

const s = (st: Station, verb: string, what: string): Step => ({ st, verb, what })

export const DISHES: readonly Dish[] = [
  {
    id: 'peru',
    crown: 'Realeza do Peru',
    name: 'Peru assado',
    emoji: '🦃',
    points: 40,
    comps: [[s('tigela', 'Temperar', 'o peru'), s('forno', 'Assar', 'o peru')]],
  },
  {
    id: 'rabanada',
    crown: 'Realeza da Rabanada',
    name: 'Rabanada',
    emoji: '🍞',
    points: 30,
    comps: [[s('tabua', 'Cortar', 'o pão'), s('fogao', 'Fritar', 'a rabanada')]],
  },
  {
    id: 'farofa',
    crown: 'Realeza da Farofa',
    name: 'Farofa',
    emoji: '🥓',
    points: 30,
    comps: [[s('tabua', 'Picar', 'bacon e cebola'), s('fogao', 'Refogar', 'a farofa')]],
  },
  {
    id: 'salpicao',
    crown: 'Realeza do Salpicão',
    name: 'Salpicão',
    emoji: '🥗',
    points: 35,
    comps: [[s('tabua', 'Desfiar', 'o frango')], [s('tigela', 'Misturar', 'a maionese')]],
  },
  {
    id: 'arroz',
    crown: 'Realeza do Arroz com Passas',
    name: 'Arroz com passas',
    emoji: '🍚',
    points: 25,
    comps: [[s('fogao', 'Cozinhar', 'o arroz')], [s('tigela', 'Misturar', 'as passas')]],
  },
  {
    id: 'pave',
    crown: 'Realeza do Pavê',
    name: 'Pavê',
    emoji: '🍮',
    points: 30,
    comps: [[s('tigela', 'Bater', 'o creme')], [s('tabua', 'Quebrar', 'as bolachas')]],
  },
  {
    id: 'panetone',
    crown: 'Realeza do Panetone',
    name: 'Panetone recheado',
    emoji: '🎂',
    points: 35,
    comps: [[s('tabua', 'Cortar', 'o panetone')], [s('fogao', 'Derreter', 'o chocolate')]],
  },
  {
    id: 'bacalhau',
    crown: 'Realeza do Bacalhau',
    name: 'Bacalhau no forno',
    emoji: '🐟',
    points: 45,
    comps: [[s('tabua', 'Desfiar', 'o bacalhau'), s('forno', 'Gratinar', 'o bacalhau')]],
  },
  {
    id: 'chester',
    crown: 'Realeza do Chester',
    name: 'Chester',
    emoji: '🍗',
    points: 40,
    comps: [[s('tigela', 'Temperar', 'o chester'), s('forno', 'Assar', 'o chester')]],
  },
  {
    id: 'tender',
    crown: 'Realeza do Tender',
    name: 'Tender com abacaxi',
    emoji: '🍖',
    points: 45,
    comps: [[s('tabua', 'Fatiar', 'o abacaxi')], [s('tigela', 'Pincelar', 'o mel'), s('forno', 'Assar', 'o tender')]],
  },
  {
    id: 'lentilha',
    crown: 'Realeza da Lentilha',
    name: 'Lentilha da sorte',
    emoji: '🫘',
    points: 25,
    comps: [[s('fogao', 'Cozinhar', 'a lentilha')]],
  },
]

export const PAVE_INDEX = DISHES.findIndex((dish) => dish.id === 'pave')

/** Toques para terminar um passo de preparo em cada estação. */
export const PREP_TAPS: Record<Station, number> = {
  tabua: 3,
  tigela: 2,
  fogao: 0,
  forno: 0,
  balcao: 2,
}

// ---------------------------------------------------------------------------
// Imprevistos (um por rodada, da 2ª em diante)
// ---------------------------------------------------------------------------

export const EVENTS = ['gas', 'vo', 'lotada', 'turbo', 'gorjeta'] as const
export type CozinhaEvent = (typeof EVENTS)[number]

export const EVENT_INFO: Record<CozinhaEvent, { emoji: string; title: string; text: string }> = {
  gas: { emoji: '🧯', title: 'Faltou gás!', text: 'O fogão só tem uma boca nesta rodada.' },
  vo: { emoji: '👵', title: 'A vó chegou e quer pavê JÁ!', text: 'O primeiro pedido é um pavê que vale o dobro.' },
  lotada: { emoji: '🎅', title: 'Ceia lotada!', text: 'A família inteira veio: mais pedidos ao mesmo tempo.' },
  turbo: { emoji: '⚡', title: 'Forno turbinado!', text: 'Tudo cozinha mais rápido — e queima mais rápido.' },
  gorjeta: { emoji: '💰', title: 'Papai Noel com fome!', text: 'Gorjeta em dobro para quem entregar rápido.' },
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

export type TeamLook = { name: string; short: string; emoji: string; color: string; light: string }

export const TEAM_LOOKS: readonly TeamLook[] = [
  { name: 'Duendes Vermelhos', short: 'Vermelhos', emoji: '🔴', color: '#ff4d5e', light: '#ffb3ba' },
  { name: 'Duendes Verdes', short: 'Verdes', emoji: '🟢', color: '#3fd07a', light: '#b5f2cb' },
]

/** O time único (2–3 pessoas): todos juntos contra o relógio. */
export const SOLO_LOOK: TeamLook = { name: 'Brigada do Noel', short: 'Brigada', emoji: '⭐', color: '#f5c242', light: '#ffe3a1' }
