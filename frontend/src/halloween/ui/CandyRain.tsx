import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { scatter, useReducedMotion } from './motion'
import './spooky.css'

type CandyRainProps = {
  active?: boolean
  /** 'candy' (doces), 'bats' (morcegos) ou 'mixed' (doces, morcegos e fantasmas). */
  kind?: 'candy' | 'bats' | 'mixed'
  /** Quantas peças caindo ao mesmo tempo (padrão 40). */
  count?: number
  zIndex?: number
}

const PIECES: Record<NonNullable<CandyRainProps['kind']>, string[]> = {
  candy: ['🍬', '🍭', '🍫', '🍬', '🍩', '🎃'],
  bats: ['🦇'],
  mixed: ['🍬', '🦇', '🍭', '👻', '🍫', '🎃'],
}

/**
 * Chuva de doces (ou morcegos) para a vitória. Tela cheia, por cima de tudo,
 * sem receber clique. Some com "reduzir movimento".
 *
 *   <CandyRain active={state.over} kind="mixed" />
 */
export default function CandyRain({ active = true, kind = 'candy', count = 40, zIndex = 1150 }: CandyRainProps) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  const symbols = PIECES[kind]

  return createPortal(
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {Array.from({ length: Math.max(1, Math.min(120, count)) }, (_, index) => {
        const style = {
          left: `${scatter(index, 31) * 100}%`,
          fontSize: `${18 + scatter(index, 32) * 26}px`,
          '--hw-fall-dur': `${3 + scatter(index, 33) * 3}s`,
          '--hw-fall-delay': `${scatter(index, 34) * 3}s`,
          '--hw-drift': `${(scatter(index, 35) - 0.5) * 160}px`,
          '--hw-spin': `${(scatter(index, 36) - 0.5) * 720}deg`,
        } as CSSProperties
        return (
          <span key={index} className="hw-candy" style={style}>
            {symbols[index % symbols.length]}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
