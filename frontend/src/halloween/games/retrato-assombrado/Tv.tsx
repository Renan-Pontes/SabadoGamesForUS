import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic, type MusicTrack } from '../../audio'
import { nameOf, type RankEntry } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { CandleTimer, CandyRain, HauntedTitle, PlayerBadge, SPOOKY_COLORS } from '../../ui'
import { categoryAt } from './content'
import { finalAwards, type State } from './engine'
import { meta } from './meta'
import Portrait from './Portrait'
import {
  VERDICT_DELAY_MS,
  drawSlotOf,
  drawingOf,
  galleryColumns,
  graceFor,
  isAnswerPhase,
  namesOf,
  phaseTotalMs,
  plural,
  shownDeadline,
  trackFor,
  verdictText,
  type PortraitTone,
} from './view'

/**
 * TV do "Retrato Assombrado". Só desenha o estado (quem decide fase, votos
 * e pontos é o motor) e os desenhos, que chegam pelos slots de cada um.
 * Letras para 3 metros: texto de 28 px para cima, títulos de 64 px para
 * cima, vela-cronômetro sempre à vista.
 */

type Slots = HalloweenViewProps<State>['slots']

const ACCENT = meta.accent
/** Fases em que susto aleatório atrapalharia. */
const SUSPENSE_PHASES: readonly string[] = ['vote', 'reveal', 'guess', 'result']

export default function Tv({ state, players, now, slots }: HalloweenViewProps<State>) {
  useSuppressScares(state.over || SUSPENSE_PHASES.includes(state.phase))
  useTvSounds(state, players)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, minHeight: 0 }}>
      {/* No fim, a moldura toca a trilha da vitória: o pedido do jogo sai de cena. */}
      {!state.over && <PhaseMusic track={trackFor(state.phase)} />}

      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          <TopBar state={state} now={now} />
          {state.phase === 'show' && <ShowBoard state={state} />}
          {(state.phase === 'draw1' || state.phase === 'draw2') && (
            <StudioBoard state={state} players={players} slots={slots} />
          )}
          {(state.phase === 'peek' || state.phase === 'gallery' || state.phase === 'vote') && (
            <GalleryBoard state={state} players={players} slots={slots} />
          )}
          {state.phase === 'reveal' && <RevealBoard state={state} players={players} slots={slots} />}
          {state.phase === 'guess' && <GuessBoard state={state} players={players} slots={slots} />}
          {state.phase === 'result' && <ResultBoard state={state} players={players} />}
          {state.phase === 'scores' && <Scoreboard state={state} players={players} />}
        </>
      )}

      <CandyRain active={state.over} kind="mixed" />
    </Box>
  )
}

/** Pede a trilha da fase enquanto estiver montado (só a TV toca). */
function PhaseMusic({ track }: { track: MusicTrack }) {
  useMusic(track)
  return null
}

/**
 * Som de cada momento (rodada + fase), uma vez só — nunca a cada poll — e
 * os dois sustos da partida: o zoom no primeiro impostor que escapa e o
 * esqueleto do "doot" quando todo mundo era impostor. (O tique-taque mora
 * no Timer, que já redesenha a cada segundo — a galeria não precisa.)
 */
