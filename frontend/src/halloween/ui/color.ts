/**
 * Cor com transparência. Hex vira hex de 8 dígitos (funciona em qualquer
 * navegador); outra coisa (var(--x), rgb()) cai no color-mix.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const hexAlpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${hexAlpha}`
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [r, g, b] = color.slice(1)
    return `#${r}${r}${g}${g}${b}${b}${hexAlpha}`
  }
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`
}
