/**
 * Identidade visual por minigame.
 *
 * Cada jogo tem um acento próprio para que, na TV, dê pra reconhecer o jogo
 * de longe só pela cor. Tudo aqui é derivado do design system em index.css.
 */

export type GameAccent = {
  /** Cor principal do jogo (títulos, bordas, destaques). */
  main: string
  /** Variação clara usada em gradientes de título. */
  light: string
  /** rgba do acento, para brilhos e fundos translúcidos. */
  glow: string
  /** Cor de texto sobre um fundo preenchido com `main`. */
  contrast: string
  /** Emoji/símbolo curto usado como marca d'água do jogo. */
  sigil: string
}

export const GAME_ACCENTS = {
  'read-my-mind': {
    main: '#22d3ee',
    light: '#a855f7',
    glow: 'rgba(34, 211, 238, 0.45)',
    contrast: '#04141a',
    sigil: '♠',
  },
  'confinamento-solitario': {
    main: '#a855f7',
    light: '#e879f9',
    glow: 'rgba(168, 85, 247, 0.45)',
    contrast: '#12041f',
    sigil: '♥',
  },
  'concurso-de-beleza': {
    main: '#d4a520',
    light: '#fbbf24',
    glow: 'rgba(212, 165, 32, 0.45)',
    contrast: '#1a1204',
    sigil: '♦',
  },
  'leilao-de-cem-votos': {
    main: '#dc2626',
    light: '#f97316',
    glow: 'rgba(220, 38, 38, 0.45)',
    contrast: '#1a0505',
    sigil: '♣',
  },
  'blef-jack': {
    main: '#22c55e',
    light: '#a3e635',
    glow: 'rgba(34, 197, 94, 0.45)',
    contrast: '#04160b',
    sigil: '♠',
  },
  'a-cacada': {
    main: '#4ade80',
    light: '#a3e635',
    glow: 'rgba(74, 222, 128, 0.4)',
    contrast: '#04140b',
    sigil: '🐾',
  },
  sintonia: {
    main: '#22d3ee',
    light: '#818cf8',
    glow: 'rgba(34, 211, 238, 0.42)',
    contrast: '#04141a',
    sigil: '◐',
  },
  caveira: {
    main: '#e2e8f0',
    light: '#f472b6',
    glow: 'rgba(226, 232, 240, 0.34)',
    contrast: '#0a0a0f',
    sigil: '☠',
  },
  resistencia: {
    main: '#ef4444',
    light: '#fbbf24',
    glow: 'rgba(239, 68, 68, 0.45)',
    contrast: '#1a0505',
    sigil: '✶',
  },
  'palavra-chave': {
    main: '#60a5fa',
    light: '#f87171',
    glow: 'rgba(96, 165, 250, 0.42)',
    contrast: '#04101f',
    sigil: '▦',
  },
  'o-infiltrado': {
    main: '#a855f7',
    light: '#22d3ee',
    glow: 'rgba(168, 85, 247, 0.45)',
    contrast: '#12041f',
    sigil: '◉',
  },
  perfil: {
    main: '#fb923c',
    light: '#fbbf24',
    glow: 'rgba(251, 146, 60, 0.42)',
    contrast: '#1a0d04',
    sigil: '?',
  },
  camaleao: {
    main: '#facc15',
    light: '#4ade80',
    glow: 'rgba(250, 204, 21, 0.42)',
    contrast: '#1a1504',
    sigil: '◆',
  },
  lobisomem: {
    main: '#c084fc',
    light: '#f8fafc',
    glow: 'rgba(192, 132, 252, 0.45)',
    contrast: '#12041f',
    sigil: '☽',
  },
  'corrida-de-camelos': {
    main: '#f59e0b',
    light: '#fde68a',
    glow: 'rgba(245, 158, 11, 0.45)',
    contrast: '#1c1203',
    sigil: '≋',
  },
  'nao-para': {
    main: '#f43f5e',
    light: '#fda4af',
    glow: 'rgba(244, 63, 94, 0.45)',
    contrast: '#1f0509',
    sigil: '⚄',
  },
  'palpite-certo': {
    main: '#e879f9',
    light: '#f0abfc',
    glow: 'rgba(232, 121, 249, 0.45)',
    contrast: '#1d0620',
    sigil: '¤',
  },
  'artista-falso': {
    main: '#34d399',
    light: '#a7f3d0',
    glow: 'rgba(52, 211, 153, 0.45)',
    contrast: '#03150e',
    sigil: '✎',
  },
  'bomba-relogio': {
    main: '#ef4444',
    light: '#fca5a5',
    glow: 'rgba(239, 68, 68, 0.5)',
    contrast: '#1c0505',
    sigil: '✸',
  },
  muralhas: {
    main: '#d6d3d1',
    light: '#fafaf9',
    glow: 'rgba(214, 211, 209, 0.4)',
    contrast: '#1c1917',
    sigil: '▦',
  },
  'desenha-e-adivinha': {
    main: '#fb7185',
    light: '#fecdd3',
    glow: 'rgba(251, 113, 133, 0.45)',
    contrast: '#1f0a10',
    sigil: '✏',
  },
  'so-uma': {
    main: '#60a5fa',
    light: '#bfdbfe',
    glow: 'rgba(96, 165, 250, 0.45)',
    contrast: '#061224',
    sigil: '☝',
  },
  manada: {
    main: '#f9a8d4',
    light: '#fce7f3',
    glow: 'rgba(249, 168, 212, 0.45)',
    contrast: '#1f0a17',
    sigil: '❀',
  },
  'quiz-da-mesa': {
    main: '#2dd4bf',
    light: '#99f6e4',
    glow: 'rgba(45, 212, 191, 0.45)',
    contrast: '#03211d',
    sigil: '¿',
  },
  'future-sugoroku': {
    main: '#38bdf8',
    light: '#818cf8',
    glow: 'rgba(56, 189, 248, 0.45)',
    contrast: '#04121c',
    sigil: '⬢',
  },
} as const satisfies Record<string, GameAccent>

export type GameSlug = keyof typeof GAME_ACCENTS

const FALLBACK_ACCENT: GameAccent = {
  main: '#d4a520',
  light: '#fbbf24',
  glow: 'rgba(212, 165, 32, 0.45)',
  contrast: '#1a1204',
  sigil: '★',
}

export function getAccent(slug: string): GameAccent {
  return (GAME_ACCENTS as Record<string, GameAccent>)[slug] ?? FALLBACK_ACCENT
}

/** Fundo da página de um jogo: névoa do acento por cima do void. */
export function accentBackdrop(accent: GameAccent) {
  return `
    radial-gradient(ellipse 120% 80% at 50% -10%, ${accent.glow} 0%, transparent 55%),
    radial-gradient(ellipse 90% 60% at 90% 110%, rgba(220, 38, 38, 0.10) 0%, transparent 60%),
    var(--bg-void)
  `
}

/** Gradiente usado nos títulos dos jogos. */
export function accentTextGradient(accent: GameAccent) {
  return `linear-gradient(100deg, ${accent.main}, ${accent.light} 70%, ${accent.main})`
}
