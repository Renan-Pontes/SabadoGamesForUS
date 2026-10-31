import { Box } from '@mui/material'
import { withAlpha } from '../../ui/color'
import { witchOf } from './content'

/**
 * Peças de desenho da Corrida de Vassouras, usadas pela TV e pelo celular:
 * a bruxa na vassoura, o dado colorido e o nome com bicho e cor.
 */

/**
 * A bruxa na vassoura: bolinha na cor dela com o bicho no meio e a
 * vassoura por baixo. `size` é um tamanho CSS (aceita clamp()).
 */
export function WitchToken({
  witch,
  size,
  glow = false,
  shaking = false,
  tumble = false,
  dim = false,
}: {
  witch: number
  size: string
  /** Em foco (voando, liderando). */
  glow?: boolean
  /** Tremendo de maldição. */
  shaking?: boolean
  /** Caindo da vassoura (cambalhota). */
  tumble?: boolean
  /** Apagadinha enquanto outra é a da vez. */
  dim?: boolean
}) {
  const w = witchOf(witch)
  return (
    <Box
      className={shaking ? 'hw-shake' : undefined}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        opacity: dim ? 0.6 : 1,
        transition: 'opacity 300ms ease',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: '-42%',
          top: '38%',
          fontSize: `calc(${size} * 0.62)`,
          lineHeight: 1,
          transform: 'rotate(-32deg)',
          filter: 'drop-shadow(0 3px 4px rgba(0, 0, 0, 0.6))',
        }}
      >
        🧹
      </Box>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: `calc(${size} * 0.56)`,
          lineHeight: 1,
          background: `radial-gradient(circle at 34% 30%, ${w.light}, ${w.color} 58%, ${withAlpha(w.color, 0.75)})`,
          border: `calc(${size} * 0.06) solid ${w.light}`,
          boxShadow: glow
            ? `0 0 calc(${size} * 0.5) ${withAlpha(w.color, 0.9)}, 0 0 calc(${size} * 0.14) #ffffff`
            : `0 calc(${size} * 0.06) calc(${size} * 0.16) rgba(0, 0, 0, 0.55)`,
          animation: tumble ? 'cvTumble 900ms cubic-bezier(0.3, 0.7, 0.4, 1) both' : undefined,
          '@keyframes cvTumble': {
            '0%': { transform: 'rotate(0deg) translateY(0)' },
            '45%': { transform: 'rotate(-220deg) translateY(28%)' },
            '100%': { transform: 'rotate(-360deg) translateY(0)' },
          },
        }}
      >
        {w.emoji}
      </Box>
    </Box>
  )
}

/** Pintas do dado de três faces (casas 0..8 de uma grade 3×3). */
const PIPS: Record<number, readonly number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6] }

/** O dado da bruxa da vez, na cor dela. Girando, ele treme. */
export function Die({ value, witch, size, rolling = false }: { value: number; witch: number; size: string; rolling?: boolean }) {
  const w = witchOf(witch)
  const pips = new Set(PIPS[value] ?? [])
  return (
    <Box
      className={rolling ? 'hw-shake' : 'animate-pop-in'}
      aria-label={rolling ? 'dado girando' : `dado: ${value}`}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        p: `calc(${size} * 0.13)`,
        borderRadius: `calc(${size} * 0.2)`,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        background: `linear-gradient(145deg, #fffdf7 0%, ${w.light} 35%, ${w.color} 100%)`,
        border: `calc(${size} * 0.04) solid rgba(0, 0, 0, 0.35)`,
        boxShadow: `0 calc(${size} * 0.08) calc(${size} * 0.22) rgba(0, 0, 0, 0.55), 0 0 calc(${size} * 0.3) ${withAlpha(w.color, 0.5)}`,
      }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <Box
          key={cell}
          sx={{
            placeSelf: 'center',
            width: '62%',
            height: '62%',
            borderRadius: '50%',
            background: pips.has(cell) ? '#1a0b24' : 'transparent',
          }}
        />
      ))}
    </Box>
  )
}

/** "🐊 Cuca" na cor da bruxa, para frases. */
export function WitchTag({ witch }: { witch: number | null | undefined }) {
  const w = witchOf(witch)
  return (
    <Box component="span" sx={{ color: w.light, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <span aria-hidden>{w.emoji}</span> {w.name}
    </Box>
  )
}
