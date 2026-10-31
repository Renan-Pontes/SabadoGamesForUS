import { useState } from 'react'
import { Box, Button, FormControlLabel, IconButton, Popover, Slider, Switch, Typography } from '@mui/material'
import { setMuted, setMusicEnabled, setRandomScaresEnabled, setVolume, useSoundState } from '../audio'
import { RARE_SCARE, SCARY_RANDOM, triggerScare } from '../scare'
import { CREEPY_FONT } from '../ui/fonts'

/**
 * Controle discreto no canto da TV: um fantasminha quase transparente que,
 * clicado, abre som, volume, música, sustos aleatórios e "testar susto".
 * Ninguém aperta botão na TV — mas quem está no notebook precisa poder.
 */
export default function TvControl() {
  const sound = useSoundState()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = Boolean(anchor)

  return (
    <>
      <IconButton
        aria-label="Som e sustos da TV"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          zIndex: 1250,
          width: 46,
          height: 46,
          fontSize: 22,
          opacity: open ? 1 : 0.3,
          background: 'rgba(12, 6, 20, 0.6)',
          border: '1px solid rgba(255, 122, 24, 0.35)',
          transition: 'opacity 200ms ease',
          '&:hover, &:focus-visible': { opacity: 1, background: 'rgba(12, 6, 20, 0.92)' },
        }}
      >
        <span aria-hidden>{sound.muted ? '🔇' : '👻'}</span>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mb: 1,
              p: 2.5,
              width: 300,
              borderRadius: 3,
              background: 'linear-gradient(165deg, rgba(30, 16, 44, 0.98), rgba(10, 6, 16, 0.98))',
              border: '1px solid rgba(255, 122, 24, 0.35)',
            },
          },
        }}
      >
        <Typography sx={{ fontFamily: CREEPY_FONT, fontSize: '1.6rem', color: '#ff7a18', lineHeight: 1.1, mb: 1 }}>
          Assombração da TV
        </Typography>

        {!sound.supported && (
          <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mb: 1 }}>
            Este navegador não tem som. Os sustos aparecem mudos. 😢
          </Typography>
        )}
        {sound.supported && !sound.unlocked && !sound.muted && (
          <Typography sx={{ color: '#fbbf24', fontSize: '0.9rem', mb: 1 }}>
            O navegador segurou o som: clique em qualquer lugar para acordar os mortos.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={<Switch checked={!sound.muted} onChange={(_, checked) => setMuted(!checked)} />}
            label="Som"
          />
          <Box sx={{ px: 1, pb: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
              VOLUME
            </Typography>
            <Slider
              aria-label="Volume"
              value={Math.round(sound.volume * 100)}
              onChange={(_, value) => setVolume((Array.isArray(value) ? value[0] : value) / 100)}
              disabled={sound.muted}
              min={0}
              max={100}
              size="small"
              sx={{ color: '#ff7a18' }}
            />
          </Box>
          <FormControlLabel
            control={<Switch checked={sound.music} onChange={(_, checked) => setMusicEnabled(checked)} />}
            label="Música"
          />
          <FormControlLabel
            control={
              <Switch checked={sound.randomScares} onChange={(_, checked) => setRandomScaresEnabled(checked)} />
            }
            label="Sustos aleatórios (3–6 min + o raro) 💀"
          />
        </Box>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 1.5 }}
          onClick={() => {
            setAnchor(null)
            // Um dos assustadores de verdade (animatrônico, rosto, grito, estática).
            triggerScare(SCARY_RANDOM)
          }}
        >
          Testar susto 😱
        </Button>
        <Button
          fullWidth
          size="small"
          sx={{ mt: 1, color: 'var(--text-secondary)' }}
          onClick={() => {
            setAnchor(null)
            triggerScare(RARE_SCARE)
          }}
        >
          Testar o susto raro 👹 (1 em 5000/s)
        </Button>
      </Popover>
    </>
  )
}
