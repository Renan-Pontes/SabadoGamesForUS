import type { CSSProperties } from 'react'
import { CREEPY_FONT } from '../ui/fonts'
import { DOOMED_FILES, makeCracks } from './prankData'
import { BATTERY_OFF_MS, PRANK_REVEAL_MS } from './scaryTiming'
import './prank.css'

/**
 * As pegadinhas: enganam por uns segundos e terminam em "TRAVESSURA!".
 *
 *   quebrada  → a tela trinca por cima do que estava aparecendo (o jogo
 *               continua visível atrás das rachaduras: é isso que engana);
 *   possuida  → "ERRO CRÍTICO: apagando as fotos de Fulano...";
 *   bateria   → "Bateria em 1% — desligando" e a tela apaga.
 *
 * Nada pisca: as rachaduras e as listras do LCD aparecem uma vez e ficam.
 */

type Prank = keyof typeof PRANK_REVEAL_MS

const CRACKS = makeCracks()

function Travessura({ prank, line }: { prank: Prank; line: string }) {
  return (
    <div className="hwp-reveal" style={{ '--hwp-reveal': `${PRANK_REVEAL_MS[prank]}ms` } as CSSProperties}>
      <div className="hwp-reveal-card">
        <div className="hwp-reveal-pumpkin" aria-hidden>
          🎃
        </div>
        <div className="hwp-reveal-word" style={{ fontFamily: CREEPY_FONT }}>
          TRAVESSURA!
        </div>
        <div className="hwp-reveal-kk">kkkkkkkkk</div>
        <div className="hwp-reveal-line">{line}</div>
      </div>
    </div>
  )
}

/** 📱💥 A tela trinca por cima do jogo... e era só travessura. */
export function CrackedScene() {
  return (
    <div className="hwp" style={{ '--hwp-reveal': `${PRANK_REVEAL_MS.quebrada}ms` } as CSSProperties}>
      <div className="hwp-crack-layer">
        {/* LCD estragado: mancha preta no impacto e listras coloridas fixas. */}
        <div className="hwp-blot" />
        <div className="hwp-dead-line" style={{ left: '63.5%', background: 'rgba(236, 72, 153, 0.85)' }} />
        <div className="hwp-dead-line" style={{ left: '66%', background: 'rgba(34, 197, 94, 0.7)', width: 2 }} />
        <div className="hwp-dead-line" style={{ left: '71.2%', background: 'rgba(56, 189, 248, 0.75)' }} />
        <svg className="hwp-cracks" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {CRACKS.shards.map((points) => (
            <polygon key={points} points={points} fill="rgba(255, 255, 255, 0.16)" stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
          ))}
          {CRACKS.lines.map(({ d, delay, width }) => (
            <g key={d} style={{ '--hwp-d': `${delay}ms` } as CSSProperties}>
              <path d={d} pathLength={1} className="hwp-crack-shadow" strokeWidth={width + 2.4} />
              <path d={d} pathLength={1} className="hwp-crack-line" strokeWidth={width} />
            </g>
          ))}
        </svg>
      </div>
      <Travessura prank="quebrada" line="Sua tela tá inteirinha. Por enquanto." />
    </div>
  )
}

/** 💻👹 "ERRO CRÍTICO: aparelho possuído, apagando as fotos de Fulano..." */
export function PossessedScene({ name }: { name?: string }) {
  const whose = name ? `de ${name}` : 'deste aparelho'
  return (
    <div className="hwp" style={{ '--hwp-reveal': `${PRANK_REVEAL_MS.possuida}ms` } as CSSProperties}>
      <div className="hwp-sys">
        <div className="hwp-sys-box">
          <div className="hwp-sys-title">⚠ ERRO CRÍTICO 0x666</div>
          <div className="hwp-sys-text">Este aparelho foi possuído por uma entidade desconhecida.</div>
          <div className="hwp-sys-text">Apagando todas as fotos {whose}…</div>
          <div className="hwp-sys-bar">
            <i />
          </div>
          <div className="hwp-sys-files">
            {DOOMED_FILES.map((file, index) => (
              <div key={file} className="hwp-sys-file" style={{ '--hwp-d': `${300 + index * 480}ms` } as CSSProperties}>
                ✖ {file}
              </div>
            ))}
          </div>
          <div className="hwp-sys-warn">NÃO DESLIGUE O APARELHO</div>
        </div>
      </div>
      <Travessura prank="possuida" line={`As fotos ${whose} estão salvas. Mas a gente viu tudo 👀`} />
    </div>
  )
}

/** 🔋 "Bateria em 1% — desligando..." e a tela apaga. */
export function BatteryScene() {
  return (
    <div
      className="hwp"
      style={
        { '--hwp-reveal': `${PRANK_REVEAL_MS.bateria}ms`, '--hwp-off': `${BATTERY_OFF_MS}ms` } as CSSProperties
      }
    >
      <div className="hwp-batt">
        <svg viewBox="0 0 120 60" className="hwp-batt-icon" aria-hidden>
          <rect x={3} y={6} width={104} height={48} rx={9} fill="none" stroke="#f5f5f5" strokeWidth={5} />
          <rect x={108} y={20} width={9} height={20} rx={3} fill="#f5f5f5" />
          <rect x={10} y={13} width={7} height={34} rx={3} fill="#ef4444" />
        </svg>
        <div className="hwp-batt-title">Bateria em 1%</div>
        <div className="hwp-batt-sub">Desligando…</div>
      </div>
      <div className="hwp-batt-off" />
      <Travessura prank="bateria" line="A bateria tá ótima. Seu coração, nem tanto." />
    </div>
  )
}
