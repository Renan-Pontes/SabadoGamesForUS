import { useEffect, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { DoorSvg } from '../../ui'
import { finalStanding, nextRoundSetup, validDoor, type State } from './engine'
import { meta } from './meta'
import { GHOST_TINT, MONSTER_GLOW, SAFE_GLOW, buzz, ghostVotesOf, plural, revealClock, roleOf, woodFor, type Role } from './view'

/**
 * Celular do "Portas do Além": uma ação clara por tela. Vivo toca numa
 * porta; fantasma toca onde o monstro ataca. Na revelação, o celular só
 * conta o que aconteceu depois que a TV mostrou (mesmo relógio) — nada de
 * estragar a surpresa da porta abrindo.
 */

const ACCENT = meta.accent
const BLOOD = 'var(--blood, #e0213a)'

export default function Phone(props: HalloweenViewProps<State>) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (roleOf(state, me.id) === 'out') return <Note icon="👀" title="Olhe a TV" text="Você entra na próxima partida." />
  if (state.phase === 'choose') {
    return roleOf(state, me.id) === 'alive' ? <ChoosePanel {...props} /> : <GhostPanel {...props} />
  }
  if (state.phase === 'reveal') return <RevealPanel {...props} />
  return <StatusPanel {...props} />
}

function Header({ state, now, grace, role }: { state: State; now: () => number; grace: boolean; role: Role }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        RODADA {state.round}
      </Typography>
      <Box
        sx={{
          px: 1.25,
          py: 0.25,
          borderRadius: 'var(--radius-full)',
          border: `2px solid ${role === 'ghost' ? GHOST_TINT : ACCENT.main}`,
          color: role === 'ghost' ? GHOST_TINT : ACCENT.light,
          fontWeight: 800,
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
        }}
      >
        {role === 'ghost' ? '👻 FANTASMA' : '😨 VIVO'}
      </Box>
      <Typography
        sx={{
          minWidth: '3.2ch',
          textAlign: 'right',
          fontFamily: 'var(--font-numeric)',
          fontSize: '1.8rem',
          lineHeight: 1,
          color: seconds !== null && seconds <= 5 ? BLOOD : ACCENT.main,
        }}
      >
        {seconds === null ? '' : `⏳ ${seconds}`}
      </Typography>
    </Box>
  )
}

/** Portas grandes para tocar: 3 numa fileira, 4 em 2×2, 5 em 3+2 (cabem em 360 px). */
function DoorGrid({
  doors,
  chosen,
  onPick,
  ghost = false,
  votes,
}: {
  doors: number
  chosen: number | null
  onPick: (door: number) => void
  ghost?: boolean
  votes?: number[]
}) {
  const width = doors === 3 ? 100 : doors === 4 ? 112 : 90
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 1.5, rowGap: 1.5, maxWidth: doors === 4 ? 280 : 340, mx: 'auto' }}>
      {Array.from({ length: doors }, (_, index) => {
        const door = index + 1
        const count = votes?.[index] ?? 0
        return (
          <Box key={door} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            {ghost && (
              <Typography sx={{ minHeight: '1.5rem', fontWeight: 800, color: GHOST_TINT, lineHeight: 1.5 }}>
                {count > 0 ? `👻 ${count}` : ''}
              </Typography>
            )}
            <DoorSvg
              width={width}
              label={door}
              color={ghost ? '#4a1d24' : woodFor(door)}
              glow={ghost ? MONSTER_GLOW : SAFE_GLOW}
              selected={chosen === door}
              onClick={() => onPick(door)}
              ariaLabel={ghost ? `Mandar o monstro para a porta ${door}` : `Entrar na porta ${door}`}
            />
          </Box>
        )
      })}
    </Box>
  )
}

/** Depois de agir: confirmação + "esperando os outros (7/15)". */
function WaitLine({ state, done, text }: { state: State; done: boolean; text: string }) {
  return (
    <Box sx={{ mt: 2, textAlign: 'center' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: done ? ACCENT.light : 'var(--text-secondary)' }}>{text}</Typography>
      {done && (
        <Typography sx={{ mt: 0.5, color: 'var(--text-muted)' }}>
          esperando os outros ({state.acted.length}/{state.roster.length})
        </Typography>
      )}
    </Box>
  )
}

