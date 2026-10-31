import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { withAlpha } from './color'
import { BLOODY_FONT, CREEPY_FONT, SPOOKY_COLORS } from './fonts'
import { scatter } from './motion'
import './spooky.css'

type HauntedTitleProps = {
  children: ReactNode
  /** Tamanho da fonte (número em px ou valor CSS/responsivo do MUI). */
  size?: number | string | Record<string, number | string>
  color?: string
  /** Cor do brilho (padrão: a própria cor). */
  glow?: string
  /** Gotas escorrendo das letras. */
  drip?: boolean
  /** Brilho que falha de leve, como lâmpada velha (sem pisca-pisca). */
  flicker?: boolean
  font?: 'creepster' | 'nosifer'
  component?: ElementType
  align?: 'left' | 'center' | 'right'
  sx?: SxProps<Theme>
}

/**
 * Título de filme de terror (Creepster), com brilho e escorrido opcional.
 *
 *   <HauntedTitle size={{ xs: 44, md: 96 }} drip>Cidade Dorme</HauntedTitle>
 *   <HauntedTitle font="nosifer" color="#dc2626" size={72}>MORREU</HauntedTitle>
 */
export default function HauntedTitle({
  children,
  size = { xs: 40, md: 72 },
  color = SPOOKY_COLORS.pumpkin,
  glow,
  drip = false,
  flicker = false,
  font = 'creepster',
  component = 'h2',
  align = 'center',
  sx,
}: HauntedTitleProps) {
  const halo = glow ?? color
  const text = typeof children === 'string' ? children : ''
  // Quantidade e posição das gotas saem do texto: estáveis entre renders.
  const drops = drip ? Math.max(3, Math.min(9, Math.round((text.length || 8) / 2))) : 0

  return (
    <Box
      component={component}
      sx={[
        {
          m: 0,
          fontFamily: font === 'nosifer' ? BLOODY_FONT : CREEPY_FONT,
          fontWeight: 400,
          fontSize: size,
          lineHeight: 1.05,
          letterSpacing: font === 'nosifer' ? '0.02em' : '0.05em',
          color,
          textAlign: align,
          textShadow: `0 0 10px ${withAlpha(halo, 0.55)}, 0 0 32px ${withAlpha(halo, 0.33)}, 0 4px 0 rgba(0,0,0,0.55)`,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <span className={`hw-title${flicker ? ' hw-flicker' : ''}`}>
        {children}
        {Array.from({ length: drops }, (_, index) => {
          const style = {
            left: `${8 + scatter(index, 21) * 84}%`,
            height: `${0.35 + scatter(index, 22) * 0.6}em`,
            background: color,
            '--hw-drip-dur': `${2.6 + scatter(index, 23) * 2.2}s`,
            '--hw-drip-delay': `${-scatter(index, 24) * 3}s`,
          } as CSSProperties
          return <span key={index} className="hw-drip" style={style} aria-hidden />
        })}
      </span>
    </Box>
  )
}
