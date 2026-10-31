import type { ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import type { GameAccent } from '../theme'
import { accentTextGradient } from '../theme'
import type { ViewMode } from '../useGameRoom'
import { Ghost } from '../../components/ui/LoadingScreen'

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
 * Fundo da partida: névoa do acento do jogo sobre o véu roxo translúcido —
 * o cenário da Noite do Terror (neblina, morcegos) aparece por trás. Não usa
 * `accentBackdrop` de `games/theme` porque aquele termina num fundo sólido.
 */
function shellBackdrop(accent: GameAccent) {
  return `
    radial-gradient(ellipse 120% 80% at 50% -10%, ${accent.glow} 0%, transparent 55%),
    radial-gradient(ellipse 90% 60% at 90% 110%, rgba(255, 123, 28, 0.1) 0%, transparent 60%),
    var(--bg-veil)
  `
}

/** Gotas escorrendo embaixo do título: um filete com cinco pingos de tamanhos diferentes. */
const DRIPS = [
  { x: 16, length: 13, delay: 0 },
  { x: 48, length: 20, delay: 0.9 },
  { x: 97, length: 11, delay: 1.6 },
  { x: 141, length: 22, delay: 0.4 },
  { x: 178, length: 15, delay: 1.2 },
]

function TitleDrips({ color, big }: { color: string; big: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 200 30"
      aria-hidden
      sx={{
        display: 'block',
        width: big ? { xs: 180, md: 300 } : { xs: 130, md: 180 },
        height: 'auto',
        mt: 0.25,
        overflow: 'visible',
        filter: `drop-shadow(0 0 6px ${color})`,
        '& .drip': {
          transformBox: 'fill-box',
          transformOrigin: 'top',
          animation: 'drip 3.4s ease-in-out infinite',
        },
      }}
    >
      <rect x="0" y="0" width="200" height="5" rx="2.5" fill={color} />
      {DRIPS.map((drip) => (
        <path
          key={drip.x}
          className="drip"
          style={{ animationDelay: `${drip.delay}s` }}
          d={`M${drip.x - 4} 3 L${drip.x - 2.4} ${drip.length - 2.6} A2.6 2.6 0 0 0 ${drip.x + 2.4} ${drip.length - 2.6} L${drip.x + 4} 3 Z`}
          fill={color}
        />
      ))}
      <circle cx="141" cy="28" r="1.8" fill={color} opacity="0.8" />
    </Box>
  )
}

/**
 * Moldura comum a todos os minigames.
 *
 * A TV recebe um tratamento diferente das telas de mão: título gigante,
 * código discreto no canto e zero botões — ninguém aperta botão na TV.
 *
 * Noite do Terror: título em Creepster escorrendo no acento do jogo,
 * fantasminha no carregamento e fundo translúcido para o cenário. As teias
 * dos cantos da tela vêm do HalloweenLayer (não repetir aqui). As props não
 * mudaram — os 25 jogos antigos dependem delas.
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
          background: shellBackdrop(accent),
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Ghost size={isTv ? 120 : 90} glow={accent.main} />
          <Typography
            sx={{
              mt: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: isTv ? '1rem' : '0.75rem',
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
              animation: 'pulse 1.8s ease-in-out infinite',
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
        background: shellBackdrop(accent),
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
          opacity: 0.03,
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
                  ? { xs: '2.8rem', md: '4.6rem' }
                  : { xs: '2rem', md: '2.7rem' },
                lineHeight: 1,
                letterSpacing: '0.05em',
                backgroundImage: accentTextGradient(accent),
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 6s linear infinite',
                // drop-shadow e não text-shadow: com o texto recortado no
                // gradiente, text-shadow pintaria por cima das letras.
                filter: `drop-shadow(0 0 16px ${accent.glow})`,
                overflowWrap: 'break-word',
              }}
            >
              {title}
            </Typography>
            <TitleDrips color={accent.main} big={isTv} />
            {tagline && (
              <Typography
                sx={{
                  mt: 0.75,
                  color: 'var(--text-secondary)',
                  fontSize: isTv ? { xs: '1rem', md: '1.3rem' } : '0.88rem',
                  maxWidth: 680,
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
                    fontSize: isTv ? '0.8rem' : '0.6rem',
                    letterSpacing: '0.24em',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                >
                  SALA
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-numeric)',
                    fontSize: isTv ? '2.4rem' : '1.6rem',
                    letterSpacing: '0.16em',
                    color: 'var(--text-secondary)',
                    lineHeight: 1,
                  }}
                >
                  {roomCode.toUpperCase()}
                </Typography>
              </>
            )}
            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end', mt: 0.75 }}>
              {!isTv && (
                <Tag color="rgba(243,238,255,0.55)">{viewMode === 'host' ? 'HOST' : 'JOGADOR'}</Tag>
              )}
              {status === 'ended' && <Tag color="var(--accent-red)">ENCERRADA</Tag>}
              {status === 'live' && <Tag color="var(--status-ready)" pulse>AO VIVO</Tag>}
            </Box>
          </Box>
        </Box>

        {headerExtra && <Box sx={{ mb: { xs: 2, md: 3 } }}>{headerExtra}</Box>}

        {error && (
          <Box
            role="alert"
            className="animate-shake"
            sx={{
              mb: 2,
              p: 1.75,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(224, 33, 58, 0.5)',
              background: 'rgba(224, 33, 58, 0.15)',
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
        background: 'rgba(10, 6, 18, 0.45)',
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
