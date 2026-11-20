import { useEffect, useState } from 'react'
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import {
  currentVoiceName,
  hasChosenVoice,
  hasGoodVoice,
  onVoicesChanged,
  portugueseVoices,
  setPreferredVoice,
  speak,
  type VoiceChoice,
  type VoiceQuality,
} from '../../lib/narrator'

const QUALITY_LABEL: Record<VoiceQuality, string> = {
  otima: '⭐ ótima',
  boa: '👍 boa',
  robotica: '🤖 robótica',
}

const AUTO = '__auto__'

/**
 * Escolha da voz da narração, no controle do canto da TV.
 *
 * Cada TV tem vozes diferentes (o Edge traz as neurais "Natural", que soam
 * como gente; o Chrome tem a do Google; o resto costuma ser robótico). Aqui
 * dá para ver a lista, testar e fixar a melhor. Sem voz boa e sem escolha, a
 * narração fica quieta e o aviso sugere abrir a TV no Edge.
 */
export default function VoicePicker() {
  const [voices, setVoices] = useState<VoiceChoice[]>(() => portugueseVoices())
  const [chosen, setChosen] = useState<string>(() => (hasChosenVoice() ? currentVoiceName() ?? AUTO : AUTO))

  // O Chrome entrega a lista de vozes depois do primeiro desenho.
  useEffect(() => onVoicesChanged(() => setVoices(portugueseVoices())), [])

  const choose = (value: string) => {
    setChosen(value)
    setPreferredVoice(value === AUTO ? null : value)
  }

  const test = () => {
    // Direto pelo narrador: o teste fala mesmo com voz robótica (é para ouvir antes de escolher).
    speak('Oi, gente! Essa é a voz que vai narrar os jogos de Natal.')
  }

  const auto = voices[0]
  const good = hasGoodVoice()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        select
        size="small"
        label="Voz da narração"
        value={voices.some((voice) => voice.name === chosen) ? chosen : AUTO}
        onChange={(event) => choose(event.target.value)}
      >
        <MenuItem value={AUTO}>
          Automática{auto ? ` (${shortName(auto.name)} · ${QUALITY_LABEL[auto.quality]})` : ''}
        </MenuItem>
        {voices.map((voice) => (
          <MenuItem key={voice.name} value={voice.name}>
            {shortName(voice.name)} · {QUALITY_LABEL[voice.quality]}
          </MenuItem>
        ))}
      </TextField>
      <Button size="small" variant="outlined" onClick={test} disabled={voices.length === 0}>
        🔊 Testar voz
      </Button>
      {!good && (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--status-waiting)', lineHeight: 1.35 }}>
          Esta TV só tem voz robótica, então a narração fica quieta. Abra a TV no{' '}
          <b>Microsoft Edge</b> para ter a voz natural — ou escolha uma voz aqui mesmo assim.
        </Typography>
      )}
    </Box>
  )
}

/** "Microsoft Francisca Online (Natural) - Portuguese (Brazil)" → "Francisca". */
function shortName(name: string): string {
  const match = /(?:Microsoft|Google)\s+(\S+)/i.exec(name)
  if (match && !/^portugu/i.test(match[1])) return match[1]
  if (/google/i.test(name)) return 'Google'
  return name.replace(/\s*-\s*Portuguese.*$/i, '').trim()
}
