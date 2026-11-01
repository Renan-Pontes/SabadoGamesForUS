import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Button, Chip, TextField, Typography } from '@mui/material'
import { nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { SPOOKY_COLORS, withAlpha } from '../../ui'
import { CITY_NOTES, GHOST_INFO, KILLER_NOTES, NOBODY_OUT, ROLE_INFO } from './content'
import { MIN_VOTES, NOTE_MAX, blockedGuard, cleanNote, type Role, type Secret, type State } from './engine'
import { meta } from './meta'
import { SUSPENSE_MS } from './narration'
import { REVEAL_SLOT, aliveActed, buzz, graceFor, namesOf, phaseLabel, plural } from './screens'

/**
 * Celular do "Cidade Dorme": uma ação clara por tela, 360 px. À noite a tela
 * é IGUAL para todo mundo ("Escolha alguém" + recado opcional) — só a
 * linhazinha de baixo muda com o papel. Segredo (papel, pistas, recados)
 * fica atrás de um toque, para o vizinho não espiar.
 */

const ACCENT = meta.accent
const YOU_ARE: Record<Role, string> = {
  killer: 'Você é ASSASSINO',
  detective: 'Você é o DETETIVE',
  angel: 'Você é o ANJO',
  citizen: 'Você é CIDADÃO',
}

type Props = HalloweenViewProps<State>
type PanelProps = Props & { me: HPlayer; secret: Secret | null }

export default function Phone(props: Props) {
  const { state, me, mine } = props
  if (!me) return null
  const panel: PanelProps = { ...props, me, secret: mine ?? null }
  if (state.over) return <EndPanel {...panel} />
  const ghost = !state.alive.includes(me.id)
  return (
    // Apelido gigante sem espaço quebra a linha em vez de estourar os 360 px.
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
      <Header state={state} now={props.now} />
      {/* Fecha sozinho a cada fase: ninguém esquece o papel aberto na mesa. */}
      {state.phase !== 'roles' && <RolePeek key={`peek-${state.phase}-${state.round}`} {...panel} ghost={ghost} />}
      {state.phase === 'roles' && <RolesPanel {...panel} />}
      {state.phase === 'night' &&
        (ghost ? (
          <HauntPanel key={`haunt-${state.inputKey}`} {...panel} />
        ) : (
          <NightPanel key={`night-${state.inputKey}`} {...panel} />
        ))}
      {state.phase === 'morning' && <MorningPanel {...panel} ghost={ghost} />}
      {state.phase === 'day' && <DayPanel {...panel} ghost={ghost} />}
      {state.phase === 'vote' && (ghost ? <GhostNote text="Fantasma não vota. Assista à TV e torça 👻" /> : <VotePanel {...panel} />)}
      {state.phase === 'verdict' && <VerdictPanel {...panel} />}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function Header({ state, now }: { state: State; now: () => number }) {
  const { seconds } = useCountdown(state.deadline, now, graceFor(state))
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>{phaseLabel(state)}</Typography>
      {seconds !== null && (
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.8rem', lineHeight: 1, color: seconds <= 5 ? SPOOKY_COLORS.blood : ACCENT.light }}
        >
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

function Title({ children, sub, color }: { children: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.3rem', lineHeight: 1 }}>{children}</Typography>
      {sub && <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: color ?? 'var(--text-secondary)', mt: 0.5 }}>{sub}</Typography>}
    </Box>
  )
}

function BigButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      fullWidth
      variant="contained"
      disabled={disabled}
      onClick={onClick}
      sx={{
        minHeight: 60,
        fontSize: '1.25rem',
        fontWeight: 800,
        textTransform: 'none',
        borderRadius: 'var(--radius-lg)',
        background: ACCENT.main,
        color: '#fff',
        '&:hover': { background: ACCENT.main, filter: 'brightness(1.12)' },
      }}
    >
      {children}
    </Button>
  )
}

function Waiting({ done, total, text = 'Esperando os outros' }: { done: number; total: number; text?: string }) {
  return (
    <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
      ⏳ {text} ({done}/{total})
    </Typography>
  )
}

function Card({ icon, title, color, children }: { icon: string; title: ReactNode; color: string; children?: ReactNode }) {
  return (
    <Box
      className="animate-pop-in"
      sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${withAlpha(color, 0.7)}`, background: withAlpha(color, 0.1), textAlign: 'center' }}
    >
      <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color, mt: 0.5 }}>{title}</Typography>
      {children && <Box sx={{ mt: 0.5, color: 'var(--text-secondary)' }}>{children}</Box>}
    </Box>
  )
}

function GhostNote({ text }: { text: string }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography className="hw-float" sx={{ fontSize: '3.5rem', lineHeight: 1 }}>
        👻
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Você é fantasma</Typography>
      <Typography sx={{ color: 'var(--text-secondary)' }}>{text}</Typography>
    </Box>
  )
}

/** Botões grandes com os nomes (2 por linha). */
function NameGrid({
  ids,
  players,
  me,
  selected,
  blocked,
  onPick,
}: {
  ids: number[]
  players: HPlayer[]
  me: number
  selected: number | null
  blocked: number | null
  onPick: (id: number) => void
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
      {ids.map((id) => {
        const active = selected === id
        return (
          <Button
            key={id}
            variant={active ? 'contained' : 'outlined'}
            disabled={blocked === id}
            onClick={() => onPick(id)}
            sx={{
              minHeight: 56,
              fontSize: '1.05rem',
              fontWeight: 700,
              textTransform: 'none',
              lineHeight: 1.15,
              borderWidth: 2,
              borderColor: active ? ACCENT.main : 'var(--border-medium)',
              color: active ? '#fff' : 'var(--text-primary)',
              background: active ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
              '&:hover': { background: active ? ACCENT.main : `${ACCENT.main}22`, borderWidth: 2 },
            }}
          >
            {nameOf(players, id)}
            {id === me ? ' (eu)' : ''}
            {blocked === id ? ' 🚫' : ''}
          </Button>
        )
      })}
    </Box>
  )
}

/** "Meu papel": escondido até tocar (e fecha sozinho na troca de fase). */
function RolePeek({ state, players, me, secret, ghost }: PanelProps & { ghost: boolean }) {
  const [open, setOpen] = useState(false)
  if (!secret) return null
  const info = ROLE_INFO[secret.role]
  return (
    <Box>
      <Button
        fullWidth
        onClick={() => setOpen((value) => !value)}
        sx={{
          minHeight: 44,
          justifyContent: 'space-between',
          textTransform: 'none',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          px: 2,
        }}
      >
        <span>{open ? `${info.icon} ${info.name}${ghost ? ' 👻' : ''}` : '👁 Meu papel e minhas pistas'}</span>
        <span>{open ? 'esconder' : 'ver'}</span>
      </Button>
      {open && (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <RoleCard secret={secret} players={players} me={me} compact />
          <Intel state={state} players={players} me={me} secret={secret} />
        </Box>
      )}
    </Box>
  )
}

function RoleCard({ secret, players, me, compact = false }: { secret: Secret; players: HPlayer[]; me: HPlayer; compact?: boolean }) {
  const info = ROLE_INFO[secret.role]
  const partners = (secret.team ?? []).filter((id) => id !== me.id)
  return (
    <Box
      className="animate-pop-in"
      sx={{
        p: compact ? 2 : 3,
        textAlign: 'center',
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${info.color}`,
        background: `linear-gradient(180deg, ${withAlpha(info.color, 0.2)}, rgba(10, 6, 18, 0.9))`,
        boxShadow: `0 0 30px ${withAlpha(info.color, 0.35)}`,
      }}
    >
      <Typography sx={{ fontSize: compact ? '2.8rem' : '4.5rem', lineHeight: 1 }}>{info.icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: compact ? '1.9rem' : '2.6rem', color: info.color, lineHeight: 1.05, mt: 1 }}>
        {YOU_ARE[secret.role]}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: '1.05rem', color: 'var(--text-secondary)' }}>{info.mission}</Typography>
      {secret.role === 'killer' && (
        <Typography sx={{ mt: 1.5, fontWeight: 800, color: info.color }}>
          {partners.length ? `🤝 Parceiros: ${namesOf(players, partners)}` : '🐺 Você age sozinho.'}
        </Typography>
      )}
    </Box>
  )
}

