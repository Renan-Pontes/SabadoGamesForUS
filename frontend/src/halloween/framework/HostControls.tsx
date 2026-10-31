import { useState, type ReactNode } from 'react'
import { Box, Button } from '@mui/material'
import type { GameAccent } from '../../games/theme'

/**
 * Controles do host, numa barra discreta presa ao rodapé do celular. O jogo
 * nunca depende deles (todo prazo anda sozinho) — são atalhos para a mesa.
 */

function Bar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: 'flex',
        gap: 1,
        justifyContent: 'center',
        // À esquerda fica o botão de som da camada global (38 px fixo no canto).
        pl: 'calc(56px + env(safe-area-inset-left, 0px))',
        pr: 1.5,
        pt: 1,
        pb: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(180deg, transparent, rgba(10, 6, 18, 0.92) 30%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {children}
    </Box>
  )
}

const barButton = {
  flex: '1 1 0',
  minWidth: 0,
  maxWidth: 170,
  minHeight: 48,
  px: 0.75,
  fontWeight: 700,
  fontSize: '0.85rem',
  textTransform: 'none',
  borderColor: 'var(--border-medium)',
  color: 'var(--text-primary)',
  background: 'rgba(37, 22, 64, 0.85)',
  whiteSpace: 'nowrap',
} as const

/** Durante a partida: pular a fase, encerrar (com confirmação) e susto na TV. */
export function HostBar({
  onSkip,
  onEnd,
  onScare,
}: {
  onSkip: () => void
  onEnd: () => void
  onScare: () => Promise<unknown> | void
}) {
  const [confirming, setConfirming] = useState(false)
  const [skipLocked, setSkipLocked] = useState(false)
  const [scareState, setScareState] = useState<'idle' | 'sent' | 'error'>('idle')

  if (confirming) {
    return (
      <Bar>
        <Button
          variant="contained"
          color="error"
          sx={{ ...barButton, background: 'var(--blood, #e0213a)' }}
          onClick={() => {
            setConfirming(false)
            onEnd()
          }}
        >
          ⏹ Encerrar mesmo
        </Button>
        <Button variant="outlined" sx={barButton} onClick={() => setConfirming(false)}>
          Voltar
        </Button>
      </Bar>
    )
  }

  return (
    <Bar>
      <Button
        variant="outlined"
        sx={barButton}
        disabled={skipLocked}
        onClick={() => {
          // Um toque = um pulo: trava por um instante contra o toque duplo.
          setSkipLocked(true)
          onSkip()
          setTimeout(() => setSkipLocked(false), 1500)
        }}
      >
        ⏭ Pular
      </Button>
      <Button variant="outlined" sx={barButton} onClick={() => setConfirming(true)}>
        ⏹ Encerrar
      </Button>
      <Button
        variant="outlined"
        sx={barButton}
        disabled={scareState === 'sent'}
        onClick={() => {
          setScareState('sent')
          Promise.resolve(onScare())
            .then(() => setTimeout(() => setScareState('idle'), 3000))
            .catch(() => {
              setScareState('error')
              setTimeout(() => setScareState('idle'), 2500)
            })
        }}
      >
        {scareState === 'sent' ? '😱 Foi!' : scareState === 'error' ? '😶 Falhou' : '😱 Susto'}
      </Button>
    </Bar>
  )
}

/** Fim da partida: jogar de novo (mesmas opções) ou voltar à sala. */
export function EndBar({
  onReplay,
  onBackToRoom,
  accent,
}: {
  onReplay: () => void
  onBackToRoom: () => void
  accent: GameAccent
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Bar>
      <Button
        variant="contained"
        disabled={busy}
        sx={{ ...barButton, maxWidth: 220, background: accent.main, color: accent.contrast, '&:hover': { background: accent.light } }}
        onClick={() => {
          setBusy(true)
          onReplay()
          setTimeout(() => setBusy(false), 3000)
        }}
      >
        🔁 Jogar de novo
      </Button>
      <Button
        variant="outlined"
        disabled={busy}
        sx={{ ...barButton, maxWidth: 220 }}
        onClick={() => {
          setBusy(true)
          onBackToRoom()
          setTimeout(() => setBusy(false), 4000)
        }}
      >
        🚪 Voltar à sala
      </Button>
    </Bar>
  )
}
