import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { GRACE_MS, ranking } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { factById } from './content'
import { finalAwards, isDouble, type MmState } from './engine'
import { meta } from './meta'
import { MAX_LIE_CHARS, cleanLie, isTruth, lieKey, splitBlank } from './text'
import { myOutcome, names, people, secretOf, truthPoints, truthShownAt, vibrate } from './view'

/**
 * Celular da "Mentira Macabra": uma ação clara por tela. Escrever a mentira
 * (o celular recusa na hora a que for verdade), escolher a verdade entre as
 * opções (sem a própria mentira) e, na revelação, o resumo da minha rodada —
 * só depois que a TV mostra a verdade, para não estragar o suspense.
 */

const ACCENT = meta.accent
const TRUTH_GREEN = '#4ade80'

export default function Phone(props: HalloweenViewProps<MmState>) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  // A key zera o rascunho a cada rodada.
  if (state.phase === 'write') return <WritePanel key={state.inputKey} {...props} />
  if (state.phase === 'choose') return <ChoosePanel {...props} />
  if (state.phase === 'reveal') return <RevealPanel {...props} />
  return <ScorePanel {...props} />
}

function Header({ state, now, grace }: { state: MmState; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
          RODADA {state.round}/{state.totalRounds}
        </Typography>
        {seconds !== null && (
          <Typography
            sx={{
              fontFamily: 'var(--font-numeric)',
              fontSize: '1.8rem',
              lineHeight: 1,
              color: grace && seconds <= 5 ? 'var(--blood, #e0213a)' : ACCENT.main,
            }}
          >
            ⏳ {seconds}
          </Typography>
        )}
      </Box>
      {isDouble(state) && (
        <Typography
          sx={{
            mt: 1,
            py: 0.5,
            textAlign: 'center',
            fontWeight: 900,
            borderRadius: 999,
            color: '#fff',
            background: 'var(--blood, #e0213a)',
          }}
        >
          💀 ÚLTIMA RODADA: VALE O DOBRO
        </Typography>
      )}
    </Box>
  )
}

