import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAudio, setSoundRole } from './audio'
import { isTvLocation, roomCodeFromPath } from './fx/route'
import TvFxLayer from './fx/TvFxLayer'
import { loadCustomJumpscare } from './scare/customJumpscare'
import ScareOverlay from './scare/ScareOverlay'
import ScareWarning from './ui/ScareWarning'
import { AudioUnlockPrompt, PhoneSoundButton } from './ui/SoundControls'
import SpookyBackdrop from './ui/SpookyBackdrop'
import './ui/fonts'

/**
 * Camada global da Noite do Terror, montada uma vez no App (dentro do
 * BrowserRouter):
 *
 * - cenário: atrás do conteúdo (lua, neblina, morcegos) e por cima dele só o
 *   que não atrapalha (vinheta e teias nos cantos) — tudo sem receber clique;
 * - palco dos sustos (acima de tudo);
 * - na TV: efeitos da sala (susto do host, música, sustos aleatórios), o
 *   controle discreto do canto e o aviso "clique para acordar os mortos";
 * - no celular: o botãozinho flutuante de som (nasce mudo);
 * - em qualquer tela, na primeira visita: o aviso para cardíacos, epilépticos
 *   etc. Nenhum susto aparece antes de alguém responder.
 */
export default function HalloweenLayer() {
  const location = useLocation()
  const tv = isTvLocation(location.pathname, location.search)
  const code = roomCodeFromPath(location.pathname)

  useEffect(() => {
    setSoundRole(tv ? 'tv' : 'phone')
  }, [tv])

  useEffect(() => initAudio(), [])

  // O vídeo de public/jumpscare/ fica carregado em todo aparelho (TV e
  // celulares): os sustos dos momentos importantes saem em todo mundo.
  useEffect(() => {
    void loadCustomJumpscare()
  }, [])

  const intensity = tv ? 'tv' : 'phone'
  return (
    <>
      <SpookyBackdrop intensity={intensity} layer="back" zIndex={0} />
      <SpookyBackdrop intensity={intensity} layer="front" zIndex={40} />
      <ScareOverlay />
      {tv && code && <TvFxLayer key={code} code={code} />}
      {tv && <AudioUnlockPrompt />}
      {!tv && <PhoneSoundButton />}
      <ScareWarning />
    </>
  )
}
