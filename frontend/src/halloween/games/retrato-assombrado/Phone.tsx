import { useEffect, useRef, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { nameOf } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import DrawingBoard from '../../../games/ui/DrawingBoard'
import { categoryAt } from './content'
import {
  COLOR_NAMES,
  MAX_POINTS,
  PALETTE,
  appendStroke,
  compactStroke,
  countPoints,
  sendDelay,
  slotFields,
  toBoardStrokes,
} from './drawing'
import type { Stroke } from './drawing'
import { DRAW_SLOT, MAX_GUESS_LENGTH, REVEAL_SECONDS, finalAwards, type State } from './engine'
import { meta } from './meta'
import { VERDICT_DELAY_MS, buzz, drawView, graceFor, namesOf, plural, verdictText } from './view'

/**
 * Celular do "Retrato Assombrado": uma ação clara por tela. Primeiro o
 * segredo; depois a prancheta (o desenho fica no slot 'draw' e volta
 * sozinho se a tela recarregar); depois os nomes para votar e, para o
 * impostor pego, o campo do chute.
 */

type Props = HalloweenViewProps<State>

const ACCENT = meta.accent
const BLOOD = 'var(--blood, #e0213a)'
/** Espessura do traço no celular (espaço 1000×625). */
const PHONE_STROKE = 9

export default function Phone(props: Props) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  switch (state.phase) {
    case 'show':
      return <SecretPanel {...props} />
    case 'draw1':
    case 'peek':
    case 'draw2':
    case 'gallery':
      // A mesma prancheta da 1ª etapa à galeria (a chave segura o estado na rodada).
      return <DrawPanel key={state.round} {...props} />
    case 'vote':
      return <VotePanel {...props} />
    case 'reveal':
      return <RevealPanel {...props} />
    case 'guess':
      return <GuessPanel {...props} />
    case 'result':
      return <ResultPanel {...props} />
    default:
      return <ScorePanel {...props} />
  }
}