function ChoosePanel({ state, myInput, send, now }: HalloweenViewProps<State>) {
  const chosen = validDoor(myInput?.door, state.doors)
  const pickDoor = (door: number) => {
    send({ door })
    buzz([30, 50, 30])
  }
  return (
    <Box>
      <Header state={state} now={now} grace role="alive" />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1.05, textAlign: 'center' }}>
        Escolha uma porta
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', textAlign: 'center', mt: 0.5, mb: state.extraMonsters > 0 ? 0.5 : 2 }}>
        {state.monsters === 1 ? 'O monstro está atrás de uma delas.' : `Tem monstro atrás de ${state.monsters} delas.`}
      </Typography>
      {state.extraMonsters > 0 && (
        <Typography sx={{ color: '#fca5a5', fontWeight: 800, textAlign: 'center', mb: 2 }}>
          😤 O além está impaciente: +{plural(state.extraMonsters, 'monstro', 'monstros')}
        </Typography>
      )}
      <DoorGrid doors={state.doors} chosen={chosen} onPick={pickDoor} />
      <WaitLine
        state={state}
        done={chosen !== null}
        text={chosen !== null ? `✓ Você está atrás da porta ${chosen}. Dá para trocar até o fim.` : 'Toque numa porta. Só você sabe qual.'}
      />
    </Box>
  )
}

function GhostPanel({ state, myInput, mine, send, now }: HalloweenViewProps<State>) {
  const chosen = validDoor(myInput?.door, state.doors)
  const votes = ghostVotesOf(mine, state.doors)
  const pickDoor = (door: number) => {
    send({ door })
    buzz([60, 40, 60])
  }
  return (
    <Box>
      <Header state={state} now={now} grace role="ghost" />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1.05, textAlign: 'center', color: GHOST_TINT }}>
        Escolha onde o monstro ataca
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', textAlign: 'center', mt: 0.5, mb: 2 }}>
        {state.monsters === 1
          ? 'A porta mais votada pelos fantasmas ganha o monstro.'
          : `As ${state.monsters} portas mais votadas pelos fantasmas ganham monstro.`}
      </Typography>
      <DoorGrid doors={state.doors} chosen={chosen} onPick={pickDoor} ghost votes={votes} />
      <WaitLine
        state={state}
        done={chosen !== null}
        text={chosen !== null ? `✓ Você mandou o monstro para a porta ${chosen}.` : 'Toque na porta que o monstro vai abrir.'}
      />
    </Box>
  )
}

function RevealPanel({ state, me, now }: HalloweenViewProps<State>) {
  const t = useServerNow(now, 250)
  const reveal = state.reveal
  const clock = reveal ? revealClock(reveal, t) : null
  const id = me?.id ?? -1
  const myDoor = reveal?.picks[String(id)]
  const myVote = reveal?.ghostVotes[String(id)]
  const died = reveal?.victims.includes(id) ?? false
  const shown = clock?.resultShown ?? false

  // Vibra forte uma vez, quando a TV mostra que você virou fantasma.
  useEffect(() => {
    if (shown && died) buzz([300, 100, 300, 100, 600])
  }, [shown, died])

  if (!reveal || !clock) return null
  // Quem morreu nesta rodada só vira fantasma no celular quando a TV mostra.
  const role: Role = myDoor !== undefined && !(shown && died) ? 'alive' : 'ghost'

  if (!shown) {
    const open = myDoor !== undefined && clock.opened.has(myDoor)
    const monsterHere = myDoor !== undefined && reveal.monsterDoors.includes(myDoor)
    const beast = myDoor !== undefined ? reveal.beasts[reveal.monsterDoors.indexOf(myDoor)] : undefined
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} role={role} />
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1.05 }}>👀 Olhe a TV!</Typography>
        {myDoor !== undefined ? (
          <>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem', mt: 1, mb: 2 }}>
              Você está atrás da porta {myDoor}
              {reveal.autoPicked.includes(id) ? ' (sorteada 🎲)' : ''}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <DoorSvg
                width={130}
                label={myDoor}
                color={woodFor(myDoor)}
                open={open}
                knock={!open && clock.monsterOut === false && clock.opened.size > 0}
                inside={monsterHere ? (beast?.emoji ?? '👹') : '🕯️'}
                glow={monsterHere ? MONSTER_GLOW : SAFE_GLOW}
              />
            </Box>
          </>
        ) : (
          <Typography sx={{ color: GHOST_TINT, fontSize: '1.15rem', fontWeight: 700, mt: 1 }}>
            {myVote !== undefined ? `Você mandou o monstro para a porta ${myVote}.` : 'Você não votou desta vez 😴'}
          </Typography>
        )}
      </Box>
    )
  }

  let icon: string
  let title: string
  let detail: string
  let color = 'var(--text-primary)'
  if (myDoor !== undefined && died) {
    icon = '💀'
    title = 'Você virou fantasma!'
    detail = 'Agora é sua vez: na próxima rodada, você escolhe onde o monstro ataca.'
    color = BLOOD
  } else if (myDoor !== undefined) {
    const caught = reveal.monsterDoors.includes(myDoor)
    icon = caught ? '🍀' : '😅'
    title = caught ? 'O monstro tropeçou!' : 'Ufa! Você sobreviveu.'
    detail = caught ? 'Você estava na porta do monstro… e escapou por sorte.' : `A porta ${myDoor} estava segura.`
    color = caught ? '#bef264' : ACCENT.light
  } else {
    const souls = reveal.hunters[String(id)] ?? 0
    const votedMonster = myVote !== undefined && reveal.monsterDoors.includes(myVote)
    icon = souls > 0 ? '🎯' : '👻'
    title = souls > 0 ? `Você levou ${plural(souls, 'alma', 'almas')}!` : 'Nenhuma alma desta vez.'
    if (souls > 0) detail = 'Fantasma vingativo! Continue assim.'
    else if (myVote === undefined) detail = 'Vote na próxima para assombrar alguém.'
    else if (votedMonster && reveal.saved) detail = 'O monstro foi na sua porta… e tropeçou.'
    else if (votedMonster) detail = 'O monstro foi na sua porta… mas não tinha ninguém lá.'
    else detail = 'O monstro foi parar em outra porta.'
    color = GHOST_TINT
  }
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} role={role} />
      <Note icon={icon} title={title} text={detail} color={color} />
    </Box>
  )
}

