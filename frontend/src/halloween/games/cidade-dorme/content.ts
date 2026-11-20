import type { Role } from './engine'

/**
 * Conteúdo do "Vila Dorme" (o Cidade Dorme de Natal): os papéis, as falas da
 * narração, as plaquinhas de quem vira boneco de neve à noite e as sugestões
 * de recado. Tudo original, em pt-BR, com humor natalino — ninguém morre: os
 * Duendes Travessos transformam os moradores em boneco de neve.
 *
 * As listas são lidas por posição (noite 1 → primeira fala...): não
 * reordene no meio da festa.
 */

export type RoleInfo = {
  name: string
  plural: string
  icon: string
  /** Para a narração e o fim: "Era a Rena Detetive". */
  was: string
  /** A missão, na cartinha do papel (uma frase curta). */
  mission: string
  /** Complemento do "Escolha alguém" da noite — só isto muda entre os papéis. */
  night: string
  /** O que o campo de recado faz para este papel. */
  notePlaceholder: string
  color: string
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  killer: {
    name: 'Duende Travesso',
    plural: 'Duendes Travessos',
    icon: '🧝',
    was: 'Era duende travesso',
    mission: 'Toda noite escolha quem vira boneco de neve. Não deixe a vila te pegar.',
    night: 'para virar boneco de neve',
    notePlaceholder: 'Cartãozinho anônimo para a vila (aparece na TV)',
    color: '#ff4d6d',
  },
  detective: {
    name: 'Rena Detetive',
    plural: 'Renas Detetives',
    icon: '🦌',
    was: 'Era a Rena Detetive',
    mission: 'Toda noite fareje alguém. De manhã você descobre se é duende travesso.',
    night: 'para farejar esta noite',
    notePlaceholder: 'Recado anônimo para os duendes',
    color: '#7fd8ff',
  },
  angel: {
    name: 'Anjo do Natal',
    plural: 'Anjos do Natal',
    icon: '😇',
    was: 'Era o Anjo do Natal',
    mission: 'Toda noite proteja alguém do frio (pode ser você). Só não repita quem protegeu ontem.',
    night: 'para cobrir com um cobertor quentinho',
    notePlaceholder: 'Recado anônimo para os duendes',
    color: '#f5c242',
  },
  citizen: {
    name: 'Morador da Vila',
    plural: 'Moradores da Vila',
    icon: '🏡',
    was: 'Era um morador da vila',
    mission: 'Descubra os duendes travessos. À noite, aposte em quem é: acerto vale ponto de faro.',
    night: 'que você acha que é duende travesso',
    notePlaceholder: 'Recado anônimo para os duendes',
    color: '#4fd67e',
  },
}

/** Quem já virou boneco de neve também mexe no celular: joga bola de neve em alguém (só aparece na TV). */
export const SNOWMAN_INFO = {
  icon: '⛄',
  night: 'para levar uma bola de neve (aparece na TV)',
}

/*
 * As falas da TV (voz do navegador): uma por fase, curtas — até umas 14
 * palavras, sem emoji nem onomatopeia. Os recados e as bolas de neve da
 * manhã ficam só na tela.
 */

/** Narração quando a noite cai — uma por noite, em ordem (depois repete). */
export const NIGHT_LINES: readonly string[] = [
  'A noite caiu na vila. Todo mundo no celular, em silêncio.',
  'Mais uma noite na vila. Escolham alguém no celular.',
  'As luzinhas se apagaram. Celular na mão, e nada de espiar o vizinho.',
  'Silêncio na vila. Façam suas escolhas no celular.',
  'Mais uma noite fria. Escolham com cuidado.',
  'A neve não para de cair. Cada um no seu celular.',
  'As renas estão inquietas. Celular na mão.',
  'A vila está cheia de bonecos de neve. Façam suas escolhas.',
]

/** A última noite antes de os duendes fugirem (ver MAX_ROUNDS). */
export const LAST_NIGHT_LINE = 'Última noite! Se a vila não pegar os duendes amanhã, eles fogem.'

