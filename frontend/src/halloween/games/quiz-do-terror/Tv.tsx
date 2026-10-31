import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic, type MusicTrack } from '../../audio'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { CandleTimer, CandyRain, HauntedTitle, PlayerBadge, SPOOKY_COLORS, withAlpha } from '../../ui'
import { CATEGORIES } from './content'
import { quizMusic, randomScaresAllowed, sceneOf } from './cues'
import { SCORES_EVERY, countChoices, finalAwards, scoreRows, type QuizState, type ScoreRow } from './engine'
import { SUSPENSE_MS, formatPoints, formatSeconds, lookOf, medalFor } from './look'
import { meta } from './meta'

/**
 * TV do "Quiz do Terror". Só desenha o estado — quem decide fase, gabarito e
 * pontos é o motor. Letras para 3 metros (texto ≥ 28 px, títulos ≥ 64 px),
 * vela-cronômetro na pergunta, contagem nas outras fases, ✓ de quem já
 * respondeu (sem revelar o quê) e revelação com rufar + suspense.
 */

const ACCENT = meta.accent
/** O zoom suspeito no campeão entra depois do pódio subir e da voz anunciar. */
const CHAMPION_ZOOM_MS = 7000
/** No primeiro placar (8 s), os olhos no escuro chamam o lanterna e somem antes da próxima pergunta. */
const EYES_AT_MS = 5000
/** Nomes por alternativa na revelação: com 15 na mesma, o resto vira "e mais N" (cada um vê o seu no celular). */
const MAX_NAMES = 8
const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
const NAME_TEXT = 'clamp(1.75rem, 1.8vw, 2.1rem)'

type BoardProps = { state: QuizState; players: HPlayer[]; now: () => number }

export default function Tv({ state, players, now }: HalloweenViewProps<QuizState>) {
  // Susto aleatório só nos placares: pergunta, revelação e pódio são sagrados.
  useSuppressScares(!randomScaresAllowed(state))
  useQuizSounds(state, players, now)
  const track = quizMusic(state)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {track && <MusicCue track={track} />}
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : state.phase === 'question' ? (
        <QuestionBoard key={state.round} state={state} players={players} now={now} />
      ) : state.phase === 'reveal' ? (
        <RevealBoard key={state.round} state={state} players={players} now={now} />
      ) : (
        <ScoreBoard state={state} players={players} now={now} />
      )}
    </Box>
  )
}

/** Troca a trilha enquanto estiver montado; ao sair, volta a do jogo. */
function MusicCue({ track }: { track: MusicTrack }) {
  useMusic(track)
  return null
}

function names(ids: number[], players: HPlayer[]) {
  return listNames(ids.map((id) => nameOf(players, id)))
}

// ---------------------------------------------------------------------------
// Som, voz e sustos — uma vez por momento (pergunta + fase), nunca a cada poll
// ---------------------------------------------------------------------------

