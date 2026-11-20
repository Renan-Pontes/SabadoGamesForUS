import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { playSfx } from '../audio'
import './phaseFlourish.css'

/**
 * Transição entre fases na TV: uma fita de presente atravessa a tela em
 * diagonal, soltando brilhos, com um "whoosh" e um sininho. Dura ~0,9 s e
 * nunca recebe clique — só marca "mudou o momento do jogo" para quem está
 * no sofá olhando para outro lado.
 *
 * Não toca na primeira montagem (abrir a TV no meio da partida não deve
 * fazer barulho), só quando `moment` muda.
 *
 * Vai por portal para o <body>: a tela do jogo fica dentro do encaixe da TV
 * (TvFit, com `transform: scale`), e lá dentro `position: fixed` ficaria
 * preso ao encaixe em vez da tela.
 */
export default function PhaseFlourish({ moment, color }: { moment: string; color: string }) {
  // Conta as trocas de momento durante o render (sem efeito): a primeira
  // montagem fica em 0 e não anima.
  const [seen, setSeen] = useState(moment)
  const [run, setRun] = useState(0)
  if (moment !== seen) {
    setSeen(moment)
    setRun(run + 1)
  }

  useEffect(() => {
    if (run === 0) return
    playSfx('whoosh', { volume: 0.55 })
    playSfx('chime', { delay: 0.25, volume: 0.35 })
  }, [run])

  if (run === 0 || typeof document === 'undefined') return null
  return createPortal(
    <div key={run} className="phase-flourish" aria-hidden style={{ '--pf-color': color } as CSSProperties}>
      <div className="phase-flourish__ribbon" />
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className="phase-flourish__spark"
          style={
            {
              '--pf-x': `${8 + index * 11}%`,
              '--pf-y': `${82 - index * 9}%`,
              '--pf-delay': `${index * 45}ms`,
            } as CSSProperties
          }
        >
          {index % 3 === 0 ? '✦' : index % 3 === 1 ? '❄' : '✧'}
        </span>
      ))}
    </div>,
    document.body,
  )
}
