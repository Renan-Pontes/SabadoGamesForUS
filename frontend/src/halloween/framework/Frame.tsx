import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import type { HPlayer, HalloweenGameMeta, HalloweenView } from '../engine/types'
import { fitScale } from './fit'
import { ChristmasAvatar, useAvatar } from '../../natal/avatars'

/**
 * Moldura das telas dos jogos: cabeçalho fino (o jogo precisa do espaço,
 * principalmente na TV) com um varal de pisca-pisca embaixo, e fundo
 * translúcido, para o cenário global — neve, estrelas — continuar
 * aparecendo por trás. (O nome `HalloweenFrame` ficou da Noite do Terror.)
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
          var(--bg-veil, rgba(6, 16, 31, 0.56))
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
          mb: isTv ? 0.75 : 0.5,
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
          {!isTv && me && <MeTag me={me} />}
        </Box>
      </Box>

      <Lights big={isTv} />

      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isTv ? <TvFit>{children}</TvFit> : children}
      </Box>

      {footer}
    </Box>
  )
}

/** "Você" no cabeçalho do celular: o seu avatar (o mesmo da TV) e o nome. */
function MeTag({ me }: { me: HPlayer }) {
  const avatar = useAvatar({ id: me.id, name: me.name })
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.6, mt: 0.4 }}>
      <ChristmasAvatar avatar={avatar} size={22} title={`Você é ${avatar.label}`} />
      <Typography noWrap sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 120 }}>
        {me.isHost ? '👑 ' : ''}
        {me.name}
      </Typography>
    </Box>
  )
}

/** Cores do pisca-pisca (as mesmas do varal do cenário). */
const LIGHT_COLORS = ['#ff4d5e', '#f5c242', '#4fd67e', '#5ab4ff', '#ff8fd0']

/**
 * Varal de pisca-pisca embaixo do cabeçalho: só CSS (gradientes), sem um
 * elemento por lâmpada — barato para a TV.
 */
function Lights({ big }: { big: boolean }) {
  const gap = big ? 46 : 30
  const radius = big ? 5 : 3.5
  const height = big ? 16 : 11
  const bulbs = LIGHT_COLORS.map(
    (color, index) =>
      `radial-gradient(circle at ${gap * index + gap / 2}px ${height - radius - 1}px, ${color} ${radius}px, transparent ${radius + 1.5}px)`,
  )
  return (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        height,
        mb: big ? 1.5 : 1,
        mx: big ? -4 : -2,
        backgroundImage: [
          ...bulbs,
          'linear-gradient(180deg, transparent 0 2px, rgba(20, 60, 36, 0.9) 2px 4px, transparent 4px)',
        ].join(', '),
        backgroundSize: `${gap * LIGHT_COLORS.length}px ${height}px`,
        backgroundRepeat: 'repeat-x',
        filter: 'drop-shadow(0 0 4px rgba(255, 230, 160, 0.55))',
      }}
    />
  )
}

/**
 * Na TV ninguém rola a página: se a tela do jogo ficar mais alta que o espaço
 * (15 nomes num notebook de 864 px ligado na TV, por exemplo), encolhe tudo
 * por igual até caber. A escala é por transform, que não mexe no layout — a
 * medida não entra em laço. As revelações em tela cheia (BigReveal, chuva de
 * presentes) e os efeitos vão por portal para o body e não encolhem junto.
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
