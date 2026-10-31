import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type CobwebProps = {
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Lado do quadrado da teia, em px (aceita valor por breakpoint). */
  size?: number | Partial<Record<Breakpoint, number>>
  opacity?: number
  color?: string
  /** Aranhinha pendurada num fio (só nos cantos de cima). */
  spider?: boolean
  sx?: SxProps<Theme>
}

const THREADS = 6
const RINGS = [20, 38, 56, 74, 92]

/**
 * Um quarto de teia ancorado no canto (0,0) de um quadrado 100×100: fios
 * saindo do canto e anéis que "cedem" para dentro, como teia de verdade.
 * Calculado uma vez só, no carregamento do módulo.
 */
const WEB_PATH = (() => {
  const angle = (index: number) => (Math.PI / 2) * (index / (THREADS - 1))
  const point = (radius: number, theta: number) =>
    `${(radius * Math.cos(theta)).toFixed(1)} ${(radius * Math.sin(theta)).toFixed(1)}`
  let d = ''
  for (let i = 0; i < THREADS; i += 1) d += `M0 0 L${point(104, angle(i))} `
  for (const radius of RINGS) {
    for (let i = 0; i < THREADS - 1; i += 1) {
      const middle = (angle(i) + angle(i + 1)) / 2
      d += `M${point(radius, angle(i))} Q${point(radius * 0.8, middle)} ${point(radius, angle(i + 1))} `
    }
  }
  return d.trim()
})()

const FLIP: Record<NonNullable<CobwebProps['corner']>, string> = {
  'top-left': 'none',
  'top-right': 'scaleX(-1)',
  'bottom-left': 'scaleY(-1)',
  'bottom-right': 'scale(-1, -1)',
}

/**
 * Teia de canto, só decoração. O cenário global (HalloweenLayer) tem as
 * teias grandes da tela; esta é a miniatura que enfeita molduras e cards.
 */
export default function Cobweb({
  corner = 'top-left',
  size = 96,
  opacity = 0.2,
  color = 'var(--ghost)',
  spider = false,
  sx,
}: CobwebProps) {
  const top = corner.startsWith('top')
  const left = corner.endsWith('left')

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        width: size,
        height: size,
        ...(top ? { top: 0 } : { bottom: 0 }),
        ...(left ? { left: 0 } : { right: 0 }),
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        ...sx,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 100 100"
        sx={{ width: '100%', height: '100%', display: 'block', transform: FLIP[corner], opacity }}
      >
        <path d={WEB_PATH} fill="none" stroke={color} strokeWidth={0.9} strokeLinecap="round" />
      </Box>

      {spider && top && (
        <Box
          sx={{
            position: 'absolute',
            top: '34%',
            [left ? 'left' : 'right']: '34%',
            transformOrigin: 'top center',
            animation: 'swing 3.6s ease-in-out infinite',
          }}
        >
          <Box sx={{ width: '1px', height: 'clamp(18px, 3.2vh, 34px)', mx: 'auto', background: color, opacity: opacity + 0.15 }} />
          <Box component="span" sx={{ display: 'block', fontSize: 'clamp(0.85rem, 1.6vh, 1.25rem)', lineHeight: 1, mt: '-2px' }}>
            🕷️
          </Box>
        </Box>
      )}
    </Box>
  )
}
