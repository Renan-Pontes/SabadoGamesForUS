import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '@mui/material'
import { useSuppressScares } from '../../scare'
import { FESTIVE_ROUND_FONT, scatter, useReducedMotion } from '../../ui'

/**
 * O "POF!" do Presente-Bomba: em vez de explosão, o presente estoura em
 * confete, purpurina e neve — engraçado, nunca assustador.
 *
 *   <PofBurst prize="🧦" />                       estouro no lugar do presente (TV)
 *   <PofReveal open title="POF!" line="..." />    tela cheia nos primeiros segundos
 *   <ConfettiRain active />                        chuva de confete e neve (fim)
 */

const CONFETTI = ['#ff4057', '#ffd166', '#4fd67e', '#f4f8ff', '#7fd8ff', '#ff8fd0']

/** Estrela de quadrinho atrás do "POF!". */
const STARBURST = Array.from({ length: 24 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 24 - Math.PI / 2
  const r = index % 2 === 0 ? 50 : 34
  return `${(50 + r * Math.cos(angle)).toFixed(1)},${(50 + r * Math.sin(angle)).toFixed(1)}`
}).join(' ')

function ComicPof({ text, size, delay = 0 }: { text: string; size: number; delay?: number }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        animation: `abbPofIn 620ms cubic-bezier(0.2, 1.6, 0.4, 1) ${delay}ms both`,
        '@keyframes abbPofIn': {
          from: { transform: 'scale(0.1) rotate(-30deg)', opacity: 0 },
          to: { transform: 'scale(1) rotate(-8deg)', opacity: 1 },
        },
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <polygon points={STARBURST} fill="#ffd166" stroke="#ff4057" strokeWidth="3" strokeLinejoin="round" />
        <polygon points={STARBURST} fill="none" stroke="#fff6dc" strokeWidth="1" transform="translate(50 50) scale(0.82) translate(-50 -50)" />
      </svg>
      <Box
        component="span"
        sx={{
          position: 'relative',
          fontFamily: FESTIVE_ROUND_FONT,
          fontWeight: 700,
          fontSize: size * 0.27,
          lineHeight: 1,
          color: '#ff4057',
          WebkitTextStroke: `${Math.max(2, size * 0.012)}px #2a0509`,
          textShadow: '0 4px 0 #2a0509',
          letterSpacing: '0.02em',
        }}
      >
        {text}
      </Box>
    </Box>
  )
}

/**
 * O estouro no lugar do presente, na mesa da TV: clarão dourado, confete e
 * flocos voando para todo lado, o laço subindo girando e o "presente" de
 * verdade (uma meia, um brócolis…) caindo no meio.
 */
export function PofBurst({ prize, size = 240 }: { prize: string; size?: number }) {
  const reduced = useReducedMotion()
  const pieces = reduced ? 0 : 34
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        '@keyframes abbFly': {
          '0%': { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.6)', opacity: 1 },
          '75%': { opacity: 1 },
          '100%': {
            transform: 'translate(-50%, -50%) translate(var(--abb-dx), var(--abb-dy)) rotate(var(--abb-rot)) scale(1)',
            opacity: 0,
          },
        },
      }}
    >
      {/* Clarão dourado */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255, 251, 232, 0.95) 0%, rgba(255, 209, 102, 0.85) 30%, rgba(79, 214, 126, 0.35) 55%, transparent 72%)',
          animation: 'abbFlash 1100ms ease-out both',
          '@keyframes abbFlash': {
            from: { transform: 'scale(0.2)', opacity: 1 },
            to: { transform: 'scale(2.1)', opacity: 0 },
          },
        }}
      />
      {/* Confete, purpurina e neve */}
      {Array.from({ length: pieces }, (_, index) => {
        const angle = scatter(index, 41) * Math.PI * 2
        const distance = size * (0.55 + scatter(index, 42) * 0.9)
        const kind = index % 6
        const style = {
          '--abb-dx': `${Math.cos(angle) * distance}px`,
          // Um pouco de "gravidade": tudo termina mais para baixo.
          '--abb-dy': `${Math.sin(angle) * distance + size * 0.35}px`,
          '--abb-rot': `${(scatter(index, 43) - 0.5) * 900}deg`,
          animationDuration: `${1.1 + scatter(index, 44) * 0.9}s`,
        } as CSSProperties
        return (
          <Box
            key={index}
            style={style}
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              animationName: 'abbFly',
              animationTimingFunction: 'cubic-bezier(0.15, 0.8, 0.4, 1)',
              animationFillMode: 'both',
              ...(kind === 5
                ? { fontSize: 22 + (index % 3) * 6, color: '#f4f8ff', lineHeight: 1 }
                : {
                    width: 9 + (index % 3) * 4,
                    height: 14 + (index % 4) * 3,
                    borderRadius: kind === 4 ? '50%' : '2px',
                    background: CONFETTI[index % CONFETTI.length],
                    boxShadow: '0 0 6px rgba(255, 255, 255, 0.35)',
                  }),
            }}
          >
            {kind === 5 ? '❄' : null}
          </Box>
        )
      })}
      {/* O laço voa longe, girando */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '30%',
          fontSize: size * 0.22,
          lineHeight: 1,
          animation: 'abbBow 1.6s cubic-bezier(0.2, 0.9, 0.4, 1) both',
          '@keyframes abbBow': {
            from: { transform: 'translate(-50%, 0) rotate(0deg)', opacity: 1 },
            '70%': { opacity: 1 },
            to: { transform: `translate(${size * 0.5}px, ${-size * 0.9}px) rotate(720deg)`, opacity: 0 },
          },
        }}
      >
        🎀
      </Box>
      {/* O "presente" de verdade cai no meio da mesa */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '-6%',
          right: '2%',
          fontSize: size * 0.24,
          lineHeight: 1,
          animation: 'abbPrize 900ms cubic-bezier(0.3, 1.6, 0.5, 1) 500ms both',
          '@keyframes abbPrize': {
            from: { transform: 'translateY(-120px) rotate(-40deg) scale(0.3)', opacity: 0 },
            to: { transform: 'translateY(0) rotate(12deg) scale(1)', opacity: 1 },
          },
        }}
      >
        {prize}
      </Box>
      <ComicPof text="POF!" size={size * 0.78} />
    </Box>
  )
}

