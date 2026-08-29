/**
 * Tokens de superfície — uma fonte só para o "vidro escuro" que aparece em
 * todo card do app. Antes cada tela repetia `border: 2px solid var(--border-subtle)`
 * com fundos ligeiramente diferentes.
 */

export const PANEL_BG =
  'linear-gradient(160deg, rgba(26, 26, 36, 0.92) 0%, rgba(10, 10, 15, 0.94) 100%)'

export const PANEL_BORDER = 'rgba(42, 42, 58, 0.9)'

export const PANEL_SHADOW = '0 18px 44px rgba(0,0,0,0.42)'

/** Sombra de um card em destaque, tingida pelo acento recebido. */
export function glowShadow(accent: string) {
  return `0 18px 44px rgba(0,0,0,0.45), 0 0 30px ${accent}33`
}

/** Fundo de página: névoa do acento sobre o void. */
export function pageBackdrop(accent: string, secondary = 'rgba(212, 165, 32, 0.08)') {
  return `
    radial-gradient(ellipse 120% 80% at 50% -10%, ${accent} 0%, transparent 55%),
    radial-gradient(ellipse 90% 60% at 85% 110%, ${secondary} 0%, transparent 60%),
    var(--bg-void)
  `
}
