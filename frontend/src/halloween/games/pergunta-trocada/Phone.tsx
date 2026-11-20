import { useState, type ReactNode } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { FESTIVE_ROUND_FONT, XMAS_COLORS, withAlpha } from '../../ui'
import { INK, XmasCard } from './Decor'
import { ANSWER_MAX, ANSWER_PHASES, asCard, cleanAnswer, finalAwards, type PtCard, type State } from './engine'
import { meta } from './meta'
import { answerText, buzz, gainOf, kindHint, myOutcome, namesOf, pointsLabel } from './view'

/**
 * Celular da "Pergunta Trocada" — a MÃO do jogador: a pergunta chega num
 * cartãozinho de Natal só seu, a resposta vai num campo grande e o voto em
 * botões grandes (com a resposta de cada um embaixo do nome). Uma ação
 * clara por tela, 360 px.
 *
 * O impostor NÃO sabe que é o impostor: o cartão dele é igualzinho. Só na
 * conversa, quando a pergunta de verdade aparece, o celular conta (no mesmo
 * lugar e do mesmo jeito para todo mundo, para ninguém descobrir de relance).
 */

const ACCENT = meta.accent
const RED = XMAS_COLORS.red
const GREEN = XMAS_COLORS.pine

type Props = HalloweenViewProps<State>

export default function Phone(props: Props) {
  const { state, me } = props
  if (!me) return null
  // "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo.
  if (state.over) return <FinalPanel {...props} />
  switch (state.phase) {
    case 'question':
      return <QuestionPanel key={state.inputKey} {...props} />
    case 'answers':
      return <AnswersPanel {...props} />
    case 'talk':
      return <TalkPanel {...props} />
    case 'vote':
      return <VotePanel {...props} />
    case 'result':
      return <ResultPanel {...props} />
    default:
      return <ScorePanel {...props} />
  }
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function Header({ state, now }: { state: State; now: () => number }) {
  const grace = ANSWER_PHASES.includes(state.phase)
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  const urgent = seconds !== null && seconds <= 5
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.9rem' }}>
        🎄 RODADA {state.round}/{state.totalRounds}
      </Typography>
      {seconds !== null && (
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.7rem', lineHeight: 1, color: urgent ? RED : ACCENT.main, flexShrink: 0 }}>
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

function Title({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.08, textAlign: 'center', color: color ?? 'var(--text-primary)', wordBreak: 'break-word' }}>
      {children}
    </Typography>
  )
}

function Note({ children, color }: { children: ReactNode; color?: string }) {
  return <Typography sx={{ mt: 1.5, textAlign: 'center', color: color ?? 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.35 }}>{children}</Typography>
}

/** Botão grande, cheio (ação principal) ou contornado. */
function BigButton({
  children,
  onClick,
  filled = false,
  color = ACCENT.main,
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  filled?: boolean
  color?: string
  disabled?: boolean
}) {
  return (
    <Button
      fullWidth
      variant={filled ? 'contained' : 'outlined'}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minHeight: 64,
        mt: 1.25,
        borderRadius: 'var(--radius-lg)',
        fontSize: '1.25rem',
        fontWeight: 800,
        textTransform: 'none',
        lineHeight: 1.15,
        borderWidth: 2,
        borderColor: color,
        color: filled ? (color === RED ? '#ffffff' : color === ACCENT.main ? ACCENT.contrast : '#1a1000') : 'var(--text-primary)',
        background: filled ? color : withAlpha(color, 0.08),
        boxShadow: filled ? `0 4px 0 ${withAlpha('#000000', 0.35)}, 0 0 18px ${withAlpha(color, 0.35)}` : 'none',
        '&:hover': { background: filled ? color : withAlpha(color, 0.2), borderWidth: 2, borderColor: color },
        '&.Mui-disabled': { color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'transparent' },
      }}
    >
      {children}
    </Button>
  )
}

/** A pergunta da pessoa num cartãozinho de Natal. */
function QuestionCard({ card, label = 'Sua pergunta · só você vê 🤫', children }: { card: PtCard | null; label?: string; children?: ReactNode }) {
  return (
    <XmasCard label={label} className="animate-deal-in" sx={{ fontSize: '0.85rem' }}>
      {card ? (
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.18, color: '#b0182c', mt: 0.75 }}>{card.question}</Typography>
      ) : (
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mt: 0.75, color: INK }}>Sua pergunta está chegando… 🛷</Typography>
      )}
      {children}
    </XmasCard>
  )
}

