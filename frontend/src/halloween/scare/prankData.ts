/** Dados puros das pegadinhas (rachaduras e arquivos "apagados"). */

/** Gerador semeado (mulberry32): as rachaduras são as mesmas em toda tela. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Onde o "dedo" bateu (unidades do viewBox 1600×900). */
export const CRACK_IMPACT = { x: 1010, y: 360 } as const

export type Crack = { d: string; delay: number; width: number }

/**
 * As rachaduras: raios tortos saindo do impacto (alguns com galhos), dois
 * anéis quebrados em volta e caquinhos no meio. Puro e determinístico.
 */
export function makeCracks(seed = 31): { lines: Crack[]; shards: string[] } {
  const rng = seeded(seed)
  const { x: cx, y: cy } = CRACK_IMPACT
  const lines: Crack[] = []
  const rays = 15
  for (let i = 0; i < rays; i += 1) {
    let angle = (i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.35
    let x = cx
    let y = cy
    const length = 320 + rng() * 1100
    let walked = 0
    const points = [`M${x.toFixed(0)} ${y.toFixed(0)}`]
    let branch: string | null = null
    while (walked < length) {
      const step = 40 + rng() * 90
      angle += (rng() - 0.5) * 0.5
      x += Math.cos(angle) * step
      y += Math.sin(angle) * step
      walked += step
      points.push(`L${x.toFixed(0)} ${y.toFixed(0)}`)
      if (!branch && walked > 160 && rng() < 0.18) {
        const side = angle + (rng() < 0.5 ? 0.7 : -0.7)
        let bx = x
        let by = y
        const parts = [`M${bx.toFixed(0)} ${by.toFixed(0)}`]
        for (let k = 0; k < 3; k += 1) {
          const s = 40 + rng() * 70
          bx += Math.cos(side + (rng() - 0.5) * 0.6) * s
          by += Math.sin(side + (rng() - 0.5) * 0.6) * s
          parts.push(`L${bx.toFixed(0)} ${by.toFixed(0)}`)
        }
        branch = parts.join(' ')
      }
    }
    const delay = Math.round(rng() * 90)
    lines.push({ d: points.join(' '), delay, width: 1.4 + rng() * 1.6 })
    if (branch) lines.push({ d: branch, delay: delay + 80, width: 1.1 })
  }
  for (const radius of [46, 110]) {
    const start = rng() * Math.PI * 2
    const sweep = Math.PI * (1.1 + rng() * 0.7)
    const pts: string[] = []
    for (let k = 0; k <= 14; k += 1) {
      const a = start + (k / 14) * sweep
      const r = radius * (0.85 + rng() * 0.3)
      pts.push(`${k === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(0)} ${(cy + Math.sin(a) * r).toFixed(0)}`)
    }
    lines.push({ d: pts.join(' '), delay: 20, width: 1.3 })
  }
  const shards: string[] = []
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.4
    const r1 = 8 + rng() * 14
    const r2 = 30 + rng() * 30
    const p1 = [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]
    const p2 = [cx + Math.cos(a + 0.5) * r2, cy + Math.sin(a + 0.5) * r2]
    const p3 = [cx + Math.cos(a + 0.15) * (r2 + 14), cy + Math.sin(a + 0.15) * (r2 + 14)]
    shards.push([p1, p2, p3].map(([px, py]) => `${px.toFixed(0)},${py.toFixed(0)}`).join(' '))
  }
  return { lines, shards }
}

/** Arquivos "sendo apagados" na tela de possuído. */
export const DOOMED_FILES = [
  'IMG_20261031_selfie_com_filtro.jpg',
  'video_dancando_sozinho.mp4',
  'print_da_conversa_com_o_crush.png',
  'audio_cantando_no_chuveiro.m4a',
  'fotos_da_festa_2019 (NÃO ABRIR)',
  'senhas_importantes.txt',
] as const

