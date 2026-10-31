import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { GRACE_MS } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { MAX_ANSWER_CHARS, answerLength, cleanAnswer, finalAwards, revealSeconds, type RdaState } from './engine'
import { meta } from './meta'
import { buzz, cardLetter, filledAfter, limitAnswer, namesOf, pointsLabel, promptParts, suspenseMs, votesLabel } from './view'

/**
 * Celular do "Resposta do Além": uma ação clara por tela. Na escrita, um
 * campo e um botão; na votação, uma lista de botões grandes (a própria
 * resposta aparece, mas não vale); depois, o que aconteceu comigo.
 */

const ACCENT = meta.accent

type Props = HalloweenViewProps<RdaState>

export default function Phone(props: Props) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  // A chave zera o rascunho a cada rodada (a tela não remonta sozinha).
  if (state.phase === 'write') return <WritePanel key={state.inputKey} {...props} />
  if (state.phase === 'vote') return <VotePanel {...props} />
  if (state.phase === 'reveal') return <RevealPanel {...props} />
  return <ScorePanel {...props} />
}

function Header({ state, now, grace }: { state: RdaState; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
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
  )
}

/** A frase com a lacuna — ou já preenchida com a resposta (prévia ao vivo). */
function PromptText({ text, fill, small = false }: { text: string; fill?: string; small?: boolean }) {
  const parts = promptParts(text)
  const before = parts.before
  // Resposta que já fecha com ponto não ganha outro ("…luz.." vira "…luz.").
  const after = fill ? filledAfter(parts.after, fill) : parts.after
  return (
    <Typography sx={{ fontWeight: 800, fontSize: small ? '1.1rem' : '1.3rem', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
      {before}
      {after !== null &&
        (fill ? (
          <Box component="span" sx={{ color: ACCENT.main }}>
            {fill}
          </Box>
        ) : (
          <Box
            component="span"
            sx={{ display: 'inline-block', width: '3em', height: '0.9em', mx: 0.5, borderBottom: `3px solid ${ACCENT.main}` }}
          />
        ))}
      {after}
    </Typography>
  )
}

function Waiting({ state, verb }: { state: RdaState; verb: string }) {
  return (
    <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
      Esperando os outros ({state.acted.length}/{state.roster.length} {verb})
    </Typography>
  )
}

const BIG_BUTTON = {
  minHeight: 60,
  fontSize: '1.25rem',
  fontWeight: 800,
  textTransform: 'none',
  background: ACCENT.main,
  color: ACCENT.contrast,
  '&:hover': { background: ACCENT.light },
} as const

function WritePanel({ state, myInput, send, now }: Props) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const sent = typeof myInput?.text === 'string' ? cleanAnswer(myInput.text) : ''
  const clean = cleanAnswer(draft)
  const length = answerLength(draft)
  // Já mandou e não está editando: mostra o que foi (o rascunho digitado
  // depois de recarregar a página não some).
  const showSent = Boolean(sent) && !editing && (draft === '' || clean === sent)

  const submit = () => {
    if (!clean) return
    send({ text: clean })
    buzz([20, 40, 20])
    setEditing(false)
  }

  if (showSent) {
    return (
      <Box>
        <Header state={state} now={now} grace />
        <PromptText text={state.prompt.text} fill={sent} />
        <Box sx={{ mt: 2, p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}`, textAlign: 'center' }}>
          <Typography sx={{ color: ACCENT.main, fontWeight: 800, fontSize: '1.2rem' }}>✓ Resposta enviada!</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', mt: 0.5, overflowWrap: 'anywhere' }}>“{sent}”</Typography>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={() => {
            setDraft(sent)
            setEditing(true)
          }}
          sx={{ mt: 1.5, minHeight: 52, fontWeight: 700, textTransform: 'none', fontSize: '1.05rem' }}
        >
          ✏️ Editar resposta
        </Button>
        <Waiting state={state} verb="responderam" />
      </Box>
    )
  }

  return (
    <Box>
      <Header state={state} now={now} grace />
      <PromptText text={state.prompt.text} fill={clean || undefined} />
      <TextField
        fullWidth
        multiline
        minRows={2}
        maxRows={4}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(limitAnswer(event.target.value))}
        onKeyDown={(event) => {
          // Enter envia (a resposta é uma linha só); o teclado mostra "Enviar".
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="Sua resposta mais engraçada…"
        autoComplete="off"
        // Sem maiúscula automática: a resposta completa a frase no meio ("…quando alguém esquece…").
        slotProps={{ htmlInput: { enterKeyHint: 'send', autoCapitalize: 'none', 'aria-label': 'Sua resposta' } }}
        sx={{ mt: 2, '& .MuiInputBase-input': { fontSize: '1.2rem', fontWeight: 600 } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <span>Anônima até a revelação 🤫</span>
        <Box component="span" sx={{ color: length >= MAX_ANSWER_CHARS - 5 ? 'var(--blood, #e0213a)' : undefined, fontWeight: 700 }}>
          {length}/{MAX_ANSWER_CHARS}
        </Box>
      </Box>
      <Button fullWidth variant="contained" disabled={!clean} onClick={submit} sx={{ ...BIG_BUTTON, mt: 1.5 }}>
        {sent ? '💾 Trocar resposta' : '👻 Enviar'}
      </Button>
      {sent ? (
        <Button
          fullWidth
          variant="text"
          color="inherit"
          onClick={() => {
            setDraft('')
            setEditing(false)
          }}
          sx={{ mt: 1, minHeight: 48, textTransform: 'none', color: 'var(--text-secondary)' }}
        >
          Cancelar (fica a resposta anterior)
        </Button>
      ) : (
        <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Complete a frase da TV. Vale emoji 👻
        </Typography>
      )}
    </Box>
  )
}

function VotePanel({ state, mine, myInput, send, now }: Props) {
  const myCard = typeof mine?.card === 'number' ? mine.card : null
  const chosen = typeof myInput?.card === 'number' ? myInput.card : null
  return (
    <Box>
      <Header state={state} now={now} grace />
      <PromptText text={state.prompt.text} small />
      <Typography sx={{ mt: 1.5, mb: 1.5, fontWeight: 700, color: chosen !== null ? ACCENT.main : 'var(--text-secondary)' }}>
        {chosen !== null ? `✓ Voto na ${cardLetter(chosen)}. Dá para trocar até o fim.` : 'Toque na resposta mais engraçada:'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {state.cards.map((card) => {
          const own = card.id === myCard
          const selected = card.id === chosen
          return (
            <Button
              key={card.id}
              disabled={own}
              variant={selected ? 'contained' : 'outlined'}
              onClick={() => {
                send({ card: card.id })
                buzz(25)
              }}
              sx={{
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: 1.25,
                minHeight: 60,
                py: 1.25,
                textAlign: 'left',
                textTransform: 'none',
                fontSize: '1.08rem',
                fontWeight: 700,
                lineHeight: 1.25,
                borderWidth: 2,
                borderColor: selected ? ACCENT.main : 'var(--border-medium)',
                color: selected ? ACCENT.contrast : 'var(--text-primary)',
                background: selected ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
                '&:hover': { background: selected ? ACCENT.light : `${ACCENT.main}22`, borderWidth: 2 },
                '&.Mui-disabled': { color: 'var(--text-muted)', borderColor: 'var(--border-medium)', borderStyle: 'dashed', opacity: 0.75 },
              }}
            >
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900,
                  background: selected ? ACCENT.contrast : ACCENT.main,
                  color: selected ? ACCENT.main : ACCENT.contrast,
                  opacity: own ? 0.5 : 1,
                }}
              >
                {cardLetter(card.id)}
              </Box>
              <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {card.text}
                {own && (
                  <Box component="span" sx={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, mt: 0.25 }}>
                    ✍️ sua resposta — não vale votar nela
                  </Box>
                )}
              </Box>
            </Button>
          )
        })}
      </Box>
      {state.cards.length === 0 && (
        <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nada para votar agora. Olhe a TV!</Typography>
      )}
      {/* Embaixo da lista: com 15 respostas, quem votou lá no fim não vê o topo da tela. */}
      {chosen !== null && <Waiting state={state} verb="votaram" />}
    </Box>
  )
}

function RevealPanel({ state, players, me, now }: Props) {
  const current = useServerNow(now)
  const reveal = state.reveal
  if (!reveal || !me) return null

  // Enquanto a TV rufa os tambores, o celular não entrega o resultado.
  const startedAt = (state.deadline ?? 0) - revealSeconds(reveal) * 1000
  if (current < startedAt + suspenseMs(reveal.kind)) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} />
        <Typography className="hw-pulse" sx={{ fontSize: '4rem', lineHeight: 1, mt: 3 }}>
          🥁
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.1, mt: 2 }}>Olhe a TV!</Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>
          {reveal.kind === 'empty' ? 'O além vai responder…' : 'E a mais votada é…'}
        </Typography>
      </Box>
    )
  }

  if (reveal.kind === 'empty') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} />
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>👻</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.1, mt: 1 }}>Ninguém respondeu…</Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>então o além respondeu por vocês:</Typography>
        {reveal.alem && (
          <Typography sx={{ mt: 1.5, fontWeight: 800, fontSize: '1.3rem', color: ACCENT.main, overflowWrap: 'anywhere' }}>
            “{reveal.alem}”
          </Typography>
        )}
        <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>Sem pontos. Escreva na próxima!</Typography>
      </Box>
    )
  }

  const mineResult = reveal.results.find((result) => result.authors.includes(me.id))
  const myVote = reveal.votes[String(me.id)]
  const voted = myVote === undefined ? undefined : reveal.results.find((result) => result.card === myVote)
  const gained = reveal.gained[String(me.id)] ?? 0
  const solo = reveal.kind === 'solo'
  const tied = reveal.results.filter((result) => result.top).length > 1
  const soloAuthors = reveal.results[0]?.authors ?? []

  const icon = mineResult?.top ? '🏆' : gained > 0 ? '😂' : mineResult ? '🫣' : '👀'
  const title = mineResult
    ? solo
      ? 'Vitória por W.O.!'
      : mineResult.top
        ? tied
          ? 'Empatou entre as mais votadas!'
          : 'A sua foi a mais votada!'
        : `Sua resposta levou ${votesLabel(mineResult.voters.length)}`
    : solo
      ? `Só ${namesOf(players, soloAuthors)} ${soloAuthors.length > 1 ? 'responderam (igual!)' : 'respondeu'}`
      : 'Você não respondeu'

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>{icon}</Typography>
      <Typography
        sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.1, mt: 1, color: mineResult?.top ? ACCENT.main : 'var(--text-primary)' }}
      >
        {title}
      </Typography>
      {mineResult && (
        <Typography sx={{ mt: 1, fontStyle: 'italic', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>“{mineResult.text}”</Typography>
      )}
      {gained > 0 && (
        <Typography sx={{ mt: 1, color: ACCENT.main, fontWeight: 900, fontSize: '1.6rem' }}>+{pointsLabel(gained)}</Typography>
      )}
      {solo && !mineResult && reveal.results[0] && (
        <Typography sx={{ mt: 1, fontWeight: 700, overflowWrap: 'anywhere' }}>“{reveal.results[0].text}” — vitória por W.O.</Typography>
      )}
      {!solo && (
        <Box sx={{ mt: 3, p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
          {voted ? (
            <>
              <Typography sx={{ color: 'var(--text-muted)' }}>Você votou em</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>“{voted.text}”</Typography>
              <Typography sx={{ color: ACCENT.main, fontWeight: 700 }}>de {namesOf(players, voted.authors)}</Typography>
            </>
          ) : (
            <Typography sx={{ fontWeight: 700 }}>Você não votou 😴</Typography>
          )}
        </Box>
      )}
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>Olhe a TV 📺</Typography>
    </Box>
  )
}

function ScorePanel({ state, players, me, now }: Props) {
  if (!me) return null
  const { ranking } = finalAwards(state)
  const mine = ranking.find((entry) => entry.id === me.id)
  const gained = state.reveal?.gained[String(me.id)] ?? 0
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem' }}>Placar</Typography>
      <Typography sx={{ fontSize: '4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main }}>{mine?.score ?? 0}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>
        {mine ? `${mine.place}º lugar` : 'fora do placar'}
        {gained > 0 ? ` · +${gained} nesta rodada` : ''}
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>
        Olhe a TV — {leaderText(ranking, players)}
      </Typography>
    </Box>
  )
}

function leaderText(ranking: { id: number; score: number; place: number }[], players: HPlayer[]) {
  const leaders = ranking.filter((entry) => entry.place === 1 && entry.score > 0).map((entry) => entry.id)
  if (!leaders.length) return 'ninguém pontuou ainda.'
  return `${namesOf(players, leaders)} ${leaders.length > 1 ? 'lideram' : 'lidera'}.`
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const best = awards.bestAnswer
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da noite</Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {pointsLabel(mine.score)}
        </Typography>
      )}
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>🏆 Alma mais engraçada</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém'}
        </Typography>
      </Box>
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>💬 Resposta da noite</Typography>
        {best ? (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', overflowWrap: 'anywhere' }}>“{best.text}”</Typography>
            <Typography sx={{ color: 'var(--text-secondary)' }}>
              {namesOf(players, best.authors)} · {votesLabel(best.votes)}
            </Typography>
          </>
        ) : (
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>Nenhuma levou voto</Typography>
        )}
      </Box>
    </Box>
  )
}
