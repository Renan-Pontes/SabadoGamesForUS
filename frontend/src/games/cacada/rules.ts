import type { CacadaMap, Clue } from './types'

/**
 * Geometria e avaliação de pistas no cliente.
 *
 * O servidor continua sendo a autoridade — toda jogada é revalidada lá. Esta
 * cópia existe só para a interface poder desabilitar um botão inválido e
 * destacar os hexágonos que a SUA pista permite, em vez de mandar a jogada e
 * receber um erro.
 */

// Offset "odd-r": linhas ímpares deslocadas meia célula para a direita.
const CUBE_DIRECTIONS: [number, number, number][] = [
  [1, -1, 0],
  [1, 0, -1],
  [0, 1, -1],
  [-1, 1, 0],
  [-1, 0, 1],
  [0, -1, 1],
]

export function hexKey(col: number, row: number) {
  return `${col},${row}`
}

export function parseKey(key: string): [number, number] {
  const [col, row] = key.split(',')
  return [Number(col), Number(row)]
}

function offsetToCube(col: number, row: number): [number, number, number] {
  const x = col - (row - (row & 1)) / 2
  const z = row
  return [x, -x - z, z]
}

function cubeToOffset(x: number, _y: number, z: number): [number, number] {
  return [x + (z - (z & 1)) / 2, z]
}

export function hexDistance(a: string, b: string) {
  const [ax, ay, az] = offsetToCube(...parseKey(a))
  const [bx, by, bz] = offsetToCube(...parseKey(b))
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz))
}

export function hexNeighbors(key: string, cols: number, rows: number) {
  const [x, y, z] = offsetToCube(...parseKey(key))
  const result: string[] = []
  for (const [dx, dy, dz] of CUBE_DIRECTIONS) {
    const [col, row] = cubeToOffset(x + dx, y + dy, z + dz)
    if (col >= 0 && col < cols && row >= 0 && row < rows) result.push(hexKey(col, row))
  }
  return result
}

/** Mesma conta do servidor: a pista permite este hexágono? */
export function clueAllows(map: CacadaMap, clue: Clue, key: string): boolean {
  const cell = map.hexes[key]
  if (!cell) return false

  const range = clue.range ?? 1
  const near = (matches: (candidate: string) => boolean) =>
    Object.keys(map.hexes).some(
      (other) => matches(other) && hexDistance(key, other) <= range,
    )

  let result: boolean
  switch (clue.kind) {
    case 'terrain_pair':
      result = cell.terrain === clue.a || cell.terrain === clue.b
      break
    case 'within_terrain':
      result = near((other) => map.hexes[other].terrain === clue.terrain)
      break
    case 'within_any_animal':
      result = near((other) => map.hexes[other].animal !== null)
      break
    case 'within_animal':
      result = near((other) => map.hexes[other].animal === clue.animal)
      break
    case 'within_structure_kind':
      result = near((other) => map.hexes[other].structure?.kind === clue.structure_kind)
      break
    case 'within_structure_color':
      result = near((other) => map.hexes[other].structure?.color === clue.color)
      break
    default:
      result = true
  }

  return clue.negated ? !result : result
}

/** Conjunto dos hexágonos que a pista permite — usado para destacar no mapa. */
export function allowedHexes(map: CacadaMap, clue: Clue | null | undefined): Set<string> {
  if (!clue) return new Set()
  return new Set(Object.keys(map.hexes).filter((key) => clueAllows(map, clue, key)))
}

/**
 * Largura mínima do mapa em px, para o hexágono continuar do tamanho de um
 * dedo mesmo num celular estreito. Abaixo disso o container rola na horizontal.
 */
export function mapMinWidth(cols: number) {
  return Math.round(cols * 52)
}
