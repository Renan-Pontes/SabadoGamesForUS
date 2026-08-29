import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

type GameCardProps = {
  title?: ReactNode
  /** Texto pequeno à direita do título (contador, dica, status). */
  hint?: ReactNode
  /** Cor da borda/brilho. Padrão: borda neutra do tema. */
  accent?: string
  /** Realça o card com brilho e borda do acento. */
  highlight?: boolean
  /** Índice para entrada escalonada em grids. */
  index?: number
  children: ReactNode
  sx?: SxProps<Theme>
}

/**
 * Painel base dos minigames: fundo com profundidade, borda sutil e um filete
 * do acento no topo. Substitui os `Box` com `border: 2px solid` espalhados.
 */
export default function GameCard({
  title,
  hint,
  accent,
  highlight = false,
  index = 0,
  children,
  sx,
}: GameCardProps) {
  return (
    <Box
      className="stagger-in"
      style={{ '--stagger-index': index } as React.CSSProperties}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${highlight && accent ? accent : 'rgba(42, 42, 58, 0.9)'}`,
        background:
          'linear-gradient(160deg, rgba(26, 26, 36, 0.92) 0%, rgba(10, 10, 15, 0.94) 100%)',
        backdropFilter: 'blur(10px)',
        boxShadow: highlight && accent
          ? `0 18px 44px rgba(0,0,0,0.45), 0 0 30px ${accent}33`
          : '0 18px 44px rgba(0,0,0,0.42)',
        p: { xs: 2.25, md: 3 },
        transition: 'border-color 250ms ease, box-shadow 250ms ease',
        ...sx,
      }}
    >
      {/* Filete do acento no topo */}
      {accent && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: highlight ? 1 : 0.45,
          }}
        />
      )}

      {(title || hint) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 2,
          }}
        >
          {title && (
            <Typography
              component="h3"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.05rem',
                letterSpacing: '0.14em',
                color: accent ?? 'var(--text-secondary)',
              }}
            >
              {title}
            </Typography>
          )}
          {hint && (
            <Typography
              sx={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {hint}
            </Typography>
          )}
        </Box>
      )}

      {children}
    </Box>
  )
}
