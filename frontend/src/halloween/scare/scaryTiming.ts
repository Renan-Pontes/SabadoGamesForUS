/**
 * Tempos-chave dos sustos de verdade (animatrônico e rosto), num lugar só:
 * a cena (scary.tsx/scary.css) e o som (config.ts) leem daqui para o guincho
 * cair junto com a imagem.
 *
 * Segurança (fotossensibilidade): no máximo 2 clarões por susto, com pelo
 * menos 400 ms de escuro entre um e outro (o teste confere).
 */

/** Clarões da lâmpada falhando no animatrônico: início e duração, em ms. */
export const ANIMATRONIC_FLASHES: readonly { at: number; ms: number }[] = [
  { at: 140, ms: 120 },
  { at: 690, ms: 110 },
]

/** Quando o animatrônico dá o bote (sai do fundo e ocupa a tela). */
export const ANIMATRONIC_RUSH_MS = 1000

/**
 * Quando o bote enche a tela: o hws-anim-rush (scary.css) passa de 100vh
 * ~10 ms depois do início e chega ao close em ~50 ms.
 */
export const ANIMATRONIC_IMPACT_MS = ANIMATRONIC_RUSH_MS + 10

/**
 * Quando o guincho é agendado: um pouco antes do impacto, porque a saída de
 * áudio do navegador atrasa ~20–50 ms (medido: ouvido em ~+1043 ms, com a
 * criatura inteira na tela em ~+1040 ms). O teste exige ±30 ms do impacto.
 */
export const SCREECH_AT_MS = ANIMATRONIC_IMPACT_MS - 30

/** Quando o rosto explode na tela, depois do meio segundo de silêncio. */
export const FACE_HIT_MS = 500

/** Regras de clarão usadas no teste. */
export const MAX_FLASHES_PER_SCARE = 2
export const MIN_FLASH_GAP_MS = 400

// --- Apagão: a TV "desliga", silêncio no escuro... e o rosto. ---------------

/** A imagem colapsa numa linha e num ponto, como TV de tubo desligando. */
export const APAGAO_OFF_MS = 450
/** Uma respiração colada no ouvido, no escuro total. */
export const APAGAO_BREATH_MS = 900
/** Dois pontinhos vermelhos abrem no escuro (pequenos e fracos: não é clarão). */
export const APAGAO_EYES_MS = 2000
/** O bote: depois de quase 3 s de escuro, o rosto explode na tela. */
export const APAGAO_HIT_MS = 3300

// --- Rastejante: algo vem engatinhando pelo corredor da câmera. ------------

/**
 * Cada "pulo" de quadro em que ela aparece mais perto (a câmera engasga e
 * ela já está noutro lugar). Cada vez mais rápido. Os percentuais do
 * @keyframes hws-crawl-steps (scary.css) saem daqui: passo / LUNGE.
 * Nada pisca: a figura é escura sobre fundo escuro e só muda de tamanho,
 * no máximo ~3 vezes por segundo.
 */
export const RASTEJANTE_STEPS: readonly number[] = [750, 1410, 1950, 2400, 2700]
/** O bote final: ela salta da tela, junto com o guincho. */
export const RASTEJANTE_LUNGE_MS = 3000
