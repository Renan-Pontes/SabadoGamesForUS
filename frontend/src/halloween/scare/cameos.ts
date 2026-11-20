/**
 * Visitas de Natal: aparições pequenas e fofas nos cantos e no fundo da TV
 * (um biscoito que acena, o Papai Noel lá no céu com um presente, um
 * pinguim escorregando...). Nada de tela cheia, nada de susto, nada de fala
 * (a voz do navegador soa robótica) — só som baixinho e, no máximo, um
 * balãozinho escrito.
 *
 * Puro (sem React): o registro, o sorteio, o barramento e o plano de som.
 * A arte mora em CameoOverlay.tsx; o agendador das visitas automáticas, em
 * fx/ambientCameos.ts.
 */

import type { SfxName } from '../audio/types'

export const CAMEOS = [
  'cookie',
  'santaSleigh',
  'snowman',
  'penguin',
  'shootingStar',
  'parachuteGift',
  'reindeerHop',
  'chimneyElf',
  'peek',
] as const

export type Cameo = (typeof CAMEOS)[number]

/** Pedido de visita sorteada (botão "Surpresa" do host, "Testar visita" da TV). */
export const CAMEO_RANDOM = 'cameo'

/**
 * O pedido antigo de "efeito de Natal sorteado". No Natal ele também vira
 * uma visita: um celular de host com a página velha não solta nada alto.
 */
export const LEGACY_FESTIVE_RANDOM = 'festive'

/** Onde a visita aparece: 'front' = cantinho por cima do jogo; 'back' = no cenário, atrás do conteúdo. */
export type CameoLayer = 'front' | 'back'

export type CameoSound = { sfx: SfxName; delay: number; volume: number }

export type CameoInfo = {
  label: string
  icon: string
  /** Tempo de tela (a animação inteira: entra, faz a graça, sai). */
  durationMs: number
  layer: CameoLayer
  /** Usa o nome de alguém (o balãozinho do desconfiado). */
  named?: boolean
  /** Fica fora do sorteio (o desconfiado só faz sentido num momento do jogo). */
  noRandom?: boolean
  /** Som baixinho, casado com a animação (delay em segundos). */
  sounds: readonly CameoSound[]
  /** Frase do cartão calmo (reduzir movimento) e do aviso do host. */
  caption: string
}

/** Só sons suaves: nada de 'boom', 'buzzer', grito, estática... */
export const CAMEO_SOFT_SFX: readonly SfxName[] = ['sleigh', 'chime', 'pop', 'giggle', 'boing', 'whoosh', 'ding']

/** Teto de volume de qualquer som de visita (o normal dos jogos é 1). */
export const CAMEO_MAX_VOLUME = 0.5

export const CAMEO_INFO: Record<Cameo, CameoInfo> = {
  cookie: {
    label: 'Biscoito',
    icon: '🍪',
    durationMs: 6000,
    layer: 'front',
    sounds: [
      { sfx: 'pop', delay: 0.5, volume: 0.25 },
      { sfx: 'giggle', delay: 1.6, volume: 0.3 },
    ],
    caption: 'Um biscoito de gengibre passou para dar oi',
  },
  santaSleigh: {
    label: 'Papai Noel',
    icon: '🎅',
    durationMs: 10000,
    layer: 'back',
    sounds: [{ sfx: 'sleigh', delay: 0.4, volume: 0.3 }],
    caption: 'O Papai Noel passou lá no céu com um presente',
  },
  snowman: {
    label: 'Boneco de neve',
    icon: '⛄',
    durationMs: 7000,
    layer: 'front',
    sounds: [
      { sfx: 'whoosh', delay: 0.3, volume: 0.2 },
      { sfx: 'boing', delay: 3.4, volume: 0.3 },
    ],
    caption: 'Um boneco de neve acenou (e o chapéu pulou!)',
  },
  penguin: {
    label: 'Pinguim',
    icon: '🐧',
    durationMs: 7000,
    layer: 'back',
    sounds: [{ sfx: 'whoosh', delay: 1.2, volume: 0.25 }],
    caption: 'Um pinguim passou escorregando de barriga',
  },
  shootingStar: {
    label: 'Estrela cadente',
    icon: '🌠',
    durationMs: 4500,
    layer: 'back',
    sounds: [{ sfx: 'chime', delay: 0.3, volume: 0.3 }],
    caption: 'Uma estrela cadente! Faça um pedido',
  },
  parachuteGift: {
    label: 'Presente',
    icon: '🎁',
    durationMs: 8000,
    layer: 'front',
    sounds: [
      { sfx: 'pop', delay: 5.5, volume: 0.3 },
      { sfx: 'chime', delay: 5.7, volume: 0.25 },
    ],
    caption: 'Um presente desceu de paraquedas',
  },
  reindeerHop: {
    label: 'Renazinha',
    icon: '🦌',
    durationMs: 8000,
    layer: 'back',
    sounds: [{ sfx: 'sleigh', delay: 0.6, volume: 0.2 }],
    caption: 'Uma renazinha passou pulando nos morros',
  },
  chimneyElf: {
    label: 'Duende',
    icon: '🧝',
    durationMs: 6500,
    layer: 'back',
    sounds: [
      { sfx: 'pop', delay: 0.9, volume: 0.3 },
      { sfx: 'giggle', delay: 2.1, volume: 0.35 },
    ],
    caption: 'Um duende saiu da chaminé e jogou confete',
  },
  peek: {
    label: 'Desconfiado',
    icon: '🤨',
    durationMs: 4800,
    layer: 'front',
    named: true,
    noRandom: true,
    sounds: [{ sfx: 'boing', delay: 0.45, volume: 0.3 }],
    caption: 'Um duende desconfiado espiou',
  },
}

