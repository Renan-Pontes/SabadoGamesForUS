import type { ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { withAlpha } from './color'
import './spooky.css'

type DoorSvgProps = {
  /** Aberta mostra o que tem dentro. */
  open?: boolean
  /** Largura em px; a altura é 1,6×. */
  width?: number
  /** Cor da madeira. */
  color?: string
  /** Número ou emoji pregado na porta. */
  label?: ReactNode
  /** O que aparece quando abre (ex.: '👹' ou '✅'). */
  inside?: ReactNode
  /** Cor da luz lá dentro. */
  glow?: string
  /** Tremendo, como se alguém batesse do outro lado. */
  knock?: boolean
  /** Celular: vira botão (escolher a porta). */
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  /** Texto para leitor de tela quando é botão. */
  ariaLabel?: string
}

/**
 * Porta assombrada que abre em 3D. Na TV é cenário; no celular, com
 * `onClick`, vira um botão grande.
 *
 *   <DoorSvg label="2" open={revealed} inside={monster ? '👹' : '🕯️'} glow={monster ? '#dc2626' : '#fbbf24'} />
 *   <DoorSvg label="3" onClick={() => send({ door: 3 })} selected={mine === 3} width={96} />
 */
export default function DoorSvg({
  open = false,
  width = 160,
  color = '#5b3a22',
  label,
  inside,
  glow = '#fbbf24',
  knock = false,
  onClick,
  selected = false,
  disabled = false,
  ariaLabel,
}: DoorSvgProps) {
  const height = width * 1.6
  const door = (
    <Box
      className={`hw-door${open ? ' hw-door--open' : ''}`}
      sx={{ position: 'relative', width, height, flexShrink: 0 }}
    >
      {/* Batente e o que tem do outro lado */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: `${width * 0.45}px ${width * 0.45}px 6px 6px`,
          border: `${Math.max(4, width * 0.06)}px solid #2b2420`,
          background: `radial-gradient(ellipse at 50% 60%, ${withAlpha(glow, 0.55)}, #07040b 70%)`,
          boxShadow: selected
            ? `0 0 0 3px ${glow}, 0 0 28px ${withAlpha(glow, 0.6)}`
            : '0 10px 28px rgba(0,0,0,0.55)',
          display: 'grid',
          placeItems: 'center',
          fontSize: width * 0.42,
          overflow: 'hidden',
        }}
      >
        {open ? inside : null}
      </Box>

      {/* A porta em si */}
      <Box
        className={`hw-door-panel${knock && !open ? ' hw-knock' : ''}`}
        sx={{
          position: 'absolute',
          inset: `${Math.max(4, width * 0.06)}px`,
          borderRadius: `${width * 0.4}px ${width * 0.4}px 3px 3px`,
          background: `repeating-linear-gradient(90deg, ${color} 0 ${width * 0.18}px, ${withAlpha('#000000', 0.25)} ${width * 0.18}px ${width * 0.19}px), ${color}`,
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.55)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '14%',
            right: '14%',
            top: '20%',
            height: '28%',
            border: '2px solid rgba(0,0,0,0.35)',
            borderRadius: `${width * 0.2}px ${width * 0.2}px 2px 2px`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '14%',
            right: '14%',
            top: '56%',
            height: '30%',
            border: '2px solid rgba(0,0,0,0.35)',
            borderRadius: 1,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            right: '12%',
            top: '54%',
            width: width * 0.1,
            height: width * 0.1,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #fde68a, #a16207)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        />
        {label !== undefined && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '7%',
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: width * 0.2,
              lineHeight: 1,
              color: '#fde68a',
              textShadow: '0 2px 0 rgba(0,0,0,0.6)',
            }}
          >
            {label}
          </Box>
        )}
      </Box>
    </Box>
  )

  if (!onClick) return door
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      sx={{
        borderRadius: `${width * 0.45}px ${width * 0.45}px 8px 8px`,
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 150ms ease',
        '&:active': { transform: 'scale(0.97)' },
      }}
    >
      {door}
    </ButtonBase>
  )
}