function useTvSounds(state: State, players: HPlayer[]) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const reveal = state.reveal
  const verdict = reveal
    ? (reveal.chaos ?? (reveal.caught ? 'caught' : reveal.accused === null ? 'tie' : 'innocent'))
    : 'none'
  const firstEscape = !state.history.some((round) => round.escaped.length > 0)
  const sneaky = reveal && !reveal.chaos && !reveal.caught ? nameOf(players, reveal.impostors[0], '') : ''
  const accusedName = reveal?.accused != null ? nameOf(players, reveal.accused) : ''
  const categoryName = categoryAt(state.categoryId).name
  const round = state.round
  const word = state.outcome?.word ?? ''
  const guess = state.outcome ? (state.outcome.guess === null ? 'none' : state.outcome.guessRight ? 'right' : 'wrong') : 'none'

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, run: () => void) => {
      timers.push(setTimeout(run, ms))
    }
    let hush: (() => void) | null = null
    const say = (text: string) => {
      hush?.()
      hush = speakSpooky(text)
    }

    switch (phase) {
      case 'show':
        playSfx('gong', { volume: 0.7 })
        later(600, () => say(`Rodada ${round}. Categoria: ${categoryName}.`))
        break
      case 'draw1':
      case 'draw2':
        playSfx('bell', { volume: 0.7 })
        break
      case 'peek':
        playSfx('creak')
        playSfx('whoosh', { delay: 0.3 })
        later(400, () => say('Espiadinha!'))
        break
      case 'gallery':
        playSfx('organ', { volume: 0.8 })
        later(1200, () => say('Quem desenhou sem saber a palavra?'))
        break
      case 'vote':
        playSfx('heartbeat')
        break
      case 'reveal': {
        playSfx('drumroll')
        later(VERDICT_DELAY_MS, () => {
          if (verdict === 'caught') {
            playSfx('scream')
            playSfx('thunder', { volume: 0.7 })
          } else if (verdict === 'everyone') {
            triggerScare('doot')
          } else if (verdict === 'nobody') {
            playSfx('ding')
            playSfx('laugh', { delay: 0.4 })
          } else {
            playSfx('fail')
            playSfx('laugh', { delay: 0.5 })
          }
        })
        // O primeiro impostor que escapa na partida ganha o zoom suspeito 🤨.
        if ((verdict === 'innocent' || verdict === 'tie') && firstEscape && sneaky) {
          later(VERDICT_DELAY_MS + 1800, () => triggerScare('zoom', { name: sneaky }))
        }
        break
      }
      case 'guess':
        playSfx('heartbeat')
        later(500, () => say(`${accusedName}, qual é a palavra?`))
        break
      case 'result':
        if (guess === 'right') {
          playSfx('win')
          playSfx('laugh', { delay: 0.6 })
        } else if (guess === 'wrong') {
          playSfx('buzzer')
        } else {
          playSfx('reveal')
        }
        if (word) later(900, () => say(`A palavra era: ${word}.`))
        break
      case 'scores':
        playSfx('ding')
        break
      case 'final':
        playSfx('organ')
        playSfx('win', { delay: 1.2 })
        break
    }
    return () => {
      timers.forEach(clearTimeout)
      hush?.()
    }
  }, [moment, phase, verdict, firstEscape, sneaky, accusedName, categoryName, round, word, guess])
}

// ---------------------------------------------------------------------------
// Cabeçalho: rodada, categoria e a vela
// ---------------------------------------------------------------------------

/** Título da fase que vai no meio da barra do topo (só nas fases de galeria: sobra altura para os retratos). */
function barTitle(state: State): string | null {
  if (state.phase === 'peek') return '👀 Espiadinha!'
  if (state.phase === 'gallery') return '🖼️ A galeria'
  if (state.phase === 'vote') return '🗳️ Quem é o impostor?'
  return null
}

function TopBar({ state, now }: { state: State; now: () => number }) {
  const title = barTitle(state)
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: title ? 'minmax(0, 1fr) auto minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 3,
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-numeric)',
            fontSize: 'clamp(1.75rem, 2.1vw, 2.4rem)',
            color: 'var(--text-secondary)',
            letterSpacing: '0.12em',
            lineHeight: 1.1,
          }}
        >
          RODADA {state.round}/{state.totalRounds}
        </Typography>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: 'clamp(2rem, 2.6vw, 3rem)', lineHeight: 1.15, color: ACCENT.light }}>
          {state.category}
        </Typography>
      </Box>
      {title && (
        <HauntedTitle key={state.phase} size="clamp(4rem, 4.8vw, 5.4rem)" color={ACCENT.main} sx={{ whiteSpace: 'nowrap' }}>
          {title}
        </HauntedTitle>
      )}
      <Box sx={{ justifySelf: 'end' }}>
        <Timer state={state} now={now} />
      </Box>
    </Box>
  )
}

