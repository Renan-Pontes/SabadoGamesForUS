/**
 * Os desenhos do "Retrato Assombrado" — formato, redução de pontos e
 * leitura tolerante. Tudo puro: roda no celular, na TV e nos testes.
 *
 * Cada desenho viaja no slot 'draw' do celular (`sendSlot('draw', {...})`)
 * e vai inteiro a cada envio (no máximo um a cada SEND_GAP_MS; "Pronto" e
 * o fim da etapa, na hora), então precisa ser pequeno:
 *
 *   { s: [{ c: 2, p: [x0, y0, x1, y1, ...] }, ...], done?: true, n1?: 4 }
 *
 * - `c`: índice da cor na PALETTE; `p`: pontos achatados, de 0 a 1, com 3
 *   casas (o mesmo desenho cabe na TV e no celular);
 * - `done`: apertou "Pronto" nesta etapa;
 * - `n1`: na 2ª etapa, quantos traços vieram da 1ª (não dá para desfazê-los).
 *
 * Teto de MAX_POINTS pontos por desenho: com 15 pessoas, a TV recebe uns
 * 100 KB por sincronização no pior caso.
 */

/** Paleta do celular: tinta, sangue, abóbora, gosma, noite e poção. */
export const PALETTE = ['#1c1917', '#e0213a', '#f97316', '#16a34a', '#2563eb', '#9333ea'] as const
export const COLOR_NAMES = ['Preto', 'Vermelho', 'Laranja', 'Verde', 'Azul', 'Roxo'] as const

/** Teto de pontos por desenho (todas as etapas juntas). */
export const MAX_POINTS = 600
/** Teto de traços por desenho (rabisco infinito de pontinhos). */
export const MAX_STROKES = 150
/** Pontos mais perto que isto do anterior são descartados (fração da largura). */
export const MIN_STEP = 0.008
/** Tolerância da simplificação (Ramer–Douglas–Peucker), em fração da largura. */
export const SIMPLIFY_EPSILON = 0.002

/**
 * Intervalo mínimo entre dois envios do desenho pelo celular (ms). Cada
 * envio é um POST com o desenho inteiro e sobe a versão da sala (todo
 * mundo baixa tudo de novo): com 15 pessoas desenhando juntas e o servidor
 * de um processo só, mandar a cada traço afoga a festa. "Pronto" e o fim da
 * etapa enviam na hora.
 */
export const SEND_GAP_MS = 2000

/** Quanto esperar (ms) para o próximo envio: conta do último envio, nunca mais que um intervalo. */
export function sendDelay(lastSentAt: number, now: number, gapMs = SEND_GAP_MS): number {
  return Math.max(0, Math.min(gapMs, lastSentAt + gapMs - now))
}

/** O que vai no slot 'draw': o desenho inteiro, o "Pronto" e (só na 2ª etapa) os traços da 1ª. */
export function slotFields(strokes: readonly Stroke[], done: boolean, n1: number | null): Record<string, unknown> {
  return n1 === null ? { s: strokes, done } : { s: strokes, done, n1 }
}

/** Mesmas proporções do DrawingBoard (16:10). */
export const VIEW_W = 1000
export const VIEW_H = 625

export type Stroke = { c: number; p: number[] }

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** 0..1 com 3 casas. */
export function round3(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

/** Quantos pontos (pares x, y) há no desenho. */
export function countPoints(strokes: readonly Stroke[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.p.length / 2, 0)
}

/** Distância do ponto `p` ao segmento `a`–`b`. */
function segmentDistance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = dx * dx + dy * dy
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Ramer–Douglas–Peucker sem recursão: tira os pontos que quase não mudam o traço. */
export function simplify(points: readonly number[][], epsilon = SIMPLIFY_EPSILON): number[][] {
  if (points.length <= 2) return [...points]
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number]
    let farthest = -1
    let distance = epsilon
    for (let i = start + 1; i < end; i += 1) {
      const d = segmentDistance(points[i], points[start], points[end])
      if (d > distance) {
        distance = d
        farthest = i
      }
    }
    if (farthest > 0) {
      keep[farthest] = true
      stack.push([start, farthest], [farthest, end])
    }
  }
  return points.filter((_, index) => keep[index])
}

/**
 * Um traço do DrawingBoard (`[[x, y], ...]`) no formato do slot: descarta
 * pontos colados, simplifica, arredonda para 3 casas e achata. Toque sem
 * arrastar vira um pontinho (dois pontos iguais). Lixo → null.
 */
