export type Terrain = 'deserto' | 'floresta' | 'pantano' | 'montanha' | 'agua'
export type Animal = 'urso' | 'puma'
export type StructureKind = 'pedra' | 'cabana'
export type StructureColor = 'verde' | 'branca' | 'azul'

export type HexCell = {
  terrain: Terrain
  animal: Animal | null
  structure: { kind: StructureKind; color: StructureColor } | null
}

export type CacadaMap = {
  cols: number
  rows: number
  hexes: Record<string, HexCell>
}

/** Pista de um jogador. `text` já vem pronto do servidor. */
export type Clue = {
  kind:
    | 'terrain_pair'
    | 'within_terrain'
    | 'within_any_animal'
    | 'within_animal'
    | 'within_structure_kind'
    | 'within_structure_color'
  text: string
  negated?: boolean
  range?: number
  a?: Terrain
  b?: Terrain
  terrain?: Terrain
  animal?: Animal
  structure_kind?: StructureKind
  color?: StructureColor
}

export type MarkerKind = 'disc' | 'cube'

/** hexágono → { id do jogador → marcador } */
export type Markers = Record<string, Record<string, MarkerKind>>

export type LogEntry =
  | { type: 'setup'; player_id: number; hex: string }
  | { type: 'penalty'; player_id: number; hex: string }
  | { type: 'ask'; asker_id: number; target_id: number; hex: string; answer: MarkerKind }
  | {
      type: 'search'
      searcher_id: number
      hex: string
      answers: { player_id: number; answer: MarkerKind }[]
      success: boolean
    }

export type CacadaState = {
  phase: 'setup' | 'playing' | 'ended'
  advanced: boolean
  map: CacadaMap
  /** Só chega ao cliente depois que a caçada termina. */
  solution?: string
  order: number[]
  turn_index: number
  markers: Markers
  pending_penalty_player_id: number | null
  winner_id: number | null
  log: LogEntry[]
  round: number
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  deserto: 'Deserto',
  floresta: 'Floresta',
  pantano: 'Pântano',
  montanha: 'Montanha',
  agua: 'Água',
}

/**
 * Paleta dos terrenos. O pântano é roxo de propósito — é o que separa ele da
 * floresta num relance, que é o que o jogo exige o tempo todo.
 */
export const TERRAIN_COLORS: Record<Terrain, string> = {
  deserto: '#c9973a',
  floresta: '#2f7d51',
  pantano: '#7048b6',
  montanha: '#78849a',
  agua: '#2470c4',
}

export const ANIMAL_LABELS: Record<Animal, string> = { urso: 'Urso', puma: 'Puma' }
export const ANIMAL_COLORS: Record<Animal, string> = { urso: '#f8fafc', puma: '#ef4444' }

export const STRUCTURE_KIND_LABELS: Record<StructureKind, string> = {
  pedra: 'Pedra erguida',
  cabana: 'Cabana abandonada',
}

export const STRUCTURE_COLORS: Record<StructureColor, string> = {
  verde: '#4ade80',
  branca: '#f1f5f9',
  azul: '#38bdf8',
}

export const STRUCTURE_COLOR_LABELS: Record<StructureColor, string> = {
  verde: 'Verde',
  branca: 'Branca',
  azul: 'Azul',
}
