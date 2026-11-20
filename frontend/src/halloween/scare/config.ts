import { hushMusic, playSfx, speakFestive, speakSpooky } from '../audio'
import { RARE_SCARE } from './bus'
import { ANIMATRONIC_FLASHES, FACE_HIT_MS, SCREECH_AT_MS } from './scaryTiming'
import type { ConcreteScare } from './bus'
import { customJumpscare, playCustomJumpscareSound } from './customJumpscare'

/**
 * Tempo de tela e trilha sonora de cada susto. Curtos (1,8–2,5 s): é meme,
 * não filme — a festa tem que voltar logo para o jogo.
 */
export const SCARE_DURATION_MS: Record<ConcreteScare, number> = {
  doot: 2300,
  zoom: 2000,
  scream: 1800,
  pumpkin: 2300,
  pipe: 2000,
  skeletons: 2500,
  spider: 2300,
  static: 2400,
  bruh: 1900,
  eyes: 2500,
  // Escuro, 2 clarões, o bote em 1 s e ~1 s de mandíbula batendo na cara.
  animatronic: 2400,
  // Meio segundo de silêncio e tela preta, e o rosto grita por ~1,4 s.
  face: 2200,
  // Encara e grita por ~1,15 s, corta para a estática e some.
  penetra: 1700,
  // Natal: um pouco mais longos (a graça tem fala e "virada" no fim), ainda < 4,5 s.
  hohoho: 3600,
  blizzard: 3200,
  giftRain: 3200,
  reindeer: 3000,
  lightsParty: 3400,
  secretSanta: 4400,
  elfChoir: 4300,
}

// --- Natal: os tempos que a tela e o som combinam ---------------------------

/** Ho ho ho: a placa da "lista dos malcriados" (ou o "Feliz Natal") entra aqui. */
export const HOHOHO_SIGN_MS = 1400
/** Chuva de presentes: o presentão do meio abre e a meia pula na mola. */
export const GIFT_OPEN_MS = 1900
/** Rena: depois que ela passa, cai um presente do trenó (e quica). */
export const REINDEER_DROP_MS = 1800
/** Pisca-pisca: um ciclo aceso/apagado de cada lâmpada (2 por segundo, < 3 Hz). */
export const LIGHTS_BLINK_MS = 500
/** Pisca-pisca: o fusível queima e tudo apaga (uma única vez). */
export const LIGHTS_BLACKOUT_MS = 2400
/** Amigo secreto: o rufar (1,7 s) termina e o nome aparece. */
export const SECRET_SANTA_REVEAL_MS = 1750
/** Amigo secreto: o presente (anticlímax) aparece. */
export const SECRET_SANTA_GIFT_MS = 2800
/** Coral: o duende pequeno grita "Feliz Natal!" depois da música. */
export const ELF_SHOUT_MS = 3550

/** Presentes de amigo secreto (a graça é o anticlímax). */
export const JOKE_GIFTS = [
  'um pano de prato',
  'um panetone de frutas cristalizadas',
  'um vale-abraço 🤗',
  'uma agenda de 2019 📒',
  'um sabonete em forma de rosa 🌹',
  'um pijama de rena',
  'um pote de sorvete... com feijão',
  'carvão 🪨 (se comportou mal)',
] as const

/** O presente de quem foi tirado: sempre o mesmo para o mesmo nome (vira piada interna). */
export function secretSantaGift(name?: string): string {
  const key = (name ?? '').trim().toLowerCase()
  let hash = 0
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return JOKE_GIFTS[hash % JOKE_GIFTS.length]
}

/**
 * A fala do Papai Noel depois da risada. O "Ho ho ho" em si é o efeito
 * sintetizado 'hohoho' — a voz do navegador lendo "Rô rô rô" soava robótica.
 */
export function santaLine(name?: string): string {
  return name ? `${name}... tá na lista dos malcriados!` : 'Feliz Natal, pessoal!'
}

/** Quando o Penetra some e a tela corta para a estática (casa com o fim do grito). */
export const PENETRA_CUT_MS = 1150

/** Tempo de tela de um susto; o raro com vídeo próprio dura o vídeo. */
export function scareDurationMs(kind: ConcreteScare): number {
  if (kind === RARE_SCARE) return customJumpscare()?.videoMs ?? SCARE_DURATION_MS[kind]
  return SCARE_DURATION_MS[kind]
}