export const SAVED_LINES: readonly string[] = [
  'Bom dia! O anjo chegou primeiro e ninguém virou boneco de neve.',
  'Bom dia! Teve travessura, mas o anjo salvou alguém.',
  'Bom dia! O anjo salvou alguém esta noite.',
]

export const QUIET_LINES: readonly string[] = [
  'Bom dia! Ninguém virou boneco de neve esta noite.',
  'Bom dia! Todo mundo acordou quentinho. Os duendes tiraram folga?',
  'Bom dia! Nenhum boneco de neve novo. Por enquanto.',
]

export const DAY_LINES: readonly string[] = [
  'Conversem. Quem tem cara de duende travesso?',
  'Hora de acusar. Quem estava mexendo demais no celular?',
  'Conversem. Alguém aqui sabe mais do que está dizendo.',
  'A vila quer o Natal de volta. Quem foi?',
]

export const VOTE_LINE = 'Hora de votar! Quem vai de trenó pro Polo Norte?'

/** Ninguém saiu na votação: o porquê, em uma frase (TV e narração). */
export const NOBODY_OUT: Record<'tie' | 'few' | 'none' | 'skip', string> = {
  tie: 'Empate! Ninguém vai pro Polo Norte hoje.',
  few: 'Ninguém juntou dois votos. A vila continua igual.',
  none: 'Ninguém votou. Os duendes agradecem.',
  skip: 'A vila preferiu não despachar ninguém. Por enquanto.',
}

export const END_LINES: Record<'caught' | 'outnumbered' | 'escaped', string> = {
  caught: 'A vila venceu! Todos os duendes travessos foram pegos. O Natal está salvo!',
  outnumbered: 'Os duendes travessos venceram. A vila virou um parque de bonecos de neve!',
  escaped: 'Chegou a manhã de Natal e os duendes fugiram com os presentes. Vitória deles.',
}

/** Plaquinha de quem vira boneco de neve à noite (sorteada pelo motor). */
export const EPITAPHS: readonly string[] = [
  'Saiu pra ver a neve de pijama.',
  'Abriu a porta pro “Papai Noel”.',
  'Foi buscar panetone e congelou.',
  'Lambeu o poste gelado.',
  'Dormiu de janela aberta em dezembro.',
  'Achou que era só o vento.',
  'Disse “comigo não acontece”.',
  'Confiou no duende errado.',
  'Defendeu uva-passa no arroz. Castigo.',
  'Comeu o biscoito do Papai Noel.',
  'Agora tem nariz de cenoura.',
  'Foi pegar água na cozinha.',
  'Sabia demais sobre o amigo secreto.',
  'Contou o amigo secreto antes da hora.',
  'Saiu pra fazer anjinho na neve.',
  'Cantou Jingle Bells desafinado.',
  'Deu boa noite pro duende.',
  'Ficou vigiando o peru da ceia.',
  'Pisou no pisca-pisca no escuro.',
  'Achou que o anjo ia aparecer.',
  'Foi o primeiro a dizer “relaxa”.',
  'Agora é decoração do jardim.',
  'Pediu meia de presente. Ganhou neve.',
  'Votou certo, dormiu no sereno.',
  'Tirou selfie com o duende.',
]

/** Sugestões de recado anônimo para os duendes (toque e pronto). */
export const CITY_NOTES: readonly string[] = [
  'Me poupa, por favor 🙏',
  'Eu sei quem você é 👀',
  'Hoje não, amanhã talvez 😅',
  'Sou só um morador inocente',
  'Pega quem tá rindo demais 🤭',
  'Se me congelar, eu volto de bola de neve ⛄',
]

/** Sugestões de cartãozinho dos duendes para a vila (aparece na TV de manhã). */
export const KILLER_NOTES: readonly string[] = [
  'Vocês nunca vão me pegar 😜',
  'Quem será o próximo boneco? ⛄',
  'Comi os biscoitos de vocês 🍪',
  'Foi o Papai Noel 🎅',
  'Tô sentado do seu lado 👋',
  'Obrigado pelos recados 💌',
]
