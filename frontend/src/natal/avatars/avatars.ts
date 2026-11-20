/**
 * Avatares de Natal: cada pessoa da mesa vira um bichinho/enfeite com uma
 * cor própria, e é o MESMO na TV e no celular. Nada fica guardado no
 * backend: tudo sai do id do jogador (e da mesa, para não repetir).
 *
 *   const avatars = assignAvatars(room.players)   // Map id → avatar
 *   avatarFor(player, room.players)               // um só
 *
 * Funções puras (sem React) — os desenhos ficam em ChristmasAvatar.tsx.
 */

export type AvatarId =
  | 'noel'
  | 'mamae-noel'
  | 'rena'
  | 'duende'
  | 'boneco'
  | 'pinguim'
  | 'urso'
  | 'biscoito'
  | 'anjo'
  | 'estrela'
  | 'presente'
  | 'panetone'
  | 'sino'
  | 'pisca'
  | 'arvore'

export type AvatarInfo = {
  id: AvatarId
  /** Nome em português, para leitores de tela e legendas. */
  label: string
  /** Artigo do nome ("Você é a Rena", "Você é o Sino"). */
  article: 'o' | 'a'
  /** Cor da pessoa (fundo do avatar, bordas, brilho). */
  color: string
  /** Posição em AVATARS. */
  index: number
}

/**
 * 15 avatares (a mesa vai até 15), cada um com uma cor bem diferente das
 * outras. A cor anda junto com o personagem: "a rena laranja" é fácil de
 * achar na TV.
 */
export const AVATARS: readonly AvatarInfo[] = (
  [
    ['noel', 'Papai Noel', '#ff5a66', 'o'],
    ['mamae-noel', 'Mamãe Noel', '#e879f9', 'a'],
    ['rena', 'Rena', '#ff9f43', 'a'],
    ['duende', 'Duende', '#4fd67e', 'o'],
    ['boneco', 'Boneco de neve', '#7fd8ff', 'o'],
    ['pinguim', 'Pinguim', '#5aa9ff', 'o'],
    ['urso', 'Urso polar', '#9ff0d0', 'o'],
    ['biscoito', 'Biscoito de gengibre', '#ffb38a', 'o'],
    ['anjo', 'Anjo', '#b49cff', 'o'],
    ['estrela', 'Estrela', '#8b8cff', 'a'],
    ['presente', 'Presente', '#b5e35a', 'o'],
    ['panetone', 'Panetone', '#f5c242', 'o'],
    ['sino', 'Sino', '#2ec4b6', 'o'],
    ['pisca', 'Pisca-pisca', '#d6e2f0', 'o'],
    ['arvore', 'Árvore', '#ff8fd0', 'a'],
  ] as const
).map(([id, label, color, article], index) => ({ id, label, color, article, index }))

const COUNT = AVATARS.length

function mod(value: number, base: number) {
  return ((value % base) + base) % base
}

/** Avatar "preferido" do jogador, só pelo id (antes de olhar a mesa). */
export function preferredAvatarIndex(playerId: number): number {
  return mod(Math.trunc(playerId), COUNT)
}

/**
 * Distribui os avatares da mesa sem repetir (até 15 pessoas).
 *
 * Determinístico e independente da ordem da lista: os jogadores são
 * atendidos por id crescente, cada um pega o seu preferido e, se já foi,
 * o próximo livre. Como o id só cresce, quem chega depois nunca muda o
 * avatar de quem já estava sentado. Com mais de 15, volta a repetir,
 * sempre pelo menos usado.
 */
export function assignAvatars(players: ReadonlyArray<{ id: number }>): Map<number, AvatarInfo> {
  const ids = [...new Set(players.map((player) => player.id))].sort((a, b) => a - b)
  const uses = new Array<number>(COUNT).fill(0)
  const result = new Map<number, AvatarInfo>()

  for (const id of ids) {
    const start = preferredAvatarIndex(id)
    const least = Math.min(...uses)
    let slot = start
    for (let step = 0; step < COUNT; step += 1) {
      const candidate = (start + step) % COUNT
      if (uses[candidate] === least) {
        slot = candidate
        break
      }
    }
    uses[slot] += 1
    result.set(id, AVATARS[slot])
  }
  return result
}

/**
 * O avatar de uma pessoa. Com a mesa (`roster`), evita repetir; sem ela,
 * fica no preferido pelo id — ainda o mesmo em todas as telas.
 */
export function avatarFor(player: { id: number }, roster?: ReadonlyArray<{ id: number }>): AvatarInfo {
  if (roster && roster.some((item) => item.id === player.id)) {
    const assigned = assignAvatars(roster).get(player.id)
    if (assigned) return assigned
  }
  return AVATARS[preferredAvatarIndex(player.id)]
}

/** Chave de nome para casar o mesmo jogador entre telas ("  Ana " = "ana"). */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR')
}

/**
 * Avatar só pelo nome — quando a tela não sabe o id (ex.: um crachá fora
 * da sala). Sempre o mesmo para o mesmo nome.
 */
export function avatarForName(name: string): AvatarInfo {
  const key = nameKey(name)
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 9973
  return AVATARS[hash % COUNT]
}

export function getAvatar(id: AvatarId): AvatarInfo {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]
}
