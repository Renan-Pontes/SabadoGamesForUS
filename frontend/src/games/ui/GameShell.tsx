import type { ReactNode } from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import type { GameAccent } from '../theme'
import { accentBackdrop, accentTextGradient } from '../theme'
import type { ViewMode } from '../useGameRoom'

type GameShellProps = {
  title: string
  /** Uma linha explicando o objetivo — aparece na TV e no host. */
  tagline?: string
  accent: GameAccent
  roomCode?: string
  viewMode: ViewMode
  status?: 'lobby' | 'live' | 'ended'
  loading?: boolean
  error?: string
  onBack?: () => void
  onToggleView?: () => void
  /** Conteúdo fixo abaixo do cabeçalho (relógio, pote, etc.). */
  headerExtra?: ReactNode
  maxWidth?: number
  children: ReactNode
}

/**
 * Moldura comum a todos os minigames.
 *
 * A TV recebe um tratamento diferente das telas de mão: título gigante,
 * código discreto no canto e zero botões — ninguém aperta botão na TV.
 */
export default function GameShell({
  title,
  tagline,
  accent,
  roomCode,
  viewMode,
  status,
  loading = false,
  error,
  onBack,
  onToggleView,
  headerExtra,
  maxWidth = 1120,
  children,
}: GameShellProps) {
  const isTv = viewMode === 'tv'

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: accentBackdrop(accent),
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: accent.main }} />
          <Typography
            sx={{
              mt: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
            }}
          >
            CARREGANDO SALA
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: accentBackdrop(accent),
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 },
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Marca d'água do naipe do jogo */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--font-display)',
          fontSize: 'min(90vh, 90vw)',
          lineHeight: 1,
          color: accent.main,
          opacity: 0.035,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {accent.sigil}
      </Box>

      <Box sx={{ maxWidth, mx: 'auto', position: 'relative' }}>
        {/* Cabeçalho */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            mb: { xs: 2, md: 3 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: isTv
                  ? { xs: '2.6rem', md: '4.4rem' }
                  : { xs: '1.9rem', md: '2.6rem' },
                lineHeight: 1,
                letterSpacing: '0.08em',
                backgroundImage: accentTextGradient(accent),
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 6s linear infinite',
              }}
            >
              {title}
            </Typography>
            {tagline && (
              <Typography
                sx={{
                  mt: 0.5,
                  color: 'var(--text-muted)',
                  fontSize: isTv ? { xs: '0.9rem', md: '1.1rem' } : '0.85rem',
                  maxWidth: 620,
                }}
              >
                {tagline}
              </Typography>
            )}
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {roomCode && (
              <>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.24em',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                >
                  SALA
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: isTv ? '1.5rem' : '1.15rem',
                    letterSpacing: '0.18em',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.2,
                  }}
                >
                  {roomCode.toUpperCase()}
                </Typography>
              </>
            )}
            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end', mt: 0.75 }}>
              {!isTv && (
                <Tag color="rgba(255,255,255,0.5)">{viewMode === 'host' ? 'HOST' : 'JOGADOR'}</Tag>
              )}
              {status === 'ended' && <Tag color="var(--accent-red)">ENCERRADA</Tag>}
              {status === 'live' && <Tag color="var(--status-ready)" pulse>AO VIVO</Tag>}
            </Box>
          </Box>
        </Box>

        {headerExtra && <Box sx={{ mb: { xs: 2, md: 3 } }}>{headerExtra}</Box>}

        {error && (
          <Box
            className="animate-shake"
            sx={{
              mb: 2,
              p: 1.75,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(220, 38, 38, 0.45)',
              background: 'rgba(220, 38, 38, 0.14)',
            }}
          >
            <Typography sx={{ color: 'var(--accent-red-light)', fontWeight: 600 }}>
              {error}
            </Typography>
          </Box>
        )}

        {children}

        {/* Navegação: só nas telas de mão, e no rodapé para não roubar foco */}
        {!isTv && (onBack || onToggleView) && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              mt: 4,
              pt: 3,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {onBack && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={onBack}
                sx={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--text-secondary)' }}
              >
                Voltar ao lobby
              </Button>
            )}
            {onToggleView && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<SwapHorizRoundedIcon />}
                onClick={onToggleView}
              >
                {viewMode === 'host' ? 'Ver como jogador' : 'Voltar ao host'}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

function Tag({
  children,
  color,
  pulse = false,
}: {
  children: ReactNode
  color: string
  pulse?: boolean
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.58rem',
        fontWeight: 800,
        letterSpacing: '0.16em',
      }}
    >
      {pulse && (
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            animation: 'pulse 1.6s ease-in-out infinite',
          }}
        />
      )}
      {children}
    </Box>
  )
}
