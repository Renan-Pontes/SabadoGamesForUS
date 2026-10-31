import type { Role } from './engine'

/**
 * Conteúdo do "Cidade Dorme": os papéis, as falas da narração, os epitáfios
 * de quem morre à noite e as sugestões de recado. Tudo original, em pt-BR,
 * com humor de Halloween — é para rir do morto, não para ofender ninguém.
 *
 * As listas são lidas por posição (noite 1 → primeira fala...): não
 * reordene no meio da festa.
 */

export type RoleInfo = {
  name: string
  plural: string
  icon: string
  /** Para a narração e o fim: "Era o detetive". */
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
    name: 'Assassino',
    plural: 'Assassinos',
    icon: '🔪',
    was: 'Era assassino',
    mission: 'Toda noite escolha quem morre. Não deixe a cidade te pegar.',
    night: 'para morrer esta noite',
    notePlaceholder: 'Bilhete anônimo para a cidade (a TV lê)',
    color: '#e0213a',
  },
  detective: {
    name: 'Detetive',
    plural: 'Detetives',
    icon: '🔎',
    was: 'Era o detetive',
    mission: 'Toda noite investigue alguém. De manhã você descobre se é assassino.',
    night: 'para investigar esta noite',
    notePlaceholder: 'Recado anônimo para o assassino',
    color: '#22d3ee',
  },
  angel: {
    name: 'Anjo',
    plural: 'Anjos',
    icon: '😇',
    was: 'Era o anjo',
    mission: 'Toda noite proteja alguém (pode ser você). Só não repita a pessoa da noite anterior.',
    night: 'para proteger esta noite',
    notePlaceholder: 'Recado anônimo para o assassino',
    color: '#fbbf24',
  },
  citizen: {
    name: 'Cidadão',
    plural: 'Cidadãos',
    icon: '🏘️',
    was: 'Era um cidadão',
    mission: 'Descubra os assassinos. À noite, aposte em quem é: acerto vale ponto de faro.',
    night: 'que você acha que é o assassino',
    notePlaceholder: 'Recado anônimo para o assassino',
    color: '#a3e635',
  },
}

/** Quem já morreu também mexe no celular: assombra alguém (só aparece na TV). */
export const GHOST_INFO = {
  icon: '👻',
  night: 'para assombrar (aparece na TV)',
}

/** Narração quando a noite cai — uma por noite, em ordem (depois repete). */
export const NIGHT_LINES: readonly string[] = [
  'A noite caiu sobre a cidade. Ninguém fecha o olho: todo mundo mexe no celular.',
  'Mais uma noite. Escolham alguém, e nada de espiar o celular do vizinho.',
  'A lua está cheia e os assassinos, com fome. Celular na mão.',
  'Silêncio na cidade. Só se ouve o barulho dos dedos na tela.',
  'Mais uma noite escura. Alguém nesta sala está mentindo.',
  'A neblina chegou. Cada um no seu celular, por favor.',
  'Os cachorros uivam lá fora. Escolham com cuidado.',
  'A cidade está cada vez mais vazia. Façam suas escolhas.',
]

/** A última noite antes de os assassinos fugirem (ver MAX_ROUNDS). */
export const LAST_NIGHT_LINE = 'Última noite. Se a cidade não pegar os assassinos amanhã, eles fogem.'

/** Abertura da manhã com morte: "<abertura> Fulano foi encontrado morto." */
export const DEATH_INTROS: readonly string[] = [
  'Amanheceu.',
  'O galo cantou.',
  'O sol nasceu, mas não para todos.',
  'Bom dia, cidade.',
  'Amanheceu com cheiro de vela.',
]

export const SAVED_LINES: readonly string[] = [
  'Amanheceu. Os assassinos atacaram, mas o anjo salvou alguém esta noite!',
  'Amanheceu. Teve ataque, mas o anjo chegou primeiro. Ninguém morreu!',
  'Amanheceu. Uma asa branca passou pela janela certa. O anjo salvou alguém!',
]

export const QUIET_LINES: readonly string[] = [
  'Amanheceu. Ninguém morreu esta noite. Tranquilo até demais.',
  'Amanheceu e todo mundo acordou. Os assassinos tiraram folga?',
  'Amanheceu. Nenhum corpo hoje. Por enquanto.',
]

export const DAY_LINES: readonly string[] = [
  'Conversem. Quem tem cara de assassino?',
  'Hora de acusar. Quem estava mexendo demais no celular?',
  'Conversem. Alguém aqui sabe mais do que está dizendo.',
  'A cidade quer justiça. Quem foi?',
]

export const VOTE_LINE = 'Hora da votação. Quem sai da cidade?'

/** Ninguém saiu na votação: o porquê, em uma frase (TV e narração). */
export const NOBODY_OUT: Record<'tie' | 'few' | 'none' | 'skip', string> = {
  tie: 'Empate! Ninguém sai da cidade hoje.',
  few: 'Ninguém juntou dois votos. A cidade continua igual.',
  none: 'Ninguém votou. Os assassinos agradecem.',
  skip: 'A cidade preferiu não expulsar ninguém. Por enquanto.',
}

export const END_LINES: Record<'caught' | 'outnumbered' | 'escaped', string> = {
  caught: 'A cidade venceu! Todos os assassinos foram pegos.',
  outnumbered: 'Os assassinos venceram. Agora a cidade dorme para sempre.',
  escaped: 'O sol nasceu pela última vez e os assassinos fugiram. Vitória deles.',
}

/** Epitáfio de quem morre à noite (sorteado pelo motor). */
export const EPITAPHS: readonly string[] = [
  'Foi dormir cedo. Cedo demais.',
  'Abriu a porta sem olhar o olho mágico.',
  'Confiou no vizinho errado.',
  'Saiu para comprar pão. Não voltou.',
  'Dormiu de janela aberta.',
  'Achou que era só um barulhinho.',
  'Disse “comigo não acontece”.',
  'Deixou o celular no silencioso.',
  'Mandou recado para a pessoa errada.',
  'Era bonzinho demais para esta cidade.',
  'Falou demais na roda de conversa.',
  'Desconfiou da pessoa certa. Tarde demais.',
  'Foi pegar água na cozinha.',
  'Morreu sem terminar o lanche.',
  'Sabia demais.',
  'Ninguém ouviu o grito.',
  'Esqueceu de trancar a porta.',
  'Achou que o anjo ia aparecer.',
  'Foi o primeiro a dizer “relaxa”.',
  'Saiu do grupo. Do grupo dos vivos.',
  'Tinha cara de quem sabia de algo.',
  'Deu boa noite para o assassino.',
  'Descansa em paz (agora de verdade).',
  'Votou certo, dormiu errado.',
]

/** Sugestões de recado anônimo para os assassinos (toque e pronto). */
export const CITY_NOTES: readonly string[] = [
  'Me poupa, por favor 🙏',
  'Eu sei quem você é 👀',
  'Hoje não, amanhã talvez 😅',
  'Sou só um cidadão inocente',
  'Pega quem tá rindo demais 😈',
  'Se me matar eu volto pra te assombrar 👻',
]

/** Sugestões de bilhete dos assassinos para a cidade (a TV lê de manhã). */
export const KILLER_NOTES: readonly string[] = [
  'Vocês nunca vão me pegar 😈',
  'Quem será o próximo?',
  'Durmam bem… se conseguirem',
  'Foi o mordomo 🫖',
  'Tô sentado do seu lado 👋',
  'Obrigado pelos recados 💌',
]
