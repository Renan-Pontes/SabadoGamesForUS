/**
 * Conteúdo da Fábrica de Presentes: as peças da esteira, quem pediu presente
 * e os imprevistos entre as rodadas. Tudo original, em pt-BR.
 *
 * Um presente se monta nesta ordem: CAIXA → PAPEL → LAÇO → ETIQUETA. Caixa e
 * papel sempre; laço e etiqueta dependem do pedido.
 */

export type Category = 'caixa' | 'papel' | 'laco' | 'etiqueta'

export const CATEGORIES: readonly Category[] = ['caixa', 'papel', 'laco', 'etiqueta']

export const CATEGORY_LABEL: Record<Category, string> = {
  caixa: 'Caixa',
  papel: 'Papel',
  laco: 'Laço',
  etiqueta: 'Etiqueta',
}

export type BoxShape = 'quadrada' | 'redonda' | 'gigante' | 'comprida'
export type PaperPattern = 'xadrez' | 'listrado' | 'bolinhas' | 'estrelas' | 'jornal'

export type PartDef = {
  id: string
  cat: Category
  /** Nome no botão e na TV ("Laço dourado"). */
  name: string
  /** Cor principal (papel, laço, etiqueta). */
  color: string
  /** Segunda cor do papel (listra, bolinha, estrela). */
  color2?: string
  shape?: BoxShape
  pattern?: PaperPattern
  /** Texto escrito na etiqueta. */
  text?: string
}

export const PARTS: readonly PartDef[] = [
  { id: 'cx-quadrada', cat: 'caixa', name: 'Caixa quadrada', color: '#c98b4f', shape: 'quadrada' },
  { id: 'cx-redonda', cat: 'caixa', name: 'Caixa redonda', color: '#c98b4f', shape: 'redonda' },
  { id: 'cx-gigante', cat: 'caixa', name: 'Caixa gigante', color: '#c98b4f', shape: 'gigante' },
  { id: 'cx-comprida', cat: 'caixa', name: 'Caixa comprida', color: '#c98b4f', shape: 'comprida' },

  { id: 'pp-xadrez', cat: 'papel', name: 'Papel xadrez', color: '#d42a3c', color2: '#1f7a45', pattern: 'xadrez' },
  { id: 'pp-listrado', cat: 'papel', name: 'Papel listrado', color: '#fff4f4', color2: '#e8394a', pattern: 'listrado' },
  { id: 'pp-bolinhas', cat: 'papel', name: 'Papel de bolinhas', color: '#1f9d55', color2: '#fff6dc', pattern: 'bolinhas' },
  { id: 'pp-estrelas', cat: 'papel', name: 'Papel de estrelas', color: '#1d3b8a', color2: '#f5c242', pattern: 'estrelas' },
  { id: 'pp-jornal', cat: 'papel', name: 'Papel de jornal', color: '#e6e1d3', color2: '#6b6b6b', pattern: 'jornal' },

  { id: 'lc-vermelho', cat: 'laco', name: 'Laço vermelho', color: '#e8394a' },
  { id: 'lc-dourado', cat: 'laco', name: 'Laço dourado', color: '#f5c242' },
  { id: 'lc-verde', cat: 'laco', name: 'Laço verde', color: '#2fbf6a' },
  { id: 'lc-azul', cat: 'laco', name: 'Laço azul', color: '#4aa8ff' },

  { id: 'et-te-amo', cat: 'etiqueta', name: 'Etiqueta "Te amo"', color: '#ffe3ea', text: 'Te amo ❤️' },
  { id: 'et-nao-abra', cat: 'etiqueta', name: 'Etiqueta "Não abra!"', color: '#fff6dc', text: 'Não abra antes do Natal!' },
  { id: 'et-fragil', cat: 'etiqueta', name: 'Etiqueta "Frágil"', color: '#fff1c9', text: 'Frágil (eu acho)' },
  { id: 'et-secreto', cat: 'etiqueta', name: 'Etiqueta "Amigo secreto"', color: '#e6f4ff', text: 'Amigo secreto 🤫' },
]

export const PART_BY_ID: Readonly<Record<string, PartDef>> = Object.fromEntries(PARTS.map((part) => [part.id, part]))

export const PART_IDS: readonly string[] = PARTS.map((part) => part.id)

/** Quem pediu presente. `likes` puxa as peças preferidas; `skip` tira laço/etiqueta. */
export type Recipient = {
  to: string
  emoji: string
  likes: readonly string[]
  skip?: readonly ('laco' | 'etiqueta')[]
}

