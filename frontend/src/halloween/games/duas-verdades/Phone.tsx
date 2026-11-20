import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { XMAS_COLORS, withAlpha } from '../../ui'
import { MAX_FACT_CHARS, cleanFact, entryProblem, factLength, finalAwards, readEntry, votersOf, type DvCard, type DvState } from './engine'
import { meta } from './meta'
import './duas.css'
import {
  DRUM_MS,
  applyPrompt,
  buzz,
  cardLetter,
  draftKey,
  limitFact,
  loadDraft,
  myLieCard,
  namesOf,
  pointsLabel,
  problemText,
  promptPage,
  revealStartedAt,
  saveDraft,
  type Draft,
} from './view'

/**
 * Celular do "Duas Verdades, Uma Mentira" — a sua mão. Na escrita, três
 * cartinhas (com ideias para começar a frase) e o botão 🤥 para marcar a
 * mentira; na vez dos outros, três botões grandes; na sua vez, as suas
 * frases com a mentira marcada (cara de paisagem!); depois, o que aconteceu.
 */

const ACCENT = meta.accent
const RED = XMAS_COLORS.red
const GREEN = XMAS_COLORS.pine
const PAPER = 'linear-gradient(160deg, #fffaf0 0%, #fff6dc 60%, #f6e7c8 100%)'
const INK = '#2b1608'

type Props = HalloweenViewProps<DvState>

export default function Phone(props: Props) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (state.phase === 'write') return <WritePanel key={state.seed} {...props} />
  if (state.phase === 'vote') return state.author === me.id ? <MyTurnPanel {...props} /> : <VotePanel key={state.inputKey} {...props} />
  if (state.phase === 'reveal') return <RevealPanel {...props} />
  return null
}

function Header({ state, now, grace }: { state: DvState; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  const label = state.phase === 'write' ? 'SUAS CARTINHAS' : `VEZ ${state.round}/${state.totalRounds}`
  const clock = seconds === null ? null : seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : String(seconds)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</Typography>
      {clock !== null && (
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.8rem', lineHeight: 1, color: grace && seconds !== null && seconds <= 5 ? RED : ACCENT.main }}>
          ⏳ {clock}
        </Typography>
      )}
    </Box>
  )
}

function Waiting({ done, total, verb }: { done: number; total: number; verb: string }) {
  return (
    <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
      Esperando os outros ({done}/{total} {verb})
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

/** Uma cartinha (só leitura): papel creme, número e, se for o caso, o selo da mentira. */
function PaperCard({ label, text, lie, dim = false }: { label: string; text: string; lie: boolean; dim?: boolean }) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        p: 1.5,
        borderRadius: 'var(--radius-lg)',
        background: PAPER,
        color: INK,
        border: `3px solid ${lie ? RED : withAlpha(ACCENT.main, 0.7)}`,
        opacity: dim ? 0.7 : 1,
      }}
    >
      <Box sx={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: RED, color: '#fff6dc', fontWeight: 900 }}>{label}</Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '1.08rem', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{text}</Typography>
      {lie && <Typography sx={{ flexShrink: 0, fontWeight: 900, color: RED, fontSize: '0.95rem' }}>🤥 MENTIRA</Typography>}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