/** "Você respondeu: …" (papel creme pequeno). */
function MyAnswer({ text }: { text: string | null }) {
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 'var(--radius-lg)', border: `2px dashed ${withAlpha(ACCENT.main, 0.8)}`, textAlign: 'center' }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>Você respondeu</Typography>
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.15, wordBreak: 'break-word' }}>{text ?? '🤐 nada'}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function QuestionPanel({ state, mine, myInput, send, now }: Props) {
  const card = asCard(mine)
  const hint = kindHint(state.kind)
  const sent = cleanAnswer(myInput?.answer)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  if (sent !== null && !editing) {
    return (
      <Box>
        <Header state={state} now={now} />
        <QuestionCard card={card} />
        <MyAnswer text={sent} />
        <Note color={ACCENT.light}>
          ✓ Resposta enviada! Esperando a mesa ({state.acted.length}/{state.roster.length})
        </Note>
        <BigButton
          onClick={() => {
            setDraft(sent)
            setEditing(true)
          }}
        >
          ✏️ Mudar resposta
        </BigButton>
      </Box>
    )
  }

  const ready = cleanAnswer(draft)
  const submit = () => {
    if (!ready) return
    buzz(30)
    send({ answer: ready })
    setEditing(false)
  }
  return (
    <Box>
      <Header state={state} now={now} />
      <QuestionCard card={card}>
        <Typography sx={{ mt: 1, color: '#17703c', fontWeight: 800, fontSize: '0.95rem' }}>
          {hint.icon} {hint.label}
        </Typography>
      </QuestionCard>
      <TextField
        fullWidth
        autoFocus
        value={draft}
        placeholder={hint.placeholder}
        onChange={(event) => setDraft(event.target.value.slice(0, ANSWER_MAX))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        slotProps={{ htmlInput: { maxLength: ANSWER_MAX, autoComplete: 'off', enterKeyHint: 'send', inputMode: hint.inputMode, 'aria-label': 'Sua resposta' } }}
        sx={{ mt: 2, '& input': { fontSize: '1.5rem', fontWeight: 700, py: 2, textAlign: 'center' } }}
      />
      <BigButton filled disabled={!ready} onClick={submit}>
        🎁 Enviar resposta
      </BigButton>
      <Note>Responda curtinho e de verdade. A TV mostra tudo junto! 📺</Note>
    </Box>
  )
}

function AnswersPanel({ state, me, mine, now }: Props) {
  if (!me) return null
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      <Typography className="pt-bounce" sx={{ fontSize: '3.5rem', lineHeight: 1 }}>
        📺
      </Typography>
      <Title>Olhe a mesa!</Title>
      <Note>As respostas de todo mundo estão na TV. Alguma não combina? 🤔</Note>
      <Box sx={{ mt: 2, textAlign: 'left' }}>
        <QuestionCard card={asCard(mine)} />
      </Box>
      <MyAnswer text={answerText(state.answers, me.id)} />
    </Box>
  )
}

function TalkPanel({ state, me, mine, myInput, send, now }: Props) {
  if (!me) return null
  const card = asCard(mine)
  const real = state.realQuestion ?? ''
  const sentReady = myInput?.ready === true
  // Mesmo lugar, mesmo jeito para todo mundo: só o texto muda (nada de "alarme" vermelho para o vizinho ver).
  const verdict = !card
    ? 'Olhe a pergunta da mesa na TV.'
    : card.odd
      ? '🤫 A sua era OUTRA pergunta: você é o impostor! Disfarce e jogue a culpa em alguém.'
      : '✅ Igual à sua. Agora ache quem respondeu outra coisa!'
  return (
    <Box>
      <Header state={state} now={now} />
      <XmasCard label="A pergunta da mesa" sx={{ fontSize: '0.85rem' }}>
        <Typography className="pt-boing" sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.45rem', lineHeight: 1.18, color: '#b0182c', mt: 0.75 }}>
          {real}
        </Typography>
      </XmasCard>
      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 'var(--radius-lg)', background: withAlpha('#ffffff', 0.06), border: '2px solid var(--border-medium)' }}>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem' }}>A sua pergunta era</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25 }}>{card?.question ?? '—'}</Typography>
        <Typography sx={{ mt: 1, fontWeight: 800, color: ACCENT.light, lineHeight: 1.3 }}>{verdict}</Typography>
      </Box>
      {sentReady ? (
        <Note color={ACCENT.light}>
          ✓ Pronto para votar! Esperando a mesa ({state.acted.length}/{state.roster.length})
        </Note>
      ) : (
        <BigButton
          filled
          onClick={() => {
            buzz(20)
            send({ ready: true })
          }}
        >
          🗳️ Já sei! Bora votar
        </BigButton>
      )}
      <Note>Conversem em voz alta: por que você respondeu isso? 🗣️</Note>
    </Box>
  )
}

function VotePanel({ state, players, me, myInput, send, now }: Props) {
  if (!me) return null
  const chosen = typeof myInput?.vote === 'number' ? myInput.vote : null
  const others = state.roster.filter((id) => id !== me.id)
  return (
    <Box>
      <Header state={state} now={now} />
      <Box sx={{ mb: 1.5 }}>
        <Title color={ACCENT.main}>Quem recebeu a pergunta trocada? 🥸</Title>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {others.map((id) => (
          <VoteButton
            key={id}
            name={nameOf(players, id)}
            answer={answerText(state.answers, id)}
            on={chosen === id}
            onClick={() => {
              buzz(20)
              send({ vote: id })
            }}
          />
        ))}
      </Box>
      <Note color={chosen !== null ? ACCENT.main : undefined}>
        {chosen !== null
          ? `✓ Voto em ${nameOf(players, chosen)} — dá pra trocar. Esperando os outros (${state.acted.length}/${state.roster.length})`
          : 'Toque em quem você acha que é o impostor. Empate? Ele escapa!'}
      </Note>
    </Box>
  )
}