export const RECIPIENTS: readonly Recipient[] = [
  { to: 'Pra vó Zuleide', emoji: '👵', likes: ['cx-redonda', 'pp-xadrez', 'lc-dourado', 'et-te-amo'] },
  { to: 'Pro tio do pavê', emoji: '🧔', likes: ['cx-gigante', 'pp-jornal'], skip: ['laco'] },
  { to: 'Pro chefe ranzinza', emoji: '👔', likes: ['cx-quadrada', 'pp-listrado', 'et-fragil'] },
  { to: 'Pro amigo secreto do escritório', emoji: '🤫', likes: ['et-secreto'] },
  { to: 'Pra prima blogueira', emoji: '🤳', likes: ['pp-estrelas', 'lc-dourado'] },
  { to: 'Pro cachorro Biscoito', emoji: '🐶', likes: ['cx-comprida', 'pp-bolinhas'], skip: ['etiqueta'] },
  { to: 'Pro vizinho do pagode', emoji: '🥁', likes: ['cx-gigante', 'et-nao-abra'] },
  { to: 'Pra tia dos "e os namoradinhos?"', emoji: '💅', likes: ['pp-listrado', 'lc-vermelho', 'et-te-amo'] },
  { to: 'Pro sogro do churrasco', emoji: '🍖', likes: ['cx-comprida', 'pp-jornal', 'lc-verde'] },
  { to: 'Pro bebê da família', emoji: '👶', likes: ['cx-redonda', 'pp-bolinhas', 'lc-azul', 'et-fragil'] },
  { to: 'Pra Mamãe Noel', emoji: '🤶', likes: ['pp-xadrez', 'lc-vermelho', 'et-te-amo'] },
  { to: 'Pra rena Pipoca', emoji: '🦌', likes: ['cx-comprida', 'lc-verde'], skip: ['etiqueta'] },
  { to: 'Pro carteiro', emoji: '📮', likes: ['cx-quadrada', 'pp-jornal', 'et-fragil'] },
  { to: 'Pro irmão que some o ano todo', emoji: '🙄', likes: ['et-nao-abra'] },
  { to: 'Pro gato que derruba a árvore', emoji: '🐱', likes: ['cx-gigante'], skip: ['laco'] },
  { to: 'Pra professora de matemática', emoji: '📐', likes: ['cx-quadrada', 'pp-xadrez'] },
  { to: 'Pro primo gamer', emoji: '🎮', likes: ['cx-comprida', 'pp-estrelas', 'lc-azul'] },
  { to: 'Pro Papai Noel (ele também ganha!)', emoji: '🎅', likes: ['cx-gigante', 'pp-listrado', 'lc-dourado'] },
  { to: 'Pra vizinha fofoqueira', emoji: '👀', likes: ['pp-bolinhas', 'et-secreto'] },
  { to: 'Pro tio que dorme no sofá', emoji: '😴', likes: ['cx-comprida', 'et-nao-abra'] },
  { to: 'Pro boneco de neve do quintal', emoji: '⛄', likes: ['pp-estrelas', 'lc-azul'], skip: ['etiqueta'] },
  { to: 'Pra madrinha chique', emoji: '💎', likes: ['cx-redonda', 'pp-estrelas', 'lc-dourado', 'et-te-amo'] },
  { to: 'Pro vô das piadas', emoji: '👴', likes: ['pp-jornal', 'lc-vermelho', 'et-te-amo'] },
  { to: 'Pro elfo estagiário', emoji: '🧝', likes: ['cx-quadrada', 'lc-verde', 'et-fragil'] },
  { to: 'Pro síndico do prédio', emoji: '🏢', likes: ['cx-quadrada', 'pp-listrado', 'et-nao-abra'] },
  { to: 'Pra melhor amiga', emoji: '💖', likes: ['pp-bolinhas', 'lc-vermelho', 'et-te-amo'] },
  { to: 'Pro cunhado que sabe tudo', emoji: '🤓', likes: ['cx-comprida', 'et-secreto'] },
  { to: 'Pro peixinho Dourado', emoji: '🐟', likes: ['cx-redonda', 'lc-dourado'], skip: ['etiqueta'] },
]

export type ChaosId = 'invertida' | 'vip' | 'sem-laco' | 'pressa' | 'troca'

export type ChaosDef = { id: ChaosId; icon: string; title: string; text: string; /** Frase curta da narração. */ say: string }

export const CHAOS: readonly ChaosDef[] = [
  {
    id: 'invertida',
    icon: '🔄',
    title: 'Esteira ao contrário!',
    text: 'Monte de trás pra frente: ETIQUETA primeiro, CAIXA por último.',
    say: 'Esteira ao contrário!',
  },
  {
    id: 'vip',
    icon: '⭐',
    title: 'Pedidos VIP do Papai Noel',
    text: 'Pedido com estrela vale o DOBRO de pontos.',
    say: 'Pedidos VIP valem o dobro!',
  },
  {
    id: 'sem-laco',
    icon: '✂️',
    title: 'Acabou a fita!',
    text: 'Nenhum pedido leva laço. Apertou laço? BAGUNÇA!',
    say: 'Acabou a fita! Nada de laço.',
  },
  {
    id: 'pressa',
    icon: '🛷',
    title: 'Trenó com pressa',
    text: 'Pedidos com menos tempo, mas valendo +50%.',
    say: 'O trenó está com pressa!',
  },
  {
    id: 'troca',
    icon: '🔀',
    title: 'Troca de turno',
    text: 'No meio da rodada as peças trocam de mão. Fiquem de olho!',
    say: 'Troca de turno no meio da rodada!',
  },
]

export const CHAOS_BY_ID: Readonly<Record<ChaosId, ChaosDef>> = Object.fromEntries(
  CHAOS.map((chaos) => [chaos.id, chaos]),
) as Record<ChaosId, ChaosDef>

export type TeamId = 'r' | 'g'

export type TeamLook = {
  id: TeamId
  name: string
  /** "dos Gorros", "das Meias" (para a narração). */
  of: string
  short: string
  icon: string
  color: string
  light: string
  dark: string
}

export const TEAM_LOOK: Record<TeamId, TeamLook> = {
  r: { id: 'r', name: 'Gorros Vermelhos', of: 'dos', short: 'Vermelho', icon: '🔴', color: '#e8394a', light: '#ff8c95', dark: '#7d0f1c' },
  g: { id: 'g', name: 'Meias Verdes', of: 'das', short: 'Verde', icon: '🟢', color: '#2fbf6a', light: '#8ef0ae', dark: '#0e5a30' },
}

/** O nome do time único quando a turma é pequena (2–3 pessoas, todos contra o relógio). */
export const COOP_NAME = 'Turma da Fábrica'