export function compactStroke(points: readonly number[][], color: number): Stroke | null {
  const clean = points
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [round3(point[0]), round3(point[1])])
  if (!clean.length) return null

  const spaced: number[][] = [clean[0]]
  for (let i = 1; i < clean.length; i += 1) {
    const last = spaced[spaced.length - 1]
    const isEnd = i === clean.length - 1
    const far = Math.hypot(clean[i][0] - last[0], clean[i][1] - last[1]) >= MIN_STEP
    // O último ponto fica sempre (é onde o dedo levantou), a menos que coincida.
    if (far || (isEnd && (clean[i][0] !== last[0] || clean[i][1] !== last[1]))) spaced.push(clean[i])
  }
  const reduced = spaced.length > 2 ? simplify(spaced) : spaced
  const finalPoints = reduced.length === 1 ? [reduced[0], reduced[0]] : reduced
  const c = Number.isInteger(color) && color >= 0 && color < PALETTE.length ? color : 0
  return { c, p: finalPoints.flat() }
}

/**
 * Acrescenta o traço respeitando o teto de pontos: se não cabe inteiro, vai
 * cortado; se não sobra nem um pontinho, devolve null ("desenho cheio").
 */
export function appendStroke(strokes: readonly Stroke[], stroke: Stroke | null): Stroke[] | null {
  if (!stroke || strokes.length >= MAX_STROKES) return null
  const room = MAX_POINTS - countPoints(strokes)
  if (room < 2) return null
  const p = stroke.p.length / 2 > room ? stroke.p.slice(0, room * 2) : stroke.p
  return [...strokes, { c: stroke.c, p }]
}

/** Quanto do teto já foi usado (0..1), para a barrinha de "tinta" do celular. */
export function inkUsed(strokes: readonly Stroke[]): number {
  return Math.min(1, countPoints(strokes) / MAX_POINTS)
}

/**
 * Lê um desenho vindo da rede, sem confiar em nada: lista de traços com cor
 * válida e pontos numéricos entre 0 e 1, dentro dos tetos. O que não presta
 * é descartado — nunca lança exceção.
 */
export function readDrawing(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return []
  const strokes: Stroke[] = []
  let budget = MAX_POINTS
  for (const item of raw) {
    if (strokes.length >= MAX_STROKES || budget < 1) break
    if (!item || typeof item !== 'object') continue
    const { c, p } = item as { c?: unknown; p?: unknown }
    if (!Array.isArray(p)) continue
    const numbers = p.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (numbers.length !== p.length || numbers.length < 2) continue
    const even = numbers.length % 2 === 0 ? numbers : numbers.slice(0, -1)
    let points = even.map(clamp01)
    if (points.length / 2 > budget) points = points.slice(0, budget * 2)
    if (points.length === 2) points = [...points, ...points]
    budget -= points.length / 2
    const color = typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < PALETTE.length ? c : 0
    strokes.push({ c: color, p: points })
  }
  return strokes
}

/** Atributo `points` de um <polyline> no espaço VIEW_W × VIEW_H. */
export function polylinePoints(p: readonly number[]): string {
  const parts: string[] = []
  for (let i = 0; i + 1 < p.length; i += 2) {
    parts.push(`${Math.round(p[i] * VIEW_W)},${Math.round(p[i + 1] * VIEW_H)}`)
  }
  return parts.join(' ')
}

/** Traços no formato do DrawingBoard (`points: [[x, y]]`, cor em hex). */
export function toBoardStrokes(strokes: readonly Stroke[], width: number) {
  return strokes.map((stroke) => {
    const points: number[][] = []
    for (let i = 0; i + 1 < stroke.p.length; i += 2) points.push([stroke.p[i], stroke.p[i + 1]])
    return { points, color: PALETTE[stroke.c] ?? PALETTE[0], width }
  })
}

/**
 * Rabisco de mentira para os bots da simulação: alguns traços curtos e
 * tortos, com a sorte do teste (nunca Math.random).
 */
export function botStrokes(rng: () => number, count: number): Stroke[] {
  const strokes: Stroke[] = []
  for (let s = 0; s < count; s += 1) {
    const points: number[][] = []
    let x = 0.15 + rng() * 0.7
    let y = 0.15 + rng() * 0.7
    const length = 3 + Math.floor(rng() * 8)
    for (let i = 0; i < length; i += 1) {
      points.push([x, y])
      x = clamp01(x + (rng() - 0.5) * 0.25)
      y = clamp01(y + (rng() - 0.5) * 0.25)
    }
    const stroke = compactStroke(points, Math.floor(rng() * PALETTE.length))
    if (stroke) strokes.push(stroke)
  }
  return strokes
}