type ConfettiRainProps = {
  active?: boolean
  count?: number
  zIndex?: number
}

/** Chuva de confete, estrelinhas e neve em tela cheia (sem receber clique). */
export function ConfettiRain({ active = true, count = 48, zIndex = 1150 }: ConfettiRainProps) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  return createPortal(
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        overflow: 'hidden',
        '@keyframes abbFall': {
          '0%': { transform: 'translate3d(0, -10vh, 0) rotate(0deg)', opacity: 0 },
          '6%': { opacity: 1 },
          '50%': { transform: 'translate3d(var(--abb-sway), 50vh, 0) rotate(calc(var(--abb-spin) / 2))' },
          '92%': { opacity: 1 },
          '100%': { transform: 'translate3d(0, 110vh, 0) rotate(var(--abb-spin))', opacity: 0 },
        },
      }}
    >
      {Array.from({ length: Math.max(1, Math.min(120, count)) }, (_, index) => {
        const kind = index % 7
        const style = {
          left: `${scatter(index, 51) * 100}%`,
          '--abb-sway': `${(scatter(index, 52) - 0.5) * 140}px`,
          '--abb-spin': `${(scatter(index, 53) - 0.5) * 1080}deg`,
          animationDuration: `${3.2 + scatter(index, 54) * 3}s`,
          animationDelay: `${scatter(index, 55) * 3}s`,
        } as CSSProperties
        const symbol = kind === 5 ? '❄' : kind === 6 ? '⭐' : null
        return (
          <Box
            key={index}
            style={style}
            sx={{
              position: 'absolute',
              top: 0,
              lineHeight: 1,
              animationName: 'abbFall',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationFillMode: 'both',
              ...(symbol
                ? { fontSize: 20 + (index % 4) * 6, color: '#f4f8ff' }
                : {
                    width: 10 + (index % 3) * 4,
                    height: 16 + (index % 4) * 3,
                    borderRadius: kind === 4 ? '50%' : '2px',
                    background: CONFETTI[index % CONFETTI.length],
                  }),
            }}
          >
            {symbol}
          </Box>
        )
      })}
    </Box>,
    document.body,
  )
}

type PofRevealProps = {
  open: boolean
  /** "POF!" ou "UFA!". */
  title: string
  /** A piada da vez (a mesma que a TV fala). */
  line: ReactNode
  subtitle?: ReactNode
  /** Emoji do "presente" que saiu de dentro. */
  prize?: string
  children?: ReactNode
}

/**
 * Tela cheia do POF: fundo de noite azul com raios dourados girando, a
 * estrela de quadrinho, chuva de confete e a piada da vez. Segura os efeitos
 * aleatórios enquanto aberta. Nunca bloqueia cliques.
 */
export function PofReveal({ open, title, line, subtitle, prize, children }: PofRevealProps) {
  useSuppressScares(open)
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <Box
      className="hw-fade-in"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'grid',
        placeItems: 'center',
        p: 3,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, rgba(20, 60, 50, 0.9) 0%, rgba(6, 16, 31, 0.96) 70%)',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '220vmax',
          height: '220vmax',
          marginLeft: '-110vmax',
          marginTop: '-110vmax',
          background:
            'repeating-conic-gradient(from 0deg, rgba(255, 209, 102, 0.16) 0deg 10deg, transparent 10deg 20deg)',
          animation: 'abbRays 14s linear infinite',
          '@keyframes abbRays': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        }}
      />
      <ConfettiRain active count={56} zIndex={1201} />
      <Box sx={{ position: 'relative', textAlign: 'center', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ position: 'relative' }}>
          <ComicPof text={title} size={340} />
          {prize && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                right: -40,
                bottom: -10,
                fontSize: '6rem',
                lineHeight: 1,
                animation: 'abbPrizeBig 900ms cubic-bezier(0.3, 1.6, 0.5, 1) 450ms both',
                '@keyframes abbPrizeBig': {
                  from: { transform: 'translateY(-200px) rotate(-40deg) scale(0.3)', opacity: 0 },
                  to: { transform: 'translateY(0) rotate(14deg) scale(1)', opacity: 1 },
                },
              }}
            >
              {prize}
            </Box>
          )}
        </Box>
        <Box
          className="animate-pop-in"
          sx={{
            mt: 2,
            fontFamily: FESTIVE_ROUND_FONT,
            fontWeight: 700,
            fontSize: { xs: '2.2rem', md: '4rem' },
            lineHeight: 1.08,
            color: '#fff6dc',
            textShadow: '0 0 24px rgba(255, 209, 102, 0.55), 0 5px 0 rgba(0, 0, 0, 0.5)',
            animationDelay: '250ms',
          }}
        >
          {line}
        </Box>
        {subtitle && (
          <Box sx={{ mt: 1.5, fontSize: { xs: '1.4rem', md: '2.4rem' }, fontWeight: 700, color: 'var(--text-secondary)' }}>{subtitle}</Box>
        )}
        {children && <Box sx={{ mt: 2 }}>{children}</Box>}
      </Box>
    </Box>,
    document.body,
  )
}