/** Texto de legenda de cada susto (também usado na versão calma, sem movimento). */
export function scareCaption(kind: ConcreteScare, name?: string): { icon: string; text: string } {
  switch (kind) {
    case 'doot':
      return { icon: '💀🎺', text: 'doot doot — obrigado sr. esqueleto' }
    case 'zoom':
      return { icon: '🤨📸', text: name ?? 'ALGUÉM AQUI' }
    case 'scream':
      return { icon: '😱', text: 'AAAAAAAH!' }
    case 'pumpkin':
      return { icon: '🎃', text: 'MUÁ-RÁ-RÁ!' }
    case 'pipe':
      return { icon: '🔩', text: '*barulho de cano caindo*' }
    case 'skeletons':
      return { icon: '💀💀', text: 'É MÊS ASSUSTADOR' }
    case 'spider':
      return { icon: '🕷️', text: 'tem uma aranha atrás de você' }
    case 'static':
      return { icon: '📺', text: 'SINAL PERDIDO... ELE ESTÁ AQUI' }
    case 'bruh':
      return { icon: '💀💀💀', text: 'bruh' }
    case 'eyes':
      return { icon: '👀', text: name ? `...${name}...` : '...eu tô te vendo...' }
    case 'animatronic':
      return { icon: '🤖', text: 'ELE AINDA FUNCIONA' }
    case 'face':
      return { icon: '👁️', text: 'NÃO OLHA' }
    case 'penetra':
      return { icon: '👹', text: 'O PENETRA TE ACHOU' }
    case 'hohoho':
      return {
        icon: '🎅',
        text: name ? `HO HO HO! ${name} está na lista dos malcriados` : 'HO HO HO! Feliz Natal!',
      }
    case 'blizzard':
      return { icon: '🥶❄️', text: 'BRRRR! NEVASCA NA SALA!' }
    case 'giftRain':
      return { icon: '🎁🎁🎁', text: 'CHUVA DE PRESENTES! (o grandão era meia 🧦)' }
    case 'reindeer':
      return { icon: '🦌🛷', text: 'SAI DA FRENTE QUE A RENA TÁ SEM FREIO!' }
    case 'lightsParty':
      return { icon: '🎄💡', text: 'O PISCA-PISCA ENLOUQUECEU... e queimou 💥' }
    case 'secretSanta':
      return {
        icon: '🥁🎁',
        text: name ? `O amigo secreto é ${name}! Ganhou ${secretSantaGift(name)}` : 'O amigo secreto é... VOCÊ!',
      }
    case 'elfChoir':
      return { icon: '🧝🎶', text: 'Jingle bells, jingle bells... FELIZ NATAL!' }
  }
}

/**
 * Toca o som do susto, casado com a animação (os atrasos são agendados no
 * relógio de áudio). Devolve a função que cancela a voz que ainda não
 * começou — a que já começou termina sozinha (cancelar a fala cortaria
 * também a narração de um jogo que começasse por cima).
 */
