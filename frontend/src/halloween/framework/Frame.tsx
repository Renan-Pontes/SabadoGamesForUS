import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import type { HPlayer, HalloweenGameMeta, HalloweenView } from '../engine/types'
import { fitScale } from './fit'

/**
 * Moldura das telas de Halloween: cabeçalho fino (o jogo precisa do espaço,
 * principalmente na TV) e fundo translúcido, para o cenário global —
 * neblina, morcegos — continuar aparecendo por trás.
 */
export function HalloweenFrame({
  meta,
  view,
  code,
  me,
  footer,
  children,
}: {
  meta: HalloweenGameMeta
  view: HalloweenView
  code: string
  me?: HPlayer | null
  /** Barra fixa no rodapé (controles do host). */
  footer?: ReactNode
  children: ReactNode
}) {
  const isTv = view === 'tv'
  const accent = meta.accent
  return (
    <Box
      sx={{
        // Na TV a moldura tem a altura exata da tela (ninguém rola a TV); o
        // conteúdo que não couber encolhe no TvFit.
        ...(isTv ? { height: '100vh', overflow: 'hidden' } : { minHeight: '100vh' }),
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-primary)',
        background: `
          radial-gradient(ellipse 110% 70% at 50% -10%, ${accent.glow} 0%, transparent 60%),
          var(--bg-veil, rgba(10, 6, 18, 0.6))
        `,
        px: isTv ? { xs: 2, md: 4 } : 2,
        pt: isTv ? { xs: 1.5, md: 2 } : 1.5,
        pb: footer ? 12 : isTv ? 2 : 3,
        overflowX: 'hidden',
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: isTv ? 2 : 1.5,
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box component="span" aria-hidden sx={{ fontSize: isTv ? '2.6rem' : '1.6rem', lineHeight: 1 }}>
            {meta.icon}
          </Box>
          <Typography
            component="h1"
            noWrap
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: isTv ? { xs: '2rem', md: '2.8rem' } : '1.45rem',
              lineHeight: 1,
              letterSpacing: '0.04em',
              color: accent.main,
              textShadow: `0 0 18px ${accent.glow}`,
            }}
          >
            {meta.name}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-numeric, var(--font-mono))',
              fontSize: isTv ? '1.9rem' : '1.05rem',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              lineHeight: 1,
            }}
          >
            SALA {code}
          </Typography>
          {!isTv && me && (
            <Typography noWrap sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 140 }}>
              {me.isHost ? '👑 ' : ''}
              {me.name}
            </Typography>
          )}
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isTv ? <TvFit>{children}</TvFit> : children}
      </Box>

      {footer}
    </Box>
  )
}

/**
 * Na TV ninguém rola a página: se a tela do jogo ficar mais alta que o espaço
 * (15 nomes num notebook de 864 px ligado na TV, por exemplo), encolhe tudo
 * por igual até caber. A escala é por transform, que não mexe no layout — a
 * medida não entra em laço. As revelações em tela cheia (BigReveal, chuva de
 * doces) e os sustos vão por portal para o body e não encolhem junto.
 */
function TvFit({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const next = fitScale(outer.clientHeight, inner.offsetHeight)
      setScale((current) => (Math.abs(current - next) < 0.005 ? current : next))
    }
    const observer = new ResizeObserver(update)
    observer.observe(outer)
    observer.observe(inner)
    update()
    return () => observer.disconnect()
  }, [])

  return (
    <Box ref={outerRef} sx={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <Box
        ref={innerRef}
        sx={{
          // Ocupa ao menos a altura toda: jogo que centraliza com flex: 1 continua centralizado.
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          transform: scale < 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'top center',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

/** Mensagem centralizada: carregando, erro, espectador... */
export function CenterMessage({
  icon,
  title,
  text,
  big = false,
  loading = false,
  children,
}: {
  icon?: string
  title: string
  text?: ReactNode
  /** Letras de TV (legível a 3 metros). */
  big?: boolean
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: big ? '70vh' : '55vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: big ? 3 : 1.5,
        px: 2,
      }}
    >
      {loading && <CircularProgress sx={{ color: 'var(--accent-gold)' }} />}
      {icon && (
        <Box aria-hidden className="animate-ghost" sx={{ fontSize: big ? '8rem' : '4rem', lineHeight: 1 }}>
          {icon}
        </Box>
      )}
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: big ? 'clamp(3rem, 6vw, 5.5rem)' : '2rem',
          lineHeight: 1.05,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </Typography>
      {text && (
        <Typography
          component="div"
          sx={{ fontSize: big ? 'clamp(1.6rem, 2.6vw, 2.4rem)' : '1.1rem', color: 'var(--text-secondary)', maxWidth: 900 }}
        >
          {text}
        </Typography>
      )}
      {children}
    </Box>
  )
}
