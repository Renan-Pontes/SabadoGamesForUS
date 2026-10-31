import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, nameOf, type TallyEntry } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import {
  BigReveal,
  CREEPY_FONT,
  CandleTimer,
  HauntedTitle,
  PlayerBadge,
  SPOOKY_COLORS,
  Tombstone,
  withAlpha,
} from '../../ui'
import { NOBODY_OUT, ROLE_INFO } from './content'
import {
  MAX_ROUNDS,
  MIN_VOTES,
  NIGHT_SECONDS,
  roleCounts,
  voteOutcome,
  type EndReason,
  type Final,
  type NightRecap,
  type Phase,
  type Role,
  type State,
} from './engine'
import { meta } from './meta'
import { SUSPENSE_MS, tvCue, type Stinger } from './narration'
import { aliveActed, ghostsOf, graceFor, killersAtLarge, musicFor, namesOf, phaseLabel, plural, revealedRoles } from './screens'

/**
 * TV do "Cidade Dorme". Só desenha o estado — quem decide fase, mortes e
 * vencedor é o motor. Letras para 3 metros (texto ≥ 28 px, títulos ≥ 64 px),
 * vela sempre à vista, ✓ de quem já agiu sem nunca dizer o papel de ninguém.
 */

const ACCENT = meta.accent
/** Corpo de texto e títulos legíveis do sofá. */
const TEXT = 'clamp(1.8rem, 2.3vw, 2.5rem)'
const SMALL = 'clamp(1.75rem, 2vw, 2.1rem)'
const TITLE = 'clamp(4rem, 6.2vw, 7rem)'
/** A revelação da morte cobre a TV no começo da manhã. */
const DEATH_REVEAL_MS = 4500
/** Cada página do fim fica este tempo na tela. */
const END_PAGE_MS = 10_000
const END_PAGES = ['Quem era quem', 'Linha do tempo', 'Melhor faro'] as const
const ROLE_ORDER: Role[] = ['killer', 'detective', 'angel', 'citizen']
const END_SUBTITLE: Record<EndReason, string> = {
  caught: 'Todos os assassinos foram pegos',
  outnumbered: 'Os assassinos tomaram a cidade',
  escaped: `Depois de ${MAX_ROUNDS} noites, os assassinos fugiram`,
}

type Board = { state: State; players: HPlayer[] }
type Slots = HalloweenViewProps<State>['slots']