export function playScareSound(kind: ConcreteScare, name?: string): () => void {
  const timers: number[] = []
  const sayLater = (text: string, delayMs: number, pitch: number, rate: number) => {
    timers.push(window.setTimeout(() => speakSpooky(text, { pitch, rate }), delayMs))
  }
  // Natal: a voz do apresentador (natural), só brincando com tom e velocidade.
  const sayFestiveLater = (text: string, delayMs: number, pitch: number, rate: number) => {
    timers.push(window.setTimeout(() => speakFestive(text, { pitch, rate }), delayMs))
  }

  switch (kind) {
    case 'doot':
      playSfx('bones', { volume: 0.5 })
      playSfx('doot', { delay: 0.45 })
      break
    case 'zoom':
      // O "vine boom" do meme junto com o boing de desenho no estalo do zoom.
      playSfx('boom', { delay: 0.3, volume: 0.8 })
      playSfx('boing', { delay: 0.32 })
      break
    case 'scream':
      // Só na CENA de susto o grito vai pelo caminho alto; o playSfx('scream') dos jogos fica no nível normal.
      playSfx('scream', { loud: true })
      break
    case 'pumpkin':
      playSfx('laugh', { delay: 0.2 })
      break
    case 'pipe':
      playSfx('clang', { delay: 0.38 })
      break
    case 'skeletons':
      playSfx('bones')
      playSfx('doot', { delay: 1.1, volume: 0.7 })
      break
    case 'spider':
      playSfx('hiss', { delay: 0.6 })
      break
    case 'static':
      playSfx('static', { loud: true })
      playSfx('scream', { delay: 1.2, volume: 0.7, loud: true })
      break
    case 'bruh':
      playSfx('pop')
      playSfx('pop', { delay: 0.15 })
      playSfx('pop', { delay: 0.3 })
      playSfx('boom', { delay: 0.45, volume: 0.6 })
      sayLater('bruh', 500, 0.3, 0.7)
      break
    case 'eyes':
      playSfx('heartbeat', { volume: 0.8 })
      playSfx('whisper', { delay: 0.3 })
      sayLater(name ? `${name}...` : 'eu tô te vendo...', 700, 0.2, 0.6)
      break
    case 'animatronic':
      // A música some na hora; a lâmpada estala nos dois clarões; o guincho vem no bote.
      hushMusic(SCARE_DURATION_MS.animatronic / 1000)
      for (const { at } of ANIMATRONIC_FLASHES) playSfx('flicker', { delay: at / 1000 })
      playSfx('screech', { delay: SCREECH_AT_MS / 1000 })
      break
    case 'face':
      // Meio segundo de silêncio total... e o grito junto com o rosto.
      hushMusic(SCARE_DURATION_MS.face / 1000)
      playSfx('shriek', { delay: FACE_HIT_MS / 1000 })
      break
    case 'penetra':
      if (playCustomJumpscareSound()) break
      playSfx('jumpscare')
      playSfx('boom', { volume: 0.8 })
      break

    // --- Natal ---
    case 'hohoho':
      playSfx('sleigh')
      playSfx('boing', { delay: 0.35, volume: 0.7 })
      playSfx('hohoho', { delay: 0.45 })
      sayFestiveLater(santaLine(name), 1800, 0.85, 0.95)
      playSfx(name ? 'buzzer' : 'chime', { delay: HOHOHO_SIGN_MS / 1000, volume: name ? 0.5 : 1 })
      break
    case 'blizzard':
      playSfx('whoosh')
      playSfx('whoosh', { delay: 0.6, volume: 0.8 })
      playSfx('whoosh', { delay: 1.3, volume: 0.9 })
      playSfx('chime', { delay: 0.25, volume: 0.6 })
      sayFestiveLater('Que friaca!', 1000, 1, 1)
      break
    case 'giftRain':
      ;[0.25, 0.5, 0.72, 0.95, 1.2, 1.45].forEach((at, index) =>
        playSfx(index % 2 ? 'boing' : 'pop', { delay: at, volume: index % 2 ? 0.55 : 0.9 }),
      )
      playSfx('pop', { delay: GIFT_OPEN_MS / 1000 })
      playSfx('boing', { delay: GIFT_OPEN_MS / 1000 + 0.05 })
      playSfx('fail', { delay: GIFT_OPEN_MS / 1000 + 0.6, volume: 0.7 })
      break
    case 'reindeer':
      playSfx('gallop')
      playSfx('sleigh', { delay: 0.15 })
      playSfx('whoosh', { delay: 0.5 })
      playSfx('boing', { delay: REINDEER_DROP_MS / 1000 + 0.35 })
      break
    case 'lightsParty':
      playSfx('chime')
      for (let at = 0.5; at < LIGHTS_BLACKOUT_MS / 1000 - 0.1; at += LIGHTS_BLINK_MS / 1000) {
        playSfx('ding', { delay: at, volume: 0.45 })
      }
      playSfx('pop', { delay: LIGHTS_BLACKOUT_MS / 1000, volume: 1.2 })
      playSfx('fail', { delay: LIGHTS_BLACKOUT_MS / 1000 + 0.3, volume: 0.7 })
      break
    case 'secretSanta':
      hushMusic(SCARE_DURATION_MS.secretSanta / 1000)
      playSfx('drumroll')
      playSfx('chime', { delay: SECRET_SANTA_REVEAL_MS / 1000 })
      if (name) sayFestiveLater(name, SECRET_SANTA_REVEAL_MS + 100, 1.1, 1)
      playSfx('fail', { delay: SECRET_SANTA_GIFT_MS / 1000, volume: 0.8 })
      break
    case 'elfChoir':
      hushMusic(SCARE_DURATION_MS.elfChoir / 1000)
      playSfx('elfsong')
      playSfx('sleigh', { delay: 0.05, volume: 0.5 })
      sayFestiveLater('Feliz Natal!', ELF_SHOUT_MS, 1.8, 1.3)
      playSfx('boing', { delay: ELF_SHOUT_MS / 1000 - 0.1, volume: 0.6 })
      break
  }

  return () => {
    for (const timer of timers) window.clearTimeout(timer)
  }
}