function Header({ state, now }: { state: State; now: () => number }) {
  const { seconds } = useCountdown(state.deadline, now, graceFor(state.phase))
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
        RODADA {state.round}/{state.totalRounds}
      </Typography>
      {seconds !== null && (
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.8rem', lineHeight: 1, color: seconds <= 5 ? BLOOD : ACCENT.main }}
        >
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

/** O segredo em uma linha, para lembrar enquanto desenha (mesmo visual para todo mundo). */
function SecretStrip({ state, mine }: { state: State; mine: Props['mine'] }) {
  const impostor = mine?.role === 'impostor'
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.75,
        mb: 1.25,
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${ACCENT.main}66`,
        background: 'rgba(255, 255, 255, 0.04)',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 1,
        minWidth: 0,
      }}
    >
      {/* A palavra quebra linha em vez de virar "Relógio de pên…" — é o que a pessoa desenha. */}
      <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1.15, minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
        {!mine ? '👀 Olhe a TV' : impostor ? '🤫 Você é o IMPOSTOR' : `🎨 ${mine.word}`}
      </Typography>
      <Typography noWrap sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0, maxWidth: '40%' }}>
        {categoryAt(state.categoryId).icon} {categoryAt(state.categoryId).name}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// show: o segredo
// ---------------------------------------------------------------------------

function SecretPanel({ state, mine, now }: Props) {
  const category = categoryAt(state.categoryId)
  const impostor = mine?.role === 'impostor'
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      <Box
        className="animate-pop-in"
        sx={{
          p: 2.5,
          borderRadius: 'var(--radius-xl)',
          border: `3px solid ${ACCENT.main}`,
          background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
          boxShadow: `0 0 30px ${ACCENT.glow}`,
        }}
      >
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em' }}>
          CATEGORIA: {category.icon} {category.name.toUpperCase()}
        </Typography>
        {!mine ? (
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, mt: 2 }}>👀 Olhe a TV</Typography>
        ) : impostor ? (
          <>
            <Typography sx={{ fontSize: '3.4rem', lineHeight: 1, mt: 2 }}>🤫</Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.3rem', lineHeight: 1.05, color: BLOOD, mt: 1 }}>
              VOCÊ É O IMPOSTOR
            </Typography>
            <Typography sx={{ mt: 1.5, fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Você não sabe a palavra. Desenhe algo da categoria e copie a galera na espiadinha da TV.
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ mt: 2, color: 'var(--text-secondary)', fontWeight: 700 }}>A PALAVRA É</Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}>
              {mine.word}
            </Typography>
            <Typography sx={{ mt: 1.5, fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Desenhe sem entregar demais: tem impostor copiando!
            </Typography>
          </>
        )}
      </Box>
      <Typography sx={{ mt: 2, color: 'var(--text-muted)' }}>
        {state.impostorCount > 1 ? 'Há 2 impostores na mesa (um não conhece o outro).' : 'Há 1 impostor na mesa.'}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// draw1 → peek → draw2 → gallery: a prancheta
// ---------------------------------------------------------------------------

function DrawPanel({ state, me, mine, slots, sendSlot, now }: Props) {
  const [color, setColor] = useState(0)
  const [draft, setDraft] = useState<number[][]>([])
  /** Traços que ainda esperam o próximo envio (o desenho inteiro, já com eles). */
  const [pending, setPending] = useState<Stroke[] | null>(null)
  const lastSentAt = useRef(0)
  const { stage, strokes, n1, done, canDraw, full } = drawView(state, me ? slots[DRAW_SLOT]?.[me.id] : null, pending)

  // Freio: um POST por traço, com 15 pessoas desenhando, afoga o servidor
  // (um processo só). Sai no máximo um envio a cada SEND_GAP_MS; quando a
  // etapa acaba (espiadinha, galeria), o que sobrou sai na hora — a chave
  // ainda é a da etapa, então conta.
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(
      () => {
        lastSentAt.current = now()
        sendSlot(DRAW_SLOT, slotFields(pending, false, n1))
        setPending(null)
      },
      stage === 0 ? 0 : sendDelay(lastSentAt.current, now()),
    )
    return () => clearTimeout(timer)
  }, [pending, stage, n1, sendSlot, now])

  // Saindo da prancheta com traço na fila (pulou a galeria): manda antes de sumir.
  const leftover = useRef<{ pending: Stroke[] | null; n1: number | null; sendSlot: Props['sendSlot'] }>({
    pending: null,
    n1: null,
    sendSlot,
  })
  useEffect(() => {
    leftover.current = { pending, n1, sendSlot }
  }, [pending, n1, sendSlot])
  useEffect(
    () => () => {
      const last = leftover.current
      if (last.pending) last.sendSlot(DRAW_SLOT, slotFields(last.pending, false, last.n1))
    },
    [],
  )

  if (!me) return null

  /** Envia já ("Pronto", "Ops"): o celular é a fonte do desenho; a TV só lê. */
  const sendNow = (next: Stroke[], ready: boolean) => {
    lastSentAt.current = now()
    sendSlot(DRAW_SLOT, slotFields(next, ready, n1))
    setPending(null)
  }

  const onStrokeEnd = (points: number[][]) => {
    setDraft([])
    const next = appendStroke(strokes, compactStroke(points, color))
    if (next) setPending(next)
  }
  // Na 2ª etapa, os traços da 1ª ficam: nada de apagar o que a mesa já viu.
  const locked = n1 ?? 0

  const caption =
    state.phase === 'draw1'
      ? '✏️ Etapa 1 de 2 — desenhe!'
      : state.phase === 'peek'
        ? '👀 Espiadinha! Olhe os desenhos na TV'
        : state.phase === 'draw2'
          ? '🖌️ Etapa 2 — continue o MESMO desenho'
          : '🖼️ Olhe a galeria na TV: quem não sabia a palavra?'

  return (
    <Box>
      <Header state={state} now={now} />
      <SecretStrip state={state} mine={mine} />
      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 1, color: stage ? 'var(--text-primary)' : ACCENT.light }}>
        {caption}
      </Typography>

      <Box sx={{ opacity: canDraw ? 1 : 0.85 }}>
        <DrawingBoard
          strokes={toBoardStrokes(strokes, PHONE_STROKE)}
          draft={canDraw ? draft : []}
          draftColor={PALETTE[color]}
          draftWidth={PHONE_STROKE}
          interactive={canDraw && !full}
          accent={ACCENT.main}
          onDraftChange={setDraft}
          onStrokeEnd={onStrokeEnd}
        />
      </Box>

      {canDraw && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.25, gap: 0.5 }}>
            {PALETTE.map((swatch, index) => (
              <Box
                key={swatch}
                component="button"
                type="button"
                aria-label={COLOR_NAMES[index]}
                onClick={() => setColor(index)}
                sx={{
                  width: 42,
                  height: 42,
                  p: 0,
                  borderRadius: '50%',
                  background: swatch,
                  cursor: 'pointer',
                  border: `3px solid ${color === index ? ACCENT.main : 'rgba(255,255,255,0.25)'}`,
                  boxShadow: color === index ? `0 0 14px ${ACCENT.glow}` : 'none',
                  transform: color === index ? 'scale(1.12)' : 'none',
                  transition: 'transform 140ms ease',
                }}
              />
            ))}
          </Box>
          <InkBar strokes={strokes} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 1, mt: 1.25 }}>
            <Button
              variant="outlined"
              disabled={strokes.length <= locked}
              onClick={() => setPending(strokes.slice(0, -1))}
              sx={{ minHeight: 56, fontWeight: 800, fontSize: '1rem', textTransform: 'none', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
            >
              ↩️ Desfazer
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                buzz(40)
                sendNow(strokes, true)
              }}
              sx={{
                minHeight: 56,
                fontWeight: 900,
                fontSize: '1.15rem',
                textTransform: 'none',
                color: ACCENT.contrast,
                background: ACCENT.main,
                '&:hover': { background: ACCENT.light },
              }}
            >
              ✓ Pronto!
            </Button>
          </Box>
        </>
      )}

      {stage > 0 && done && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography sx={{ color: ACCENT.main, fontWeight: 800, fontSize: '1.15rem' }}>
            ✓ Pronto! Esperando os outros ({state.acted.length}/{state.roster.length})
          </Typography>
          <Button variant="text" onClick={() => sendNow(strokes, false)} sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700, minHeight: 48 }}>
            ✏️ Ops, quero desenhar mais
          </Button>
        </Box>
      )}

      {stage === 0 && (
        <Typography sx={{ mt: 1.5, textAlign: 'center', color: 'var(--text-secondary)' }}>
          {state.phase === 'peek' ? 'Já já você continua o seu desenho.' : 'Já já começa a votação.'}
        </Typography>
      )}
    </Box>
  )
}

function InkBar({ strokes }: { strokes: Stroke[] }) {
  const used = Math.min(1, countPoints(strokes) / MAX_POINTS)
  const low = used >= 0.85
  return (
    <Box sx={{ mt: 1.25 }}>
      <Box sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${(1 - used) * 100}%`, background: low ? BLOOD : ACCENT.main, transition: 'width 200ms ease' }} />
      </Box>
      {low && (
        <Typography sx={{ mt: 0.5, fontSize: '0.85rem', color: BLOOD, fontWeight: 700 }}>
          {used >= 1 ? '🖋️ A tinta acabou! Aperte "Pronto".' : '🖋️ Quase sem tinta…'}
        </Typography>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// vote: quem é o impostor?
// ---------------------------------------------------------------------------

function VotePanel({ state, players, me, mine, myInput, send, now }: Props) {
  const chosen = typeof myInput?.vote === 'number' ? myInput.vote : null
  const others = state.roster.filter((id) => id !== me?.id)
  return (
    <Box>
      <Header state={state} now={now} />
      <SecretStrip state={state} mine={mine} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.05, mb: 0.5 }}>🗳️ Quem é o impostor?</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', mb: 1.5 }}>Olhe a galeria na TV e toque num nome.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {others.map((id) => {
          const selected = chosen === id
          return (
            <Button
              key={id}
              variant={selected ? 'contained' : 'outlined'}
              onClick={() => {
                buzz()
                send({ vote: id })
              }}
              sx={{
                minHeight: 56,
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                lineHeight: 1.15,
                borderWidth: 2,
                overflowWrap: 'anywhere',
                borderColor: selected ? ACCENT.main : 'var(--border-medium)',
                color: selected ? ACCENT.contrast : 'var(--text-primary)',
                background: selected ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
                '&:hover': { background: selected ? ACCENT.light : `${ACCENT.main}22`, borderWidth: 2 },
              }}
            >
              {nameOf(players, id)}
            </Button>
          )
        })}
      </Box>
      <Typography sx={{ mt: 2, textAlign: 'center', color: chosen !== null ? ACCENT.main : 'var(--text-secondary)', fontWeight: 600 }}>
        {chosen !== null
          ? `✓ Voto em ${nameOf(players, chosen)}. Dá para trocar. Esperando os outros (${state.acted.length}/${state.roster.length})`
          : 'Quem desenhou sem saber a palavra?'}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// reveal: o veredito (no mesmo ritmo da TV)
// ---------------------------------------------------------------------------

function RevealPanel({ state, players, me, now }: Props) {
  const t = useServerNow(now)
  const reveal = state.reveal
  if (!reveal || !me) return null
  // O celular espera o rufar da TV para não estragar a surpresa.
  const startedAt = (state.deadline ?? 0) - REVEAL_SECONDS * 1000
  const shown = t >= startedAt + VERDICT_DELAY_MS
  const verdict = verdictText(state, players)
  const myVote = reveal.votes[String(me.id)]
  const wasImpostor = reveal.impostors.includes(me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      {!shown ? (
        <Box sx={{ py: 4 }}>
          <Typography className="animate-urgent" sx={{ fontSize: '4rem', lineHeight: 1 }}>
            🥁
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', mt: 1 }}>Olhe a TV…</Typography>
        </Box>
      ) : (
        <Box className="animate-pop-in">
          <Typography sx={{ fontSize: '3.6rem', lineHeight: 1 }}>{verdict.icon}</Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', lineHeight: 1.05, mt: 1, wordBreak: 'break-word' }}>
            {verdict.title}
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>{verdict.detail}</Typography>
          <Box sx={{ mt: 2.5, p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
            {wasImpostor && reveal.chaos === null && (
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: reveal.caught && reveal.accused === me.id ? BLOOD : ACCENT.main }}>
                {reveal.caught && reveal.accused === me.id ? 'Pegaram você! 😱' : 'Você escapou! 😈 +2'}
              </Typography>
            )}
            <Typography sx={{ fontWeight: 700 }}>
              {myVote === undefined ? 'Você não votou 😴' : `Você votou em ${nameOf(players, myVote)}`}
            </Typography>
            {myVote !== undefined && !wasImpostor && reveal.chaos === null && reveal.impostors.includes(myVote) && (
              <Typography sx={{ color: ACCENT.main, fontWeight: 800, mt: 0.5 }}>
                🦅 Acertou o impostor{reveal.caught ? '! +1' : ' — mas a mesa não o pegou.'}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// guess: a última chance do impostor pego
// ---------------------------------------------------------------------------

function GuessPanel({ state, players, me, myInput, send, now }: Props) {
  const [text, setText] = useState('')
  const accused = state.reveal?.accused ?? null
  if (!me) return null
  const sent = typeof myInput?.guess === 'string' ? myInput.guess : null

  if (accused !== me.id) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} />
        <Typography sx={{ fontSize: '3.4rem', lineHeight: 1, mt: 2 }}>🤞</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', lineHeight: 1.1, mt: 1 }}>
          {nameOf(players, accused)} está tentando adivinhar a palavra…
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>Bico calado! Olhe a TV.</Typography>
      </Box>
    )
  }

  const submit = () => {
    const guess = text.trim().slice(0, MAX_GUESS_LENGTH)
    if (!guess) return
    buzz(40)
    send({ guess })
  }

  return (
    <Box>
      <Header state={state} now={now} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1.05, color: BLOOD }}>🎯 Pegaram você!</Typography>
      <Typography sx={{ mt: 1, fontSize: '1.1rem', fontWeight: 700 }}>Última chance: qual era a palavra? Acertou, leva +2.</Typography>
      <Typography sx={{ mt: 0.5, color: 'var(--text-secondary)' }}>
        Categoria: {categoryAt(state.categoryId).icon} {categoryAt(state.categoryId).name}
      </Typography>
      {sent ? (
        <Typography sx={{ mt: 3, textAlign: 'center', color: ACCENT.main, fontWeight: 800, fontSize: '1.2rem' }}>
          ✓ Chute enviado: “{sent}”. Olhe a TV!
        </Typography>
      ) : (
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}
        >
          <TextField
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_GUESS_LENGTH))}
            placeholder="Digite a palavra"
            autoComplete="off"
            fullWidth
            slotProps={{ htmlInput: { maxLength: MAX_GUESS_LENGTH, autoCapitalize: 'none', 'aria-label': 'Seu chute' } }}
            sx={{ '& .MuiInputBase-input': { fontSize: '1.3rem', py: 1.5 } }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!text.trim()}
            sx={{
              minHeight: 58,
              fontWeight: 900,
              fontSize: '1.15rem',
              textTransform: 'none',
              color: '#fff',
              background: BLOOD,
              '&:hover': { background: '#b91c1c' },
            }}
          >
            🎯 Chutar — só uma chance!
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// result, placar e fim
// ---------------------------------------------------------------------------

function ResultPanel({ state, me, now }: Props) {
  const outcome = state.outcome
  if (!outcome || !me) return null
  const gained = outcome.gains[String(me.id)] ?? 0
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} />
      {outcome.word ? (
        <>
          <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.1em' }}>A PALAVRA ERA</Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}>
            {outcome.word}
          </Typography>
        </>
      ) : (
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.1 }}>🤡 Não tinha palavra!</Typography>
      )}
      <Box sx={{ mt: 3, p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${gained ? ACCENT.main : 'var(--border-medium)'}` }}>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '2.6rem', lineHeight: 1, color: gained ? ACCENT.main : 'var(--text-muted)' }}>
          {gained ? `+${gained}` : '+0'}
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
          {gained ? 'Boa! Olhe a TV.' : 'Nada desta vez. Olhe a TV.'}
        </Typography>
      </Box>
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
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem' }}>Placar</Typography>
      <Typography sx={{ fontSize: '4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main }}>{mine?.score ?? 0}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>{mine ? `${mine.place}º lugar` : 'fora do placar'}</Typography>
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>
        {ranking[0] && ranking[0].score > 0 ? `${nameOf(players, ranking[0].id)} lidera. ` : ''}Próxima rodada já já!
      </Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da exposição</Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {plural(mine.score, 'ponto', 'pontos')}
        </Typography>
      )}
      <Award icon="🏆" title="Artista da noite" names={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém'} highlight />
      <Award icon="🎭" title="Mestre do disfarce" names={awards.disguise.length ? namesOf(players, awards.disguise) : 'Ninguém escapou'} />
      <Award icon="🦅" title="Olho de lince" names={awards.eagle.length ? namesOf(players, awards.eagle) : 'Ninguém acertou'} />
    </Box>
  )
}

function Award({ icon, title, names, highlight = false }: { icon: string; title: string; names: string; highlight?: boolean }) {
  return (
    <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${highlight ? ACCENT.main : 'var(--border-medium)'}` }}>
      <Typography sx={{ color: 'var(--text-muted)' }}>
        {icon} {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', wordBreak: 'break-word' }}>{names}</Typography>
    </Box>
  )
}