function Timer({ state, now }: { state: State; now: () => number }) {
  const { seconds } = useCountdown(state.deadline, now, graceFor(state.phase))
  const urgent = isAnswerPhase(state.phase) && seconds !== null && seconds <= 5

  // Tique-taque nos últimos 5 segundos de quem precisa agir.
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (!urgent || seconds === null || seconds <= 0) return
    const tick = `${state.inputKey}-${seconds}`
    if (lastTick.current === tick) return
    lastTick.current = tick
    playSfx('tick')
  }, [urgent, seconds, state.inputKey])

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      <CandleTimer deadline={shownDeadline(state)} total={phaseTotalMs(state.phase)} now={now} size={104} showSeconds={false} />
      <Typography
        className={urgent ? 'animate-urgent' : undefined}
        sx={{
          fontFamily: 'var(--font-numeric)',
          fontSize: 'clamp(3.4rem, 4.6vw, 5rem)',
          lineHeight: 1,
          minWidth: '2ch',
          textAlign: 'right',
          color: urgent ? SPOOKY_COLORS.blood : 'var(--text-primary)',
          textShadow: urgent ? '0 0 22px rgba(224, 33, 58, 0.6)' : 'none',
        }}
      >
        {seconds ?? ''}
      </Typography>
    </Box>
  )
}

function Subtitle({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
      {children}
    </Typography>
  )
}

// ---------------------------------------------------------------------------
// show: a categoria
// ---------------------------------------------------------------------------