export default function Tv({ state, players, now, slots }: HalloweenViewProps<State>) {
  const clock = useServerNow(now)
  // Manhã, votação e veredito: susto aleatório atropelaria o momento.
  useSuppressScares(state.over || state.phase === 'morning' || state.phase === 'vote' || state.phase === 'verdict')
  useTvCue(state, players)
  useLastSecondsTick(state, now)

  return (
    // Apelido gigante sem espaço quebra a linha em vez de estourar a TV.
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, minWidth: 0, overflowWrap: 'anywhere' }}>
      {/* Trilha por fase; no fim ela sai de cena e a moldura toca a vitória. */}
      {!state.over && <PhaseMusic phase={state.phase} />}
      <TopBar state={state} now={now} />

      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <EndBoard state={state} players={players} clock={clock} slots={slots} />
      ) : (
        <>
          {state.phase === 'roles' && <RolesBoard state={state} players={players} />}
          {state.phase === 'night' && <NightBoard state={state} players={players} now={now} />}
          {state.phase === 'morning' && <MorningBoard state={state} players={players} clock={clock} />}
          {state.phase === 'day' && <DayBoard state={state} players={players} now={now} />}
          {state.phase === 'vote' && <VoteBoard state={state} players={players} />}
          {state.phase === 'verdict' && <VerdictBoard state={state} players={players} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som, voz, susto e música
// ---------------------------------------------------------------------------

function PhaseMusic({ phase }: { phase: Phase }) {
  useMusic(musicFor(phase))
  return null
}

/** Efeito, narração e susto de cada momento — uma vez só por rodada + fase. */
function useTvCue(state: State, players: HPlayer[]) {
  const cue = tvCue(state, players)
  const { moment, stinger, speech, speechDelayMs } = cue
  const scareKind = cue.scare?.kind ?? null
  const scareName = cue.scare?.name ?? ''
  const scareDelay = cue.scare?.delayMs ?? 0
  useEffect(() => {
    const timers: number[] = []
    const later = (ms: number, run: () => void) => {
      timers.push(window.setTimeout(run, ms))
    }
    const voice = { stop: () => {} }
    playStinger(stinger, later)
    if (speech) {
      later(speechDelayMs, () => {
        voice.stop = speakSpooky(speech)
      })
    }
    if (scareKind) later(scareDelay, () => triggerScare(scareKind, scareName ? { name: scareName } : undefined))
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      voice.stop()
    }
  }, [moment, stinger, speech, speechDelayMs, scareKind, scareName, scareDelay])
}

function playStinger(stinger: Stinger | null, later: (ms: number, run: () => void) => void) {
  switch (stinger) {
    case 'roles':
      playSfx('organ', { volume: 0.8 })
      break
    case 'night':
      playSfx('bell', { volume: 0.8 })
      playSfx('creak', { delay: 1.6, volume: 0.6 })
      break
    case 'death':
      // A ferroada de cada morte: trovão e grito.
      playSfx('thunder')
      playSfx('scream', { delay: 0.45 })
      break
    case 'saved':
      playSfx('reveal')
      break
    case 'quiet':
      playSfx('creak')
      playSfx('ghost', { delay: 0.8, volume: 0.6 })
      break
    case 'day':
      playSfx('ding', { volume: 0.7 })
      break
    case 'vote':
      playSfx('gong')
      break
    case 'caught':
      playSfx('drumroll')
      later(SUSPENSE_MS, () => playSfx('scream', { delay: 0.5, volume: 0.8 }))
      break
    case 'innocent':
      playSfx('drumroll')
      later(SUSPENSE_MS, () => playSfx('fail'))
      break
    case 'nobody':
      playSfx('drumroll')
      later(SUSPENSE_MS, () => playSfx('laugh'))
      break
    case 'city':
      playSfx('win')
      break
    case 'killers':
      playSfx('laugh')
      playSfx('thunder', { delay: 0.8 })
      break
    case 'ended':
      playSfx('organ')
      break
    default:
      break
  }
}

/** Tique-taque nos últimos 5 segundos da noite e da votação. */
function useLastSecondsTick(state: State, now: () => number) {
  const racing = !state.over && (state.phase === 'night' || state.phase === 'vote')
  const { seconds } = useCountdown(racing ? state.deadline : null, now, GRACE_MS)
  const key = `${state.round}-${state.phase}-${seconds}`
  const last = useRef('')
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0 || last.current === key) return
    last.current = key
    playSfx('tick')
  }, [seconds, key])
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

function TopBar({ state, now }: { state: State; now: () => number }) {
  // Noite e dia têm a vela gigante no quadro; nas outras fases, o relógio fica aqui.
  const candle = !state.over && (state.phase === 'night' || state.phase === 'day')
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
      <Typography
        sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}
      >
        {phaseLabel(state)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {state.phase !== 'roles' && <TownCount state={state} />}
        {!state.over && !candle && (
          <Countdown deadline={state.deadline} now={now} graceMs={graceFor(state)} urgent={state.phase === 'vote'} />
        )}
      </Box>
    </Box>
  )
}

