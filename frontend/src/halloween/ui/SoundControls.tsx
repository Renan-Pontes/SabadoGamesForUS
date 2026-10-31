import { Box, IconButton } from '@mui/material'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import { playSfx, toggleMuted, useSoundState } from '../audio'
import { useInlineSoundToggleCount, useRegisterInlineSoundToggle } from './soundButtons'
import './spooky.css'

type SoundToggleProps = {
  /** Diâmetro em px. */
  size?: number
}

/**
 * Botão de som para pôr no cabeçalho de uma tela (celular). Enquanto ele
 * estiver na tela, o botão flutuante da camada global some.
 *
 *   <SoundToggle />
 */
export function SoundToggle({ size = 40 }: SoundToggleProps) {
  const sound = useSoundState()
  useRegisterInlineSoundToggle()
  if (!sound.supported) return null

  return (
    <IconButton
      aria-label={sound.muted ? 'Ligar o som' : 'Desligar o som'}
      aria-pressed={!sound.muted}
      onClick={() => {
        // O clique é o gesto que o navegador exige: ligar aqui já destrava o áudio.
        const wasMuted = sound.muted
        toggleMuted()
        if (wasMuted) window.setTimeout(() => playSfx('pop', { volume: 0.6 }), 60)
      }}
      sx={{
        width: size,
        height: size,
        color: sound.muted ? 'var(--text-muted)' : '#ff7a18',
        background: 'rgba(12, 6, 20, 0.7)',
        border: `1px solid ${sound.muted ? 'rgba(255,255,255,0.14)' : 'rgba(255, 122, 24, 0.55)'}`,
        '&:hover': { background: 'rgba(12, 6, 20, 0.92)' },
      }}
    >
      {sound.muted ? <VolumeOffRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
    </IconButton>
  )
}

/**
 * Botãozinho flutuante de som dos celulares (canto inferior esquerdo,
 * pequeno e translúcido). Some se a tela tiver um SoundToggle próprio.
 */
export function PhoneSoundButton() {
  const sound = useSoundState()
  const inline = useInlineSoundToggleCount()
  if (inline > 0 || !sound.supported) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 10,
        bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        zIndex: 1250,
        opacity: sound.muted ? 0.55 : 0.85,
        transition: 'opacity 200ms ease',
        '&:hover, &:focus-within': { opacity: 1 },
      }}
    >
      <FloatingToggle muted={sound.muted} />
    </Box>
  )
}

function FloatingToggle({ muted }: { muted: boolean }) {
  return (
    <IconButton
      aria-label={muted ? 'Ligar o som' : 'Desligar o som'}
      aria-pressed={!muted}
      onClick={() => {
        toggleMuted()
        if (muted) window.setTimeout(() => playSfx('pop', { volume: 0.6 }), 60)
      }}
      sx={{
        width: 38,
        height: 38,
        color: muted ? 'rgba(245,245,245,0.75)' : '#ff7a18',
        background: 'rgba(12, 6, 20, 0.78)',
        border: `1px solid ${muted ? 'rgba(255,255,255,0.18)' : 'rgba(255, 122, 24, 0.6)'}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        '&:hover': { background: 'rgba(12, 6, 20, 0.95)' },
      }}
    >
      {muted ? <VolumeOffRoundedIcon sx={{ fontSize: 20 }} /> : <VolumeUpRoundedIcon sx={{ fontSize: 20 }} />}
    </IconButton>
  )
}

/**
 * Aviso da TV enquanto o navegador segura o som: "Clique para acordar os
 * mortos". Qualquer clique/tecla em qualquer lugar destrava; o aviso some.
 * Fica no alto, no centro: embaixo a TV mostra quem já entrou na sala.
 */
export function AudioUnlockPrompt() {
  const sound = useSoundState()
  if (!sound.supported || sound.unlocked || sound.muted) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 'max(14px, 2vh)',
        zIndex: 1260,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Box
        className="hw-breathe"
        role="status"
        sx={{
          pointerEvents: 'auto',
          cursor: 'pointer',
          px: 3,
          py: 1.25,
          borderRadius: 999,
          fontSize: { xs: '1rem', md: '1.35rem' },
          fontWeight: 800,
          color: '#fff7ed',
          background: 'linear-gradient(135deg, rgba(194, 65, 12, 0.92), rgba(88, 28, 135, 0.92))',
          border: '1px solid rgba(255, 122, 24, 0.7)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 24px rgba(255, 122, 24, 0.35)',
        }}
      >
        🔊 Clique para acordar os mortos
      </Box>
    </Box>
  )
}
