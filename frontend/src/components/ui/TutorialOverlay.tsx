import { useEffect, useRef, useState } from 'react'
import { Box, Button, IconButton, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { canNarrate, speak, stopNarration } from '../../lib/narrator'

type TutorialOverlayProps = {
  open: boolean
  title: string
  icon: string
  /** Frase de abertura, lida antes do primeiro passo. */
  pitch: string
  steps: string[]
  step: number
  accent: string
  /** Só o dispositivo que narra fala; os outros apenas mostram o texto. */
  narrate: boolean
  /** Quem controla o passo (o host). TV e celulares só acompanham. */
  controls?: {
    onNext: () => void
    onPrev: () => void
    onClose: () => void
  }
  /** Mostra tudo maior, para leitura a três metros. */
  big?: boolean
}

/**
 * Tutorial narrado do jogo. O texto vem do catálogo; a voz, do navegador.
 *
 * A TV narra; o host aperta "próximo" no celular. Assim a sala ouve uma voz
 * só e o ritmo fica na mão de quem conhece a mesa.
 */
export default function TutorialOverlay({
  open,
  title,
  icon,
  pitch,
  steps,
  step,
  accent,
  narrate,
  controls,
  big = false,
}: TutorialOverlayProps) {
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const cancelRef = useRef<() => void>(() => undefined)

  const clamped = Math.min(Math.max(step, 0), steps.length)
  // Passo 0 é a abertura; os seguintes são os passos do "como jogar".
  const text = clamped === 0 ? `${title}. ${pitch}` : steps[clamped - 1] ?? ''
  const isLast = clamped >= steps.length

  const shouldNarrate = open && narrate && !muted && canNarrate()

  // O estado "falando" so muda pelos callbacks da voz — o efeito em si nao
  // toca em estado, so dispara e cancela a fala.
  useEffect(() => {
    if (!shouldNarrate) {
      stopNarration()
      return
    }
    cancelRef.current = speak(text, {
      onStart: () => setSpeaking(true),
      onStop: () => setSpeaking(false),
    })
    return () => cancelRef.current()
  }, [shouldNarrate, text])

  const showSpeaking = speaking && shouldNarrate

  if (!open) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 55,
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, md: 4 },
        background: 'rgba(5, 5, 9, 0.86)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 260ms ease both',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: big ? 1100 : 720,
          borderRadius: 'var(--radius-xl)',
          border: `1px solid ${accent}`,
          background: 'linear-gradient(165deg, rgba(26,26,36,0.97), rgba(10,10,15,0.98))',
          boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 70px ${accent}44`,
          p: { xs: 3, md: big ? 6 : 4 },
          position: 'relative',
        }}
      >
        {/* Cabeçalho */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ fontSize: big ? '4rem' : '2.6rem', lineHeight: 1 }}>{icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.62rem',
                letterSpacing: '0.24em',
                fontWeight: 800,
                color: 'var(--text-muted)',
              }}
            >
              TUTORIAL · {clamped === 0 ? 'APRESENTAÇÃO' : `PASSO ${clamped} DE ${steps.length}`}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: big ? { xs: '2rem', md: '3.4rem' } : { xs: '1.7rem', md: '2.4rem' },
                lineHeight: 1.05,
                letterSpacing: '0.06em',
                color: accent,
              }}
            >
              {title}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {narrate && canNarrate() && (
              <IconButton
                onClick={() => setMuted((current) => !current)}
                aria-label={muted ? 'Ligar narração' : 'Silenciar narração'}
                sx={{
                  color: muted ? 'var(--text-muted)' : accent,
                  animation: showSpeaking ? 'pulse 1.4s ease-in-out infinite' : undefined,
                }}
              >
                {muted ? <VolumeOffRoundedIcon /> : <VolumeUpRoundedIcon />}
              </IconButton>
            )}
            {controls && (
              <IconButton onClick={controls.onClose} aria-label="Fechar tutorial" sx={{ color: 'var(--text-muted)' }}>
                <CloseRoundedIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Texto do passo */}
        <Box
          key={clamped}
          className="animate-pop-in"
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 'var(--radius-lg)',
            background: `${accent}12`,
            border: `1px solid ${accent}33`,
            minHeight: big ? 180 : 120,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: big ? { xs: '1.5rem', md: '2.3rem' } : { xs: '1.15rem', md: '1.45rem' },
              lineHeight: 1.35,
              color: 'var(--text-primary)',
            }}
          >
            {text}
          </Typography>
        </Box>

        {/* Progresso */}
        <Box sx={{ display: 'flex', gap: 0.75, mt: 2.5, justifyContent: 'center' }}>
          {Array.from({ length: steps.length + 1 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                width: index === clamped ? 28 : 10,
                height: 10,
                borderRadius: 'var(--radius-full)',
                background: index <= clamped ? accent : 'rgba(255,255,255,0.12)',
                transition: 'all 260ms ease',
              }}
            />
          ))}
        </Box>

        {/* Controles — só quem conduz */}
        {controls ? (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3, justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              disabled={clamped === 0}
              onClick={controls.onPrev}
            >
              Anterior
            </Button>
            {isLast ? (
              <Button
                variant="contained"
                color="secondary"
                onClick={controls.onClose}
                sx={{ px: 4, backgroundImage: 'none', bgcolor: accent, color: '#0a0a0f' }}
              >
                Entendi, vamos jogar
              </Button>
            ) : (
              <Button
                variant="contained"
                color="secondary"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={controls.onNext}
                sx={{ px: 4, backgroundImage: 'none', bgcolor: accent, color: '#0a0a0f' }}
              >
                Próximo
              </Button>
            )}
          </Box>
        ) : (
          <Typography
            sx={{
              mt: 3,
              textAlign: 'center',
              fontSize: '0.75rem',
              letterSpacing: '0.16em',
              fontWeight: 700,
              color: 'var(--text-muted)',
            }}
          >
            O HOST CONDUZ O TUTORIAL PELO CELULAR
          </Typography>
        )}
      </Box>
    </Box>
  )
}