function TownCount({ state }: { state: State }) {
  const ghosts = state.roster.length - state.alive.length
  const atLarge = killersAtLarge(state)
  const killers = atLarge === null ? `🔪 ${roleCounts(state.roster.length).killer} no começo` : `🔪 ${atLarge} à solta`
  return (
    <Typography sx={{ fontSize: TEXT, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      🧍 {state.alive.length} {state.alive.length === 1 ? 'vivo' : 'vivos'}
      {ghosts > 0 ? ` · 👻 ${ghosts}` : ''}
      {!state.over ? ` · ${killers}` : ''}
    </Typography>
  )
}

function Countdown({ deadline, now, graceMs, urgent }: { deadline: number | null; now: () => number; graceMs: number; urgent: boolean }) {
  const { seconds } = useCountdown(deadline, now, graceMs)
  if (seconds === null) return null
  const hurry = urgent && seconds <= 5
  return (
    <Box
      className={hurry ? 'animate-urgent' : undefined}
      sx={{
        width: 'clamp(110px, 9vw, 150px)',
        height: 'clamp(110px, 9vw, 150px)',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: `6px solid ${hurry ? SPOOKY_COLORS.blood : ACCENT.main}`,
        boxShadow: `0 0 30px ${hurry ? 'rgba(224, 33, 58, 0.55)' : ACCENT.glow}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3.4rem, 4.6vw, 5rem)', lineHeight: 1 }}>{seconds}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function BadgeRow({
  ids,
  players,
  acted,
  ghost = false,
  center = false,
}: {
  ids: number[]
  players: HPlayer[]
  acted: Set<number>
  ghost?: boolean
  center?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: center ? 'center' : 'flex-start' }}>
      {ids.map((id) => {
        const player = players.find((candidate) => candidate.id === id)
        return (
          <PlayerBadge
            key={id}
            name={nameOf(players, id)}
            acted={acted.has(id)}
            ghost={ghost}
            offline={player ? !player.online : false}
            size="lg"
          />
        )
      })}
    </Box>
  )
}

function Banner({ icon, title, text, color }: { icon: string; title: string; text: string; color: string }) {
  return (
    <Box
      className="animate-pop-in"
      sx={{
        textAlign: 'center',
        p: { xs: 3, md: 4 },
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${withAlpha(color, 0.7)}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        boxShadow: `0 0 50px ${withAlpha(color, 0.3)}`,
        maxWidth: 860,
      }}
    >
      <Box aria-hidden className="hw-float" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
        {icon}
      </Box>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 5.4vw, 5.8rem)', color, lineHeight: 1.05, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 1 }}>{text}</Typography>
    </Box>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 4.6vw, 5rem)', color: ACCENT.light, lineHeight: 1, mb: 2 }}>
      {children}
    </Typography>
  )
}

/** Quem já morreu, com o papel quando foi revelado. */
function Graveyard({ state, players }: Board) {
  if (!state.graveyard.length) return null
  return (
    <Box>
      <Typography sx={{ fontSize: SMALL, color: 'var(--text-muted)', mb: 1 }}>🪦 Cemitério da cidade</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {state.graveyard.map((grave) => (
          <PlayerBadge
            key={grave.id}
            name={nameOf(players, grave.id)}
            ghost
            size="lg"
            trailing={`${grave.how === 'vote' ? '⚖️' : '🔪'} ${grave.role ? ROLE_INFO[grave.role].icon : '❔'}`}
          />
        ))}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

function RolesBoard({ state, players }: Board) {
  const counts = roleCounts(state.roster.length)
  return (
    <Box
      className="animate-pop-in"
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: { xs: 3, md: 4 }, textAlign: 'center' }}
    >
      <HauntedTitle size="clamp(4.5rem, 9vw, 9.5rem)" color={ACCENT.main} glow={ACCENT.light} drip>
        Cidade Dorme
      </HauntedTitle>
      <Typography sx={{ fontSize: 'clamp(2.2rem, 3.4vw, 3.8rem)', fontWeight: 800, lineHeight: 1.15 }}>
        📱 Olhem seu papel no celular — e escondam a tela!
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {ROLE_ORDER.filter((role) => counts[role] > 0).map((role, index) => (
          <RoleChip key={role} role={role} count={counts[role]} delay={index * 150} />
        ))}
      </Box>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', maxWidth: 1300 }}>
        Ninguém fecha o olho: de noite, <b>todo mundo</b> mexe no celular ao mesmo tempo.
      </Typography>
      <Box>
        <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700, mb: 1.5 }}>
          {state.acted.length}/{state.roster.length} já viram o papel
        </Typography>
        <BadgeRow ids={state.roster} players={players} acted={new Set(state.acted)} center />
      </Box>
    </Box>
  )
}

function RoleChip({ role, count, delay }: { role: Role; count: number; delay: number }) {
  const info = ROLE_INFO[role]
  return (
    <Box
      className="stagger-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        py: 1.5,
        borderRadius: 'var(--radius-full)',
        border: `3px solid ${withAlpha(info.color, 0.8)}`,
        background: withAlpha(info.color, 0.14),
        boxShadow: `0 0 24px ${withAlpha(info.color, 0.3)}`,
      }}
    >
      <Box component="span" aria-hidden sx={{ fontSize: 'clamp(2.4rem, 3.4vw, 3.6rem)', lineHeight: 1 }}>
        {info.icon}
      </Box>
      <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', fontWeight: 800 }}>
        {count > 1 ? `${count} ${info.plural}` : `1 ${info.name}`}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Noite
// ---------------------------------------------------------------------------

function NightBoard({ state, players, now }: Board & { now: () => number }) {
  const acted = new Set(state.acted)
  const ghosts = ghostsOf(state)
  return (
    <Box
      sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr auto' },
        gap: { xs: 3, lg: 6 },
        alignItems: 'center',
        p: { xs: 2, md: 4 },
        borderRadius: 'var(--radius-xl)',
        background:
          'radial-gradient(ellipse at 85% 0%, rgba(147, 197, 253, 0.16), transparent 55%), linear-gradient(180deg, rgba(8, 12, 40, 0.78), rgba(10, 6, 18, 0.55))',
        border: '2px solid rgba(147, 197, 253, 0.18)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            aria-hidden
            className="hw-float"
            sx={{ fontSize: 'clamp(5rem, 8vw, 8.5rem)', lineHeight: 1, filter: 'drop-shadow(0 0 30px rgba(254, 243, 199, 0.55))' }}
          >
            🌙
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <HauntedTitle align="left" size={TITLE} color={SPOOKY_COLORS.moon} glow="#93c5fd">
              A cidade dorme…
            </HauntedTitle>
            <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.2 }}>
              …mas ninguém fecha o olho 👀 Todo mundo no celular!
            </Typography>
          </Box>
        </Box>
        {state.round >= MAX_ROUNDS && (
          <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: SPOOKY_COLORS.blood }}>
            ⚠️ Última noite: amanhã é a última chance da cidade!
          </Typography>
        )}
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.8rem, 4vw, 4.4rem)', color: ACCENT.light, letterSpacing: '0.06em', lineHeight: 1 }}
        >
          {aliveActed(state)}/{state.alive.length} já agiram
        </Typography>
        <BadgeRow ids={state.alive} players={players} acted={acted} />
        {ghosts.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: SMALL, color: 'var(--text-muted)', mb: 1 }}>👻 Fantasmas escolhendo quem assombrar</Typography>
            <BadgeRow ids={ghosts} players={players} acted={acted} ghost />
          </Box>
        )}
      </Box>
      <Box sx={{ justifySelf: 'center' }}>
        <CandleTimer
          deadline={state.deadline === null ? null : state.deadline - GRACE_MS}
          total={NIGHT_SECONDS * 1000}
          now={now}
          size={320}
          label="até o amanhecer"
        />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Manhã
// ---------------------------------------------------------------------------

function MorningBoard({ state, players, clock }: Board & { clock: number }) {
  const news = state.news
  if (!news) return null
  const dead = news.killed
  const role = news.role ? ROLE_INFO[news.role] : null
  return (
    <Box
      sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr' }, gap: { xs: 3, lg: 5 }, alignItems: 'center' }}
    >
      <BigReveal
        open={dead !== null && clock < state.since + DEATH_REVEAL_MS}
        icon="💀"
        tone="blood"
        sound={null}
        title={`${nameOf(players, dead)} morreu`}
        subtitle={role ? `${role.icon} ${role.was}` : 'encontrado sem vida ao amanhecer'}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
        <HauntedTitle size={TITLE} color={SPOOKY_COLORS.candle}>
          ☀️ Amanheceu
        </HauntedTitle>
        {dead !== null ? (
          <Tombstone name={nameOf(players, dead)} epitaph={`“${news.epitaph}”`} width={460} rise>
            <Box sx={{ fontWeight: 800, fontSize: '1.9rem' }}>{role ? `${role.icon} ${role.name}` : 'papel: segredo 🤫'}</Box>
          </Tombstone>
        ) : news.saved ? (
          <Banner icon="😇" title="O anjo salvou alguém!" text="Os assassinos atacaram, mas ninguém morreu esta noite." color={ROLE_INFO.angel.color} />
        ) : (
          <Banner icon="🌙" title="Noite tranquila…" text="Ninguém morreu. Tranquilo até demais." color={SPOOKY_COLORS.moon} />
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
        {news.notes.map((note, index) => (
          <NoteCard key={`${index}-${note}`} text={note} index={index} />
        ))}
        {news.haunts.length > 0 && (
          <Box className="stagger-in" style={{ animationDelay: '900ms' }}>
            <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: SPOOKY_COLORS.ghost }}>👻 Os fantasmas assombraram:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              {news.haunts.map((haunt) => (
                <PlayerBadge
                  key={haunt.id}
                  name={nameOf(players, haunt.id)}
                  size="lg"
                  highlight
                  color={SPOOKY_COLORS.ghost}
                  trailing={haunt.count > 1 ? `👻×${haunt.count}` : '👻'}
                />
              ))}
            </Box>
          </Box>
        )}
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
          📨{' '}
          {news.letters === 0
            ? 'Nenhum recado chegou aos assassinos.'
            : `${plural(news.letters, 'recado anônimo chegou', 'recados anônimos chegaram')} aos assassinos.`}
        </Typography>
        <Graveyard state={state} players={players} />
      </Box>
    </Box>
  )
}

/** Bilhete do assassino, em papel amassado. */
function NoteCard({ text, index }: { text: string; index: number }) {
  return (
    <Box className="stagger-in" style={{ animationDelay: `${600 + index * 450}ms` }}>
      <Box
        sx={{
          p: 2.5,
          borderRadius: '6px',
          background: 'linear-gradient(170deg, #f5f0e1, #e2d5b5)',
          color: '#2a1810',
          transform: `rotate(${index % 2 ? 1.2 : -1.5}deg)`,
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(120, 80, 40, 0.4)',
        }}
      >
        <Typography sx={{ fontFamily: CREEPY_FONT, fontSize: 'clamp(1.8rem, 2.2vw, 2.4rem)', color: SPOOKY_COLORS.blood, lineHeight: 1 }}>
          🩸 Bilhete na cena do crime
        </Typography>
        <Typography sx={{ fontSize: 'clamp(2.1rem, 2.9vw, 3.1rem)', fontWeight: 700, lineHeight: 1.15, mt: 1, wordBreak: 'break-word' }}>
          “{text}”
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Dia
// ---------------------------------------------------------------------------

function DayBoard({ state, players, now }: Board & { now: () => number }) {
  return (
    <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr auto' }, gap: { xs: 3, lg: 6 }, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Box>
          <HauntedTitle align="left" size={TITLE} color={SPOOKY_COLORS.candle}>
            ☀️ Conversem!
          </HauntedTitle>
          <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Quem tem cara de assassino? Acusem, defendam, blefem.
          </Typography>
        </Box>
        <LastNight state={state} players={players} />
        {state.round >= MAX_ROUNDS && (
          <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: SPOOKY_COLORS.blood }}>
            ⚠️ Última chance: sem assassino expulso hoje, eles fogem da cidade!
          </Typography>
        )}
        <Box>
          <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700, mb: 1.5 }}>
            ✋ {aliveActed(state)}/{state.alive.length} prontos para votar
          </Typography>
          <BadgeRow ids={state.alive} players={players} acted={new Set(state.acted)} />
        </Box>
        <Graveyard state={state} players={players} />
      </Box>
      <Box sx={{ justifySelf: 'center' }}>
        <CandleTimer deadline={state.deadline} total={state.dayMs} now={now} size={320} label="até a votação" />
      </Box>
    </Box>
  )
}

/** O resumo da noite que passou, para quem chegou atrasado na conversa. */
function LastNight({ state, players }: Board) {
  const news = state.news
  if (!news) return null
  const what =
    news.killed !== null
      ? `💀 ${nameOf(players, news.killed)} morreu${news.role ? ` (${ROLE_INFO[news.role].icon} ${ROLE_INFO[news.role].name})` : ''}`
      : news.saved
        ? '😇 o anjo salvou alguém'
        : '🌙 ninguém morreu'
  return (
    <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.05)', borderLeft: `6px solid ${ACCENT.main}` }}>
      <Typography sx={{ fontSize: TEXT, fontWeight: 700 }}>Esta noite: {what}</Typography>
      {news.notes.map((note, index) => (
        <Typography key={`${index}-${note}`} sx={{ fontSize: SMALL, color: 'var(--text-secondary)', fontStyle: 'italic', wordBreak: 'break-word' }}>
          🩸 “{note}”
        </Typography>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Votação
// ---------------------------------------------------------------------------

function VoteBoard({ state, players }: Board) {
  // A mesma conta do motor: o 🎯 marca quem sairia se a votação fechasse agora.
  const { tally: entries, out: leader, abstain } = voteOutcome(state.votes)
  const abstainers = Object.keys(state.votes)
    .filter((id) => state.votes[id] === null)
    .map(Number)
  const best = Math.max(entries[0]?.count ?? 0, abstain)
  const acted = new Set(state.acted)
  const waiting = state.alive.filter((id) => !acted.has(id))
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <HauntedTitle align="left" size={TITLE} color={ACCENT.main}>
          🗳️ Quem sai da cidade?
        </HauntedTitle>
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
          Votem no celular · precisa de {MIN_VOTES} votos · empate: ninguém sai
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, gap: 5, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {entries.length === 0 && abstain === 0 ? (
            <Typography sx={{ fontSize: 'clamp(2.4rem, 3.4vw, 3.6rem)', color: 'var(--text-muted)' }}>Ninguém votou ainda… 🕯️</Typography>
          ) : (
            entries.slice(0, 6).map((entry) => (
              <VoteRow key={entry.id} entry={entry} best={best} players={players} leading={entry.id === leader} />
            ))
          )}
          {/* "Ninguém sai" concorre como um nome: se empatar ou vencer, ninguém sai. */}
          {abstain > 0 && (
            <VoteRow
              entry={{ id: -1, count: abstain, voters: abstainers }}
              label="🤷 Ninguém sai"
              best={best}
              players={players}
              leading={false}
            />
          )}
        </Box>
        <Box>
          <Typography sx={{ fontSize: TEXT, fontWeight: 700, mb: 1.5 }}>
            {aliveActed(state)}/{state.alive.length} votaram{waiting.length ? ' · faltam:' : ' · todo mundo votou!'}
          </Typography>
          <BadgeRow ids={waiting} players={players} acted={acted} />
        </Box>
      </Box>
    </Box>
  )
}

function VoteRow({
  entry,
  best,
  players,
  leading,
  label,
}: {
  entry: TallyEntry
  best: number
  players: HPlayer[]
  leading: boolean
  /** Rótulo no lugar do nome (a linha do "🤷 Ninguém sai"). */
  label?: string
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          noWrap
          sx={{ width: '34%', fontSize: TEXT, fontWeight: 800, color: leading ? ACCENT.main : label ? 'var(--text-secondary)' : 'var(--text-primary)' }}
        >
          {leading ? '🎯 ' : ''}
          {label ?? nameOf(players, entry.id)}
        </Typography>
        <Box sx={{ flex: 1, height: 'clamp(28px, 3vw, 40px)', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${(entry.count / Math.max(1, best)) * 100}%`,
              background: leading ? `linear-gradient(90deg, ${ACCENT.main}, ${ACCENT.light})` : 'linear-gradient(90deg, #5b4a7a, #8c7fa8)',
              borderRadius: 2,
              transition: 'width 400ms ease',
            }}
          />
        </Box>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', minWidth: '1.6ch', textAlign: 'right' }}>
          {entry.count}
        </Typography>
      </Box>
      <Typography noWrap sx={{ pl: '34%', ml: 2, fontSize: SMALL, color: 'var(--text-muted)' }}>
        ← {namesOf(players, entry.voters)}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Veredito
// ---------------------------------------------------------------------------

function VerdictBoard({ state, players }: Board) {
  const verdict = state.verdict
  if (!verdict) return null
  const best = verdict.tally[0]?.count ?? 0
  const out = verdict.out
  const role = verdict.role
  return (
    <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' }, gap: 5, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        <HauntedTitle align="left" size={TITLE} color={ACCENT.main}>
          ⚖️ O veredito
        </HauntedTitle>
        {verdict.tally.length === 0 ? (
          <Typography sx={{ fontSize: 'clamp(2.4rem, 3.4vw, 3.6rem)', color: 'var(--text-muted)' }}>Ninguém votou em ninguém…</Typography>
        ) : (
          verdict.tally.slice(0, 6).map((entry, index) => (
            <Box key={entry.id} className="stagger-in" style={{ animationDelay: `${index * 160}ms` }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography noWrap sx={{ width: '34%', fontSize: TEXT, fontWeight: 800, color: entry.id === out ? ACCENT.main : 'var(--text-primary)' }}>
                {nameOf(players, entry.id)}
              </Typography>
              <Box sx={{ flex: 1, height: 'clamp(28px, 3vw, 40px)', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: `${(entry.count / Math.max(1, best)) * 100}%`,
                    background: entry.id === out ? `linear-gradient(90deg, ${ACCENT.main}, ${ACCENT.light})` : 'linear-gradient(90deg, #5b4a7a, #8c7fa8)',
                    borderRadius: 2,
                    transformOrigin: 'left',
                    animation: 'cdGrow 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
                    animationDelay: `${index * 160}ms`,
                    '@keyframes cdGrow': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                  }}
                />
              </Box>
              <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', minWidth: '1.6ch', textAlign: 'right' }}>
                {entry.count}
              </Typography>
            </Box>
          ))
        )}
        {verdict.abstain > 0 && (
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>🤷 {plural(verdict.abstain, 'voto', 'votos')} em “ninguém sai”</Typography>
        )}
      </Box>
      {/* O resultado só sobe depois do rufar (o som chega junto). */}
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          animation: `cdRise 900ms cubic-bezier(0.22, 1, 0.36, 1) ${SUSPENSE_MS}ms both`,
          '@keyframes cdRise': { from: { opacity: 0, transform: 'translateY(60px) scale(0.9)' }, to: { opacity: 1, transform: 'none' } },
        }}
      >
        {out !== null ? (
          <Tombstone
            title="FORA DA CIDADE"
            name={nameOf(players, out)}
            width={460}
            epitaph={
              role === null ? (
                'papel: segredo 🤫'
              ) : role === 'killer' ? (
                <Box component="span" sx={{ color: '#7f1020', fontWeight: 900, fontStyle: 'normal' }}>
                  🔪 ERA ASSASSINO!
                </Box>
              ) : (
                `${ROLE_INFO[role].icon} ${ROLE_INFO[role].was}… 😬`
              )
            }
          />
        ) : (
          <Banner icon="🤷" title="Ninguém saiu" text={NOBODY_OUT[verdict.reason === 'out' ? 'few' : verdict.reason]} color={SPOOKY_COLORS.moon} />
        )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

function EndBoard({ state, players, clock, slots }: Board & { clock: number; slots: Slots }) {
  const final = state.final
  if (!final) return <EndedEarly state={state} players={players} slots={slots} />
  const page = Math.floor(Math.max(0, clock - state.since) / END_PAGE_MS) % END_PAGES.length
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <WinnerBanner final={final} state={state} players={players} />
      <Box key={page} className="animate-pop-in" sx={{ flex: 1 }}>
        {page === 0 && <RolesReveal final={final} state={state} players={players} />}
        {page === 1 && <TimelineBoard nights={final.nights} players={players} />}
        {page === 2 && <FaroBoard final={final} players={players} />}
      </Box>
      <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        {END_PAGES.map((label, index) => (
          <Typography
            key={label}
            sx={{
              fontSize: SMALL,
              fontWeight: 800,
              color: index === page ? ACCENT.main : 'var(--text-muted)',
              borderBottom: `4px solid ${index === page ? ACCENT.main : 'transparent'}`,
            }}
          >
            {label}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

function WinnerBanner({ final, state, players }: Board & { final: Final }) {
  const killersWon = final.winner === 'killers'
  const killers = state.roster.filter((id) => final.roles[String(id)] === 'killer')
  return (
    <Box sx={{ textAlign: 'center' }}>
      <HauntedTitle size="clamp(4rem, 7vw, 7.5rem)" color={killersWon ? SPOOKY_COLORS.blood : SPOOKY_COLORS.toxic} drip={killersWon}>
        {killersWon ? '🔪 Os assassinos venceram!' : '🏆 A cidade venceu!'}
      </HauntedTitle>
      <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', fontWeight: 700, mt: 1 }}>
        {END_SUBTITLE[final.reason]} · {killers.length > 1 ? 'Os assassinos eram' : 'O assassino era'}{' '}
        <Box component="span" sx={{ color: SPOOKY_COLORS.blood }}>
          {namesOf(players, killers)}
        </Box>
      </Typography>
    </Box>
  )
}

function RolesReveal({ final, state, players }: Board & { final: Final }) {
  const order = [...state.roster].sort(
    (a, b) => ROLE_ORDER.indexOf(final.roles[String(a)]) - ROLE_ORDER.indexOf(final.roles[String(b)]) || state.roster.indexOf(a) - state.roster.indexOf(b),
  )
  return (
    <Box>
      <SectionTitle>🎭 Quem era quem</SectionTitle>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(260px, 22vw, 380px), 1fr))', gap: 1.5 }}>
        {order.map((id, index) => {
          const role = final.roles[String(id)] ?? 'citizen'
          const info = ROLE_INFO[role]
          const dead = !state.alive.includes(id)
          return (
            <Box
              key={id}
              className="stagger-in"
              style={{ animationDelay: `${index * 90}ms` }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderRadius: 'var(--radius-lg)',
                border: `3px solid ${withAlpha(info.color, role === 'killer' ? 0.95 : 0.45)}`,
                background: withAlpha(info.color, role === 'killer' ? 0.2 : 0.07),
                boxShadow: role === 'killer' ? `0 0 26px ${withAlpha(info.color, 0.35)}` : 'none',
              }}
            >
              <Box aria-hidden sx={{ fontSize: 'clamp(2.4rem, 3vw, 3.2rem)', lineHeight: 1 }}>
                {info.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: TEXT, fontWeight: 800, lineHeight: 1.1, opacity: dead ? 0.7 : 1 }}>
                  {dead ? '👻 ' : ''}
                  {nameOf(players, id)}
                </Typography>
                <Typography noWrap sx={{ fontSize: SMALL, color: info.color, lineHeight: 1.1 }}>
                  {info.name}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function TimelineBoard({ nights, players }: { nights: NightRecap[]; players: HPlayer[] }) {
  const name = (id: number | null) => nameOf(players, id)
  return (
    <Box>
      <SectionTitle>🕯️ Linha do tempo das noites</SectionTitle>
      {nights.length === 0 ? (
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>Nem deu tempo de anoitecer.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: nights.length > 5 ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 1.25, columnGap: 3 }}>
          {nights.map((night, index) => {
            const attack =
              night.target === null
                ? '🔪 ninguém atacado'
                : night.saved
                  ? `🔪 ${name(night.target)} → 😇 salvo`
                  : `🔪 ${name(night.target)} morreu`
            const parts = [
              attack,
              night.guard !== null && !night.saved ? `😇 protegeu ${name(night.guard)}` : null,
              night.clue ? `🔎 ${name(night.clue.target)}: ${night.clue.killer ? 'ASSASSINO!' : 'inocente'}` : null,
              !night.voted ? null : night.out !== null ? `⚖️ ${name(night.out)} saiu` : '⚖️ ninguém saiu',
            ].filter((part): part is string => part !== null)
            return (
              <Box
                key={night.round}
                className="stagger-in"
                style={{ animationDelay: `${index * 140}ms` }}
                sx={{ display: 'flex', alignItems: 'baseline', gap: 2.5, px: 2.5, py: 1.25, borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', color: ACCENT.light, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                  NOITE {night.round}
                </Typography>
                <Typography sx={{ fontSize: TEXT, fontWeight: 600, lineHeight: 1.25 }}>{parts.join('  ·  ')}</Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

function FaroBoard({ final, players }: { final: Final; players: HPlayer[] }) {
  const entries = final.faro
  const sniffed = entries.some((entry) => entry.hits > 0)
  return (
    <Box>
      <SectionTitle>👃 Melhor faro</SectionTitle>
      <Typography sx={{ fontSize: SMALL, color: 'var(--text-muted)', mb: 2 }}>
        {sniffed ? 'Apostas certas dos cidadãos em quem era assassino' : 'Ninguém farejou nada 🤧 — os assassinos agradecem'}
      </Typography>
      {entries.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: entries.length > 6 ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 1.25, columnGap: 5, maxWidth: entries.length > 6 ? 'none' : 1100 }}>
          {entries.map((entry, index) => {
            const place = entries.findIndex((other) => other.hits === entry.hits) + 1
            const top = sniffed && place === 1
            return (
              <Box
                key={entry.id}
                className="stagger-in"
                style={{ animationDelay: `${index * 80}ms` }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2.5,
                  py: 1,
                  borderRadius: 'var(--radius-lg)',
                  background: top ? `${ACCENT.main}26` : 'rgba(255, 255, 255, 0.04)',
                  border: `2px solid ${top ? ACCENT.main : 'transparent'}`,
                }}
              >
                <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>
                  {place}º
                </Typography>
                <Typography noWrap sx={{ flex: 1, fontSize: TEXT, fontWeight: 700 }}>
                  {top ? '👃 ' : ''}
                  {nameOf(players, entry.id)}
                </Typography>
                <Typography sx={{ fontSize: SMALL, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {entry.hits}/{plural(entry.bets, 'aposta', 'apostas')}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

/**
 * O host apertou "Encerrar" no meio: o motor não fechou a partida. Cada
 * celular conta o próprio papel (slot 'reveal') e a TV revela quem já contou.
 */
function EndedEarly({ state, players, slots }: Board & { slots: Slots }) {
  const told = revealedRoles(state, slots)
  const killers = state.roster.filter((id) => told[String(id)] === 'killer')
  const missing = Math.max(0, roleCounts(state.roster.length).killer - killers.length)
  const others = (['detective', 'angel'] as const)
    .map((role) => {
      const id = state.roster.find((candidate) => told[String(candidate)] === role)
      return id === undefined ? null : `${ROLE_INFO[role].icon} ${ROLE_INFO[role].name}: ${nameOf(players, id)}`
    })
    .filter((line): line is string => line !== null)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textAlign: 'center' }}>
      <HauntedTitle size={TITLE} color={ACCENT.main}>
        ⏹ Partida encerrada
      </HauntedTitle>
      {killers.length > 0 ? (
        <Typography className="animate-pop-in" sx={{ fontSize: 'clamp(2.4rem, 3.6vw, 4rem)', fontWeight: 800 }}>
          🔪 {killers.length > 1 || missing > 0 ? 'Os assassinos eram' : 'O assassino era'}{' '}
          <Box component="span" sx={{ color: SPOOKY_COLORS.blood }}>
            {namesOf(players, killers)}
          </Box>
          {missing > 0 ? ` e mais ${missing} que fugiu sem contar` : ''}
        </Typography>
      ) : (
        <Typography sx={{ fontSize: 'clamp(2rem, 3vw, 3.2rem)', fontWeight: 700 }}>
          Os celulares estão contando quem era quem… 🤫
        </Typography>
      )}
      {others.length > 0 && <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>{others.join('  ·  ')}</Typography>}
      <Graveyard state={state} players={players} />
    </Box>
  )
}