function useQuizSounds(state: QuizState, players: HPlayer[], now: () => number) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  // A cena (cues.ts) é lida UMA vez, quando o momento começa: gente saindo da
  // sala ou trocando de nome no meio do pódio não toca o rufar e a voz de novo.
  const live = useRef({ state, players })
  useEffect(() => {
    live.current = { state, players }
  })
  // O "bruh" de quando ninguém acerta sai uma vez por partida — repetido perde a graça.
  const bruhUsed = useRef(false)

  useEffect(() => {
    const scene = sceneOf(live.current.state, live.current.players)
    const timers: ReturnType<typeof setTimeout>[] = []
    const voices: (() => void)[] = []
    const later = (ms: number, run: () => void) => {
      timers.push(setTimeout(run, ms))
    }
    const say = (text: string) => {
      voices.push(speakSpooky(text))
    }

    if (scene.phase === 'question') {
      if (scene.last) {
        playSfx('gong', { volume: 0.8 })
        later(500, () => say('Última pergunta!'))
      } else {
        playSfx('whoosh')
      }
    } else if (scene.phase === 'reveal') {
      playSfx('drumroll')
      later(SUSPENSE_MS, () => {
        if (scene.cue === 'acertos' || scene.cue === 'todos-acertaram') {
          playSfx('ding')
          if (scene.cue === 'todos-acertaram') playSfx('win', { delay: 0.25 })
        } else if (scene.cue === 'ninguem-acertou' && !bruhUsed.current) {
          bruhUsed.current = true
          triggerScare('bruh')
        } else if (scene.cue === 'ninguem-acertou') {
          playSfx('buzzer')
          playSfx('laugh', { delay: 0.5 })
        } else {
          playSfx('ghost')
        }
      })
    } else if (scene.phase === 'scores') {
      playSfx('organ')
      if (scene.leaderText) later(1000, () => say(scene.leaderText))
      // Uma vez por partida: "👀 ...Fulano..." — os fantasmas de olho em quem está em último.
      if (scene.eyesOn) later(EYES_AT_MS, () => triggerScare('eyes', { name: scene.eyesOn }))
    } else if (scene.phase === 'final') {
      playSfx('drumroll')
      if (scene.championText) {
        later(SUSPENSE_MS + 100, () => playSfx('win'))
        later(2600, () => say(`O cérebro mais assombrado da noite é... ${scene.championText}!`))
        later(CHAMPION_ZOOM_MS, () => triggerScare('zoom', { name: scene.zoomOn }))
      } else {
        // Ninguém pontuou (ou o host encerrou logo no começo): sem fanfarra.
        later(SUSPENSE_MS + 100, () => playSfx('laugh'))
        later(2600, () => say('Fim do quiz. Os fantasmas venceram.'))
      }
    }

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      voices.forEach((cancel) => cancel())
    }
  }, [moment])

  // "Plim" a cada resposta nova que chega (só o ✓, nunca o quê).
  const answeredNow = phase === 'question' ? state.acted.length : 0
  const answeredBefore = useRef({ round: 0, count: 0 })
  useEffect(() => {
    if (phase !== 'question') return
    const before = answeredBefore.current
    if (before.round === state.round && answeredNow > before.count) playSfx('pop', { volume: 0.7 })
    answeredBefore.current = { round: state.round, count: answeredNow }
  }, [phase, state.round, answeredNow])

  // Tique-taque nos últimos 5 segundos da pergunta (uma vez por segundo).
  const { seconds } = useCountdown(phase === 'question' ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef('')
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0) return
    const key = `${state.round}-${seconds}`
    if (lastTick.current === key) return
    lastTick.current = key
    playSfx(seconds === 5 ? 'heartbeat' : 'tick')
  }, [seconds, state.round])
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function RoundLabel({ state, children }: { state: QuizState; children?: ReactNode }) {
  const category = CATEGORIES[state.question.category] ?? CATEGORIES.halloween
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 1, flexWrap: 'wrap' }}>
      <Typography
        sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.9rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1 }}
      >
        PERGUNTA {state.round}/{state.totalRounds}
      </Typography>
      <Box
        sx={{
          px: 2,
          py: 0.5,
          borderRadius: 'var(--radius-full)',
          border: `2px solid ${withAlpha(ACCENT.main, 0.6)}`,
          background: withAlpha(ACCENT.main, 0.12),
          color: ACCENT.light,
          fontSize: TEXT,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {category.icon} {category.label}
      </Box>
      {children}
    </Box>
  )
}

/** O quadrado colorido com o símbolo: cor E forma, para quem não distingue cores. */
function SymbolBadge({ index, compact = false }: { index: number; compact?: boolean }) {
  const look = lookOf(index)
  const side = compact ? 'clamp(56px, 4.2vw, 76px)' : 'clamp(64px, 5.6vw, 92px)'
  return (
    <Box
      role="img"
      aria-label={look.name}
      sx={{
        width: side,
        height: side,
        flexShrink: 0,
        borderRadius: 'var(--radius-md)',
        background: look.color,
        color: look.ink,
        display: 'grid',
        placeItems: 'center',
        fontSize: compact ? 'clamp(2rem, 2.8vw, 3rem)' : 'clamp(2.4rem, 3.4vw, 3.6rem)',
        lineHeight: 1,
        boxShadow: `inset 0 -5px 0 ${withAlpha(look.deep, 0.65)}`,
      }}
    >
      {look.symbol}
    </Box>
  )
}

