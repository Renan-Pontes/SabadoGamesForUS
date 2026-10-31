import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { CREEPY_FONT } from './fonts'
import './spooky.css'

type TombstoneProps = {
  name: ReactNode
  epitaph?: ReactNode
  /** Linha de cima (padrão: "AQUI JAZ"). */
  title?: ReactNode
  /** Largura em px; a altura acompanha. */
  width?: number
  /** Cor da pedra. */
  stone?: string
  /** Sobe da terra ao aparecer. */
  rise?: boolean
  children?: ReactNode
}

/**
 * Lápide com nome e epitáfio — para quem morreu, saiu ou foi o mais votado.
 *
 *   <Tombstone name="Pedro" epitaph="Foi investigar o barulho no porão" rise />
 */
export default function Tombstone({
  name,
  epitaph,
  title = 'AQUI JAZ',
  width = 260,
  stone = '#7c818c',
  rise = false,
  children,
}: TombstoneProps) {
  const unit = width / 10
  return (
    <Box
      className={rise ? 'hw-rise' : undefined}
      sx={{ position: 'relative', width, display: 'inline-block', flexShrink: 0 }}
    >
      <Box
        sx={{
          position: 'relative',
          width,
          minHeight: width * 1.15,
          px: `${unit * 0.9}px`,
          pt: `${unit * 1.5}px`,
          pb: `${unit * 1.6}px`,
          borderRadius: '50% 50% 10px 10px / 34% 34% 10px 10px',
          background: `linear-gradient(170deg, ${stone} 0%, #50545e 62%, #33363d 100%)`,
          boxShadow: `inset 0 -${unit * 0.4}px ${unit}px rgba(0,0,0,0.45), inset 0 ${unit * 0.25}px 0 rgba(255,255,255,0.12), 0 ${unit * 0.6}px ${unit * 1.4}px rgba(0,0,0,0.55)`,
          textAlign: 'center',
          color: 'rgba(22, 22, 30, 0.88)',
          textShadow: '0 1px 0 rgba(255,255,255,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* Rachadura e musgo */}
        <svg
          viewBox="0 0 100 120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          aria-hidden
        >
          <path d="M72 8 L66 22 L71 30 L63 44" stroke="rgba(20,20,26,0.45)" strokeWidth={0.9} fill="none" />
          <ellipse cx="12" cy="112" rx="22" ry="12" fill="rgba(74, 122, 52, 0.35)" />
          <ellipse cx="90" cy="116" rx="16" ry="8" fill="rgba(74, 122, 52, 0.25)" />
        </svg>

        <Box sx={{ position: 'relative', fontFamily: CREEPY_FONT, fontSize: unit * 0.95, letterSpacing: '0.12em' }}>
          {title}
        </Box>
        <Box
          sx={{
            position: 'relative',
            mt: `${unit * 0.4}px`,
            fontFamily: 'var(--font-display)',
            fontSize: unit * 1.55,
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            wordBreak: 'break-word',
          }}
        >
          {name}
        </Box>
        {epitaph && (
          <Box
            sx={{
              position: 'relative',
              mt: `${unit * 0.5}px`,
              fontSize: unit * 0.62,
              fontStyle: 'italic',
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            {epitaph}
          </Box>
        )}
        {children && <Box sx={{ position: 'relative', mt: `${unit * 0.5}px` }}>{children}</Box>}
      </Box>

      {/* Grama na base */}
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: '-6%', bottom: -unit * 0.2, width: '112%', height: unit * 0.9 }}
        aria-hidden
      >
        <path
          d="M0 12 L3 4 L6 12 L9 2 L12 12 L16 5 L19 12 L23 3 L26 12 L30 6 L33 12 L37 2 L40 12 L44 5 L47 12 L51 3 L54 12 L58 6 L61 12 L65 2 L68 12 L72 5 L75 12 L79 3 L82 12 L86 6 L89 12 L93 3 L96 12 L100 5 L100 12 Z"
          fill="#2f4a22"
        />
      </svg>
    </Box>
  )
}