/** O que só eu sei: parceiros e recados, investigações, proteções ou apostas. */
function Intel({ state, players, me, secret }: { state: State; players: HPlayer[]; me: HPlayer; secret: Secret }) {
  const name = (id: number) => nameOf(players, id)
  const line = { fontSize: '1rem' }
  const muted = { fontSize: '0.9rem', color: 'var(--text-muted)' }
  switch (secret.role) {
    case 'killer': {
      const partners = (secret.team ?? []).filter((id) => id !== me.id)
      return (
        <Box sx={{ p: 1.5, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.04)' }}>
          {partners.length > 0 && (
            <Typography sx={line}>
              🤝 {partners.map((id) => `${name(id)}${state.alive.includes(id) ? '' : ' 👻'}`).join(', ')}
            </Typography>
          )}
          <Inbox notes={secret.inbox ?? []} />
        </Box>
      )
    }
    case 'detective': {
      const clues = secret.clues ?? []
      return (
        <Box sx={{ p: 1.5, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.04)' }}>
          {clues.length === 0 && <Typography sx={muted}>Nenhuma investigação ainda.</Typography>}
          {clues.map((clue) => (
            <Typography key={clue.round} sx={line}>
              Noite {clue.round}: {name(clue.target)} —{' '}
              {clue.killer ? <b style={{ color: SPOOKY_COLORS.blood }}>ASSASSINO 🔪</b> : 'inocente ✅'}
            </Typography>
          ))}
        </Box>
      )
    }
    case 'angel': {
      const guards = secret.guards ?? []
      const blocked = blockedGuard(secret, state.phase === 'night' ? state.round : state.round + 1)
      return (
        <Box sx={{ p: 1.5, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.04)' }}>
          {guards.length === 0 && <Typography sx={muted}>Ninguém protegido ainda.</Typography>}
          {guards.map((guard) => (
            <Typography key={guard.round} sx={line}>
              Noite {guard.round}: protegeu {name(guard.target)}
            </Typography>
          ))}
          {blocked !== null && (
            <Typography sx={muted}>
              {state.phase === 'night' ? 'Esta noite' : 'Na próxima noite'} não pode repetir {name(blocked)}.
            </Typography>
          )}
        </Box>
      )
    }
    default: {
      const bets = secret.bets ?? []
      return (
        <Box sx={{ p: 1.5, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.04)' }}>
          {bets.length === 0 && <Typography sx={muted}>Nenhuma aposta ainda.</Typography>}
          {bets.map((bet) => (
            <Typography key={bet.round} sx={line}>
              Noite {bet.round}: apostou em {name(bet.target)}
            </Typography>
          ))}
          <Typography sx={muted}>Os acertos de faro só aparecem no fim.</Typography>
        </Box>
      )
    }
  }
}

function Inbox({ notes }: { notes: string[] }) {
  if (!notes.length) return <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>📭 Nenhum recado na última noite.</Typography>
  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography sx={{ fontWeight: 800, color: ROLE_INFO.killer.color }}>📨 {plural(notes.length, 'recado anônimo', 'recados anônimos')}</Typography>
      {notes.map((note, index) => (
        <Typography key={`${index}-${note}`} sx={{ fontStyle: 'italic', wordBreak: 'break-word', mt: 0.5 }}>
          “{note}”
        </Typography>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

function RolesPanel({ state, players, me, secret, myInput, send }: PanelProps) {
  const [flipped, setFlipped] = useState(false)
  if (myInput !== null) {
    // Depois do "Entendi" a carta some: celular largado na mesa não entrega ninguém.
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>🤫</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1 }}>Guardado!</Typography>
        <Typography sx={{ color: 'var(--text-secondary)' }}>Seu papel fica no botão 👁 durante o jogo.</Typography>
        <Waiting done={state.acted.length} total={state.roster.length} />
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!flipped ? (
        <Button
          onClick={() => {
            setFlipped(true)
            buzz(20)
          }}
          sx={{
            minHeight: 280,
            borderRadius: 'var(--radius-xl)',
            border: `3px dashed ${ACCENT.main}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            color: 'var(--text-primary)',
            textTransform: 'none',
            background: `repeating-linear-gradient(45deg, ${withAlpha(ACCENT.main, 0.1)} 0 14px, rgba(10, 6, 18, 0.65) 14px 28px)`,
          }}
        >
          <Typography sx={{ fontSize: '4rem', lineHeight: 1 }}>🃏</Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.1 }}>Toque para ver seu papel</Typography>
          <Typography sx={{ color: 'var(--text-muted)' }}>Esconda a tela dos vizinhos 👀</Typography>
        </Button>
      ) : secret ? (
        <RoleCard secret={secret} players={players} me={me} />
      ) : (
        <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>Buscando seu papel no além…</Typography>
      )}
      {flipped && (
        <BigButton
          onClick={() => {
            send({ ok: true })
            buzz([30, 40, 30])
          }}
        >
          Entendi 👍
        </BigButton>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Noite
// ---------------------------------------------------------------------------

function NightPanel({ state, players, me, secret, myInput, send }: PanelProps) {
  const role = secret?.role ?? 'citizen'
  const info = ROLE_INFO[role]
  const sentTarget = typeof myInput?.target === 'number' ? myInput.target : null
  const sentNote = typeof myInput?.note === 'string' ? myInput.note : ''
  const [editing, setEditing] = useState(sentTarget === null)
  const [choice, setChoice] = useState<number | null>(sentTarget)
  const [note, setNote] = useState(sentNote)
  const confirmRef = useRef<HTMLDivElement | null>(null)
  const blocked = role === 'angel' ? blockedGuard(secret, state.round) : null
  const team = secret?.team ?? []
  // Assassino não escolhe parceiro; o anjo pode se proteger; o resto escolhe outra pessoa.
  const candidates = state.alive.filter((id) => (role === 'killer' ? !team.includes(id) : role === 'angel' || id !== me.id))
  const progress = <Waiting done={aliveActed(state)} total={state.alive.length} />
  const tip = <NightTip state={state} players={players} me={me} secret={secret} />

  if (!editing && sentTarget !== null) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
        <Typography className="hw-float" sx={{ fontSize: '3.5rem', lineHeight: 1 }}>
          🌙
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.3rem', lineHeight: 1 }}>Feito!</Typography>
        <Typography sx={{ fontSize: '1.15rem' }}>
          Você escolheu <b>{nameOf(players, sentTarget)}</b>
        </Typography>
        {sentNote && <Typography sx={{ fontStyle: 'italic', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>“{sentNote}”</Typography>}
        {tip}
        <Button variant="outlined" onClick={() => setEditing(true)} sx={{ minHeight: 48, textTransform: 'none', fontWeight: 700 }}>
          Mudar
        </Button>
        {progress}
      </Box>
    )
  }

  const pickName = (id: number) => {
    setChoice(id)
    // Com 15 nomes o "Confirmar" fica abaixo da dobra: sem isto, tem gente que
    // toca no nome, larga o celular e a escolha (até a do assassino) não vale.
    window.setTimeout(() => {
      try {
        confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        // Navegador sem rolagem suave: tudo bem, o botão continua lá.
      }
    }, 60)
  }

  const confirm = () => {
    if (choice === null) return
    send({ target: choice, note: cleanNote(note) })
    buzz([30, 40, 30])
    setEditing(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Mesma cor para todos os papéis: de longe, a tela de ninguém se destaca. */}
      <Title sub={`${info.icon} ${info.night}`}>Escolha alguém</Title>
      {tip}
      <NameGrid ids={candidates} players={players} me={me.id} selected={choice} blocked={blocked} onPick={pickName} />
      <NoteField value={note} onChange={setNote} placeholder={info.notePlaceholder} suggestions={role === 'killer' ? KILLER_NOTES : CITY_NOTES} />
      <Box ref={confirmRef}>
        <BigButton disabled={choice === null} onClick={confirm}>
          {choice === null ? 'Escolha alguém acima' : `Confirmar: ${nameOf(players, choice)}`}
        </BigButton>
      </Box>
      {progress}
    </Box>
  )
}

function NoteField({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  suggestions: readonly string[]
}) {
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        maxRows={3}
        label="Recado (opcional)"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {suggestions.slice(0, 4).map((text) => (
          <Chip key={text} label={text} variant="outlined" onClick={() => onChange(text)} sx={{ fontSize: '0.85rem' }} />
        ))}
      </Box>
    </Box>
  )
}

/**
 * A caixinha do topo da noite. TODO papel tem uma, igualzinha por fora: de
 * longe, a tela do assassino (com os parceiros ao vivo) ou do anjo (com o
 * "não pode repetir") parece a de qualquer cidadão.
 */
function NightTip({ state, players, me, secret }: { state: State; players: HPlayer[]; me: HPlayer; secret: Secret | null }) {
  const role = secret?.role ?? 'citizen'
  const line = { fontSize: '1rem' }
  let body: ReactNode
  if (role === 'killer') {
    const partners = (secret?.team ?? []).filter((id) => id !== me.id && state.alive.includes(id))
    const picks = secret?.picks ?? {}
    body = partners.length ? (
      <>
        {partners.map((id) => {
          const target = picks[String(id)]
          return (
            <Typography key={id} sx={line}>
              🤝 {nameOf(players, id)} → {typeof target === 'number' ? <b>{nameOf(players, target)}</b> : <i>escolhendo…</i>}
            </Typography>
          )
        })}
        <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vale o mais escolhido; empate é sorteado.</Typography>
      </>
    ) : (
      <Typography sx={line}>🤫 Você age sozinho: a escolha é toda sua.</Typography>
    )
  } else if (role === 'angel') {
    const blocked = blockedGuard(secret, state.round)
    body = (
      <Typography sx={line}>
        {blocked !== null ? `🤫 Ontem você protegeu ${nameOf(players, blocked)} — hoje não pode repetir.` : '🤫 Pode proteger você mesmo.'}
      </Typography>
    )
  } else if (role === 'detective') {
    body = <Typography sx={line}>🤫 De manhã você descobre, em segredo, se é assassino.</Typography>
  } else {
    body = <Typography sx={line}>🤫 Acertou o assassino? Vale ponto de faro no fim.</Typography>
  }
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-medium)',
        background: 'rgba(255, 255, 255, 0.04)',
        textAlign: 'left',
        color: 'var(--text-secondary)',
      }}
    >
      {body}
    </Box>
  )
}

function HauntPanel({ state, players, me, myInput, send }: PanelProps) {
  const target = typeof myInput?.target === 'number' ? myInput.target : null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Title sub={`${GHOST_INFO.icon} ${GHOST_INFO.night}`} color={SPOOKY_COLORS.ghost}>
        Escolha alguém
      </Title>
      <NameGrid
        ids={state.alive}
        players={players}
        me={me.id}
        selected={target}
        blocked={null}
        onPick={(id) => {
          send({ target: id })
          buzz(30)
        }}
      />
      {target !== null && (
        <Typography sx={{ textAlign: 'center', fontWeight: 700, color: SPOOKY_COLORS.ghost }}>
          ✓ Assombrando {nameOf(players, target)} — dá para trocar.
        </Typography>
      )}
      <Waiting done={aliveActed(state)} total={state.alive.length} text="Os vivos estão escolhendo" />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Manhã e dia
// ---------------------------------------------------------------------------

function MorningPanel({ state, players, me, secret, ghost }: PanelProps & { ghost: boolean }) {
  const [open, setOpen] = useState(false)
  const news = state.news
  const iDied = news !== null && news.killed === me.id
  // Morreu: o celular treme (uma vez, ao abrir a manhã).
  useEffect(() => {
    if (iDied) buzz([200, 100, 300])
  }, [iDied])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>☀️</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.3rem', lineHeight: 1 }}>Amanheceu</Typography>
        <Typography sx={{ color: 'var(--text-secondary)' }}>Olhe a TV 📺</Typography>
      </Box>
      {iDied && news && (
        <Card icon="💀" title="Você morreu esta noite!" color={SPOOKY_COLORS.blood}>
          “{news.epitaph}” — agora você é fantasma: não vota e não fala 🤫, mas assombra à noite.
        </Card>
      )}
      {/* Todo mundo tem a mesma "manhã secreta" — o vizinho não sabe quem tem pista. */}
      {!open ? (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setOpen(true)}
          sx={{ minHeight: 56, textTransform: 'none', fontWeight: 800, fontSize: '1.05rem', borderWidth: 2 }}
        >
          👁 Toque para ver sua manhã (em segredo)
        </Button>
      ) : (
        <SecretMorning state={state} players={players} me={me} secret={secret} ghost={ghost} />
      )}
    </Box>
  )
}

function SecretMorning({ state, players, me, secret, ghost }: { state: State; players: HPlayer[]; me: HPlayer; secret: Secret | null; ghost: boolean }) {
  const news = state.news
  const round = news?.round ?? state.round
  const name = (id: number) => nameOf(players, id)
  if (!secret || !news) return <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nada de novo para você. 😴</Typography>
  const saved = secret.savedAt === round
  const blocks: ReactNode[] = []
  if (saved) {
    blocks.push(
      <Card key="saved" icon="😇" title="Você foi atacado…" color={ROLE_INFO.angel.color}>
        …e o anjo te salvou! Guarde segredo (ou não).
      </Card>,
    )
  }
  if (secret.role === 'killer' && state.alive.includes(me.id)) {
    blocks.push(
      <Box key="inbox" sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${withAlpha(ROLE_INFO.killer.color, 0.6)}` }}>
        <Inbox notes={secret.inbox ?? []} />
      </Box>,
    )
  }
  const clue = secret.clues?.find((entry) => entry.round === round)
  if (clue) {
    blocks.push(
      <Card
        key="clue"
        icon="🔎"
        title={clue.killer ? `${name(clue.target)} É ASSASSINO!` : `${name(clue.target)} não é assassino`}
        color={clue.killer ? SPOOKY_COLORS.blood : SPOOKY_COLORS.toxic}
      >
        {clue.killer ? 'Convença a cidade sem se entregar.' : 'Pode riscar da lista.'}
      </Card>,
    )
  }
  const guard = secret.guards?.find((entry) => entry.round === round)
  if (guard) {
    blocks.push(
      <Card key="guard" icon="😇" title={`Você protegeu ${name(guard.target)}`} color={ROLE_INFO.angel.color}>
        {news.saved ? 'E salvou! Os assassinos foram nele.' : 'Amanhã escolha outra pessoa.'}
      </Card>,
    )
  }
  const bet = secret.bets?.find((entry) => entry.round === round)
  if (bet) {
    blocks.push(
      <Card key="bet" icon="🎲" title={`Você apostou em ${name(bet.target)}`} color={ROLE_INFO.citizen.color}>
        Acertou? Só no fim você descobre.
      </Card>,
    )
  }
  if (!blocks.length) {
    blocks.push(
      <Typography key="nothing" sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        {ghost ? '👻 Fantasmas não têm segredos. Só saudade.' : 'Nada de novo para você. 😴'}
      </Typography>,
    )
  }
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{blocks}</Box>
}

function DayPanel({ state, myInput, send, ghost }: PanelProps & { ghost: boolean }) {
  if (ghost) return <GhostNote text="Fantasma não vota nem fala 🤫 — mas pode fazer careta." />
  const ready = myInput !== null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>🗣️</Typography>
        <Title sub="Quem tem cara de assassino? Acuse, defenda, blefe.">Conversem!</Title>
      </Box>
      {ready ? (
        <Waiting done={aliveActed(state)} total={state.alive.length} text="Pronto para votar! Esperando os outros" />
      ) : (
        <BigButton
          onClick={() => {
            send({ ready: true })
            buzz(30)
          }}
        >
          ✋ Pronto para votar
        </BigButton>
      )}
      <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        A votação abre quando todos estiverem prontos — ou quando a vela apagar.
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Votação e veredito
// ---------------------------------------------------------------------------

function VotePanel({ state, players, me, myInput, send }: PanelProps) {
  const voted = myInput !== null && 'vote' in myInput
  const choice = voted ? myInput.vote : undefined
  const others = state.alive.filter((id) => id !== me.id)
  const vote = (target: number | null) => {
    send({ vote: target })
    buzz(30)
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Title sub={`Precisa de ${MIN_VOTES} votos · empate: ninguém sai`}>Quem sai da cidade?</Title>
      <NameGrid
        ids={others}
        players={players}
        me={me.id}
        selected={typeof choice === 'number' ? choice : null}
        blocked={null}
        onPick={(id) => vote(id)}
      />
      {/* "Ninguém sai" concorre como um nome: se empatar ou vencer o mais votado, ninguém sai. */}
      <Button
        fullWidth
        variant={voted && choice === null ? 'contained' : 'outlined'}
        onClick={() => vote(null)}
        sx={{ minHeight: 52, textTransform: 'none', fontWeight: 700, fontSize: '1.05rem', borderWidth: 2 }}
      >
        🤷 Ninguém sai hoje
      </Button>
      <Typography sx={{ textAlign: 'center', fontWeight: 700, color: voted ? ACCENT.light : 'var(--text-secondary)' }}>
        {voted
          ? `✓ ${typeof choice === 'number' ? `Voto em ${nameOf(players, choice)}` : 'Voto: ninguém sai'} — dá para trocar. (${aliveActed(state)}/${state.alive.length} votaram)`
          : 'Toque em quem você quer expulsar.'}
      </Typography>
    </Box>
  )
}

function VerdictPanel({ state, players, me, now }: PanelProps) {
  const clock = useServerNow(now)
  const verdict = state.verdict
  const myVote = state.votes[String(me.id)]
  // O resultado aparece junto com a TV, depois do rufar.
  const revealed = verdict !== null && clock >= state.since + SUSPENSE_MS
  let headline: ReactNode = 'Olhe a TV… 🥁'
  let detail: ReactNode = null
  if (revealed && verdict) {
    if (verdict.out === null) {
      headline = 'Ninguém saiu'
      detail = NOBODY_OUT[verdict.reason === 'out' ? 'few' : verdict.reason]
    } else if (verdict.out === me.id) {
      headline = '💀 Você foi expulso!'
      detail = 'Agora você é fantasma: não vota, mas assombra à noite.'
    } else {
      headline = `${nameOf(players, verdict.out)} saiu da cidade`
      detail = verdict.role ? `${ROLE_INFO[verdict.role].icon} ${ROLE_INFO[verdict.role].was}` : 'Papel: segredo 🤫'
    }
  }
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>⚖️</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.05 }}>{headline}</Typography>
      {detail && <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>{detail}</Typography>}
      {myVote !== undefined && (
        <Typography sx={{ color: 'var(--text-muted)' }}>
          {myVote === null ? 'Você votou: ninguém sai' : `Você votou em ${nameOf(players, myVote)}`}
        </Typography>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

function EndPanel({ state, players, me, secret, slots, sendSlot }: PanelProps) {
  const final = state.final
  const role = final?.roles[String(me.id)] ?? secret?.role ?? null
  const info = role ? ROLE_INFO[role] : null
  const told = slots[REVEAL_SLOT]?.[me.id]?.role
  // "⏹ Encerrar" do host: o motor não revelou ninguém, então o celular conta
  // o próprio papel para a TV (só ela recebe o slot) — uma vez só.
  useEffect(() => {
    if (final || !secret || told === secret.role) return
    sendSlot(REVEAL_SLOT, { role: secret.role })
  }, [final, secret, told, sendSlot])
  if (!final) {
    return (
      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Partida encerrada</Typography>
        {info && (
          <Typography sx={{ fontSize: '1.2rem' }}>
            Você era {info.icon} <b>{info.name}</b>
          </Typography>
        )}
      </Box>
    )
  }
  const won = final.winner === (role === 'killer' ? 'killers' : 'city')
  const killers = state.roster.filter((id) => final.roles[String(id)] === 'killer')
  const faro = final.faro.find((entry) => entry.id === me.id)
  const place = faro ? final.faro.findIndex((entry) => entry.hits === faro.hits) + 1 : 0
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: '4rem', lineHeight: 1 }}>{won ? '🏆' : '💀'}</Typography>
      <Typography
        sx={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', lineHeight: 1, color: won ? SPOOKY_COLORS.toxic : SPOOKY_COLORS.blood }}
      >
        {won ? 'Você venceu!' : 'Você perdeu…'}
      </Typography>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
        {final.winner === 'killers' ? '🔪 Os assassinos venceram' : '🏘️ A cidade venceu'}
      </Typography>
      {info && (
        <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${info.color}` }}>
          <Typography sx={{ color: 'var(--text-muted)' }}>Você era</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: info.color }}>
            {info.icon} {info.name}
          </Typography>
        </Box>
      )}
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>{killers.length > 1 ? 'Os assassinos eram' : 'O assassino era'}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: SPOOKY_COLORS.blood }}>{namesOf(players, killers)}</Typography>
      </Box>
      {faro && (
        <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ROLE_INFO.citizen.color}` }}>
          <Typography sx={{ color: 'var(--text-muted)' }}>👃 Seu faro</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
            {faro.bets === 0
              ? 'Você não apostou 😴'
              : `${faro.hits} de ${plural(faro.bets, 'aposta certa', 'apostas certas')}${faro.hits > 0 ? ` · ${place}º lugar` : ''}`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