/** Quanto falta para a próxima fase (revelação e placar). */
function NextIn({ deadline, now, label }: { deadline: number | null; now: () => number; label: string }) {
  const { seconds } = useCountdown(deadline, now)
  if (seconds === null) return null
  return (
    <Box sx={{ flexShrink: 0, textAlign: 'center', minWidth: 'clamp(120px, 9vw, 160px)' }}>
      <Box
        sx={{
          mx: 'auto',
          width: 'clamp(100px, 7.5vw, 130px)',
          height: 'clamp(100px, 7.5vw, 130px)',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          border: `6px solid ${ACCENT.main}`,
          boxShadow: `0 0 30px ${ACCENT.glow}`,
          background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
          fontFamily: 'var(--font-numeric)',
          fontSize: 'clamp(3rem, 4vw, 4.4rem)',
          lineHeight: 1,
        }}
      >
        {seconds}
      </Box>
      <Typography sx={{ mt: 0.5, fontSize: TEXT, color: 'var(--text-muted)' }}>{label}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Pergunta aberta
// ---------------------------------------------------------------------------

function QuestionBoard({ state, players, now }: BoardProps) {
  const answered = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const last = state.round >= state.totalRounds

  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* "Última pergunta!" na mesma linha do rótulo: em TV de notebook (768 px) cada linha conta. */}
          <RoundLabel state={state}>
            {last && (
              <Typography
                className="animate-urgent"
                sx={{
                  display: 'inline-block',
                  transformOrigin: 'left center',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.4rem, 3.2vw, 3.6rem)',
                  color: 'var(--blood, #e0213a)',
                  lineHeight: 1,
                }}
              >
                ☠️ Última pergunta!
              </Typography>
            )}
          </RoundLabel>
          <Typography
            sx={{
              mt: 2,
              fontWeight: 800,
              fontSize: 'clamp(2.8rem, 4.2vw, 5rem)',
              lineHeight: 1.1,
              color: 'var(--text-primary)',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
              overflowWrap: 'anywhere',
            }}
          >
            {state.question.text}
          </Typography>
        </Box>
        {/* A vela encolhe em tela baixa (notebook na TV) sem perder a proporção. */}
        <Box sx={{ flexShrink: 0, '& svg': { height: 'clamp(120px, 18vh, 190px)', width: 'auto' } }}>
          <CandleTimer
            deadline={state.deadline === null ? null : state.deadline - GRACE_MS}
            total={state.seconds * 1000}
            now={now}
            size={180}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {state.question.options.map((text, index) => {
          const look = lookOf(index)
          return (
            <Box
              key={index}
              className="stagger-in"
              style={{ animationDelay: `${index * 90}ms` }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                minHeight: 'clamp(88px, 10vh, 124px)',
                p: 1.5,
                pr: 2.5,
                borderRadius: 'var(--radius-lg)',
                border: `3px solid ${look.color}`,
                background: `linear-gradient(90deg, ${withAlpha(look.color, 0.3)}, rgba(10, 6, 18, 0.86) 60%)`,
                boxShadow: `0 6px 0 ${look.deep}`,
              }}
            >
              <SymbolBadge index={index} />
              <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2rem, 2.7vw, 3.2rem)', lineHeight: 1.1, minWidth: 0, overflowWrap: 'anywhere' }}>
                {text}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mb: 1.5 }}>
          Responda no celular · {answered.size}/{state.roster.length} já {answered.size === 1 ? 'respondeu' : 'responderam'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          {state.roster.map((id) => (
            <PlayerBadge
              key={id}
              name={nameOf(players, id)}
              acted={answered.has(id)}
              offline={!online.has(id) && !answered.has(id)}
              size="lg"
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Revelação: rufar (as barras crescem), depois a certa acende e as outras apagam
// ---------------------------------------------------------------------------

function RevealBoard({ state, players, now }: BoardProps) {
  const reveal = state.reveal
  if (!reveal) return null
  const counts = countChoices(reveal, state.question.options.length)
  const most = Math.max(1, ...counts)
  const last = state.round >= state.totalRounds

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <RoundLabel state={state} />
          <Typography sx={{ mt: 1.5, fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.12, overflowWrap: 'anywhere' }}>
            {state.question.text}
          </Typography>
        </Box>
        <NextIn deadline={state.deadline} now={now} label={last ? 'pódio' : state.round % SCORES_EVERY === 0 ? 'placar' : 'próxima'} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {state.question.options.map((text, index) => (
          <RevealTile
            key={index}
            index={index}
            text={text}
            count={counts[index] ?? 0}
            share={(counts[index] ?? 0) / most}
            right={index === reveal.correct}
            pickers={state.roster.filter((id) => reveal.choices[String(id)] === index)}
            points={reveal.points}
            players={players}
          />
        ))}
      </Box>

      <Verdict state={state} players={players} />
    </Box>
  )
}

function RevealTile({
  index,
  text,
  count,
  share,
  right,
  pickers,
  points,
  players,
}: {
  index: number
  text: string
  count: number
  share: number
  right: boolean
  pickers: number[]
  points: Record<string, number>
  players: HPlayer[]
}) {
  const look = lookOf(index)
  // Na certa, quem fez mais pontos (o mais rápido) aparece primeiro.
  const ordered = right ? [...pickers].sort((a, b) => (points[String(b)] ?? 0) - (points[String(a)] ?? 0)) : pickers
  const shown = ordered.slice(0, MAX_NAMES)
  const hidden = ordered.length - shown.length
  return (
    <Box
      sx={{
        position: 'relative',
        p: 1.5,
        pr: 2.5,
        borderRadius: 'var(--radius-lg)',
        border: `3px solid ${look.color}`,
        background: 'rgba(10, 6, 18, 0.86)',
        // Depois do rufar: a certa cresce, as erradas apagam (só transform e opacidade).
        animation: `${right ? 'qdtRight' : 'qdtWrong'} 600ms cubic-bezier(0.22, 1, 0.36, 1) ${SUSPENSE_MS}ms both`,
        '@keyframes qdtRight': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.03)' } },
        '@keyframes qdtWrong': { from: { opacity: 1 }, to: { opacity: 0.38 } },
      }}
    >
      {right && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: -4,
            borderRadius: 'var(--radius-lg)',
            border: `5px solid ${SPOOKY_COLORS.candle}`,
            boxShadow: `0 0 48px ${withAlpha(SPOOKY_COLORS.candle, 0.65)}`,
            pointerEvents: 'none',
            animation: `qdtHalo 500ms ease ${SUSPENSE_MS}ms both`,
            '@keyframes qdtHalo': { from: { opacity: 0 }, to: { opacity: 1 } },
          }}
        />
      )}
      {/* Barra de quantos escolheram esta: cresce durante o rufar. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${Math.round(share * 100)}%`,
          borderRadius: 'calc(var(--radius-lg) - 3px)',
          background: withAlpha(look.color, 0.32),
          transformOrigin: 'left',
          animation: 'qdtGrow 1300ms cubic-bezier(0.22, 1, 0.36, 1) both',
          '@keyframes qdtGrow': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        }}
      />
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
        <SymbolBadge index={index} compact />
        <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 'clamp(1.9rem, 2.5vw, 2.8rem)', lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          {text}
        </Typography>
        {right && (
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 2.6vw, 2.8rem)',
              color: SPOOKY_COLORS.candle,
              lineHeight: 1,
              animation: `qdtLate 400ms ease ${SUSPENSE_MS}ms both`,
              '@keyframes qdtLate': { from: { opacity: 0, transform: 'scale(0.6)' }, to: { opacity: 1, transform: 'scale(1)' } },
            }}
          >
            ✓ CERTA
          </Typography>
        )}
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.4rem, 3.2vw, 3.6rem)', lineHeight: 1, minWidth: '1.4ch', textAlign: 'right' }}>
          {count}
        </Typography>
      </Box>
      {shown.length > 0 && (
        <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {shown.map((id) => (
            <Box
              key={id}
              sx={{
                px: 1.5,
                py: 0.25,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(0, 0, 0, 0.5)',
                fontSize: NAME_TEXT,
                fontWeight: 700,
                lineHeight: 1.3,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {nameOf(players, id)}
              {right && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    color: SPOOKY_COLORS.candle,
                    animation: `qdtHalo 400ms ease ${SUSPENSE_MS}ms both`,
                    '@keyframes qdtHalo': { from: { opacity: 0 }, to: { opacity: 1 } },
                  }}
                >
                  +{formatPoints(points[String(id)] ?? 0)}
                </Box>
              )}
            </Box>
          ))}
          {hidden > 0 && (
            <Box sx={{ px: 1.5, py: 0.25, fontSize: NAME_TEXT, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-secondary)' }}>
              {`e mais ${hidden}`}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

/** A linha de baixo da revelação: quantos acertaram, o mais rápido e quem está pegando fogo. */
function Verdict({ state, players }: { state: QuizState; players: HPlayer[] }) {
  const reveal = state.reveal
  if (!reveal) return null
  const answered = Object.keys(reveal.choices).length
  const hitIds = Object.keys(reveal.points).map(Number)
  const hottest = Math.max(0, ...hitIds.map((id) => state.streaks[String(id)] ?? 0))
  const onFire = hottest >= 2 ? hitIds.filter((id) => (state.streaks[String(id)] ?? 0) === hottest) : []
  const fastestTime = reveal.fastest.length ? reveal.times[String(reveal.fastest[0])] : null

  const big = { fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 4.6vw, 5rem)', lineHeight: 1.05 }
  return (
    <Box
      sx={{
        mt: 'auto',
        textAlign: 'center',
        animation: `qdtLate 500ms ease ${SUSPENSE_MS}ms both`,
        '@keyframes qdtLate': { from: { opacity: 0, transform: 'scale(0.6)' }, to: { opacity: 1, transform: 'scale(1)' } },
      }}
    >
      {answered === 0 ? (
        <Typography sx={{ ...big, color: 'var(--text-secondary)' }}>👻 Ninguém respondeu… os fantasmas cochilaram.</Typography>
      ) : hitIds.length === 0 ? (
        <Typography sx={{ ...big, color: 'var(--blood, #e0213a)' }}>💀 NINGUÉM ACERTOU!</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 4, rowGap: 1 }}>
          <Typography sx={{ fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', fontWeight: 800 }}>
            ✅ {hitIds.length} de {state.roster.length} {hitIds.length === 1 ? 'acertou' : 'acertaram'}
          </Typography>
          {fastestTime !== null && (
            <Typography sx={{ fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', fontWeight: 800, color: SPOOKY_COLORS.candle }}>
              ⚡ {names(reveal.fastest, players)} em {formatSeconds(fastestTime)}
            </Typography>
          )}
          {onFire.length > 0 && (
            <Typography sx={{ fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', fontWeight: 800, color: SPOOKY_COLORS.pumpkin }}>
              🔥 {names(onFire, players)}: {hottest} seguidas
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Placar a cada 3 perguntas
// ---------------------------------------------------------------------------

function ScoreBoard({ state, players, now }: BoardProps) {
  const rows = scoreRows(state)
  const showMoves = state.round > SCORES_EVERY
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <HauntedTitle size="clamp(4rem, 5.6vw, 6.4rem)" color={ACCENT.main} align="left" drip>
            Placar do Além
          </HauntedTitle>
          <Typography sx={{ mt: 1, fontSize: TEXT, color: 'var(--text-secondary)' }}>
            Depois de {state.round} de {state.totalRounds} perguntas
          </Typography>
        </Box>
        <NextIn deadline={state.deadline} now={now} label="próxima" />
      </Box>
      <RankList rows={rows} players={players} showMoves={showMoves} />
    </Box>
  )
}

function RankList({ rows, players, showMoves }: { rows: ScoreRow[]; players: HPlayer[]; showMoves: boolean }) {
  const twoColumns = rows.length > 8
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: twoColumns ? { xs: '1fr', lg: '1fr 1fr' } : '1fr',
        gap: 1.25,
        columnGap: 5,
        width: '100%',
        maxWidth: twoColumns ? 'none' : 1150,
      }}
    >
      {rows.map((row, index) => (
        <Box
          key={row.id}
          className="stagger-in"
          style={{ animationDelay: `${index * 70}ms` }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2.5,
            py: 1,
            minWidth: 0,
            borderRadius: 'var(--radius-lg)',
            background: row.place === 1 && row.score > 0 ? withAlpha(ACCENT.main, 0.16) : 'rgba(255, 255, 255, 0.04)',
            border: `2px solid ${row.place === 1 && row.score > 0 ? ACCENT.main : 'transparent'}`,
          }}
        >
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.9rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>
            {row.place}º
          </Typography>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 'clamp(1.9rem, 2.4vw, 2.6rem)', fontWeight: 700 }}>
            {nameOf(players, row.id)}
            {row.streak >= 2 ? ` 🔥${row.streak}` : ''}
          </Typography>
          {showMoves && row.moved !== 0 && (
            <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: row.moved > 0 ? '#4ade80' : 'var(--blood, #e0213a)' }}>
              {row.moved > 0 ? `▲${row.moved}` : `▼${-row.moved}`}
            </Typography>
          )}
          {row.gained > 0 && (
            <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: ACCENT.light }}>+{formatPoints(row.gained)}</Typography>
          )}
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.1rem, 2.8vw, 3rem)', minWidth: '3ch', textAlign: 'right' }}>
            {formatPoints(row.score)}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim: pódio, prêmios e o resto da classificação
// ---------------------------------------------------------------------------

function FinalBoard({ state, players }: { state: QuizState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  const someoneScored = awards.champions.length > 0
  const rest = someoneScored ? awards.ranking.slice(3) : awards.ranking

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <CandyRain active={someoneScored} kind="mixed" count={36} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.9rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
          FIM DO QUIZ
        </Typography>
        <HauntedTitle size="clamp(4rem, 6vw, 6.6rem)" color={someoneScored ? ACCENT.main : SPOOKY_COLORS.blood} drip flicker>
          {someoneScored ? 'Cérebro do Além' : 'Os fantasmas venceram'}
        </HauntedTitle>
      </Box>

      {someoneScored && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, gap: 3, alignItems: 'end' }}>
          <Podium entries={awards.ranking.slice(0, 3)} players={players} hits={state.hits} />
          <Box sx={{ display: 'grid', gap: 2 }}>
            <AwardCard
              icon="⚡"
              title="Dedo mais rápido"
              names={awards.fastest.ids.length ? names(awards.fastest.ids, players) : 'Ninguém'}
              detail={
                awards.fastest.ids.length
                  ? `${awards.fastest.count} ${awards.fastest.count === 1 ? 'vez' : 'vezes'} o primeiro a acertar`
                  : 'a galera estava devagar'
              }
              delay={2200}
            />
            <AwardCard
              icon="🔥"
              title="Maior sequência"
              names={awards.bestStreak.ids.length ? names(awards.bestStreak.ids, players) : 'Ninguém'}
              detail={awards.bestStreak.ids.length ? `${awards.bestStreak.streak} acertos seguidos` : 'nenhum acerto seguido'}
              delay={2800}
            />
          </Box>
        </Box>
      )}

      {rest.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: 'center' }}>
          {rest.map((entry, index) => (
            <Box
              key={entry.id}
              className="stagger-in"
              style={{ animationDelay: `${2400 + index * 60}ms` }}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1.25,
                px: 2,
                py: 0.75,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '2px solid var(--border-medium)',
                fontSize: TEXT,
                maxWidth: '100%',
              }}
            >
              <Box component="span" sx={{ fontFamily: 'var(--font-numeric)', color: 'var(--text-muted)' }}>
                {entry.place}º
              </Box>
              <Box component="span" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(players, entry.id)}
              </Box>
              <Box component="span" sx={{ fontFamily: 'var(--font-numeric)' }}>
                {formatPoints(entry.score)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

function Podium({
  entries,
  players,
  hits,
}: {
  entries: { id: number; score: number; place: number }[]
  players: HPlayer[]
  hits: Record<string, number>
}) {
  // 2º à esquerda, 1º no meio, 3º à direita. Sobe o 3º, depois o 2º, por último o campeão.
  const columns = [
    { entry: entries[1], delay: 900 },
    { entry: entries[0], delay: SUSPENSE_MS },
    { entry: entries[2], delay: 300 },
  ]
  const pedestals = ['clamp(110px, 16vh, 170px)', 'clamp(80px, 11vh, 120px)', 'clamp(56px, 7vh, 84px)']
  const tones = [SPOOKY_COLORS.candle, '#cbd5e1', '#d97706']

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: { xs: 1.5, md: 3 } }}>
      {columns.map(({ entry, delay }, column) => {
        if (!entry) return <Box key={`vazio-${column}`} sx={{ width: 'clamp(150px, 17vw, 300px)' }} />
        const tier = Math.min(3, Math.max(1, entry.place)) - 1
        const tone = tones[tier]
        return (
          <Box
            key={entry.id}
            className="hw-rise"
            style={{ animationDelay: `${delay}ms` }}
            sx={{ width: 'clamp(150px, 17vw, 300px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}
          >
            <Typography sx={{ fontSize: 'clamp(3rem, 4.4vw, 4.8rem)', lineHeight: 1 }}>{medalFor(entry.place)}</Typography>
            <Typography
              noWrap
              sx={{
                maxWidth: '100%',
                fontFamily: 'var(--font-display)',
                fontSize: entry.place === 1 ? 'clamp(2.6rem, 3.6vw, 4rem)' : 'clamp(2.1rem, 2.8vw, 3rem)',
                lineHeight: 1.1,
                color: entry.place === 1 ? ACCENT.light : 'var(--text-primary)',
              }}
            >
              {nameOf(players, entry.id)}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', color: tone, lineHeight: 1.1 }}>
              {formatPoints(entry.score)}
            </Typography>
            <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)', lineHeight: 1.2 }}>
              {hits[String(entry.id)] ?? 0} {(hits[String(entry.id)] ?? 0) === 1 ? 'acerto' : 'acertos'}
            </Typography>
            <Box
              sx={{
                mt: 1,
                width: '100%',
                height: pedestals[tier],
                borderRadius: '14px 14px 0 0',
                background: `linear-gradient(180deg, ${withAlpha(tone, 0.5)}, ${withAlpha(tone, 0.1)})`,
                border: `3px solid ${tone}`,
                borderBottom: 'none',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-numeric)',
                fontSize: 'clamp(2.6rem, 3.8vw, 4.2rem)',
                color: tone,
              }}
            >
              {entry.place}º
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function AwardCard({ icon, title, names: who, detail, delay }: { icon: string; title: string; names: string; detail: string; delay: number }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: 2,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${ACCENT.main}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        boxShadow: `0 0 40px ${ACCENT.glow}`,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', color: ACCENT.light, lineHeight: 1.1 }}>
        {icon} {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', lineHeight: 1.1, mt: 0.5, overflowWrap: 'anywhere' }}>{who}</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
