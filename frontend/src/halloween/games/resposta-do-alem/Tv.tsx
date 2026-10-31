import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { CandleTimer, CandyRain, HauntedTitle, PlayerBadge } from '../../ui'
import {
  SCORES_SECONDS,
  VOTE_SECONDS,
  WRITE_SECONDS,
  finalAwards,
  revealSeconds,
  type RdaResult,
  type RdaState,
} from './engine'
import { meta } from './meta'
import {
  ALEM_DELAY_MS,
  SOLO_DELAY_MS,
  WINNER_DELAY_MS,
  cardGrid,
  cardLetter,
  filledAfter,
  namesOf,
  pointsLabel,
  promptParts,
  rankColumns,
  revealLines,
  soloTitle,
  speakablePrompt,
  topResults,
  votesLabel,
} from './view'

/**
 * TV do "Resposta do Além". Só desenha o estado — quem decide fase, votos e
 * pontos é o motor. Letras para 3 metros: texto de pelo menos 28 px, títulos
 * de 64 px para cima e a vela-cronômetro sempre à vista.
 *
 * Cabe 15 respostas numa TV 1920×1080 sem rolar: a vela fica ao lado da
 * frase (não numa barra só dela) e a letra da carta vai na mesma linha do
 * texto, que fica com a largura toda.
 */

const ACCENT = meta.accent
/** No fim, depois da fanfarra: zoom suspeito em quem venceu. */
const CHAMPION_ZOOM_MS = 3200

const PROMPT_FONT = {
  big: 'clamp(3.4rem, 5vw, 5.8rem)',
  medium: 'clamp(2.3rem, 2.9vw, 3.3rem)',
  small: 'clamp(1.9rem, 2.3vw, 2.6rem)',
} as const

const VEIL = 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))'
const TEXT_MIN = 'clamp(1.75rem, 2vw, 2.3rem)'

export default function Tv({ state, players, now }: HalloweenViewProps<RdaState>) {
  // "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo.
  const phase = state.over ? 'final' : state.phase
  // Susto aleatório no meio da votação ou da revelação estraga a piada: segura.
  useSuppressScares(phase === 'vote' || phase === 'reveal' || phase === 'final')
  // Swing para escrever, tique-taque para decidir; no fim, a da vitória.
  useMusic(phase === 'final' ? 'victory' : phase === 'vote' ? 'quiz' : 'party')
  usePhaseSounds(state, players, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'write' && <WriteBoard state={state} players={players} now={now} />}
          {state.phase === 'vote' && <VoteBoard state={state} players={players} now={now} />}
          {state.phase === 'reveal' && <RevealBoard state={state} players={players} now={now} />}
          {state.phase === 'scores' && <Scoreboard state={state} players={players} now={now} />}
        </>
      )}
    </Box>
  )
}

type BoardProps = { state: RdaState; players: HPlayer[]; now: () => number }

/**
 * Som de cada momento, uma vez por rodada+fase (nunca a cada poll): sino e a
 * voz de terror lendo a frase; cartas na mesa; rufar e risada na revelação;
 * estática quando ninguém responde; órgão e zoom no campeão no fim.
 */
