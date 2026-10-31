/**
 * Agendador com antecedência ("lookahead") para trilhas em laço.
 *
 * O `setInterval` do navegador atrasa à toa (aba ocupada, GC, TV fraca), mas o
 * relógio do AudioContext é preciso. Então um timer barato acorda de tempos em
 * tempos e agenda no relógio de áudio tudo o que cai na próxima janela.
 *
 * Sem drift: o horário de cada passo é calculado a partir do início
 * (`início + n × duração`), nunca somando atrasos. Se a aba congelou e o
 * relógio passou da hora, os passos perdidos são pulados — tocar todos de uma
 * vez seria uma metralhadora de notas.
 */

export type StepEvent = {
  /** Passo absoluto desde o início da trilha (só cresce). */
  step: number
  /** Passo dentro da partitura: introdução + laço. */
  loopStep: number
  /** Volta do laço (-1 enquanto toca a introdução). */
  cycle: number
  /** Horário do passo no relógio do AudioContext (s). */
  time: number
}

export type LoopSchedulerOptions = {
  /** Horário (relógio de áudio, em s) do passo 0. */
  startTime: number
  /** Duração de um passo, em segundos. */
  stepDur: number
  /** Passos do laço que se repete (sem contar a introdução). */
  loopSteps: number
  /** Passos tocados uma única vez antes do laço. */
  introSteps?: number
  /** Quanto à frente agendar, em segundos. */
  lookahead?: number
  /** Atraso tolerado: passo mais atrasado do que isso é pulado sem tocar. */
  lateTolerance?: number
  onStep: (event: StepEvent) => void
}

export class LoopScheduler {
  private next = 0
  private stopped = false
  private stopAt = Infinity
  private readonly options: LoopSchedulerOptions
  private readonly intro: number
  private readonly lookahead: number
  private readonly tolerance: number

  constructor(options: LoopSchedulerOptions) {
    this.options = options
    if (!(options.stepDur > 0) || !(options.loopSteps > 0)) {
      throw new Error('LoopScheduler: stepDur e loopSteps precisam ser positivos')
    }
    this.intro = Math.max(0, Math.floor(options.introSteps ?? 0))
    this.lookahead = options.lookahead ?? 0.2
    this.tolerance = options.lateTolerance ?? 0.08
  }

  /** Horário exato do passo absoluto `step`. */
  timeOf(step: number): number {
    return this.options.startTime + step * this.options.stepDur
  }

  /** Passo absoluto → posição na partitura (introdução + laço) e volta do laço. */
  position(step: number): { loopStep: number; cycle: number } {
    if (step < this.intro) return { loopStep: step, cycle: -1 }
    const inLoop = step - this.intro
    return {
      loopStep: this.intro + (inLoop % this.options.loopSteps),
      cycle: Math.floor(inLoop / this.options.loopSteps),
    }
  }

  /** Para de agendar passos que comecem a partir de `time` (usado no fade-out). */
  stopFrom(time: number) {
    this.stopAt = Math.min(this.stopAt, time)
  }

  stop() {
    this.stopped = true
  }

  get isStopped() {
    return this.stopped
  }

  /**
   * Agenda os passos que caem antes de `now + lookahead`. Pode ser chamado
   * quantas vezes quiser com o mesmo `now`: nunca agenda um passo duas vezes.
   * Devolve quantos passos agendou.
   */
  tick(now: number): number {
    if (this.stopped) return 0
    const { stepDur, startTime, onStep } = this.options

    // Aba congelada: pula o que já passou em vez de tocar tudo atrasado.
    if (this.timeOf(this.next) < now - this.tolerance) {
      this.next = Math.max(this.next, Math.ceil((now - this.tolerance - startTime) / stepDur))
    }

    const horizon = now + this.lookahead
    let count = 0
    while (this.timeOf(this.next) < horizon) {
      const time = this.timeOf(this.next)
      if (time >= this.stopAt) {
        this.stopped = true
        break
      }
      const { loopStep, cycle } = this.position(this.next)
      onStep({ step: this.next, loopStep, cycle, time })
      this.next += 1
      count += 1
    }
    return count
  }
}
