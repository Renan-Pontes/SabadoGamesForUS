/**
 * Narração por voz com a Web Speech API do navegador.
 *
 * Sem biblioteca, sem chave de API, sem custo: Chrome, Edge e Safari trazem
 * vozes em português do Brasil. É o suficiente para a TV ler as regras para a
 * sala — e funciona offline.
 */

let cachedVoice: SpeechSynthesisVoice | null = null

export function canNarrate(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang'> & { localService?: boolean }

/**
 * Nota de uma voz — maior é melhor; `-1` = não serve (não é português).
 *
 * As vozes neurais ("Natural"/"Online", do Edge e do Windows 11) soam como
 * gente; a "Google português do Brasil" do Chrome vem logo atrás; as antigas
 * do Windows (Maria, Daniel) e as do sistema são o último recurso. Português
 * do Brasil sempre ganha de Portugal.
 */
export function scoreVoice(voice: VoiceLike): number {
  const lang = voice.lang.replace('_', '-').toLowerCase()
  if (!lang.startsWith('pt')) return -1
  let score = lang === 'pt-br' ? 100 : 10
  const name = voice.name.toLowerCase()
  if (/natural|neural/.test(name)) score += 50
  else if (/online/.test(name)) score += 40
  else if (/google/.test(name)) score += 30
  else if (/microsoft/.test(name)) score += 10
  // Entre as neurais do Edge, a Francisca e a Thalita são as mais claras para a TV.
  if (/francisca|thalita/.test(name)) score += 5
  return score
}

/** A melhor voz em português da lista (ou `null` se não houver nenhuma). */
export function bestVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null
  let bestScore = -1
  for (const voice of voices) {
    const score = scoreVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

/**
 * A lista de vozes carrega de forma assíncrona no Chrome: na primeira chamada
 * pode vir vazia. Por isso a escolha é refeita a cada `speak`, e o resultado
 * bom fica em cache.
 */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (!canNarrate()) return null
  if (cachedVoice) return cachedVoice

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // A voz escolhida na TV (controle do canto) vale mais que a nota automática.
  const preferred = readPreferredVoice()
  cachedVoice = (preferred && voices.find((voice) => voice.name === preferred)) || bestVoice(voices)
  return cachedVoice
}

/** Qualidade da voz, para mostrar na lista e decidir se a narração já nasce ligada. */
export type VoiceQuality = 'otima' | 'boa' | 'robotica'

export function voiceQuality(voice: VoiceLike): VoiceQuality {
  const name = voice.name.toLowerCase()
  if (/natural|neural|online/.test(name)) return 'otima'
  if (/google/.test(name)) return 'boa'
  return 'robotica'
}

export type VoiceChoice = { name: string; lang: string; quality: VoiceQuality }

/** As vozes em português deste aparelho, da melhor para a pior. */
export function portugueseVoices(): VoiceChoice[] {
  if (!canNarrate()) return []
  return listPortuguese(window.speechSynthesis.getVoices())
}

export function listPortuguese(voices: readonly VoiceLike[]): VoiceChoice[] {
  return voices
    .filter((voice) => scoreVoice(voice) >= 0)
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
    .map((voice) => ({ name: voice.name, lang: voice.lang, quality: voiceQuality(voice) }))
}

const VOICE_KEY = 'sabado_voice'

function readPreferredVoice(): string | null {
  try {
    return window.localStorage.getItem(VOICE_KEY)
  } catch {
    return null
  }
}

/** Guarda a voz escolhida neste aparelho (null volta para a automática). */
export function setPreferredVoice(name: string | null) {
  try {
    if (name) window.localStorage.setItem(VOICE_KEY, name)
    else window.localStorage.removeItem(VOICE_KEY)
  } catch {
    // Sem onde guardar: vale até recarregar.
  }
  cachedVoice = null
}

/** Alguém escolheu uma voz na mão neste aparelho? */
export function hasChosenVoice(): boolean {
  return readPreferredVoice() !== null
}

/**
 * Vale a pena falar? Só se houver voz que não soe robótica — ou se alguém
 * escolheu uma voz na mão (aí é escolha dele). Com a lista ainda vazia (o
 * Chrome carrega depois), tenta: o `speak` espera as vozes chegarem.
 */
export function narrationWorthIt(): boolean {
  if (!canNarrate()) return false
  if (hasChosenVoice()) return true
  if (window.speechSynthesis.getVoices().length === 0) return true
  return hasGoodVoice()
}

/** A voz que vai falar agora (a escolhida ou a melhor automática). */
export function currentVoiceName(): string | null {
  return pickVoice()?.name ?? null
}

/** Este aparelho tem alguma voz em português que não soa robótica? */
export function hasGoodVoice(): boolean {
  return portugueseVoices().some((voice) => voice.quality !== 'robotica')
}

/**
 * As vozes chegam depois no Chrome: avisa quando a lista mudar (para a tela
 * de escolha se redesenhar). Devolve a função que para de ouvir.
 */
export function onVoicesChanged(listener: () => void): () => void {
  if (!canNarrate()) return () => undefined
  const synth = window.speechSynthesis
  const handler = () => {
    cachedVoice = null
    listener()
  }
  synth.addEventListener('voiceschanged', handler)
  return () => synth.removeEventListener('voiceschanged', handler)
}

/** Onomatopeias que a voz soletra (são efeitos sonoros, não fala). */
const NOISES: RegExp[] = [
  /(?<![\p{L}])b+r{2,}\p{L}*/giu, // Brrrr
  /(?<![\p{L}])(?:r[ôo]|ho)(?:[\s,!.-]+(?:r[ôo]|ho)){1,}(?![\p{L}])/giu, // Rô, rô, rô / Ho ho ho
  /(?<![\p{L}])h?i(?:[\s,!.-]+h?i){2,}(?![\p{L}])/giu, // hi-hi-hi
  /(?<![\p{L}])(?:k{3,}|(?:ha){2,}h?|(?:he){2,}h?|(?:rs){2,})(?![\p{L}])/giu, // kkk, hahaha, rsrs
  /(?<![\p{L}])u+h+u{2,}\p{L}*/giu, // Uhuuu
  /(?<![\p{L}])(?:a{3,}|o{3,}|e{3,})h*(?![\p{L}])/giu, // Aaaa, Oooo
]

/**
 * Deixa o texto bom de ser falado pela voz do navegador:
 *
 * - tira emoji e símbolo (o Chrome lê "🎁" como "pacote embrulhado" no meio
 *   da frase);
 * - tira onomatopeia ("Brrrr", "Rô rô rô", "Ho ho ho", "hi-hi-hi", "kkk",
 *   "Uhuuu"): a voz soletra e fica robótica — esses sons são efeito sonoro;
 * - junta espaços e pontuação que sobraram.
 *
 * Devolve '' quando não sobra nada para dizer.
 */
export function cleanForSpeech(text: string): string {
  let out = text
    // Seletor de variação, junção de emoji e tecla (⃣) saem antes, um por um.
    .replace(/\u{FE0F}|\u{200D}|\u{20E3}/gu, '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/[★☆✦✧✨❄✔✓✗✘•→←↑↓·]/gu, ' ')
  for (const pattern of NOISES) out = out.replace(pattern, ' ')
  out = out
    .replace(/\s+([,.!?…])/g, '$1')
    .replace(/[,.!?…]{2,}/g, (match) => (match.includes('?') ? '?' : match.includes('!') ? '!' : match[0]))
    .replace(/^[\s,.!?…:;-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return /[\p{L}\p{N}]/u.test(out) ? out : ''
}

export type SpeakOptions = {
  rate?: number
  pitch?: number
  /** A voz começou de fato (as vozes podem demorar a carregar). */
  onStart?: () => void
  /** Terminou de falar até o fim. */
  onEnd?: () => void
  /** Parou por qualquer motivo: fim, cancelamento ou erro. */
  onStop?: () => void
  onError?: () => void
}

/**
 * Fala o texto e devolve uma função que cancela.
 *
 * Cancela qualquer fala anterior antes de começar: numa troca rápida de passo
 * do tutorial, duas vozes sobrepostas seriam pior do que nenhuma.
 */
export function speak(rawText: string, options: SpeakOptions = {}): () => void {
  const text = cleanForSpeech(rawText)
  if (!canNarrate() || !text) {
    options.onEnd?.()
    return () => undefined
  }

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'pt-BR'
  }
  utterance.rate = options.rate ?? 0.98
  utterance.pitch = options.pitch ?? 1
  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => {
    options.onEnd?.()
    options.onStop?.()
  }
  utterance.onerror = (event) => {
    options.onStop?.()
    // "interrupted" e "canceled" são o cancelamento normal, não falha.
    if (event.error === 'interrupted' || event.error === 'canceled') return
    options.onError?.()
  }

  // Chrome: se as vozes ainda não carregaram, espera o evento e tenta de novo.
  if (!voice && synth.getVoices().length === 0) {
    const retry = () => {
      synth.removeEventListener('voiceschanged', retry)
      cachedVoice = null
      speak(text, options)
    }
    synth.addEventListener('voiceschanged', retry)
    // Se o evento nunca vier, fala com a voz padrão mesmo.
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', retry)
      if (!synth.speaking) synth.speak(utterance)
    }, 600)
    return () => {
      synth.removeEventListener('voiceschanged', retry)
      synth.cancel()
    }
  }

  synth.speak(utterance)
  return () => synth.cancel()
}

export function stopNarration() {
  if (canNarrate()) window.speechSynthesis.cancel()
}

/** Chave do localStorage que marca "já vi o tutorial deste jogo". */
export function tutorialSeenKey(slug: string) {
  return `sabado_tutorial_seen_${slug}`
}

export function hasSeenTutorial(slug: string) {
  try {
    return window.localStorage.getItem(tutorialSeenKey(slug)) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(slug: string) {
  try {
    window.localStorage.setItem(tutorialSeenKey(slug), '1')
  } catch {
    // Sem localStorage (modo privado, etc.) o aviso só volta a aparecer.
  }
}
