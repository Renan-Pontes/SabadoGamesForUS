import type { CSSProperties } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { NUMBER_FONT, XMAS } from './look'

/**
 * Carta de cartão de Natal (1–100). Tudo em `em`: o tamanho da carta vem do
 * `size` (font-size da raiz), então a mesma carta serve de miniatura no
 * celular e de cartaz na TV, sem JavaScript medindo tela.
 *
 *   <XmasCard value={34} size="clamp(18px, 2.4vh, 34px)" anim="land" />
 *   <XmasCard faceDown size="6px" />
 *
 * Frente: número grande (verde nos baixos, dourado no meio, vermelho nos
 * altos), azevinho no canto, número repetido nos dois cantos de cima (dá
 * para ler no leque) e um "termômetro" de bengala doce de 1 a 100.
 */

export type CardAnim = 'none' | 'deal' | 'land' | 'flip'

type XmasCardProps = {
  value?: number
  faceDown?: boolean
  /** font-size da raiz: a carta mede 6em × 8.4em. */
  size?: string
  highlight?: boolean
  /** Carimbo "OPS!" de carta jogada cedo demais. */
  mistake?: boolean
  dim?: boolean
  anim?: CardAnim
  /** Atraso da animação de entrada, em ms. */
  delay?: number
  /** Rotação final, em graus. */
  tilt?: number
  label?: string
  sx?: SxProps<Theme>
}

function inkFor(value: number): string {
  if (value <= 33) return XMAS.inkGreen
  if (value <= 66) return '#a26a00'
  return XMAS.ink
}

const ANIMS: Record<CardAnim, string | undefined> = {
  none: undefined,
  deal: 'rmmDeal 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
  land: 'rmmLand 760ms cubic-bezier(0.2, 1.3, 0.4, 1) both',
  flip: 'rmmFlip 640ms cubic-bezier(0.22, 1, 0.36, 1) both',
}

const KEYFRAMES = {
  '@keyframes rmmDeal': {
    '0%': { opacity: 0, transform: 'translateY(-2.5em) rotate(-14deg) scale(0.7)' },
    '70%': { opacity: 1, transform: 'translateY(0.2em) rotate(calc(var(--tilt) + 3deg)) scale(1.03)' },
    '100%': { opacity: 1, transform: 'rotate(var(--tilt))' },
  },
  '@keyframes rmmLand': {
    '0%': { opacity: 0, transform: 'translate(-3em, -9em) rotate(-40deg) scale(1.6)' },
    '55%': { opacity: 1, transform: 'translate(0, 0.3em) rotate(calc(var(--tilt) + 6deg)) scale(0.96)' },
    '75%': { transform: 'translate(0, -0.15em) rotate(calc(var(--tilt) - 2deg)) scale(1.03)' },
    '100%': { opacity: 1, transform: 'rotate(var(--tilt))' },
  },
  '@keyframes rmmFlip': {
    '0%': { opacity: 0, transform: 'rotateY(90deg) scale(0.85)' },
    '60%': { opacity: 1, transform: 'rotateY(-12deg) scale(1.05) rotate(var(--tilt))' },
    '100%': { opacity: 1, transform: 'rotateY(0deg) rotate(var(--tilt))' },
  },
} as const

