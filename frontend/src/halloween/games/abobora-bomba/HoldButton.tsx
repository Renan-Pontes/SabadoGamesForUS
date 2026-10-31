import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Box } from '@mui/material'

type HoldButtonProps = {
  /** Quanto tempo segurar (ms). */
  holdMs: number
  disabled?: boolean
  /** Já foi: anel cheio e o botão para de responder. */
  done?: boolean
  /** Chamado uma vez, quando completa o tempo segurando. */
  onComplete: () => void
  /** Texto parado. */
  label: ReactNode
  /** Texto enquanto segura. */
  holdingLabel?: ReactNode
  /** Diâmetro em px. */
  size?: number
}

const RADIUS = 46
const LENGTH = 2 * Math.PI * RADIUS

/**
 * Botão de "segure para passar": um círculo grande com um anel que enche
 * enquanto o dedo está em cima. Soltou antes, não vale. Funciona no toque
 * (pointer events, sem menu de toque longo nem rolagem), no mouse e no
 * teclado (espaço/enter seguro).
 *
 *   <HoldButton holdMs={1200} label="SEGURE PARA PASSAR" onComplete={pass} />
 */
export default function HoldButton({
  holdMs,
  disabled = false,
  done = false,
  onComplete,
  label,
  holdingLabel,
  size = 220,
}: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const latest = useRef(onComplete)
  const locked = disabled || done

  useEffect(() => {
    latest.current = onComplete
  }, [onComplete])

  // O relógio do aperto: soltou, desabilitou ou saiu da tela, cancela.
  useEffect(() => {
    if (!holding || locked) return
    const timer = setTimeout(() => {
      setHolding(false)
      latest.current()
    }, holdMs)
    return () => clearTimeout(timer)
  }, [holding, locked, holdMs])

  const press = (event: PointerEvent<HTMLElement>) => {
    if (locked) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Sem captura (navegador antigo): o soltar ainda cancela.
    }
    setHolding(true)
  }
  const release = () => setHolding(false)
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !locked) {
      event.preventDefault()
      setHolding(true)
    }
  }
  const keyUp = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === ' ' || event.key === 'Enter') setHolding(false)
  }

  const active = holding && !locked
  const filled = active || done

  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      aria-disabled={locked}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event: { preventDefault: () => void }) => event.preventDefault()}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        p: 0,
        border: 'none',
        borderRadius: '50%',
        cursor: locked ? 'default' : 'pointer',
        color: '#ffe8cc',
        background: active
          ? 'radial-gradient(circle at 50% 40%, #5a1f05 0%, #2a0d02 70%)'
          : 'radial-gradient(circle at 50% 35%, #3a1404 0%, #1f0d02 72%)',
        boxShadow: active
          ? '0 0 0 6px rgba(255, 247, 194, 0.35), 0 12px 40px rgba(0, 0, 0, 0.55)'
          : '0 10px 30px rgba(0, 0, 0, 0.45)',
        transform: active ? 'scale(0.96)' : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        opacity: disabled && !done ? 0.45 : 1,
        // Toque longo sem menu, sem seleção de texto e sem rolar a página.
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        '&:focus-visible': { boxShadow: '0 0 0 4px #fff7c2' },
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255, 232, 204, 0.18)" strokeWidth={6} />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={done ? '#8cf045' : '#fde047'}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={filled ? 0 : LENGTH}
          transform="rotate(-90 50 50)"
          style={{
            transition: active ? `stroke-dashoffset ${holdMs}ms linear` : 'stroke-dashoffset 160ms ease-out',
          }}
        />
      </svg>
      <Box
        component="span"
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          px: 3,
          fontFamily: 'var(--font-display)',
          fontSize: size >= 185 ? '1.75rem' : '1.4rem',
          lineHeight: 1.05,
          letterSpacing: '0.04em',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {active && holdingLabel ? holdingLabel : label}
      </Box>
    </Box>
  )
}
