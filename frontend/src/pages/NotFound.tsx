import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="page narrow">
      <p className="eyebrow">Ops</p>
      <h2>Página não encontrada</h2>
      <p className="lead">Talvez o link esteja errado. Volte para a tela inicial.</p>
      <Link className="btn btn-primary" to="/">
        Ir para o início
      </Link>
    </section>
  )
}