/** As que podem sair no sorteio (botão "Surpresa", visitas automáticas). */
export const RANDOM_CAMEOS: readonly Cameo[] = CAMEOS.filter((kind) => !CAMEO_INFO[kind].noRandom)

export function isCameo(value: unknown): value is Cameo {
  return typeof value === 'string' && (CAMEOS as readonly string[]).includes(value)
}

/** É pedido de visita: uma visita pelo nome, 'cameo' ou o antigo 'festive'. */
export function isCameoRequest(value: unknown): boolean {
  return isCameo(value) || value === CAMEO_RANDOM || value === LEGACY_FESTIVE_RANDOM
}

let lastCameo: Cameo | null = null

/** Sorteia uma visita (sem o desconfiado), nunca a mesma da última vez. */
export function pickCameo(random: () => number = Math.random, avoid: Cameo | null = lastCameo): Cameo {
  const pool = RANDOM_CAMEOS.filter((kind) => kind !== avoid)
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Visita pelo nome fica; 'cameo', 'festive' ou qualquer outra coisa vira sorteio. */
export function resolveCameo(kind: unknown, random: () => number = Math.random): Cameo {
  return isCameo(kind) ? kind : pickCameo(random)
}

/** O balãozinho do desconfiado: "Hmm… Ana?". As outras visitas não falam. */
export function cameoBubble(kind: Cameo, name?: string): string | null {
  if (kind !== 'peek') return null
  return `Hmm… ${name?.trim() || 'alguém aqui'}?`
}

// --- Barramento --------------------------------------------------------------

export type CameoRequest = { id: number; kind: Cameo; name?: string }

type Listener = (request: CameoRequest) => void

const listeners = new Set<Listener>()
let sequence = 0
let showing = false

/** Manda uma visita para o palco (CameoOverlay.tsx). Devolve o pedido (ou null se ninguém está ouvindo). */
export function emitCameo(kind: unknown, options: { name?: string | null } = {}): CameoRequest | null {
  const cameo = resolveCameo(kind)
  lastCameo = cameo
  const name = CAMEO_INFO[cameo].named ? options.name?.trim() || undefined : undefined
  const request: CameoRequest = { id: (sequence += 1), kind: cameo, name }
  if (listeners.size === 0) return null
  for (const listener of [...listeners]) listener(request)
  return request
}

export function onCameo(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setCameoShowing(value: boolean) {
  showing = value
}

/** Tem visita na tela agora (a automática espera ela sair). */
export function isCameoShowing(): boolean {
  return showing
}

// --- Botões do host -------------------------------------------------------

export type HostCameoButton = {
  kind: Cameo
  label: string
  icon: string
  /** A visita usa o nome de alguém da mesa (sorteado na hora). */
  named?: boolean
  done: (name?: string) => string
}

/** O que o painel "EFEITOS DA TV" do host oferece: só visitas de Natal. */
export const HOST_CAMEO_BUTTONS: readonly HostCameoButton[] = CAMEOS.map((kind) => {
  const info = CAMEO_INFO[kind]
  return {
    kind,
    label: info.label,
    icon: info.icon,
    named: info.named,
    done: (name?: string) =>
      kind === 'peek'
        ? `🤨 Um duende vai espiar ${name ?? 'a mesa'} desconfiado...`
        : `${info.icon} ${info.label} a caminho! Olhe os cantos da TV.`,
  }
})
