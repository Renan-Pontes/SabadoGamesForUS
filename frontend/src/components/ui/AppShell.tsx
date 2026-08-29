import type { ReactNode } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { pageBackdrop } from './surfaces'

type AppShellProps = {
  /** Título da tela. Omita para dar o palco a um `headerLeft` próprio. */
  title?: string
  subtitle?: ReactNode
  /** Substitui o bloco de título (usado pela landing, que mostra a marca). */
  headerLeft?: ReactNode
  /** Ações à direita do cabeçalho: perfil, código da sala, sair. */
  headerRight?: ReactNode
  onBack?: () => void
  accent?: string
  /** Névoa colorida no topo da página. */
  backdropTint?: string
  error?: string
  maxWidth?: number
  /** Centraliza verticalmente (telas curtas: 404, TV, carregamento). */
  center?: boolean
  children: ReactNode
}

/**
 * Moldura das telas fora de partida (landing, lobby, sala, perfil, TV).
 *
 * As telas de jogo usam `games/ui/GameShell`, que é a versão com acento por
 * jogo e relógio; as duas compartilham as mesmas superfícies.
 */
export default function AppShell({
  title,
  subtitle,
  headerLeft,
  headerRight,
  onBack,
  accent = 'var(--accent-gold)',
  backdropTint = 'rgba(220, 38, 38, 0.12)',
  error,
  maxWidth = 1180,
  center = false,
  children,
}: AppShellProps) {
  const hasHeader = Boolean(title || headerLeft || headerRight || onBack)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: pageBackdrop(backdropTint),
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          maxWidth,
          width: '100%',
          mx: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          ...(center && { justifyContent: 'center' }),
        }}
      >
        {hasHeader && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              mb: { xs: 2.5, md: 3.5 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              {onBack && (
                <IconButton
                  onClick={onBack}
                  aria-label="Voltar"
                  sx={{
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { color: accent, borderColor: accent },
                  }}
                >
                  <ArrowBackRoundedIcon />
                </IconButton>
              )}

              {headerLeft ?? (
                <Box sx={{ minWidth: 0 }}>
                  {title && (
                    <Typography
                      component="h1"
                      sx={{
                        fontFamily: 'var(--font-display)',
                        fontSize: { xs: '1.8rem', md: '2.4rem' },
                        lineHeight: 1.05,
                        letterSpacing: '0.08em',
                        color: accent,
                      }}
                    >
                      {title}
                    </Typography>
                  )}
                  {subtitle && (
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.88rem', mt: 0.25 }}>
                      {subtitle}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {headerRight && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{headerRight}</Box>
            )}
          </Box>
        )}

        {error && (
          <Box
            className="animate-shake"
            sx={{
              mb: 2.5,
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
      </Box>
    </Box>
  )
}
