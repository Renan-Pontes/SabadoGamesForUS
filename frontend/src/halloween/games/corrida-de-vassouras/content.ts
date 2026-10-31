/**
 * O conteúdo da "Corrida de Vassouras": as cinco bruxas da pista e as falas
 * do narrador. Tudo original, em pt-BR.
 *
 * As bruxas misturam folclore (Cuca, Matinta Pereira, Baba Yaga, Morgana) e
 * uma inventada (Zuleica). O id é a posição na lista — é ele que viaja no
 * estado e nas apostas, então não reordene no meio da festa. Cores bem
 * diferentes entre si e um bicho por bruxa: dá para reconhecer a 3 metros
 * mesmo sem ler o nome.
 */

export type Witch = {
  id: number
  name: string
  /** O bicho/amuleto da bruxa — vai no token da pista e nos botões. */
  emoji: string
  /** Cor da raia, do token e do dado. */
  color: string
  /** Versão clara da cor, para texto sobre fundo escuro. */
  light: string
  /** Apelido curtinho (TV e celular). */
  title: string
}

export const WITCHES: readonly Witch[] = [
  { id: 0, name: 'Cuca', emoji: '🐊', color: '#4ade80', light: '#bbf7d0', title: 'cara de jacaré' },
  { id: 1, name: 'Matinta', emoji: '🦉', color: '#60a5fa', light: '#dbeafe', title: 'assobia na janela' },
  { id: 2, name: 'Baba Yaga', emoji: '🦴', color: '#fb923c', light: '#ffedd5', title: 'trocou o pilão pela vassoura' },
  { id: 3, name: 'Morgana', emoji: '🔮', color: '#c084fc', light: '#f3e8ff', title: 'feiticeira das brumas' },
  { id: 4, name: 'Zuleica', emoji: '🐸', color: '#facc15', light: '#fef9c3', title: 'síndica do cemitério' },
]

/** Bruxa pelo id (id inválido cai na primeira — a tela nunca quebra por isso). */
export function witchOf(id: number | null | undefined): Witch {
  return WITCHES[typeof id === 'number' ? id : 0] ?? WITCHES[0]
}

// ---------------------------------------------------------------------------
// Falas do narrador. `{b}` é o nome da bruxa; `{n}`, um número.
// A tela escolhe a fala pela etapa (sempre a mesma no mesmo momento).
// ---------------------------------------------------------------------------

export const ROLL_LINES: Readonly<Record<1 | 2 | 3, readonly string[]>> = {
  1: [
    '{b} engasgou na vassoura: só 1 casa.',
    '{b} parou para pedir doce: 1 casa.',
    '{b} achou um atalho… que não era: 1 casa.',
    '{b} esqueceu a vassoura no freio de mão: 1 casa.',
    '{b} ficou fofocando com um morcego: 1 casa.',
  ],
  2: [
    '{b} vai no embalo: 2 casas.',
    '{b} pegou carona num morcego: 2 casas.',
    '{b} deu uma gargalhada e voou 2 casas.',
    '{b} desviou de uma abóbora: 2 casas.',
    '{b} mexeu o caldeirão e seguiu: 2 casas.',
  ],
  3: [
    '{b} TURBINOU a vassoura: 3 casas!',
    '{b} pegou o vento da lua cheia: 3 casas!',
    '{b} tomou poção de foguete: 3 casas!',
    '{b} saiu cortando a neblina: 3 casas!',
    '{b} voou como quem fugiu da missa: 3 casas!',
  ],
}

export const FALL_LINES: readonly string[] = [
  '{b} levou {n} maldições e CAIU DA VASSOURA!',
  'A praga pegou! {b} despencou ({n} maldições)!',
  '{n} maldições na conta: {b} beijou o chão!',
  'Vassoura quebrada! {b} caiu com {n} maldições!',
]

/** Teve 2+ maldições, mas empatadas no topo: ninguém cai. */
export const WEAK_CURSE_LINES: readonly string[] = [
  'As maldições se embolaram: ninguém caiu.',
  'Empate nas maldições: a vassoura aguentou.',
  'Empate de pragas: todo mundo segue voando.',
  'As pragas se anularam no ar. Que sorte!',
]

/** Nenhuma bruxa levou 2 maldições: a fala ensina a regra. */
export const FEW_CURSE_LINES: readonly string[] = [
  'Só 1 maldição não derruba: precisa de 2!',
  'Maldição fraca… precisa de 2 na mesma bruxa.',
  'A praga não pegou: faltou a 2ª maldição.',
  'Uma maldição só faz cócegas. Precisa de 2!',
]

export const LEAD_LINES: readonly string[] = [
  '{b} lidera a etapa!',
  'Na frente agora: {b}!',
  '{b} está voando baixo — e na frente!',
  'Quem manda na pista: {b}!',
]

export const START_SPEECH = 'Cinco bruxas na largada. Façam suas apostas!'
export const FINISH_LINE = '{b} CRUZOU A CHEGADA!'
export const MIDNIGHT_LINE = 'Meia-noite! Vence quem está na frente: {b}!'

/** Dicas que giram na TV durante as apostas. */
export const BET_TIPS: readonly string[] = [
  '🕯️ A mais amaldiçoada (2+ maldições, sem empate) cai e volta 2 casas no fim da etapa.',
  '🥇 Líder da etapa paga 3 🍬 · 🥈 a segunda paga 1 🍬.',
  '🧹 Mesma casa? Quem chegou por último fica na frente — quem cai vai pra trás.',
  '🎲 Cada bruxa anda 1, 2 ou 3 casas por etapa, numa ordem sorteada.',
  '🏁 A primeira a cruzar a casa 16 vence. Apostou nela na 1ª etapa? +5 🍬.',
]

/** Troca `{b}` e `{n}` na fala. */
export function fillLine(line: string, witch: string, n = 0): string {
  return line.replace(/\{b\}/g, witch).replace(/\{n\}/g, String(n))
}
