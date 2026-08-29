import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { glowShadow, PANEL_BG, PANEL_BORDER, PANEL_SHADOW } from './surfaces'

type PanelProps = {
  title?: ReactNode
  /** Texto pequeno à direita do título. */
  hint?: ReactNode
  /** Ícone/emoji antes do título. */
  icon?: ReactNode
  accent?: string
  highlight?: boolean
  /** Índice para entrada escalonada. */
  index?: number
  /** Torna o painel clicável (cards de catálogo). */
  onClick?: () => void
  children: ReactNode
  sx?: SxProps<Theme>
}

/** O card padrão do app inteiro. */
export default function Panel({
  title,
  hint,
  icon,
  accent,
  highlight = false,
  index = 0,
  onClick,
  children,
  sx,
}: PanelProps) {
  const interactive = Boolean(onClick)

  return (
    <Box
      className="stagger-in"
      style={{ '--stagger-index': index } as React.CSSProperties}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${highlight && accent ? accent : PANEL_BORDER}`,
        background: PANEL_BG,
        backdropFilter: 'blur(10px)',
        boxShadow: highlight && accent ? glowShadow(accent) : PANEL_SHADOW,
        p: { xs: 2.25, md: 3 },
        transition: 'border-color 250ms ease, box-shadow 250ms ease, transform 250ms ease',
        ...(interactive && {
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-3px)',
            borderColor: accent ?? 'var(--accent-gold)',
            boxShadow: glowShadow(accent ?? 'var(--accent-gold)'),
          },
        }),
        ...sx,
      }}
    >
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
            opacity: highlight ? 1 : 0.4,
          }}
        />
      )}

      {(title || hint) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            {icon && <Box sx={{ fontSize: '1.35rem', lineHeight: 1 }}>{icon}</Box>}
            {title && (
              <Typography
                component="h2"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  letterSpacing: '0.14em',
                  color: accent ?? 'var(--text-secondary)',
                }}
              >
                {title}
              </Typography>
            )}
          </Box>
          {hint && (
            <Typography
              sx={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
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