function WritePanel({ state, me, code, myInput, send, now }: Props) {
  const storeKey = draftKey(code, me?.id ?? 0, state.seed)
  const sentEntry = readEntry(myInput)
  const [draft, setDraft] = useState<Draft>(() => {
    if (sentEntry) return { facts: [...sentEntry.facts], lie: sentEntry.lie }
    return loadDraft(storeKey) ?? { facts: ['', '', ''], lie: null }
  })
  const [editing, setEditing] = useState(false)
  const [focus, setFocus] = useState(0)
  const [page, setPage] = useState(me?.id ?? 0)

  const update = (next: Draft) => {
    setDraft(next)
    saveDraft(storeKey, next)
  }
  const clean = draft.facts.map(cleanFact)
  const problem = entryProblem(clean, draft.lie)

  const submit = () => {
    if (problem) return
    send({ facts: clean, lie: draft.lie })
    buzz([20, 40, 20])
    setEditing(false)
  }

  if (sentEntry && !editing) {
    return (
      <Box>
        <Header state={state} now={now} grace />
        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: '2.6rem', lineHeight: 1 }}>🧦🎁</Typography>
          <Typography sx={{ color: ACCENT.main, fontWeight: 900, fontSize: '1.35rem', mt: 0.5 }}>Cartinhas na meia!</Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>Na sua vez, a TV lê para a mesa. Segura a cara de paisagem 😐</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sentEntry.facts.map((fact, index) => (
            <PaperCard key={index} label={String(index + 1)} text={fact} lie={index === sentEntry.lie} />
          ))}
        </Box>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={() => {
            setDraft({ facts: [...sentEntry.facts], lie: sentEntry.lie })
            setEditing(true)
          }}
          sx={{ mt: 1.5, minHeight: 52, fontWeight: 700, textTransform: 'none', fontSize: '1.05rem' }}
        >
          ✏️ Editar cartinhas
        </Button>
        <Waiting done={state.acted.length} total={state.roster.length} verb="prontos" />
      </Box>
    )
  }

  const ideas = promptPage(page)
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.3 }}>
        Escreva 3 frases sobre você: <span style={{ color: GREEN }}>2 verdades</span> e <span style={{ color: RED }}>1 mentira</span>.
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', mb: 1.5 }}>Toque em 🤥 na frase que é mentira.</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {draft.facts.map((fact, index) => {
          const isLie = draft.lie === index
          const length = factLength(fact)
          return (
            <Box
              key={index}
              sx={{
                p: 1.25,
                borderRadius: 'var(--radius-lg)',
                background: PAPER,
                color: INK,
                border: `3px solid ${isLie ? RED : focus === index ? ACCENT.main : 'transparent'}`,
                boxShadow: isLie ? `0 0 18px ${RED}66` : '0 4px 14px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 900, color: '#7a2a1a', fontSize: '0.95rem' }}>✉️ Cartinha {index + 1}</Typography>
                <Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 700, color: length >= MAX_FACT_CHARS - 8 ? RED : '#7a5a3a' }}>
                  {length}/{MAX_FACT_CHARS}
                </Box>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={3}
                value={fact}
                onFocus={() => setFocus(index)}
                onChange={(event) => {
                  const facts = [...draft.facts]
                  facts[index] = limitFact(event.target.value.replace(/\n/g, ' '))
                  update({ ...draft, facts })
                }}
                placeholder={index === 0 ? 'Ex.: Já comi um panetone inteiro sozinho' : index === 1 ? 'Outra coisa sobre você…' : 'Mais uma…'}
                autoComplete="off"
                slotProps={{ htmlInput: { enterKeyHint: 'next', 'aria-label': `Frase ${index + 1}` } }}
                sx={{
                  '& .MuiInputBase-root': { background: '#ffffff', color: INK, borderRadius: 2 },
                  '& .MuiInputBase-input': { fontSize: '1.08rem', fontWeight: 600, color: INK },
                  '& .MuiInputBase-input::placeholder': { color: '#8a6a4a', opacity: 1 },
                }}
              />
              <Button
                fullWidth
                variant={isLie ? 'contained' : 'outlined'}
                onClick={() => {
                  update({ ...draft, lie: isLie ? null : index })
                  buzz(20)
                }}
                sx={{
                  mt: 0.75,
                  minHeight: 44,
                  fontWeight: 800,
                  textTransform: 'none',
                  fontSize: '1rem',
                  borderWidth: 2,
                  color: isLie ? '#fff6dc' : '#7a2a1a',
                  background: isLie ? RED : 'transparent',
                  borderColor: isLie ? RED : '#c9a77c',
                  '&:hover': { background: isLie ? RED : `${RED}18`, borderWidth: 2 },
                }}
              >
                {isLie ? '🤥 Esta é a MENTIRA' : '✓ Verdade — tocar se for a mentira'}
              </Button>
            </Box>
          )
        })}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
          <Typography sx={{ fontWeight: 800, color: 'var(--text-secondary)' }}>💡 Sem ideia? Toque para começar a cartinha {focus + 1}:</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {ideas.map((idea) => (
            <Button
              key={idea}
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => {
                const facts = [...draft.facts]
                facts[focus] = applyPrompt(facts[focus], idea)
                update({ ...draft, facts })
                buzz(15)
              }}
              sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 600, borderColor: 'var(--border-medium)', lineHeight: 1.2, py: 0.6 }}
            >
              {idea}…
            </Button>
          ))}
          <Button size="small" onClick={() => setPage(page + 1)} sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 800, color: ACCENT.main }}>
            🔀 outras ideias
          </Button>
        </Box>
      </Box>

      <Typography sx={{ mt: 2, textAlign: 'center', fontWeight: 800, color: problem ? 'var(--text-secondary)' : GREEN }}>{problemText(problem)}</Typography>
      <Button fullWidth variant="contained" disabled={problem !== null} onClick={submit} sx={{ ...BIG_BUTTON, mt: 1 }}>
        {sentEntry ? '💾 Salvar cartinhas' : '🎁 Pôr na meia (enviar)'}
      </Button>
      {sentEntry && (
        <Button
          fullWidth
          variant="text"
          color="inherit"
          onClick={() => setEditing(false)}
          sx={{ mt: 1, minHeight: 48, textTransform: 'none', color: 'var(--text-secondary)' }}
        >
          Cancelar (ficam as anteriores)
        </Button>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Vez de alguém
// ---------------------------------------------------------------------------

function MyTurnPanel({ state, mine, now }: Props) {
  const lieCard = myLieCard(mine, state.cards)
  const voters = votersOf(state)
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography className="dv-wiggle" sx={{ fontSize: '3.4rem', lineHeight: 1 }}>
          🎤
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.1, color: ACCENT.main }}>É a sua vez!</Typography>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Faça cara de paisagem 😐 e defenda as três. Você não vota.</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {state.cards.map((card) => (
          <PaperCard key={card.id} label={cardLetter(card.id)} text={card.text} lie={card.id === lieCard} />
        ))}
      </Box>
      <Typography sx={{ mt: 1.5, textAlign: 'center', color: 'var(--text-muted)' }}>Cada pessoa que cair na mentira = +1 para você 😏</Typography>
      <Waiting done={state.acted.length} total={voters.length} verb="votaram" />
    </Box>
  )
}

