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

  cachedVoice = bestVoice(voices)
  return cachedVoice
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
export function speak(text: string, options: SpeakOptions = {}): () => void {
  if (!canNarrate() || !text.trim()) {
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
