import { useEffect, useState, type ReactNode } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { SPOOKY_COLORS, withAlpha } from '../../ui'
import { finalAwards, type EspiaoState } from './engine'
import { meta } from './meta'
import { GUESS_MAX, asCard, cleanGuess, type SpyCard } from './rules'
import { buzz, clock, gainOf, myOutcome, namesOf, spiesLabel } from './view'

/**
 * Celular do "Espião Assombrado": uma ação clara por tela, 360 px.
 *
 * A carta fica virada para baixo até a pessoa tocar (o vizinho não espia).
 * Na conversa, todo mundo vê a mesma tela — "Ver minha carta" e "Acusar
 * alguém" —; o "Chutar o lugar" do espião mora DENTRO da carta aberta, então
 * nem de relance dá para saber quem é espião pelo celular dos outros.
 */

const ACCENT = meta.accent
const BLOOD = SPOOKY_COLORS.blood

type Props = HalloweenViewProps<EspiaoState>
/** O rascunho do chute, guardado na raiz: sobrevive a uma acusação no meio e chega pronto na última chance. */
type Draft = { draft: string; setDraft: (text: string) => void }

export default function Phone(props: Props) {
  const { state, me } = props
  const [saved, setSaved] = useState({ round: 0, text: '' })
  const draft: Draft = {
    draft: saved.round === state.round ? saved.text : '',
    setDraft: (text) => setSaved({ round: state.round, text }),
  }
  if (!me) return null
  // "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo.
  if (state.over) return <FinalPanel {...props} />
  switch (state.phase) {
    case 'reveal':
      return <RevealPanel key={state.inputKey} {...props} />
    case 'talk':
      return <TalkPanel key={state.inputKey} {...props} {...draft} />
    case 'accuse':
      return <AccusePanel key={state.inputKey} {...props} />
    case 'final_vote':
      return <FinalVotePanel {...props} />
    case 'last_chance':
      return <LastChancePanel key={state.inputKey} {...props} {...draft} />
    case 'result':
      return <ResultPanel {...props} />
    default:
      return <ScorePanel {...props} />
  }
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function Header({ state, now, grace = false, minutes = false }: { state: EspiaoState; now: () => number; grace?: boolean; minutes?: boolean }) {
  const { ms, seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  const urgent = seconds !== null && seconds <= (minutes ? 60 : 5)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.9rem' }}>
        RODADA {state.round}/{state.totalRounds} · 🕵️ {spiesLabel(state.spyCount)}
      </Typography>
      {seconds !== null && (
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.7rem', lineHeight: 1, color: urgent ? BLOOD : ACCENT.main, flexShrink: 0 }}>
          ⏳ {minutes ? clock(ms) : seconds}
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
        minHeight: 60,
        mt: 1.25,
        fontSize: '1.15rem',
        fontWeight: 800,
        textTransform: 'none',
        lineHeight: 1.15,
        borderWidth: 2,
        borderColor: color,
        color: filled ? '#0b0614' : 'var(--text-primary)',
        background: filled ? color : withAlpha(color, 0.08),
        '&:hover': { background: filled ? color : withAlpha(color, 0.2), borderWidth: 2, borderColor: color },
        '&.Mui-disabled': { color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'transparent' },
      }}
    >
      {children}
    </Button>
  )
}

/** Uma pessoa por botão, em duas colunas. */
function PeopleGrid({ ids, players, selected, onPick }: { ids: number[]; players: HPlayer[]; selected: number | null; onPick: (id: number) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
      {ids.map((id) => {
        const on = selected === id
        return (
          <Button
            key={id}
            variant={on ? 'contained' : 'outlined'}
            onClick={() => onPick(id)}
            sx={{
              minHeight: 56,
              fontSize: '1.05rem',
              fontWeight: 700,
              textTransform: 'none',
              lineHeight: 1.15,
              borderWidth: 2,
              borderColor: on ? ACCENT.main : 'var(--border-medium)',
              color: on ? ACCENT.contrast : 'var(--text-primary)',
              background: on ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
              wordBreak: 'break-word',
              '&:hover': { background: on ? ACCENT.light : withAlpha(ACCENT.main, 0.14), borderWidth: 2 },
            }}
          >
            {nameOf(players, id)}
          </Button>
        )
      })}
    </Box>
  )
}

/** A carta secreta: virada para baixo até tocar. */
function SecretCard({
  card,
  spyCount,
  open,
  onToggle,
  big = false,
  children,
}: {
  card: SpyCard | null
  spyCount: number
  open: boolean
  onToggle: () => void
  big?: boolean
  children?: ReactNode
}) {
  if (!open) {
    return (
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          width: '100%',
          minHeight: big ? 250 : 112,
          p: 2,
          borderRadius: 'var(--radius-xl)',
          border: `3px dashed ${withAlpha(ACCENT.main, 0.8)}`,
          background: `repeating-linear-gradient(45deg, ${withAlpha(ACCENT.main, 0.12)} 0 14px, rgba(10, 6, 18, 0.88) 14px 28px)`,
          color: 'var(--text-primary)',
          font: 'inherit',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Box>
          <Typography aria-hidden sx={{ fontSize: big ? '3.6rem' : '2rem', lineHeight: 1 }}>
            👁️
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: big ? '1.35rem' : '1.1rem', mt: 0.75 }}>Toque para ver sua carta</Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>escondido de quem está do lado 🤫</Typography>
        </Box>
      </Box>
    )
  }

  const spy = card?.spy === true
  return (
    <Box
      className="animate-deal-in"
      sx={{
        p: 2.25,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${spy ? BLOOD : ACCENT.main}`,
        background: `radial-gradient(ellipse at top, ${withAlpha(spy ? BLOOD : ACCENT.main, 0.22)}, rgba(10, 6, 18, 0.92) 70%)`,
        boxShadow: `0 0 28px ${withAlpha(spy ? BLOOD : ACCENT.main, 0.35)}`,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}>SÓ VOCÊ VÊ ISTO</Typography>
      {card === null ? (
        <Note>Sua carta está chegando…</Note>
      ) : card.spy ? (
        <>
          <Typography aria-hidden sx={{ fontSize: '3.2rem', lineHeight: 1.15 }}>
            🕵️
          </Typography>
          <Title color={BLOOD}>VOCÊ É O ESPIÃO</Title>
          <Typography sx={{ color: 'var(--text-secondary)', mt: 1, lineHeight: 1.35 }}>
            Você não sabe o lugar. Descubra pelas perguntas — e não se entregue!
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', mt: 0.75, fontSize: '0.95rem', lineHeight: 1.3 }}>
            Na conversa, o botão 🔮 Chutar o lugar fica aqui na carta. Só uma chance!
          </Typography>
          {spyCount > 1 && (
            <Typography sx={{ color: 'var(--text-muted)', mt: 0.75, fontSize: '0.95rem' }}>Tem outro espião na mesa — vocês não sabem quem é.</Typography>
          )}
        </>
      ) : (
        <>
          <Typography aria-hidden sx={{ fontSize: '3.2rem', lineHeight: 1.15 }}>
            {card.icon}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: 'var(--text-muted)', fontWeight: 800 }}>O LUGAR</Typography>
          <Title color={ACCENT.main}>{card.place}</Title>
          <Typography sx={{ mt: 1, fontSize: '1.15rem' }}>
            Seu papel: <b style={{ color: ACCENT.light }}>{card.role}</b>
          </Typography>
        </>
      )}
      {children}
      <Button onClick={onToggle} sx={{ mt: 1, minHeight: 44, color: 'var(--text-muted)', textTransform: 'none', fontWeight: 700 }}>
        🙈 Esconder a carta
      </Button>
    </Box>
  )
}

function GuessField({ value, onChange, onSubmit }: { value: string; onChange: (text: string) => void; onSubmit: () => void }) {
  return (
    <TextField
      fullWidth
      autoFocus
      value={value}
      placeholder="Digite o lugar…"
      onChange={(event) => onChange(event.target.value.slice(0, GUESS_MAX))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit()
      }}
      slotProps={{ htmlInput: { maxLength: GUESS_MAX, autoComplete: 'off', autoCapitalize: 'none', spellCheck: false, enterKeyHint: 'go' } }}
      sx={{ mt: 2, '& input': { fontSize: '1.3rem', fontWeight: 700, py: 1.75 } }}
    />
  )
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function RevealPanel({ state, now, mine }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Box>
      <Header state={state} now={now} />
      <Box sx={{ mb: 1.5 }}>
        <Title>Olhe sua carta 🤫</Title>
      </Box>
      <SecretCard
        card={asCard(mine)}
        spyCount={state.spyCount}
        open={open}
        big
        onToggle={() => {
          if (!open) buzz(25)
          setOpen(!open)
        }}
      />
      <Note>Guarde o lugar e o papel. Dá para olhar de novo durante a conversa.</Note>
    </Box>
  )
}

type TalkMode = { kind: 'main' } | { kind: 'pick' } | { kind: 'confirm-accuse'; target: number } | { kind: 'type' } | { kind: 'confirm-guess'; text: string }

function TalkPanel({ state, players, me, mine, myInput, send, now, draft, setDraft }: Props & Draft) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<TalkMode>({ kind: 'main' })
  if (!me) return null
  const card = asCard(mine)
  const used = state.accusers.includes(me.id)
  const others = state.roster.filter((id) => id !== me.id)
  const sentAccuse = typeof myInput?.accuse === 'number' ? myInput.accuse : null
  const sentGuess = typeof myInput?.guess === 'string' ? myInput.guess : null
  const header = <Header state={state} now={now} minutes />

  if (sentGuess !== null) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        {header}
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🔮</Typography>
        <Title>Chute enviado!</Title>
        <Note>“{sentGuess}” — segura o coração e olhe a TV…</Note>
      </Box>
    )
  }
  if (sentAccuse !== null) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        {header}
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🫵</Typography>
        <Title>Você acusou {nameOf(players, sentAccuse)}</Title>
        <Note>A votação já vai abrir na TV…</Note>
      </Box>
    )
  }

  if (mode.kind === 'pick') {
    return (
      <Box>
        {header}
        <Box sx={{ mb: 1.5 }}>
          <Title>Quem é o espião?</Title>
        </Box>
        <PeopleGrid ids={others} players={players} selected={null} onPick={(target) => setMode({ kind: 'confirm-accuse', target })} />
        <BigButton onClick={() => setMode({ kind: 'main' })}>Voltar</BigButton>
      </Box>
    )
  }

  if (mode.kind === 'confirm-accuse') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        {header}
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🫵</Typography>
        <Title color={ACCENT.main}>Acusar {nameOf(players, mode.target)}?</Title>
        <Note>Todo mundo vota SIM ou NÃO. Você só acusa uma vez por rodada.</Note>
        <BigButton
          filled
          color={BLOOD}
          onClick={() => {
            buzz(60)
            send({ accuse: mode.target, at: now() })
          }}
        >
          Acusar!
        </BigButton>
        <BigButton onClick={() => setMode({ kind: 'pick' })}>Voltar</BigButton>
      </Box>
    )
  }

  if (mode.kind === 'type') {
    const ready = cleanGuess(draft)
    const next = () => {
      if (ready) setMode({ kind: 'confirm-guess', text: ready })
    }
    return (
      <Box>
        {header}
        <Title>Onde vocês estão?</Title>
        <Note>Digite o lugar. Vale sem acento e com erro pequeno.</Note>
        <GuessField value={draft} onChange={setDraft} onSubmit={next} />
        <BigButton filled disabled={!ready} onClick={next}>
          Chutar
        </BigButton>
        <BigButton onClick={() => setMode({ kind: 'main' })}>Voltar</BigButton>
      </Box>
    )
  }

  if (mode.kind === 'confirm-guess') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        {header}
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>⚠️</Typography>
        <Title color={BLOOD}>Só tem UMA chance!</Title>
        <Note>Chutar “{mode.text}”? Acertou, você vence. Errou, a mesa vence.</Note>
        <BigButton
          filled
          color={BLOOD}
          onClick={() => {
            buzz([70, 50, 70])
            send({ guess: mode.text, at: now() })
          }}
        >
          Sim, chutar!
        </BigButton>
        <BigButton onClick={() => setMode({ kind: 'type' })}>Voltar</BigButton>
      </Box>
    )
  }

  return (
    <Box>
      {header}
      <SecretCard
        card={card}
        spyCount={state.spyCount}
        open={open}
        onToggle={() => {
          if (!open) buzz(25)
          setOpen(!open)
        }}
      >
        {card?.spy && (
          <BigButton filled color={BLOOD} onClick={() => setMode({ kind: 'type' })}>
            🔮 Chutar o lugar
          </BigButton>
        )}
      </SecretCard>
      <BigButton filled disabled={used || others.length === 0} onClick={() => setMode({ kind: 'pick' })}>
        {used ? 'Você já acusou nesta rodada' : '🫵 Acusar alguém'}
      </BigButton>
      <Note>
        🎤 {nameOf(players, state.starter, 'Qualquer um')} começa perguntando. Pergunte sobre o lugar sem entregar!
      </Note>
    </Box>
  )
}

function AccusePanel({ state, players, me, myInput, send, now }: Props) {
  const accusation = state.accusation
  const accusedMe = Boolean(me && accusation?.target === me.id)
  useEffect(() => {
    if (accusedMe) buzz([220, 100, 220, 100, 320])
  }, [accusedMe])
  if (!me || !accusation) return null

  const voters = state.roster.filter((id) => id !== accusation.target)
  const progress = `${state.acted.length}/${voters.length}`
  const tally = `👍 ${accusation.yes} × ${accusation.no} 👎`
  const target = nameOf(players, accusation.target)
  const accuser = nameOf(players, accusation.by)

  if (accusedMe) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <Typography className="animate-shake" sx={{ fontSize: '4rem', lineHeight: 1 }}>
          😱
        </Typography>
        <Title color={BLOOD}>{accuser} acusou você!</Title>
        <Note>Defenda-se em voz alta! A mesa está votando ({progress}).</Note>
        <Note color={ACCENT.light}>{tally}</Note>
      </Box>
    )
  }

  if (accusation.by === me.id) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🫵</Typography>
        <Title>Você acusou {target}</Title>
        <Note>Seu voto já conta como SIM. Esperando os outros ({progress}).</Note>
        <Note color={ACCENT.light}>{tally}</Note>
      </Box>
    )
  }

  const vote = typeof myInput?.yes === 'boolean' ? myInput.yes : null
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace />
      <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
        {accuser} acusa {target}
      </Typography>
      <Title color={ACCENT.main}>{target} é o espião?</Title>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mt: 1 }}>
        <VoteButton label="👍 SIM" on={vote === true} color="#22c55e" onClick={() => send({ yes: true })} />
        <VoteButton label="👎 NÃO" on={vote === false} color={BLOOD} onClick={() => send({ yes: false })} />
      </Box>
      <Note color={vote === null ? undefined : ACCENT.light}>
        {vote === null ? 'A maioria decide. Quem não vota não conta.' : `✓ Você votou ${vote ? 'SIM' : 'NÃO'} — dá pra trocar. Esperando os outros (${progress})`}
      </Note>
    </Box>
  )
}

function VoteButton({ label, on, color, onClick }: { label: string; on: boolean; color: string; onClick: () => void }) {
  return (
    <Button
      variant={on ? 'contained' : 'outlined'}
      onClick={onClick}
      sx={{
        minHeight: 96,
        fontSize: '1.5rem',
        fontWeight: 900,
        borderWidth: 3,
        borderColor: color,
        color: on ? '#0b0614' : 'var(--text-primary)',
        background: on ? color : withAlpha(color, 0.1),
        '&:hover': { background: on ? color : withAlpha(color, 0.22), borderWidth: 3, borderColor: color },
      }}
    >
      {label}
    </Button>
  )
}

function FinalVotePanel({ state, players, me, myInput, send, now }: Props) {
  if (!me) return null
  const chosen = typeof myInput?.vote === 'number' ? myInput.vote : null
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Box sx={{ mb: 1.5 }}>
        <Title color={BLOOD}>⏰ Acabou o tempo!</Title>
        <Note>Quem é o espião? O mais votado é condenado.</Note>
      </Box>
      <PeopleGrid
        ids={state.roster.filter((id) => id !== me.id)}
        players={players}
        selected={chosen}
        onPick={(id) => {
          buzz(20)
          send({ vote: id })
        }}
      />
      <Note color={chosen !== null ? ACCENT.main : undefined}>
        {chosen !== null
          ? `✓ Voto em ${nameOf(players, chosen)} — dá pra trocar. Esperando os outros (${state.acted.length}/${state.roster.length})`
          : 'Toque em quem você acha que é o espião.'}
      </Note>
    </Box>
  )
}

function LastChancePanel({ state, players, me, myInput, send, now, draft, setDraft }: Props & Draft) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const caughtMe = Boolean(me && state.caught === me.id)
  useEffect(() => {
    if (caughtMe) buzz([300, 120, 300])
  }, [caughtMe])
  if (!me) return null
  const caught = nameOf(players, state.caught)

  if (!caughtMe) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🎯</Typography>
        <Title color={BLOOD}>{caught} é espião!</Title>
        <Note>Última chance: se adivinhar o lugar, os espiões vencem. Nada de soprar! 🤐</Note>
      </Box>
    )
  }

  const sent = typeof myInput?.guess === 'string' ? myInput.guess : null
  if (sent !== null) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🔮</Typography>
        <Title>Chute enviado!</Title>
        <Note>“{sent}” — olhe a TV…</Note>
      </Box>
    )
  }

  if (confirming !== null) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace />
        <Title color={BLOOD}>Só tem UMA chance!</Title>
        <Note>Chutar “{confirming}”?</Note>
        <BigButton
          filled
          color={BLOOD}
          onClick={() => {
            buzz([70, 50, 70])
            send({ guess: confirming, at: now() })
          }}
        >
          Sim, chutar!
        </BigButton>
        <BigButton onClick={() => setConfirming(null)}>Voltar</BigButton>
      </Box>
    )
  }

  const ready = cleanGuess(draft)
  const next = () => {
    if (ready) setConfirming(ready)
  }
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Box sx={{ textAlign: 'center' }}>
        <Typography className="animate-shake" sx={{ fontSize: '3.5rem', lineHeight: 1 }}>
          🎯
        </Typography>
        <Title color={BLOOD}>Você foi pego!</Title>
        <Note>Última chance: digite o lugar. Acertou, os espiões vencem!</Note>
      </Box>
      <GuessField value={draft} onChange={setDraft} onSubmit={next} />
      <BigButton filled disabled={!ready} onClick={next}>
        Chutar
      </BigButton>
    </Box>
  )
}

function ResultPanel({ state, players, me, mine, now }: Props) {
  const result = state.result
  if (!me || !result) return null
  const outcome = myOutcome(result, me.id)
  const gain = gainOf(state, me.id)
  const card = asCard(mine)
  const spies =
    result.kind === 'everyone' ? 'Todo mundo era espião! 🤡' : result.kind === 'nobody' ? 'Não tinha espião! 😇' : `Espião: ${namesOf(players, result.spies)}`
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      <Typography className="animate-pop-in" sx={{ fontSize: '4rem', lineHeight: 1 }}>
        {outcome.icon}
      </Typography>
      <Title color={outcome.good === true ? ACCENT.main : outcome.good === false ? BLOOD : undefined}>{outcome.title}</Title>
      {gain > 0 && (
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '2.6rem', lineHeight: 1.1, color: ACCENT.main }}>+{gain}</Typography>
      )}
      <Box sx={{ mt: 2, p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>O lugar era</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem' }}>
          {result.place.icon} {result.place.name}
        </Typography>
        <Typography sx={{ mt: 1, fontWeight: 700 }}>{spies}</Typography>
        {card && (
          <Typography sx={{ mt: 0.5, color: 'var(--text-secondary)' }}>
            {card.spy ? 'Você era espião 🕵️' : `Você era: ${card.role}`}
          </Typography>
        )}
      </Box>
      <Note>Olhe a TV 📺</Note>
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
      <Typography sx={{ fontSize: '4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main }}>{mine?.score ?? 0}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>{mine ? `${mine.place}º lugar` : 'fora do placar'}</Typography>
      <Note>
        {state.round + 1 >= state.totalRounds ? 'Agora vem a última rodada! 😱' : 'Próxima rodada já vem — prepare a cara de paisagem 😐'}{' '}
        {nameOf(players, ranking[0]?.id)} lidera.
      </Note>
    </Box>
  )
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const rows: { icon: string; label: string; value: string }[] = [
    { icon: '🏆', label: 'Campeão da noite', value: awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém' },
    {
      icon: '🕵️',
      label: 'Mestre do disfarce',
      value: awards.masterSpies.length ? `${namesOf(players, awards.masterSpies)} (${awards.maxSpyWins})` : 'Ninguém',
    },
    { icon: '🔎', label: 'Faro fino', value: awards.detectives.length ? `${namesOf(players, awards.detectives)} (${awards.maxSharp})` : 'Ninguém' },
  ]
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Title>Fim da noite</Title>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {mine.score} {mine.score === 1 ? 'ponto' : 'pontos'}
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