function VotePanel({ state, players, myInput, send, now }: Props) {
  const chosen = typeof myInput?.card === 'number' ? myInput.card : null
  const author = nameOf(players, state.author)
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', lineHeight: 1.2 }}>
        Qual é a mentira de <span style={{ color: ACCENT.main }}>{author}</span>? 🤔
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 1.5, fontWeight: 700, color: chosen !== null ? ACCENT.main : 'var(--text-secondary)' }}>
        {chosen !== null ? `✓ Você votou na ${cardLetter(chosen)}. Dá para trocar até o fim.` : 'Conversem com a mesa e toque na mentira:'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {state.cards.map((card) => (
          <VoteButton
            key={card.id}
            card={card}
            selected={card.id === chosen}
            onPick={() => {
              send({ card: card.id })
              buzz(25)
            }}
          />
        ))}
      </Box>
      {chosen !== null && <Waiting done={state.acted.length} total={votersOf(state).length} verb="votaram" />}
    </Box>
  )
}

function VoteButton({ card, selected, onPick }: { card: DvCard; selected: boolean; onPick: () => void }) {
  return (
    <Button
      variant={selected ? 'contained' : 'outlined'}
      onClick={onPick}
      sx={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 84,
        py: 1.5,
        px: 1.5,
        textAlign: 'left',
        textTransform: 'none',
        fontSize: '1.12rem',
        fontWeight: 800,
        lineHeight: 1.25,
        borderWidth: 3,
        borderRadius: 'var(--radius-lg)',
        borderColor: selected ? RED : ACCENT.main,
        color: INK,
        background: selected ? 'linear-gradient(160deg, #fff1ec 0%, #ffd2c8 100%)' : PAPER,
        boxShadow: selected ? `0 0 22px ${RED}88` : '0 4px 14px rgba(0, 0, 0, 0.3)',
        '&:hover': { background: selected ? 'linear-gradient(160deg, #fff1ec 0%, #ffd2c8 100%)' : PAPER, borderWidth: 3 },
      }}
    >
      <Box
        component="span"
        sx={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '1.4rem', background: RED, color: '#fff6dc', border: `3px solid ${XMAS_COLORS.gold}` }}
      >
        {cardLetter(card.id)}
      </Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        {card.text}
      </Box>
      {selected && (
        <Box component="span" sx={{ flexShrink: 0, fontSize: '1.6rem' }}>
          🤥
        </Box>
      )}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Revelação
