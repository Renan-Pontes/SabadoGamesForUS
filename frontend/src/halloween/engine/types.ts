import type { ComponentType } from 'react'
import type { GameAccent } from '../../games/theme'
import type { GameMeta } from '../../lib/gameCatalog'
import type { MusicTrack } from '../audio'

/**
 * Contrato dos jogos da Noite do Terror (ver "Motor (F2)" no HALLOWEEN.md).
 *
 * A TV é o juiz: o motor de cada jogo roda no navegador dela, lê as respostas
 * que os celulares gravaram no próprio `player.state` e devolve o estado novo
 * da partida, que vai para `room.state.g`. Este arquivo só tem tipos — nada
 * aqui roda, então qualquer módulo pode importá-lo sem criar ciclo.
 */

/** Uma pessoa da sala, como o motor enxerga. */
export type HPlayer = { id: number; name: string; isHost: boolean; online: boolean }

/** Resposta de um jogador. `k` é o `inputKey` que ela responde. */
export type HInput = { k: string; [field: string]: unknown }

/** Comando do host (`skip`, ou algo próprio do jogo). `id` só cresce. */
export type HCommand = { id: number; type: string; [field: string]: unknown }

export type EngineCtx = {
  /** Todos na sala, na ordem de entrada. */
  players: HPlayer[]
  /** Resposta atual de cada jogador (pode ser de outra fase: confira o `k`). */
  inputs: Record<number, HInput | undefined>
  /** Respostas persistentes nomeadas (ex.: 'draw'), que não somem na troca de fase. */
  slots: Record<string, Record<number, HInput | undefined>>
  /** Comando do host ainda não visto pelo motor — chega uma vez só. */
  command: HCommand | null
  /** Agora, em ms do relógio do servidor. */
  now: number
  /** Aleatório em [0, 1). Use sempre este, nunca Math.random (os testes semeiam). */
  rng: () => number
  /** Opções escolhidas pelo host na tela de configuração. */
  options: Record<string, unknown>
}

export type BaseState = {
  phase: string
  /** Muda a cada nova rodada de respostas; respostas com outro `k` são ignoradas. */
  inputKey: string
  /** Quando a fase avança sozinha (ms do servidor), ou null. */
  deadline: number | null
  /** Quem está na partida (fixo desde o início). */
  roster: number[]
  /** Acabou: as telas mostram o resultado final. */
  over: boolean
  /** Quem já respondeu na fase (público: a TV mostra ✓, nunca o quê). */
  acted?: number[]
  scores?: Record<string, number>
  /** Segredo por jogador (chave = id). Só o dono vê, pela prop `mine`. */
  private?: Record<string, unknown>
  round?: number
  totalRounds?: number
}

export type HalloweenEngine<S extends BaseState> = {
  /** Começa a partida (o host apertou "Começar"). */
  init(ctx: EngineCtx): S
  /** Puro e idempotente: devolve o MESMO objeto quando nada mudou. */
  step(state: S, ctx: EngineCtx): S
  /**
   * Resposta plausível do jogador (testes e simulação). Devolve os campos da
   * resposta, sem o `k`; com `_slot: 'nome'` a resposta vai para o slot.
   * null = nada a fazer agora.
   */
  bot(state: S, playerId: number, ctx: EngineCtx): Record<string, unknown> | null
}

export type HalloweenOptionValue = string | number | boolean

/** Uma escolha da tela de configuração (rodadas, tempo, modo...). */
export type HalloweenOption = {
  key: string
  label: string
  help?: string
  choices: { value: HalloweenOptionValue; label: string }[]
  default: HalloweenOptionValue
}

export type HalloweenGameMeta = {
  slug: string
  name: string
  icon: string
  /** Uma linha curta (cabeçalho e vitrine). */
  tagline: string
  /** Frase de venda: o que a pessoa ganha jogando isso. */
  pitch: string
  /** "Como jogar": 3 a 5 passos de no máximo ~14 palavras. */
  howTo: string[]
  duration: string
  vibe: GameMeta['vibe']
  minPlayers: number
  maxPlayers: number
  accent: GameAccent
  options: HalloweenOption[]
  /** Trilha da TV durante a partida. */
  music?: MusicTrack
  /** Intervalo do poll nos celulares (padrão ~1500 ms). */
  phonePollMs?: number
}

export type HalloweenView = 'tv' | 'host' | 'player'

/** Tipo do segredo de um jogador, tirado de `S['private']`. */
export type PrivateOf<S> = S extends { private?: Record<string, infer P> } ? P : unknown

/**
 * O que as telas do jogo recebem. `state` chega SEM `private` — o segredo do
 * próprio jogador vem em `mine`, e a TV nunca recebe segredo nenhum.
 */
export type HalloweenViewProps<S extends BaseState = BaseState> = {
  code: string
  view: HalloweenView
  state: S
  players: HPlayer[]
  /** Quem está segurando o celular (null na TV). */
  me: HPlayer | null
  isHost: boolean
  /** Minha resposta da fase atual (já otimista: aparece assim que eu envio). */
  myInput: HInput | null
  /** state.private[me.id] */
  mine: PrivateOf<S> | null
  /** Agora, em ms do servidor. Para redesenhar sozinho, use useServerNow(now). */
  now: () => number
  /** Responde a fase atual: grava `{ k: state.inputKey, ...fields }`. */
  send: (fields: Record<string, unknown>) => void
  /** Grava num slot persistente (ex.: 'draw'), com o `k` da fase atual. */
  sendSlot: (slot: string, fields: Record<string, unknown>) => void
  /** Comando do host (ex.: 'skip'). Só vale vindo do host. */
  command: (type: string, extra?: Record<string, unknown>) => void
  /** Slots de todo mundo na TV; nos celulares, só os meus. */
  slots: Record<string, Record<number, HInput | undefined>>
  /** Opções escolhidas na configuração. */
  options: Record<string, unknown>
}

/** O que cada pasta `games/<slug>/index.ts` exporta. */
/**
 * Um momento importante da partida que assusta a sala inteira de uma vez:
 * a TV e os celulares (todos, ou só os de `phones`) disparam o susto quando
 * veem o estado. Cada `key` assusta uma vez só por aparelho; quem abre a tela
 * já no meio do momento não leva susto atrasado.
 */
export type ScareMoment = {
  /** Única por momento na partida (ex.: `result-3`). */
  key: string
  /** Só estes celulares (ids); sem isso, todos. */
  phones?: number[]
  /** A TV assusta junto? Padrão: sim. */
  tv?: boolean
  /** Espera antes do susto (deixa a tela do momento aparecer primeiro). */
  delayMs?: number
}

export type HalloweenGameModule<S extends BaseState = BaseState> = {
  meta: HalloweenGameMeta
  engine: HalloweenEngine<S>
  Tv: ComponentType<HalloweenViewProps<S>>
  Phone: ComponentType<HalloweenViewProps<S>>
  /** O momento de susto para todos, se o estado está num (puro; roda em todo aparelho). */
  scareMoment?: (state: S, players: HPlayer[]) => ScareMoment | null
}
