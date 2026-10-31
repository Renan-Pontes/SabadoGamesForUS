import { useState } from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { withAlpha } from './surfaces'

type RoomCodeProps = {
  code: string
  /** `hero` é o tamanho da TV, para ler do outro lado da sala. */
  size?: 'sm' | 'md' | 'hero'
  accent?: string
  copyable?: boolean
  label?: string
}

const SIZES = {
  sm: { value: '1.45rem', label: '0.55rem', px: 1.5, py: 0.6 },
  md: { value: '2.3rem', label: '0.62rem', px: 2.5, py: 1 },
  // Pela altura também: TV de navegador costuma ter viewport baixinho.
  hero: { value: 'clamp(3.5rem, min(13vw, 17vh), 10rem)', label: 'clamp(0.85rem, 1.7vh, 1.25rem)', px: 4, py: 2 },
} as const

/** O código da sala, com botão de copiar. */
export default function RoomCode({
  code,
  size = 'md',
  accent = 'var(--accent-gold)',
  copyable = false,
  label = 'CÓDIGO DA SALA',
}: RoomCodeProps) {
  const [copied, setCopied] = useState(false)
  const dims = SIZES[size]

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code.toUpperCase())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard bloqueado (contexto inseguro): o código está na tela de todo jeito.
    }
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        px: dims.px,
        py: dims.py,
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${accent}`,
        background: `linear-gradient(150deg, ${withAlpha(accent, 0.16)}, rgba(12, 7, 22, 0.78))`,
        boxShadow: `0 0 34px ${withAlpha(accent, 0.18)}`,
      }}
    >
      <Box>
        <Typography
          sx={{
            fontSize: dims.label,
            letterSpacing: '0.28em',
            fontWeight: 800,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-numeric)',
            fontWeight: 400,
            fontSize: dims.value,
            lineHeight: 0.95,
            letterSpacing: size === 'hero' ? '0.14em' : '0.16em',
            color: accent,
            textShadow: `0 0 30px ${withAlpha(accent, 0.45)}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {code.toUpperCase()}
        </Typography>
      </Box>

      {copyable && (
        <Tooltip title={copied ? 'Copiado!' : 'Copiar código'}>
          <IconButton
            onClick={handleCopy}
            sx={{ color: copied ? 'var(--status-ready)' : accent }}
            aria-label="Copiar código da sala"
          >
            {copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