function usePhaseSounds(state: RdaState, players: HPlayer[], now: () => number) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const kind = state.reveal?.kind ?? null
  const hasTop = state.reveal?.results.some((result) => result.top) ?? false
  const prompt = state.prompt.text
  const alem = state.reveal?.alem ?? null
  const champions = state.over ? finalAwards(state).champions : []
  const champion = champions.length === 1 ? nameOf(players, champions[0]) : ''
  // A estática assusta uma vez por partida; se a mesa insistir em não responder, só o fantasma geme.
  const staticDone = useRef(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, ms))
    }
    let stopVoice: (() => void) | null = null
    const say = (text: string) => {
      stopVoice?.()
      stopVoice = speakSpooky(text)
    }

    if (phase === 'write') {
      playSfx('bell', { volume: 0.6 })
      later(700, () => say(speakablePrompt(prompt)))
    } else if (phase === 'vote') {
      playSfx('whoosh')
      playSfx('pop', { delay: 0.3 })
    } else if (phase === 'scores') {
      playSfx('ding')
    } else if (phase === 'final') {
      playSfx('organ')
      playSfx('win', { delay: 1.2 })
      // A zoeira do fim: 🤨📸 no nome de quem venceu (só com campeão único).
      if (champion) later(CHAMPION_ZOOM_MS, () => triggerScare('zoom', { name: champion }))
    } else if (phase === 'reveal' && kind === 'empty') {
      // Ninguém respondeu: o sinal cai… e o além responde por vocês.
      if (staticDone.current) {
        playSfx('ghost')
      } else {
        staticDone.current = true
        triggerScare('static')
      }
      if (alem) later(ALEM_DELAY_MS, () => say(`O além responde: ${alem}`))
    } else if (phase === 'reveal') {
      playSfx('drumroll')
      later(kind === 'solo' ? SOLO_DELAY_MS : WINNER_DELAY_MS, () => {
        playSfx(hasTop ? 'win' : 'fail')
        if (hasTop) playSfx('laugh', { delay: 0.5 })
      })
    }

    return () => {
      for (const timer of timers) clearTimeout(timer)
      stopVoice?.()
    }
  }, [moment, phase, kind, hasTop, prompt, alem, champion])

  // "Pop" baixinho a cada ✓ novo: a sala sente que a coisa anda. Só conta o
  // que mudou dentro do mesmo momento (TV recarregada no meio não dispara).
  const answering = phase === 'write' || phase === 'vote'
  const actedCount = state.acted.length
  const lastActed = useRef<{ moment: string; count: number } | null>(null)
  useEffect(() => {
    const previous = lastActed.current
    lastActed.current = { moment, count: actedCount }
    if (!answering || !previous || previous.moment !== moment) return
    if (actedCount > previous.count) playSfx('pop', { volume: 0.45 })
  }, [moment, actedCount, answering])

  // Tique-taque nos últimos 5 segundos da escrita e da votação.
  const { seconds } = useCountdown(answering ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0) return
    const tick = `${moment}-${seconds}`
    if (lastTick.current === tick) return
    lastTick.current = tick
    playSfx('tick')
  }, [seconds, moment])
}

function phaseTotalMs(state: RdaState): number {
  if (state.phase === 'write') return WRITE_SECONDS * 1000
  if (state.phase === 'vote') return VOTE_SECONDS * 1000
  if (state.phase === 'reveal') return (state.reveal ? revealSeconds(state.reveal) : 10) * 1000
  return SCORES_SECONDS * 1000
}

/**
 * O topo de toda fase: rodada + o que fazer agora, o destaque da fase
 * (a frase, a vencedora...) e, ao lado, a vela-cronômetro.
 */
function Stage({ state, now, label, children }: { state: RdaState; now: () => number; label: string; children?: ReactNode }) {
  // Nas fases de resposta a vela apaga na hora prometida; a folga fica escondida.
  const answering = state.phase === 'write' || state.phase === 'vote'
  const deadline = state.deadline === null ? null : state.deadline - (answering ? GRACE_MS : 0)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 2, md: 4 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2, lineHeight: 1.1 }}>
          <Box
            component="span"
            sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.3vw, 2.5rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}
          >
            RODADA {state.round}/{state.totalRounds}
          </Box>
          <Box
            component="span"
            sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 2.7vw, 3rem)', color: ACCENT.main, textShadow: `0 0 22px ${ACCENT.glow}` }}
          >
            {label}
          </Box>
        </Typography>
        {children && <Box sx={{ mt: 1.5 }}>{children}</Box>}
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <CandleTimer deadline={deadline} total={phaseTotalMs(state)} now={now} size={140} />
      </Box>
    </Box>
  )
}

/** A frase, com a lacuna desenhada — ou preenchida com uma resposta. */
function PromptTitle({ text, size, fill }: { text: string; size: keyof typeof PROMPT_FONT; fill?: string }) {
  const parts = promptParts(text)
  const before = parts.before
  // Resposta que já fecha com ponto não ganha outro ("…luz.." vira "…luz.").
  const after = fill ? filledAfter(parts.after, fill) : parts.after
  return (
    <Typography
      sx={{
        fontWeight: 800,
        fontSize: PROMPT_FONT[size],
        lineHeight: 1.12,
        color: 'var(--text-primary)',
        textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
        overflowWrap: 'anywhere',
      }}
    >
      {before}
      {after !== null &&
        (fill ? (
          <Box
            component="span"
            sx={{
              color: ACCENT.main,
              px: '0.18em',
              borderRadius: '0.2em',
              background: `${ACCENT.main}22`,
              textShadow: `0 0 24px ${ACCENT.glow}`,
            }}
          >
            {fill}
          </Box>
        ) : (
          <Box
            component="span"
            className="hw-breathe"
            sx={{
              display: 'inline-block',
              width: '3.2em',
              height: '0.9em',
              mx: '0.15em',
              borderBottom: `0.12em solid ${ACCENT.main}`,
              boxShadow: `0 10px 18px -12px ${ACCENT.glow}`,
            }}
          />
        ))}
      {after}
    </Typography>
  )
}