function VoteButton({ name, answer, on, onClick }: { name: string; answer: string | null; on: boolean; onClick: () => void }) {
  return (
    <Button
      fullWidth
      variant={on ? 'contained' : 'outlined'}
      onClick={onClick}
      sx={{
        minHeight: 68,
        px: 2,
        justifyContent: 'space-between',
        gap: 1.5,
        textTransform: 'none',
        borderWidth: 2,
        borderRadius: 'var(--radius-lg)',
        borderColor: on ? ACCENT.main : 'var(--border-medium)',
        color: on ? ACCENT.contrast : 'var(--text-primary)',
        background: on ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
        '&:hover': { background: on ? ACCENT.light : withAlpha(ACCENT.main, 0.14), borderWidth: 2 },
      }}
    >
      <Box sx={{ textAlign: 'left', minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.15, wordBreak: 'break-word' }}>{name}</Typography>
        <Typography sx={{ fontSize: '1rem', lineHeight: 1.2, opacity: 0.85, wordBreak: 'break-word' }}>{answer ? `“${answer}”` : '🤐 não respondeu'}</Typography>
      </Box>
      <Typography aria-hidden sx={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>
        {on ? '🫵' : '🤨'}
      </Typography>
    </Button>
  )
}

function ResultPanel({ state, players, me, now }: Props) {
  const result = state.result
  if (!me || !result) return null
  const outcome = myOutcome(result, me.id)
  const gain = gainOf(state, me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      <Typography className="animate-pop-in" sx={{ fontSize: '4rem', lineHeight: 1 }}>
        {outcome.icon}
      </Typography>
      <Title color={outcome.good === true ? GREEN : outcome.good === false ? RED : undefined}>{outcome.title}</Title>
      {gain > 0 && <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '2.6rem', lineHeight: 1.1, color: ACCENT.main }}>+{gain}</Typography>}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <XmasCard label={result.impostor === null ? 'Não tinha impostor 😇' : `Impostor: ${nameOf(players, result.impostor)} 🥸`} sx={{ fontSize: '0.85rem' }}>
          <Typography sx={{ mt: 0.75, color: INK, fontWeight: 700, fontSize: '1rem' }}>Mesa: {result.realQuestion}</Typography>
          {result.oddQuestion && <Typography sx={{ mt: 0.75, color: '#b0182c', fontWeight: 800, fontSize: '1rem' }}>Impostor: {result.oddQuestion}</Typography>}
        </XmasCard>
      </Box>
      <Note>Olhe a TV 📺🎄</Note>
    </Box>
  )
}

function ScorePanel({ state, players, me, now }: Props) {
  if (!me) return null
  const { ranking } = finalAwards(state)
  const mine = ranking.find((entry) => entry.id === me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      <Title>Placar</Title>
      <Typography className="pt-bounce" sx={{ fontSize: '4rem', fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, lineHeight: 1, color: ACCENT.main }}>
        {mine?.score ?? 0}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>{mine ? `${mine.place}º lugar` : 'fora do placar'}</Typography>
      <Note>
        {state.round + 1 >= state.totalRounds ? 'Agora vem a última rodada! 🎁' : 'Próxima pergunta já vem — cara de paisagem 😐'} {nameOf(players, ranking[0]?.id)} lidera.
      </Note>
    </Box>
  )
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const rows: { icon: string; label: string; value: string }[] = [
    { icon: '🏆', label: 'Campeão da festa', value: awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém' },
    { icon: '🥸', label: 'Cara de pau', value: awards.bluffers.length ? `${namesOf(players, awards.bluffers)} (${awards.maxEscapes})` : 'Ninguém' },
    { icon: '🦌', label: 'Nariz de Rena', value: awards.sniffers.length ? `${namesOf(players, awards.sniffers)} (${awards.maxSharp})` : 'Ninguém' },
  ]
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography aria-hidden className="pt-bounce" sx={{ fontSize: '3.4rem', lineHeight: 1 }}>
        🎅
      </Typography>
      <Title>Fim da festa 🎄</Title>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {pointsLabel(mine.score)}
        </Typography>
      )}
      {rows.map((row) => (
        <Box key={row.label} sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${withAlpha(ACCENT.main, 0.7)}` }}>
          <Typography sx={{ color: 'var(--text-muted)' }}>
            {row.icon} {row.label}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', wordBreak: 'break-word' }}>{row.value}</Typography>
        </Box>
      ))}
    </Box>
  )
}
