import { useParams } from 'react-router-dom'

/**
 * PLACEHOLDER — tela que roda qualquer jogo da Noite do Terror (TV como
 * árbitro, celulares como controle). Implementada na Etapa 1 do plano
 * (HALLOWEEN.md); a rota `/game/:code/:slug` já aponta para cá.
 */
export default function HalloweenGameScreen() {
  const { slug } = useParams()
  return <div style={{ padding: 32, color: '#fff' }}>Em construção: {slug}</div>
}