export default function XmasCard({
  value,
  faceDown = false,
  size = '16px',
  highlight = false,
  mistake = false,
  dim = false,
  anim = 'none',
  delay = 0,
  tilt = 0,
  label,
  sx,
}: XmasCardProps) {
  const root: SxProps<Theme> = {
    ...KEYFRAMES,
    '--tilt': `${tilt}deg`,
    fontSize: size,
    width: '6em',
    height: '8.4em',
    flexShrink: 0,
    position: 'relative',
    borderRadius: '0.55em',
    transform: 'rotate(var(--tilt))',
    animation: ANIMS[anim],
    animationDelay: `${delay}ms`,
    opacity: dim ? 0.6 : 1,
    userSelect: 'none',
    transition: 'transform 220ms ease, box-shadow 220ms ease, opacity 220ms ease',
  } as SxProps<Theme>

  if (faceDown || value === undefined) {
    return (
      <Box
        role="img"
        aria-label={label ?? 'Carta virada para baixo'}
        sx={[
          root,
          {
            background: [
              'radial-gradient(circle at 50% 50%, rgba(255, 217, 117, 0.28) 0 1.2em, transparent 1.25em)',
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.09) 0 0.35em, transparent 0.35em 0.7em)',
              `linear-gradient(160deg, #d33242, ${XMAS.ink})`,
            ].join(', '),
            border: `0.14em solid ${XMAS.goldLight}`,
            boxShadow: highlight
              ? `0 0.6em 1.4em rgba(0,0,0,0.5), 0 0 1.6em ${XMAS.gold}`
              : '0 0.45em 1em rgba(0,0,0,0.45)',
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: '0.35em',
            borderRadius: '0.35em',
            border: '0.06em solid rgba(255, 246, 220, 0.6)',
          }}
        />
        <Box
          component="svg"
          viewBox="0 0 40 40"
          aria-hidden
          sx={{ position: 'absolute', left: '50%', top: '50%', width: '3em', height: '3em', transform: 'translate(-50%, -50%)' }}
        >
          <path d="M20 3 L30 18 H25 L33 28 H7 L15 18 H10 Z" fill="#1f9d55" stroke="#0f5c33" strokeWidth="1" />
          <rect x="17.5" y="28" width="5" height="5" fill="#6b3f22" />
          <path d="M20 0 L21.6 3.6 L25.4 3.8 L22.4 6.2 L23.4 10 L20 7.8 L16.6 10 L17.6 6.2 L14.6 3.8 L18.4 3.6 Z" fill={XMAS.goldLight} />
          <circle cx="16" cy="20" r="1.6" fill={XMAS.goldLight} />
          <circle cx="24" cy="23" r="1.6" fill="#ff8c95" />
          <circle cx="19" cy="26" r="1.4" fill="#7fd8ff" />
        </Box>
      </Box>
    )
  }

  const ink = inkFor(value)
  const digits = String(value)
  const corner: CSSProperties = {
    position: 'absolute',
    fontFamily: NUMBER_FONT,
    fontWeight: 700,
    fontSize: '1.15em',
    lineHeight: 1,
    color: ink,
  }

  return (
    <Box
      role="img"
      aria-label={label ?? `Carta ${value}`}
      sx={[
        root,
        {
          background: `linear-gradient(160deg, #ffffff 0%, ${XMAS.cream} 45%, ${XMAS.creamShade} 100%)`,
          border: highlight ? `0.14em solid ${XMAS.gold}` : '0.1em solid rgba(120, 80, 30, 0.25)',
          boxShadow: highlight
            ? `0 0.7em 1.6em rgba(0,0,0,0.55), 0 0 1.8em rgba(245, 194, 66, 0.75)`
            : '0 0.45em 1.1em rgba(0,0,0,0.45)',
          filter: mistake ? 'saturate(0.8)' : undefined,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {/* Moldura vermelha com filete dourado */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '0.3em',
          borderRadius: '0.35em',
          border: `0.09em solid ${XMAS.red}`,
          boxShadow: `inset 0 0 0 0.07em ${XMAS.goldLight}`,
        }}
      />
      {/* Floco de neve de marca d'água */}
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 40 40"
        sx={{ position: 'absolute', left: '50%', top: '46%', width: '4.6em', height: '4.6em', transform: 'translate(-50%, -50%)', opacity: 0.09 }}
      >
        {[0, 60, 120].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 20 20)`} stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            <line x1="20" y1="2" x2="20" y2="38" />
            <line x1="20" y1="8" x2="15" y2="4" />
            <line x1="20" y1="8" x2="25" y2="4" />
            <line x1="20" y1="32" x2="15" y2="36" />
            <line x1="20" y1="32" x2="25" y2="36" />
          </g>
        ))}
      </Box>

      <span aria-hidden style={{ ...corner, top: '0.55em', left: '0.55em' }}>
        {digits}
      </span>
      <span aria-hidden style={{ ...corner, top: '0.55em', right: '0.55em' }}>
        {digits}
      </span>
      <Holly sx={{ position: 'absolute', top: '1.55em', left: '0.45em', width: '1.5em' }} />
      <Holly sx={{ position: 'absolute', bottom: '1.45em', right: '0.45em', width: '1.5em', transform: 'rotate(180deg)' }} />

      {/* O número, grande */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pb: '0.5em',
          fontFamily: NUMBER_FONT,
          fontWeight: 700,
          fontSize: digits.length >= 3 ? '2.35em' : '3.2em',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: ink,
          textShadow: '0 0.04em 0 rgba(255,255,255,0.9), 0 0.06em 0.12em rgba(0,0,0,0.12)',
        }}
      >
        {digits}
      </Box>

      {/* Termômetro de bengala doce: onde o número cai entre 1 e 100 */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: '0.75em',
          right: '0.75em',
          bottom: '0.72em',
          height: '0.32em',
          borderRadius: '1em',
          background: 'rgba(120, 80, 30, 0.14)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${Math.max(4, Math.min(100, value))}%`,
            height: '100%',
            borderRadius: '1em',
            background: `repeating-linear-gradient(-45deg, ${XMAS.red} 0 0.22em, #ffffff 0.22em 0.4em)`,
          }}
        />
      </Box>

      {mistake && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: '72%',
            transform: 'translate(-50%, -50%) rotate(-12deg)',
            px: '0.35em',
            py: '0.05em',
            border: `0.12em solid ${XMAS.red}`,
            borderRadius: '0.3em',
            color: XMAS.red,
            background: 'rgba(255, 250, 240, 0.82)',
            fontFamily: NUMBER_FONT,
            fontWeight: 700,
            fontSize: '1.05em',
            letterSpacing: '0.06em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          OPS!
        </Box>
      )}
    </Box>
  )
}

/** Raminho de azevinho: duas folhas e três frutinhas. */
export function Holly({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box component="svg" viewBox="0 0 24 16" aria-hidden sx={[{ display: 'block', height: 'auto' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <path d="M12 9 C 9 3 4 4 1 6 C 3 7 3 9 2 11 C 6 12 9 11 12 9 Z" fill={XMAS.holly} />
      <path d="M12 9 C 15 3 20 4 23 6 C 21 7 21 9 22 11 C 18 12 15 11 12 9 Z" fill="#167a40" />
      <circle cx="10.5" cy="9.5" r="2.1" fill={XMAS.berry} />
      <circle cx="13.6" cy="9.8" r="2.1" fill={XMAS.berry} />
      <circle cx="12" cy="7.3" r="2.1" fill="#ff3b4b" />
    </Box>
  )
}

/** Verso miniatura (barato) para contar cartas na mão de cada um. */
export function MiniBack({ size = 14, tilt = 0 }: { size?: number; tilt?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: Math.round(size * 1.4),
        borderRadius: `${Math.max(2, size / 6)}px`,
        background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 4px), linear-gradient(160deg, #d33242, ${XMAS.ink})`,
        border: `1.5px solid ${XMAS.goldLight}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        transform: `rotate(${tilt}deg)`,
        flexShrink: 0,
      }}
    />
  )
}