// ---------------------------------------------------------------------------

function RevealPanel({ state, players, me, now }: Props) {
  const current = useServerNow(now)
  const reveal = state.reveal
  if (!reveal || !me) return null

  // Enquanto a TV rufa os tambores, o celular não entrega o resultado.
  if (current < revealStartedAt(state.deadline, reveal) + DRUM_MS) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} />
        <Typography className="hw-pulse" sx={{ fontSize: '4rem', lineHeight: 1, mt: 3 }}>
          🥁
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.1, mt: 2 }}>Olhe a TV!</Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>E a mentira é…</Typography>
      </Box>
    )
  }

  const lie = state.cards[reveal.lieCard]
  const author = nameOf(players, reveal.author)
  const gained = reveal.gained[String(me.id)] ?? 0
  const isAuthor = me.id === reveal.author
  const myVote = reveal.votes[String(me.id)]
  const right = myVote !== undefined && myVote === reveal.lieCard

  let icon: string
  let title: string
  let detail: string
  if (isAuthor) {
    const fooled = reveal.fooled.length
    icon = fooled && !reveal.right.length ? '🤥' : fooled ? '😏' : '😅'
    title = !fooled ? 'Ninguém caiu…' : !reveal.right.length ? 'Enganou todo mundo!' : `Você enganou ${fooled}!`
    detail = fooled ? (reveal.right.length ? `${namesOf(players, reveal.right)} ${reveal.right.length > 1 ? 'farejaram' : 'farejou'} a mentira.` : 'Mente melhor que o Papai Noel!') : 'A mesa te conhece bem demais.'
  } else if (myVote === undefined) {
    icon = '😴'
    title = 'Você não votou'
    detail = 'Na próxima, toque na mentira!'
  } else if (right) {
    icon = '🎯'
    title = 'Acertou!'
    detail = `Farejou a lorota de ${author}.`
  } else {
    icon = '🤦'
    title = 'Caiu na lorota!'
    detail = `Você votou na ${cardLetter(myVote)} — era verdade!`
  }

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontSize: '3.6rem', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1.1, mt: 1, color: right || (isAuthor && reveal.fooled.length) ? ACCENT.main : 'var(--text-primary)' }}>
        {title}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', mt: 0.75 }}>{detail}</Typography>
      {gained > 0 && <Typography sx={{ mt: 1, color: ACCENT.main, fontWeight: 900, fontSize: '1.6rem' }}>+{pointsLabel(gained)}</Typography>}
      {lie && (
        <Box sx={{ mt: 2.5, textAlign: 'left' }}>
          <Typography sx={{ color: 'var(--text-muted)', mb: 0.75, textAlign: 'center' }}>A mentira de {isAuthor ? 'você' : author} era:</Typography>
          <PaperCard label={cardLetter(lie.id)} text={lie.text} lie />
        </Box>
      )}
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>Olhe a TV 📺</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const fooled = state.fooledTotal?.[String(me.id)] ?? 0
  const found = state.rightTotal?.[String(me.id)] ?? 0
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim das histórias</Typography>
      {!state.queue.length ? (
        <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>Ninguém escreveu as cartinhas… 🤐</Typography>
      ) : (
        <>
          {mine && (
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
              Você ficou em {mine.place}º com {pointsLabel(mine.score)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Stat icon="🤥" value={fooled} label={fooled === 1 ? 'enganado' : 'enganados'} />
            <Stat icon="🎯" value={found} label={found === 1 ? 'mentira achada' : 'mentiras achadas'} />
          </Box>
          <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
            <Typography sx={{ color: 'var(--text-muted)' }}>🏆 Campeão da lareira</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>{awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém'}</Typography>
          </Box>
          {awards.bestLie && (
            <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
              <Typography sx={{ color: 'var(--text-muted)' }}>🎭 Mentira da noite</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>“{awards.bestLie.lie}”</Typography>
              <Typography sx={{ color: 'var(--text-secondary)' }}>
                {nameOf(players, awards.bestLie.author)} enganou {awards.bestLie.fooled}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <Box sx={{ flex: 1, p: 1.5, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.05)', border: '2px solid var(--border-medium)' }}>
      <Typography sx={{ fontSize: '1.6rem', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '2.2rem', lineHeight: 1.1, color: ACCENT.main }}>{value}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</Typography>
    </Box>
  )
}
