/**
 * Tokens de superfície — uma fonte só para o "vidro escuro" que aparece em
 * todo card do app. Antes cada tela repetia `border: 2px solid var(--border-subtle)`
 * com fundos ligeiramente diferentes.
 *
 * Noite do Terror: o vidro é roxo-noite e um pouco translúcido, para a
 * neblina e os morcegos do cenário (HalloweenLayer) aparecerem por trás.
 */

export const PANEL_BG =
  'linear-gradient(160deg, rgba(31, 18, 54, 0.86) 0%, rgba(12, 7, 22, 0.9) 100%)'

export const PANEL_BORDER = 'rgba(72, 48, 108, 0.75)'

export const PANEL_SHADOW = '0 18px 44px rgba(0,0,0,0.45)'

/**
 * Cor com transparência, aceitando hex (#rgb/#rrggbb) e `var(--...)`.
 *
 * O app inteiro faz `${accent}33` para clarear o acento — o que só funciona
 * com hex. Com `var(--accent-red)` saía CSS inválido e o brilho sumia calado;
 * aqui o caso da variável vai por `color-mix`.
 */
export function withAlpha(color: string, alpha: number) {
  const clamped = Math.min(1, Math.max(0, alpha))
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)
  const full = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : color
  if (/^#[0-9a-f]{6}$/i.test(full)) {
    return `${full}${Math.round(clamped * 255)
      .toString(16)
      .padStart(2, '0')}`
  }
  return `color-mix(in srgb, ${color} ${Math.round(clamped * 100)}%, transparent)`
}

/** Sombra de um card em destaque, tingida pelo acento recebido. */
export function glowShadow(accent: string) {
  return `0 18px 44px rgba(0,0,0,0.45), 0 0 30px ${withAlpha(accent, 0.22)}`
}

/**
 * Fundo de página: névoa do acento sobre um véu roxo translúcido. O véu (e
 * não um fundo sólido) é o que deixa o cenário animado aparecer.
 */
export function pageBackdrop(accent: string, secondary = 'rgba(255, 123, 28, 0.09)') {
  return `
    radial-gradient(ellipse 120% 80% at 50% -10%, ${accent} 0%, transparent 55%),
    radial-gradient(ellipse 90% 60% at 85% 110%, ${secondary} 0%, transparent 60%),
    var(--bg-veil)
  `
}

/** Tons prontos de névoa para as telas fora de partida. */
export const MIST = {
  witch: 'rgba(139, 63, 217, 0.22)',
  pumpkin: 'rgba(255, 123, 28, 0.16)',
  slime: 'rgba(140, 240, 69, 0.12)',
  blood: 'rgba(224, 33, 58, 0.18)',
  ecto: 'rgba(79, 230, 208, 0.12)',
} as const
