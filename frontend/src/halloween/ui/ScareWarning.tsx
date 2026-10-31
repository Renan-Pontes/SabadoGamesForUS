import { useEffect, useRef } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { getSoundState, playSfx, setMuted, unlockAudio } from '../audio'
import { acceptScareWarning, useScareConsent } from '../scare/level'
import { BLOODY_FONT, CREEPY_FONT } from './fonts'
import './spooky.css'

/** Quem não deve encarar o modo pesadelo. */
const RISK_GROUPS: { icon: string; text: string }[] = [
  { icon: '❤️', text: 'Cardíacos, quem tem pressão alta, arritmia ou usa marca-passo' },
  { icon: '🤰', text: 'Gestantes' },
  { icon: '⚡', text: 'Pessoas com epilepsia ou sensibilidade a luz' },
  { icon: '😰', text: 'Quem tem crises de ansiedade, pânico ou fobia' },
  { icon: '🧒', text: 'Crianças pequenas' },
]

/** O que a pessoa vai encontrar. */
const WHAT_HAPPENS: string[] = [
  'Gritos MUITO altos de repente — saem altos mesmo com o volume do site baixo.',
  'Criaturas pulando na tela sem aviso, a qualquer momento da noite.',
  'Escuro e silêncio de propósito antes do pior.',
  'Às vezes, quando você acha que acabou... não acabou.',
]

/**
 * O aviso da entrada: aparece uma vez por aparelho, por cima de tudo, antes
 * de qualquer susto. O site é da mesa de amigos e é sempre pesadelo — o
 * aviso existe para quem cair aqui por acaso. "Entendi" libera os sustos (e
 * é o gesto que destrava o som); "sair" leva para fora do site.
 */
export default function ScareWarning() {
  const consent = useScareConsent()
  const primary = useRef<HTMLButtonElement>(null)
  const open = consent === null

  useEffect(() => {
    if (!open) return
    primary.current?.focus({ preventScroll: true })
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const enter = () => {
    unlockAudio()
    // No celular, liga o som: os sustos dos momentos importantes também
    // gritam na mão de quem joga (dá para calar no botãozinho do canto).
    if (getSoundState().role === 'phone') setMuted(false)
    acceptScareWarning()
    // O coração bate uma vez: bem-vindo.
    window.setTimeout(() => playSfx('heartbeat', { volume: 0.8 }), 120)
  }

  const leave = () => {
    window.location.replace('about:blank')
  }

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="hw-warning-title"
      aria-describedby="hw-warning-body"
      className="hw-warning"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        overflowY: 'auto',
        background: 'radial-gradient(ellipse at 50% 22%, #3a060c 0%, #12020a 55%, #000 100%)',
        color: '#f5f0e1',
      }}
    >
      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, py: { xs: 4, md: 6 }, textAlign: 'center' }}>
        <Box className="hw-warning-heart" aria-hidden sx={{ fontSize: { xs: 64, md: 84 }, lineHeight: 1 }}>
          ❤️
        </Box>
        <Typography
          id="hw-warning-title"
          component="h1"
          sx={{
            fontFamily: BLOODY_FONT,
            fontSize: { xs: '2.6rem', md: '3.6rem' },
            color: '#e0213a',
            lineHeight: 1.1,
            mt: 1.5,
            textShadow: '0 0 24px rgba(224, 33, 58, 0.45)',
          }}
        >
          AVISO
        </Typography>
        <Typography sx={{ fontFamily: CREEPY_FONT, fontSize: { xs: '1.5rem', md: '1.9rem' }, color: '#ffc94a' }}>
          Leia antes de entrar na Noite do Terror
        </Typography>

        <Typography id="hw-warning-body" sx={{ mt: 2, fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.55 }}>
          Este site tem <b>sustos repentinos de verdade</b>, feitos para fazer a sala inteira pular do sofá.
        </Typography>

        <Box
          component="ul"
          sx={{
            textAlign: 'left',
            listStyle: 'none',
            p: 0,
            mx: 'auto',
            mt: 2,
            mb: 0,
            maxWidth: 560,
            display: 'grid',
            gap: 0.75,
          }}
        >
          {WHAT_HAPPENS.map((text) => (
            <Box component="li" key={text} sx={{ display: 'flex', gap: 1, color: 'rgba(245, 240, 225, 0.88)' }}>
              <span aria-hidden>💀</span>
              <span>{text}</span>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            mt: 3,
            p: { xs: 2, md: 2.5 },
            textAlign: 'left',
            borderRadius: 3,
            border: '2px solid rgba(224, 33, 58, 0.75)',
            background: 'rgba(70, 6, 14, 0.55)',
            boxShadow: '0 0 32px rgba(224, 33, 58, 0.18) inset',
          }}
        >
          <Typography sx={{ fontWeight: 800, color: '#ff6b7d', letterSpacing: '0.04em', mb: 1 }}>
            ⚠️ NÃO RECOMENDADO PARA:
          </Typography>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.75 }}>
            {RISK_GROUPS.map(({ icon, text }) => (
              <Box component="li" key={text} sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline' }}>
                <span aria-hidden>{icon}</span>
                <span>{text}</span>
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: 1.5, fontSize: '0.92rem', color: 'rgba(245, 240, 225, 0.8)' }}>
            Se você se encaixa em algum desses, <b>não entre</b>. Aqui não tem versão leve: é pesadelo do começo
            ao fim.
          </Typography>
        </Box>

        <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
          <Button
            ref={primary}
            fullWidth
            size="large"
            variant="contained"
            onClick={enter}
            sx={{
              py: 1.7,
              fontWeight: 900,
              fontSize: '1.1rem',
              color: '#fff',
              background: 'linear-gradient(135deg, #b3122a, #5c0614)',
              border: '1px solid rgba(255, 107, 125, 0.6)',
              boxShadow: '0 10px 30px rgba(179, 18, 42, 0.45)',
              '&:hover': { background: 'linear-gradient(135deg, #d0152f, #6e0718)' },
            }}
          >
            💀 Entendi — quero entrar
          </Button>
          <Button
            onClick={leave}
            sx={{ color: 'rgba(245, 240, 225, 0.7)', fontWeight: 700, textTransform: 'none' }}
          >
            Não é para mim — sair do site
          </Button>
        </Box>

        <Typography sx={{ mt: 2.5, fontSize: '0.8rem', lineHeight: 1.5, color: 'rgba(245, 240, 225, 0.6)' }}>
          Ao entrar, você confirma que leu este aviso e que não se encaixa nos grupos acima. As imagens não piscam
          em sequência (nada de estrobo), mas a tela vai do claro ao escuro de repente. Este aviso aparece uma vez
          por aparelho.
        </Typography>
      </Box>
    </Box>
  )
}
