import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAudio, setSoundRole } from './audio'
import { isTvLocation, roomCodeFromPath } from './fx/route'
import TvFxLayer from './fx/TvFxLayer'
import ScareOverlay from './scare/ScareOverlay'
import { AudioUnlockPrompt, PhoneSoundButton } from './ui/SoundControls'
import SnowBackdrop from '../natal/SnowBackdrop'
import './ui/fonts'

/**
 * Camada global do app (som, efeitos da TV e cenário), montada uma vez no App
 * (dentro do BrowserRouter). Nasceu na Noite do Terror; no Natal o cenário é
 * a neve:
 *
 * - cenário: atrás do conteúdo (aurora, estrelas, neve, morros, trenó) e por
 *   cima dele só o que não atrapalha (pisca-pisca e vinheta) — sem clique;
 * - palco dos sustos (acima de tudo);
 * - na TV: efeitos da sala (susto do host, música, sustos aleatórios), o
 *   controle discreto do canto e o aviso "clique para acordar os mortos";
 * - no celular: o botãozinho flutuante de som (nasce mudo).
 */
export default function HalloweenLayer() {
  const location = useLocation()
  const tv = isTvLocation(location.pathname, location.search)
  const code = roomCodeFromPath(location.pathname)

  useEffect(() => {
    setSoundRole(tv ? 'tv' : 'phone')
  }, [tv])

  useEffect(() => initAudio(), [])

  const intensity = tv ? 'tv' : 'phone'
  return (
    <>
      <SnowBackdrop intensity={intensity} layer="back" zIndex={0} />
      <SnowBackdrop intensity={intensity} layer="front" zIndex={40} />
      <ScareOverlay />
      {tv && code && <TvFxLayer key={code} code={code} />}
      {tv && <AudioUnlockPrompt />}
      {!tv && <PhoneSoundButton />}
    </>
  )
}