function StatusPanel({ state, me, now }: HalloweenViewProps<State>) {
  const id = me?.id ?? -1
  const role = roleOf(state, id)
  const next = nextRoundSetup(state)
  const souls = state.souls[String(id)] ?? 0
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} role={role} />
      {role === 'alive' ? (
        <Note
          icon="😨"
          title="Você continua vivo"
          text={state.alive.length === 1 ? 'Só sobrou você!' : `Restam ${state.alive.length} vivos. Prepare-se para a próxima porta.`}
          color={ACCENT.light}
        />
      ) : (
        <Note
          icon="👻"
          title="Você é um fantasma"
          text={`${souls > 0 ? `${plural(souls, 'alma levada', 'almas levadas')} até agora. ` : ''}Na próxima, você escolhe onde o monstro ataca.`}
          color={GHOST_TINT}
        />
      )}
      <Typography sx={{ mt: 2, color: 'var(--text-secondary)', fontWeight: 700 }}>
        Próxima rodada: 🚪 {next.doors} · 👹 {plural(next.monsters, 'monstro', 'monstros')}
      </Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: HalloweenViewProps<State>) {
  if (!me) return null
  const standing = finalStanding(state)
  const mine = standing.ranking.find((entry) => entry.id === me.id)
  const won = standing.winners.includes(me.id)
  const died = state.diedIn[String(me.id)]
  const others = standing.winners.filter((id) => id !== me.id)
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da noite</Typography>
      {won ? (
        <Note
          icon="🏆"
          title="Você sobreviveu ao além!"
          text={others.length ? `Empate dos últimos com ${names(others, players)}.` : 'Último vivo da noite. Respeito.'}
          color={ACCENT.light}
        />
      ) : mine ? (
        <Note
          icon="👻"
          title={`${mine.place}º lugar`}
          text={died !== undefined ? `Você virou fantasma na rodada ${died}.` : 'Boa tentativa!'}
          color={GHOST_TINT}
        />
      ) : null}
      {!won && standing.winners.length > 0 && (
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
          🏆 {names(standing.winners, players)} {standing.winners.length === 1 ? 'sobreviveu' : 'sobreviveram'}
        </Typography>
      )}
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${GHOST_TINT}` }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>👻 Fantasma mais vingativo</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {standing.avengers.length
            ? `${names(standing.avengers, players)} (${plural(standing.maxSouls, 'alma', 'almas')})`
            : 'Ninguém acertou'}
        </Typography>
      </Box>
    </Box>
  )
}

function Note({ icon, title, text, color = 'var(--text-primary)' }: { icon: string; title: string; text?: ReactNode; color?: string }) {
  return (
    <Box className="animate-pop-in" sx={{ py: 2 }}>
      <Typography sx={{ fontSize: '4rem', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.05, mt: 1, color }}>{title}</Typography>
      {text && <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.1rem', mt: 1 }}>{text}</Typography>}
    </Box>
  )
}

function names(ids: number[], players: HPlayer[]) {
  return listNames(ids.map((id) => nameOf(players, id)))
}