function ShowBoard({ state }: { state: State }) {
  const category = categoryAt(state.categoryId)
  return (
    <Box
      className="animate-pop-in"
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2.5 }}
    >
      <Box className="animate-ghost" sx={{ fontSize: 'clamp(5rem, 9vw, 9rem)', lineHeight: 1 }}>
        {category.icon}
      </Box>
      <Typography sx={{ fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.24em' }}>
        A CATEGORIA É
      </Typography>
      <HauntedTitle size="clamp(4rem, 8vw, 8.5rem)" color={ACCENT.main} drip>
        {category.name}
      </HauntedTitle>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3.4vw, 3.6rem)', lineHeight: 1.15, mt: 2 }}>
        🤫 Olhem o celular — e não mostrem pra ninguém!
      </Typography>
      <Subtitle>
        {state.impostorCount > 1
          ? 'Há 2 impostores na mesa: eles só sabem a categoria.'
          : 'Há 1 impostor na mesa: ele só sabe a categoria.'}
      </Subtitle>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// draw1 / draw2: todo mundo desenhando (os desenhos ficam escondidos)
// ---------------------------------------------------------------------------

function StudioBoard({ state, players, slots }: { state: State; players: HPlayer[]; slots: Slots }) {
  const first = state.phase === 'draw1'
  const done = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: { xs: 3, md: 5 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Box className="hw-float" sx={{ fontSize: 'clamp(4rem, 7vw, 7rem)', lineHeight: 1 }}>
          {first ? '🎨' : '🖌️'}
        </Box>
        <HauntedTitle size="clamp(4rem, 7vw, 7.5rem)" color={ACCENT.main}>
          {first ? 'Desenhem!' : 'Últimos retoques!'}
        </HauntedTitle>
        <Box sx={{ mt: 1 }}>
          <Subtitle>
            {first ? 'Etapa 1 de 2 — já já tem espiadinha na TV 👀' : 'Etapa 2 de 2 — continuem o MESMO desenho'}
          </Subtitle>
        </Box>
      </Box>
      <Box>
        <Typography sx={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 2.2vw, 2.4rem)', color: 'var(--text-secondary)', mb: 1.5 }}>
          {done.size}/{state.roster.length} prontos
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
          {state.roster.map((id) => {
            const busy = !done.has(id) && drawSlotOf(slots, id, state.round)?.k === state.inputKey
            return (
              <PlayerBadge
                key={id}
                name={nameOf(players, id)}
                acted={done.has(id)}
                offline={!online.has(id)}
                size="lg"
                trailing={busy ? '✏️' : undefined}
              />
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// A galeria: espiadinha, galeria e votação
// ---------------------------------------------------------------------------

type Look = { tone?: PortraitTone; badge?: ReactNode; ribbon?: ReactNode }

function Gallery({
  ids,
  round,
  slots,
  players,
  reserve,
  look,
  revealDelayMs = 0,
}: {
  ids: number[]
  round: number
  slots: Slots
  players: HPlayer[]
  /** Altura (px) que o resto da tela ocupa: a galeria cabe no que sobra. */
  reserve: number
  look?: (id: number) => Look
  revealDelayMs?: number
}) {
  const cols = galleryColumns(ids.length)
  const rows = Math.max(1, Math.ceil(ids.length / cols))
  // Retratos 16:10 + moldura + plaquinha + espaço entre linhas (~78 px por linha):
  // a largura máxima com que a galeria ainda cabe na altura da tela.
  const fit = `calc(${cols} * 1.6 * ((100vh - ${reserve}px) / ${rows} - 78px) + ${(cols - 1) * 24}px)`
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: `max(520px, ${fit})`,
        mx: 'auto',
        pt: 1.5,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        columnGap: 3,
        rowGap: 2.5,
      }}
    >
      {ids.map((id, index) => (
        <Portrait
          key={id}
          strokes={drawingOf(slots, id, round)}
          name={nameOf(players, id)}
          delayMs={index * 70}
          revealDelayMs={revealDelayMs}
          {...(look?.(id) ?? {})}
        />
      ))}
    </Box>
  )
}

function GalleryBoard({ state, players, slots }: { state: State; players: HPlayer[]; slots: Slots }) {
  const voting = state.phase === 'vote'
  const voted = new Set(voting ? state.acted : [])
  const sub =
    state.phase === 'peek'
      ? 'Guardem na memória… alguém aqui não sabe a palavra e está copiando!'
      : state.phase === 'gallery'
        ? 'Quem desenhou sem saber a palavra? Discutam!'
        : `Votem no celular · ${voted.size}/${state.roster.length} já votaram`
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Subtitle>{sub}</Subtitle>
      </Box>
      <Gallery
        ids={state.roster}
        round={state.round}
        slots={slots}
        players={players}
        reserve={290}
        look={voting ? (id) => ({ badge: voted.has(id) ? '✓' : undefined }) : undefined}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// reveal: votos, rufar… e o veredito
// ---------------------------------------------------------------------------

function RevealBoard({ state, players, slots }: { state: State; players: HPlayer[]; slots: Slots }) {
  const reveal = state.reveal
  if (!reveal) return null
  const verdict = verdictText(state, players)
  const counts = new Map(reveal.tally.map((entry) => [entry.id, entry.count]))
  const best = reveal.tally[0]?.count ?? 0
  const bloody = reveal.caught || reveal.chaos === 'everyone'
  const look = (id: number): Look => {
    const votes = counts.get(id)
    const badge = votes ? `🗳️${votes}` : undefined
    if (reveal.chaos === 'everyone') return { badge, tone: 'impostor', ribbon: '🤡 IMPOSTOR' }
    if (reveal.chaos === 'nobody') return reveal.top.includes(id) ? { badge, tone: 'accused', ribbon: '😇 INOCENTE' } : { badge }
    if (reveal.impostors.includes(id)) return { badge, tone: 'impostor', ribbon: '🤫 IMPOSTOR' }
    if (id === reveal.accused) return { badge, tone: 'accused', ribbon: '😇 INOCENTE' }
    return { badge }
  }
  return (
    <Box
      sx={{
        flex: 1,
        display: 'grid',
        // Lado a lado já a partir de 900 px: empilhado, a galeria ocupa a altura toda e o veredito cai para fora da TV.
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
        gap: { xs: 3, lg: 5 },
        alignItems: 'center',
      }}
    >
      <Gallery
        ids={state.roster}
        round={state.round}
        slots={slots}
        players={players}
        reserve={260}
        look={look}
        revealDelayMs={VERDICT_DELAY_MS}
      />
      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', color: 'var(--text-secondary)' }}>
          {reveal.tally.length ? '🗳️ E o mais votado foi…' : '🗳️ A urna está vazia…'}
        </Typography>
        {reveal.tally.length > 0 && (
          <Typography
            className="animate-pop-in"
            style={{ animationDelay: '900ms' }}
            sx={{ fontWeight: 900, fontSize: 'clamp(3rem, 4.6vw, 5rem)', lineHeight: 1.05 }}
          >
            {reveal.accused !== null ? nameOf(players, reveal.accused) : namesOf(players, reveal.top)}
            <Box component="span" sx={{ display: 'block', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {plural(best, 'voto', 'votos')}
              {reveal.accused === null ? ' cada — empate!' : ''}
            </Box>
          </Typography>
        )}
        <Box className="animate-pop-in" style={{ animationDelay: `${VERDICT_DELAY_MS}ms` }} sx={{ mt: 1 }}>
          <Box sx={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', lineHeight: 1 }}>{verdict.icon}</Box>
          <HauntedTitle size="clamp(4rem, 5vw, 5.8rem)" color={bloody ? SPOOKY_COLORS.blood : SPOOKY_COLORS.ghost}>
            {verdict.title}
          </HauntedTitle>
          <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: 'clamp(1.9rem, 2.5vw, 2.7rem)', lineHeight: 1.2 }}>
            {verdict.detail}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// guess: a última chance do impostor pego
// ---------------------------------------------------------------------------

function GuessBoard({ state, players, slots }: { state: State; players: HPlayer[]; slots: Slots }) {
  const accused = state.reveal?.accused ?? null
  if (accused === null) return null
  const name = nameOf(players, accused)
  return (
    <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1.1fr)' }, gap: 5, alignItems: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 680, mx: 'auto' }}>
        <Portrait strokes={drawingOf(slots, accused, state.round)} name={name} tone="impostor" ribbon="🤫 IMPOSTOR" strokeWidth={11} />
      </Box>
      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <HauntedTitle size="clamp(4rem, 6.4vw, 7rem)" color={SPOOKY_COLORS.blood}>
          🎯 Última chance!
        </HauntedTitle>
        <Typography sx={{ fontWeight: 900, fontSize: 'clamp(2.4rem, 3.6vw, 4rem)', lineHeight: 1.1 }}>{name} foi pego…</Typography>
        <Subtitle>…mas se adivinhar a palavra pelo celular, leva +2.</Subtitle>
        <Typography sx={{ fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', mt: 2 }}>
          Dica: <b>{state.category}</b>
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// result: a palavra e quem ganhou o quê
// ---------------------------------------------------------------------------

function ResultBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const outcome = state.outcome
  const reveal = state.reveal
  if (!outcome || !reveal) return null
  const accused = reveal.accused
  const reason = (id: number) => {
    if (outcome.escaped.includes(id)) return '🤫 escapou'
    if (outcome.guessRight && id === accused) return '🎯 acertou a palavra'
    if (reveal.chaos === 'nobody') return '😇 consolação'
    return '🦅 votou certo'
  }
  const gains = state.roster.filter((id) => (outcome.gains[String(id)] ?? 0) > 0)
  return (
    <Box
      className="animate-pop-in"
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5, textAlign: 'center' }}
    >
      {outcome.word ? (
        <>
          <Typography sx={{ fontSize: 'clamp(1.9rem, 2.6vw, 2.8rem)', letterSpacing: '0.24em', color: 'var(--text-secondary)' }}>
            A PALAVRA ERA
          </Typography>
          <HauntedTitle size="clamp(5rem, 9vw, 10rem)" color={ACCENT.main} drip>
            {outcome.word}
          </HauntedTitle>
        </>
      ) : (
        <>
          <Box sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>🤡</Box>
          <HauntedTitle size="clamp(4rem, 7vw, 7.5rem)" color={ACCENT.main}>
            Não tinha palavra!
          </HauntedTitle>
          <Subtitle>Todo mundo só sabia a categoria — e desenhou mesmo assim.</Subtitle>
        </>
      )}

      {reveal.caught && accused !== null && (
        <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2rem, 3vw, 3.2rem)', lineHeight: 1.2 }}>
          {outcome.guess === null
            ? `⌛ ${nameOf(players, accused)} não chutou a tempo.`
            : `${nameOf(players, accused)} chutou “${outcome.guess}” — ${outcome.guessRight ? '✅ ACERTOU!' : '❌ errou!'}`}
        </Typography>
      )}

      {gains.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center', maxWidth: 1500, mt: 1 }}>
          {gains.map((id, index) => (
            <Box key={id} className="stagger-in" style={{ animationDelay: `${300 + index * 90}ms` }}>
              <PlayerBadge
                name={`${nameOf(players, id)} · ${reason(id)}`}
                size="lg"
                highlight
                trailing={
                  <Box component="span" sx={{ color: ACCENT.main, fontWeight: 900 }}>
                    +{outcome.gains[String(id)]}
                  </Box>
                }
              />
            </Box>
          ))}
        </Box>
      ) : (
        <Subtitle>{reveal.chaos === 'everyone' ? 'Sem pontos nesta — é só para rir. 🤡' : 'Ninguém pontuou nesta rodada.'}</Subtitle>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Placar e fim
// ---------------------------------------------------------------------------

function Scoreboard({ state, players }: { state: State; players: HPlayer[] }) {
  const { ranking } = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <HauntedTitle size="clamp(4rem, 5.4vw, 6rem)" color={ACCENT.main} align="left">
        Placar da galeria
      </HauntedTitle>
      <RankList entries={ranking} players={players} gains={state.outcome?.gains ?? {}} />
    </Box>
  )
}

function RankList({ entries, players, gains }: { entries: RankEntry[]; players: HPlayer[]; gains: Record<string, number> }) {
  const wide = entries.length > 8
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: wide ? { xs: '1fr', lg: '1fr 1fr' } : '1fr',
        gap: 1.25,
        columnGap: 5,
        maxWidth: wide ? 'none' : 1100,
        width: '100%',
        mx: wide ? 0 : 'auto',
      }}
    >
      {entries.map((entry, index) => {
        const gained = gains[String(entry.id)] ?? 0
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
              py: 1,
              borderRadius: 'var(--radius-lg)',
              background: entry.place === 1 ? `${ACCENT.main}26` : 'rgba(255, 255, 255, 0.04)',
              border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>
              {entry.place}º
            </Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', fontWeight: 700 }}>
              {entry.place === 1 && entry.score > 0 ? '👑 ' : ''}
              {nameOf(players, entry.id)}
            </Typography>
            {gained > 0 && (
              <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: ACCENT.main, fontWeight: 900 }}>+{gained}</Typography>
            )}
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '2ch', textAlign: 'right' }}>
              {entry.score}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const awards = finalAwards(state)
  const names = (ids: number[]) => namesOf(players, ids)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <HauntedTitle size="clamp(4.4rem, 6vw, 6.6rem)" color={ACCENT.main} drip>
        Fim da exposição
      </HauntedTitle>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Artista da noite"
          names={awards.champions.length ? names(awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? plural(awards.topScore, 'ponto', 'pontos') : 'a galeria ficou vazia'}
          delay={0}
        />
        <AwardCard
          icon="🎭"
          title="Mestre do disfarce"
          names={awards.disguise.length ? names(awards.disguise) : 'Nenhum impostor escapou'}
          detail={awards.disguise.length ? `escapou ${plural(awards.maxEscapes, 'vez', 'vezes')}` : 'a mesa é afiada'}
          delay={500}
        />
        <AwardCard
          icon="🦅"
          title="Olho de lince"
          names={awards.eagle.length ? names(awards.eagle) : 'Ninguém acertou'}
          detail={awards.eagle.length ? `votou certo ${plural(awards.maxHits, 'vez', 'vezes')}` : 'os impostores agradecem'}
          delay={1000}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gains={{}} />
    </Box>
  )
}

function AwardCard({ icon, title, names, detail, delay }: { icon: string; title: string; names: string; detail: string; delay: number }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: 3,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${ACCENT.main}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        boxShadow: `0 0 40px ${ACCENT.glow}`,
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 2.8vw, 3rem)', color: ACCENT.light, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1, mt: 1, wordBreak: 'break-word' }}>
        {names}
      </Typography>
      <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