/** O fato com a lacuna (ou, depois da revelação, com a verdade no lugar). */
function FactCard({ text, answer = null }: { text: string; answer?: string | null }) {
  const [before, after] = splitBlank(text)
  return (
    <Box
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${answer ? TRUTH_GREEN : ACCENT.main}`,
        background: 'rgba(255, 255, 255, 0.03)',
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
        {before}
        <Box
          component="span"
          sx={{
            px: 0.5,
            fontWeight: 900,
            color: answer ? TRUTH_GREEN : ACCENT.main,
            borderBottom: '3px solid currentColor',
            textTransform: answer ? 'uppercase' : 'none',
          }}
        >
          {answer ?? '???'}
        </Box>
        {after}
      </Typography>
    </Box>
  )
}

function Waiting({ state }: { state: MmState }) {
  return (
    <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
      ⏳ Esperando os outros ({state.acted.length}/{state.roster.length})
    </Typography>
  )
}

function WritePanel({ state, myInput, send, now }: HalloweenViewProps<MmState>) {
  const sent = typeof myInput?.lie === 'string' ? myInput.lie : null
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const text = cleanLie(draft)
    if (!text || !lieKey(text)) {
      setError('Escreva uma mentira com letras de verdade.')
      vibrate([60, 40, 60])
      return
    }
    // A mesma comparação tolerante do motor: a verdade (ou quase) não passa.
    if (isTruth(text, factById(state.fact.id))) {
      setError('Isso é verdade (ou quase)! 😱 Invente outra.')
      vibrate([90, 50, 90])
      return
    }
    setError(null)
    send({ lie: text })
    vibrate([25, 40, 25])
    setEditing(false)
  }

  if (sent && !editing) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <FactCard text={state.fact.text} />
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>🤥</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: ACCENT.main, lineHeight: 1.1, mt: 0.5 }}>
          Mentira enviada!
        </Typography>
        <Typography sx={{ mt: 1, fontWeight: 900, fontSize: '1.4rem', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
          “{sent}”
        </Typography>
        <Button
          variant="outlined"
          onClick={() => {
            setDraft(sent)
            setError(null)
            setEditing(true)
          }}
          sx={{
            mt: 2,
            minHeight: 52,
            px: 3,
            fontWeight: 800,
            textTransform: 'none',
            borderWidth: 2,
            borderColor: 'var(--border-medium)',
            color: 'var(--text-primary)',
            '&:hover': { borderWidth: 2 },
          }}
        >
          ✏️ Trocar mentira
        </Button>
        <Waiting state={state} />
      </Box>
    )
  }

  return (
    <Box>
      <Header state={state} now={now} grace />
      <FactCard text={state.fact.text} />
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', mb: 1 }}>Invente uma MENTIRA para a lacuna:</Typography>
      <TextField
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="Sua mentira…"
        autoComplete="off"
        fullWidth
        error={Boolean(error)}
        helperText={`${Array.from(draft).length}/${MAX_LIE_CHARS} · curtinha e com cara de verdade`}
        slotProps={{
          htmlInput: { maxLength: MAX_LIE_CHARS, enterKeyHint: 'send', autoCapitalize: 'sentences', 'aria-label': 'Sua mentira' },
        }}
        sx={{ '& .MuiInputBase-input': { fontSize: '1.25rem', py: 1.75 } }}
      />
      {error && (
        <Box
          className="animate-shake"
          role="alert"
          sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--blood, #e0213a)',
            background: 'rgba(224, 33, 58, 0.12)',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: '#fecaca' }}>{error}</Typography>
        </Box>
      )}
      <Button
        fullWidth
        variant="contained"
        disabled={!draft.trim()}
        onClick={submit}
        sx={{
          mt: 1.5,
          minHeight: 60,
          fontSize: '1.2rem',
          fontWeight: 900,
          textTransform: 'none',
          background: ACCENT.main,
          color: ACCENT.contrast,
          '&:hover': { background: ACCENT.light },
        }}
      >
        🤥 Enviar mentira
      </Button>
      {sent && (
        <Button fullWidth variant="text" onClick={() => setEditing(false)} sx={{ mt: 1, minHeight: 48, textTransform: 'none', color: 'var(--text-secondary)' }}>
          Manter “{sent}”
        </Button>
      )}
    </Box>
  )
}

function ChoosePanel({ state, mine, myInput, send, now }: HalloweenViewProps<MmState>) {
  const secret = secretOf(mine)
  const chosen = typeof myInput?.pick === 'number' ? myInput.pick : null
  // A própria mentira não aparece: não dá para votar nela.
  const options = state.options.filter((option) => option.id !== secret?.own)
  return (
    <Box>
      <Header state={state} now={now} grace />
      <FactCard text={state.fact.text} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: ACCENT.main, lineHeight: 1.1, mb: 1 }}>
        Qual é a VERDADE?
      </Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {options.map((option) => {
          const selected = chosen === option.id
          return (
            <Button
              key={option.id}
              variant={selected ? 'contained' : 'outlined'}
              onClick={() => {
                send({ pick: option.id })
                vibrate(20)
              }}
              sx={{
                minHeight: 56,
                px: 1.5,
                fontSize: '1.1rem',
                fontWeight: 800,
                lineHeight: 1.15,
                textTransform: 'uppercase',
                overflowWrap: 'anywhere',
                borderWidth: 2,
                borderColor: selected ? ACCENT.main : 'var(--border-medium)',
                color: selected ? ACCENT.contrast : 'var(--text-primary)',
                background: selected ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
                '&:hover': { background: selected ? ACCENT.light : `${ACCENT.main}22`, borderWidth: 2 },
              }}
            >
              {selected ? '✓ ' : ''}
              {option.text}
            </Button>
          )
        })}
      </Box>
      {secret && (
        <Typography sx={{ mt: 1.5, color: 'var(--text-muted)', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>
          🤫 Sua mentira “{secret.lie}” está no meio — nessa você não vota.
        </Typography>
      )}
      {chosen !== null ? (
        <>
          <Typography sx={{ mt: 1.5, textAlign: 'center', fontWeight: 800, color: ACCENT.main }}>
            ✓ Escolhido! Dá para trocar até o fim.
          </Typography>
          <Waiting state={state} />
        </>
      ) : (
        <Typography sx={{ mt: 1.5, textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Toque na opção que você acha que é verdade.
        </Typography>
      )}
    </Box>
  )
}

function RevealPanel({ state, me, players, now }: HalloweenViewProps<MmState>) {
  const t = useServerNow(now, 400)
  const reveal = state.reveal
  if (!reveal || !me) return null

  // Até o cartão da verdade virar na TV (depois do rufar), o celular não conta nada (suspense!).
  if (t < truthShownAt(reveal)) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} />
        <Typography className="animate-pulse" sx={{ fontSize: '4rem', lineHeight: 1, mt: 3 }}>
          👀
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1.1, mt: 1 }}>Olhe a TV!</Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1, fontSize: '1.1rem' }}>
          Mentira por mentira… a verdade vem por último.
        </Typography>
      </Box>
    )
  }

  const { picked, mine, gain } = myOutcome(reveal, me.id)
  const truth = reveal.steps[reveal.steps.length - 1]
  let pickLine = '😴 Você não escolheu nada.'
  if (picked?.kind === 'truth') pickLine = `🎯 Você achou a verdade! +${truthPoints(reveal)}`
  else if (picked?.kind === 'house') pickLine = '🤡 Você caiu na mentira da casa!'
  else if (picked) pickLine = `🤡 Você caiu na mentira de ${names(players, picked.authors)}!`
  let lieLine = 'Você não mentiu nesta rodada.'
  if (mine && mine.pickers.length) lieLine = `🤥 Sua mentira enganou ${people(mine.pickers.length)}: +${mine.gain}`
  else if (mine) lieLine = '😢 Sua mentira não enganou ninguém.'

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <FactCard text={state.fact.text} answer={truth?.text ?? null} />
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${picked?.kind === 'truth' ? TRUTH_GREEN : 'var(--border-medium)'}` }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{pickLine}</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${mine?.gain ? ACCENT.main : 'var(--border-medium)'}` }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{lieLine}</Typography>
        </Box>
      </Box>
      <Typography sx={{ mt: 2, fontFamily: 'var(--font-numeric)', fontSize: '3rem', lineHeight: 1, color: gain ? ACCENT.main : 'var(--text-muted)' }}>
        +{gain}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)' }}>nesta rodada</Typography>
    </Box>
  )
}

function ScorePanel({ state, players, me, now }: HalloweenViewProps<MmState>) {
  if (!me) return null
  const order = ranking(state.scores, state.roster)
  const mine = order.find((entry) => entry.id === me.id)
  // Ninguém pontuou ainda: não dá para dizer que alguém "lidera".
  const leaders = order.filter((entry) => entry.place === 1 && entry.score > 0).map((entry) => entry.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem' }}>Placar</Typography>
      <Typography sx={{ fontSize: '4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main }}>{mine?.score ?? 0}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>{mine ? `${mine.place}º lugar` : 'fora do placar'}</Typography>
      <Typography sx={{ color: 'var(--text-muted)', mt: 2, overflowWrap: 'anywhere' }}>
        {leaders.length ? `Olhe a TV — ${names(players, leaders)} ${leaders.length > 1 ? 'lideram' : 'lidera'}.` : 'Olhe a TV!'}
      </Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: HalloweenViewProps<MmState>) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const award = (icon: string, title: string, ids: number[], detail: string) => (
    <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ids.includes(me.id) ? ACCENT.main : 'var(--border-medium)'}` }}>
      <Typography sx={{ color: 'var(--text-muted)' }}>
        {icon} {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', overflowWrap: 'anywhere' }}>
        {ids.length ? `${names(players, ids)} ${detail}` : 'Ninguém'}
      </Typography>
    </Box>
  )
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da noite</Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {mine.score} {mine.score === 1 ? 'ponto' : 'pontos'}
        </Typography>
      )}
      {award('🤥', 'Mestre da mentira', awards.liars, `(${people(awards.maxFooled)})`)}
      {award('🔍', 'Farejador da verdade', awards.sniffers, `(${awards.maxFound})`)}
      {award('🤡', 'Caiu em tudo', awards.suckers, `(${awards.maxFell})`)}
    </Box>
  )
}