/** Rodapé das fases de resposta: o recado e quem já agiu (✓, sem revelar o quê). */
function RosterFooter({ state, players, text }: { state: RdaState; players: HPlayer[]; text: string }) {
  const done = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box sx={{ mt: 'auto' }}>
      <Typography sx={{ fontSize: TEXT_MIN, lineHeight: 1.2, color: 'var(--text-secondary)', mb: 1.25 }}>
        {text} · {done.size}/{state.roster.length} {state.phase === 'vote' ? 'já votaram' : 'já responderam'}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        {state.roster.map((id) => (
          <PlayerBadge
            key={id}
            name={nameOf(players, id)}
            acted={done.has(id)}
            offline={!online.has(id) && !done.has(id)}
            size="lg"
          />
        ))}
      </Box>
    </Box>
  )
}

function WriteBoard({ state, players, now }: BoardProps) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      <Stage state={state} now={now} label="✍️ Completem a frase no celular">
        <Box className="animate-pop-in">
          <PromptTitle text={state.prompt.text} size="big" />
        </Box>
      </Stage>
      <RosterFooter state={state} players={players} text="Respostas anônimas, até 60 letras" />
    </Box>
  )
}

function gridColumns(columns: number) {
  return { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${columns}, minmax(0, 1fr))` }
}

function VoteBoard({ state, players, now }: BoardProps) {
  const grid = cardGrid(state.cards.length)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Stage state={state} now={now} label="🗳️ Votem na mais engraçada">
        <PromptTitle text={state.prompt.text} size="medium" />
      </Stage>
      <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns(grid.columns), gap: { xs: 1.5, md: 2 } }}>
        {state.cards.map((card, index) => (
          <Box
            key={card.id}
            className="animate-deal-in"
            style={{ animationDelay: `${index * 90}ms` }}
            sx={{
              minWidth: 0,
              px: { xs: 1.5, md: 2 },
              py: { xs: 1.25, md: 1.5 },
              borderRadius: 'var(--radius-lg)',
              border: `3px solid ${ACCENT.main}66`,
              background: VEIL,
              boxShadow: `0 0 26px ${ACCENT.glow}`,
            }}
          >
            <Typography sx={{ fontSize: grid.font, fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
              {/* A letra é a mesma do celular: "votei na C". */}
              <Box component="span" sx={{ fontFamily: 'var(--font-display)', color: ACCENT.main, mr: '0.4em' }}>
                {cardLetter(card.id)}
              </Box>
              {card.text}
            </Typography>
          </Box>
        ))}
      </Box>
      <RosterFooter state={state} players={players} text="Anônimas — na sua não vale" />
    </Box>
  )
}

function RevealBoard({ state, players, now }: BoardProps) {
  const reveal = state.reveal
  if (!reveal) return null
  if (reveal.kind === 'empty') return <EmptyReveal state={state} now={now} alem={reveal.alem} />
  if (reveal.kind === 'solo' && reveal.results[0]) {
    return <SoloReveal state={state} players={players} now={now} result={reveal.results[0]} />
  }
  return <VoteReveal state={state} players={players} now={now} />
}

/** Sobe da "terra" depois de `delay` ms (CSS puro: nada de timer na tela). */
function Rise({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <Box className="hw-rise" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </Box>
  )
}

function EmptyReveal({ state, now, alem }: { state: RdaState; now: () => number; alem: string | null }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stage state={state} now={now} label="👻 Ninguém respondeu…">
        <PromptTitle text={state.prompt.text} size="small" />
      </Stage>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box>
          <Typography className="animate-ghost" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
            👻
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 4vw, 4.4rem)', lineHeight: 1.1, mt: 1 }}>
            …então o além respondeu por vocês:
          </Typography>
          {alem && (
            <Rise delay={ALEM_DELAY_MS}>
              <Typography
                sx={{
                  mt: 3,
                  fontWeight: 800,
                  fontSize: 'clamp(3rem, 5vw, 5.6rem)',
                  lineHeight: 1.1,
                  color: ACCENT.main,
                  textShadow: `0 0 30px ${ACCENT.glow}`,
                  overflowWrap: 'anywhere',
                }}
              >
                “{alem}”
              </Typography>
            </Rise>
          )}
          <Typography sx={{ fontSize: TEXT_MIN, color: 'var(--text-secondary)', mt: 3 }}>
            Sem pontos nesta rodada. Escrevam na próxima!
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

function SoloReveal({ state, players, now, result }: BoardProps & { result: RdaResult }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stage state={state} now={now} label={`🏆 ${soloTitle(result.authors.length)}`}>
        <Rise delay={SOLO_DELAY_MS}>
          <WinnerPanel prompt={state.prompt.text} result={result} players={players} compact={false} />
        </Rise>
      </Stage>
    </Box>
  )
}

/** A mais votada em destaque: a frase completa com a resposta, quem escreveu e os pontos. */
function WinnerPanel({ prompt, result, players, compact }: { prompt: string; result: RdaResult; players: HPlayer[]; compact: boolean }) {
  const together = result.authors.length > 1
  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: { xs: 1.5, md: 2 },
        borderRadius: 'var(--radius-xl)',
        border: `4px solid ${ACCENT.main}`,
        background: VEIL,
        boxShadow: `0 0 60px ${ACCENT.glow}`,
      }}
    >
      <PromptTitle text={prompt} size={compact ? 'small' : 'medium'} fill={result.text} />
      <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 3, rowGap: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: compact ? 'clamp(2rem, 2.4vw, 2.6rem)' : 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1 }}>
          🏆 {namesOf(players, result.authors)}
          {together ? ' (pensaram igual!)' : ''}
        </Typography>
        <Typography sx={{ fontSize: TEXT_MIN, color: 'var(--text-secondary)' }}>
          {result.voters.length > 0 ? `${votesLabel(result.voters.length)} · ` : ''}+{pointsLabel(result.points)}
          {together ? ' para cada' : ''}
        </Typography>
      </Box>
      {result.voters.length > 0 && (
        <Typography noWrap sx={{ mt: 0.5, fontSize: TEXT_MIN, color: 'var(--text-muted)' }}>
          Votos de {namesOf(players, result.voters)}
        </Typography>
      )}
    </Box>
  )
}

/** Uma resposta revelada: o texto (até `lines` linhas, se pedido), quem escreveu e quantos votos levou. */
function ResultCard({
  result,
  players,
  font,
  highlight,
  lines = null,
}: {
  result: RdaResult
  players: HPlayer[]
  font: string
  highlight: boolean
  lines?: number | null
}) {
  const clamp = lines ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        minWidth: 0,
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.5 },
        borderRadius: 'var(--radius-lg)',
        border: `3px solid ${highlight ? ACCENT.main : 'var(--border-medium)'}`,
        background: highlight ? `${ACCENT.main}22` : VEIL,
        boxShadow: highlight ? `0 0 30px ${ACCENT.glow}` : 'none',
      }}
    >
      <Typography sx={{ fontSize: font, fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere', ...clamp }}>{result.text}</Typography>
      <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography
          noWrap
          sx={{ minWidth: 0, fontSize: 'clamp(1.75rem, 1.9vw, 2.2rem)', lineHeight: 1.2, fontWeight: 800, color: ACCENT.light }}
        >
          {highlight ? '🏆 ' : ''}
          {namesOf(players, result.authors)}
        </Typography>
        <Typography sx={{ flexShrink: 0, fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.9rem, 2.2vw, 2.6rem)', lineHeight: 1 }}>
          {result.voters.length} 🗳️
        </Typography>
      </Box>
    </Box>
  )
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 3.4vw, 3.8rem)', lineHeight: 1.1, color: ACCENT.light }}>
      {children}
    </Typography>
  )
}

function VoteReveal({ state, players, now }: BoardProps) {
  const reveal = state.reveal
  if (!reveal) return null
  const tops = topResults(reveal.results)
  // Até 3 empatadas ganham destaque; mais que isso, ficam marcadas na grade.
  const featured = tops.length <= 3 ? tops : []
  const rest = reveal.results.filter((result) => !featured.includes(result))
  const grid = cardGrid(rest.length)
  // Muita resposta: a vencedora encolhe um pouco para a grade caber na TV.
  const compact = reveal.results.length > 8
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Stage state={state} now={now} label={featured.length === 1 ? '👀 E a mais votada é…' : '👀 Revelação'}>
        {featured.length === 1 ? (
          <Rise delay={WINNER_DELAY_MS}>
            <WinnerPanel prompt={state.prompt.text} result={featured[0]} players={players} compact={compact} />
          </Rise>
        ) : (
          <>
            <PromptTitle text={state.prompt.text} size="small" />
            <Box sx={{ mt: 1.5 }}>
              {tops.length === 0 ? (
                <Banner>👻 Ninguém votou… sem pontos nesta rodada.</Banner>
              ) : (
                <Rise delay={WINNER_DELAY_MS}>
                  <Banner>
                    🤝 Empate entre {tops.length} respostas! O bônus divide: +1 para cada.
                  </Banner>
                </Rise>
              )}
            </Box>
          </>
        )}
      </Stage>
      {featured.length > 1 && (
        <Rise delay={WINNER_DELAY_MS}>
          <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns(featured.length), gap: 2 }}>
            {featured.map((result) => (
              <ResultCard key={result.card} result={result} players={players} font={cardGrid(featured.length).font} highlight />
            ))}
          </Box>
        </Rise>
      )}
      {rest.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns(grid.columns), gap: { xs: 1.5, md: 2 } }}>
          {rest.map((result, index) => (
            // As menos votadas aparecem primeiro: a grade "cresce" até a vencedora.
            <Box key={result.card} className="stagger-in" style={{ animationDelay: `${(rest.length - 1 - index) * 120}ms` }}>
              <ResultCard result={result} players={players} font={grid.font} highlight={result.top} lines={revealLines(rest.length)} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

function Scoreboard({ state, players, now }: BoardProps) {
  const { ranking } = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Stage state={state} now={now} label="🏆 Placar do além" />
      <RankList entries={ranking} players={players} gained={state.reveal?.gained ?? {}} moment="scores" />
    </Box>
  )
}

/**
 * O placar. Com 15 nomes cabe numa TV 1080p sem rolar: 8 linhas entre as
 * rodadas, 5 no fim (os prêmios ficam em cima). Várias colunas são lidas
 * coluna por coluna — a primeira é o topo do placar.
 */
function RankList({
  entries,
  players,
  gained,
  moment,
}: {
  entries: { id: number; score: number; place: number }[]
  players: HPlayer[]
  gained: Record<string, number>
  moment: 'scores' | 'final'
}) {
  const columns = rankColumns(entries.length, moment)
  const rows = Math.ceil(entries.length / columns)
  const many = columns > 1
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: many ? { xs: '1fr', lg: `repeat(${columns}, minmax(0, 1fr))` } : '1fr',
        gridTemplateRows: many ? { lg: `repeat(${rows}, auto)` } : undefined,
        gridAutoFlow: many ? { lg: 'column' } : undefined,
        gap: 1.25,
        columnGap: columns > 2 ? 3 : 5,
        maxWidth: many ? 'none' : 1100,
      }}
    >
      {entries.map((entry, index) => {
        const plus = gained[String(entry.id)] ?? 0
        return (
          <Box
            key={entry.id}
            className="stagger-in"
            style={{ animationDelay: `${index * 70}ms` }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2.5,
              py: 0.75,
              borderRadius: 'var(--radius-lg)',
              background: entry.place === 1 ? `${ACCENT.main}26` : 'rgba(255, 255, 255, 0.04)',
              border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography
              sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', lineHeight: 1.15, color: 'var(--text-muted)', minWidth: '2.2ch' }}
            >
              {entry.place}º
            </Typography>
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', lineHeight: 1.15, fontWeight: 700 }}>
              {nameOf(players, entry.id)}
            </Typography>
            {plus > 0 && (
              <Typography className="animate-pop-in" sx={{ fontSize: TEXT_MIN, lineHeight: 1.15, color: ACCENT.main, fontWeight: 800 }}>
                +{plus}
              </Typography>
            )}
            <Typography
              sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', lineHeight: 1.15, minWidth: '2ch', textAlign: 'right' }}
            >
              {entry.score}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: RdaState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  const best = awards.bestAnswer
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CandyRain active kind="mixed" count={36} />
      <HauntedTitle size="clamp(3.4rem, 4.6vw, 4.8rem)" color={ACCENT.main} align="left" drip>
        Fim da noite
      </HauntedTitle>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Alma mais engraçada"
          main={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? pointsLabel(awards.topScore) : 'os espíritos ficaram tímidos'}
          delay={0}
        />
        <AwardCard
          icon="💬"
          title="Resposta da noite"
          main={best ? `“${best.text}”` : 'Nenhuma levou voto'}
          detail={best ? `${namesOf(players, best.authors)} · ${votesLabel(best.votes)}` : 'a mesa não votou a noite toda'}
          delay={600}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gained={{}} moment="final" />
    </Box>
  )
}

function AwardCard({ icon, title, main, detail, delay }: { icon: string; title: string; main: string; detail: string; delay: number }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: 2.5,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${ACCENT.main}`,
        background: VEIL,
        boxShadow: `0 0 40px ${ACCENT.glow}`,
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      {/* Ícone na linha do título: o fim precisa caber com o placar de 15 embaixo. */}
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', lineHeight: 1.1, color: ACCENT.light }}>
        {icon} {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 2.9vw, 3.3rem)', lineHeight: 1.1, mt: 1, overflowWrap: 'anywhere' }}>
        {main}
      </Typography>
      <Typography sx={{ fontSize: TEXT_MIN, lineHeight: 1.25, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
