import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { scatter, useReducedMotion } from '../../ui'

const PIECES = ['🎁', '❄️', '⭐', '🎄', '🍪', '🔔', '🎨', '🦌', '🍬', '❄️']

/**
 * Chuva de presentes, flocos e estrelas para o fim da exposição (a mesma
 * queda da chuva de doces do kit, com peças de Natal). Tela cheia, sem
 * clique; some com "reduzir movimento".
 *
 *   <GiftRain active={state.over} />
 */
export default function GiftRain({ active = true, count = 44 }: { active?: boolean; count?: number }) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1150, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, index) => {
        const style = {
          left: `${scatter(index, 41) * 100}%`,
          fontSize: `${20 + scatter(index, 42) * 28}px`,
          '--hw-fall-dur': `${3.2 + scatter(index, 43) * 3}s`,
          '--hw-fall-delay': `${scatter(index, 44) * 3.5}s`,
          '--hw-drift': `${(scatter(index, 45) - 0.5) * 180}px`,
          '--hw-spin': `${(scatter(index, 46) - 0.5) * 540}deg`,
        } as CSSProperties
        return (
          <span key={index} className="hw-candy" style={style}>
            {PIECES[index % PIECES.length]}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
