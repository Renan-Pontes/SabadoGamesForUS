import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  /** Quando muda (nova fase, nova rodada), a tela tenta desenhar de novo. */
  resetKey: string
  fallback: (retry: () => void) => ReactNode
  children: ReactNode
}

type State = { error: unknown; key: string; attempt: number }

/**
 * Rede de segurança das telas dos jogos: um erro de desenho numa fase não
 * derruba a TV (nem apaga o celular de ninguém). O juiz continua rodando
 * por fora; a tela volta sozinha na próxima fase.
 */
export class ViewBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('erro desconhecido') }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[halloween] a tela do jogo quebrou; o jogo segue', error, info.componentStack)
  }

  retry = () => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))
  }

  render() {
    if (this.state.error) return this.props.fallback(this.retry)
    // `attempt` na key remonta os filhos de verdade.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
