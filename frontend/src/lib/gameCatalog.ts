import { getAccent } from '../games/theme'

/**
 * Tudo que a interface precisa saber sobre um minigame além do que vem da API.
 *
 * O backend guarda nome, descrição e limites de jogadores; aqui ficam o ícone,
 * as regras e o roteiro de "como jogar". Antes isso estava só na HostRoom, com
 * um jogo fantasma (`sabado-quiz`) e sem o Blef Jack.
 */
export type GameMeta = {
  icon: string
  /** Frase curta de vitrine — o que a pessoa ganha jogando isso. */
  pitch: string
  /** Passos de "como jogar", na ordem em que acontecem na mesa. */
  howTo: string[]
  /** Duração típica de uma partida. */
  duration: string
  /** Grau de traição envolvido — ajuda o host a escolher o clima da noite. */
  vibe: 'Cooperativo' | 'Dedução' | 'Blefe' | 'Negociação' | 'Corrida'
}

/** Temas das cartas do Perfil — o host escolhe quais entram no baralho. */
export const PERFIL_THEMES = ['Pessoa', 'Lugar', 'Coisa', 'Ano', 'Ficção'] as const

const CATALOG: Record<string, GameMeta> = {
  'read-my-mind': {
    icon: '🧠',
    pitch: 'Joguem as cartas em ordem crescente sem trocar uma palavra.',
    duration: '10-15 min',
    vibe: 'Cooperativo',
    howTo: [
      'Cada jogador recebe cartas de 1 a 100. Ninguém mostra a mão.',
      'Sem falar nem dar sinais, joguem as cartas em ordem crescente.',
      'No co-op vocês têm 3 vidas e precisam chegar à rodada 10 juntos.',
      'No versus, quem cortar a sequência está eliminado.',
    ],
  },
  'confinamento-solitario': {
    icon: '♥️',
    pitch: 'Você vê o naipe de todo mundo, menos o seu. Deduza ou caia.',
    duration: '15-25 min',
    vibe: 'Dedução',
    howTo: [
      'Cada pessoa recebe um naipe que só os outros enxergam.',
      'Conversem: o que os outros falam é a única pista sobre a sua carta.',
      'Ao fim da rodada, todos apontam qual naipe acham que têm.',
      'Quem errar é eliminado. A partida acaba quando o Valete de Copas cai.',
    ],
  },
  'concurso-de-beleza': {
    icon: '👑',
    pitch: 'Escolha um número pensando no número que os outros vão escolher.',
    duration: '20-30 min',
    vibe: 'Dedução',
    howTo: [
      'Todos escolhem um número de 0 a 100 em segredo.',
      'O alvo é 80% da média de todos os números.',
      'Quem chegar mais perto do alvo vence; os outros perdem 1 ponto.',
      'A cada eliminação uma regra nova entra em vigor. Chegou a −10, você sai.',
    ],
  },
  'leilao-de-cem-votos': {
    icon: '🔨',
    pitch: 'Leilão aberto onde perder ainda custa tudo que você apostou.',
    duration: '15-20 min',
    vibe: 'Negociação',
    howTo: [
      'Cada rodada tem um pote. O maior lance leva o pote inteiro.',
      'Os lances são públicos e só sobem — e os pontos saem na hora.',
      'Quem perde não recebe nada de volta: o gasto engorda o pote seguinte.',
      'Depois de 10 rodadas, os dois maiores vão para a morte súbita.',
    ],
  },
  'blef-jack': {
    icon: '🃏',
    pitch: 'Anuncie o valor da sua mão. Mentir é metade do jogo.',
    duration: '15-25 min',
    vibe: 'Blefe',
    howTo: [
      'Cada pessoa recebe 2 cartas e só enxerga as próprias.',
      'Todos anunciam um valor — verdadeiro ou não. As falas são públicas.',
      'Depois, cada um aposta em quem realmente tem a mão mais forte.',
      'Acertar vale +3. Ter a melhor mão e errar a aposta custa −4.',
    ],
  },
  'a-cacada': {
    icon: '🐾',
    pitch: 'Cada um sabe uma coisa sobre onde a criatura está. Ninguém sabe o bastante sozinho.',
    duration: '30-45 min',
    vibe: 'Dedução',
    howTo: [
      'Um mapa de hexágonos com 5 terrenos, territórios de urso e puma, e estruturas.',
      'Cada jogador recebe uma pista secreta e verdadeira — "a até 2 espaços de uma pedra".',
      'A criatura está no único hexágono que satisfaz TODAS as pistas ao mesmo tempo.',
      'No seu turno: pergunte a alguém sobre um hexágono, ou faça uma busca e ouça todos.',
      'Levou um "não"? Você é obrigado a revelar um hexágono que a sua pista elimina.',
      'Acertou a busca com todo mundo dizendo sim: achou a criatura e venceu.',
    ],
  },
  sintonia: {
    icon: '◐',
    pitch: 'Um espectro, um alvo escondido e uma pista só. A mesa discute em voz alta.',
    duration: '20-30 min',
    vibe: 'Dedução',
    howTo: [
      'Cada rodada tem um espectro entre dois extremos, tipo "Frio ↔ Quente".',
      'O vidente da vez vê um alvo escondido nesse espectro. Só ele vê.',
      'Ele dá UMA pista que descreva aquele ponto exato — nem mais, nem menos.',
      'Todo mundo discute em voz alta e depois cada um aponta onde acha que é.',
      'Quanto mais perto do alvo, mais pontos. O vidente leva a média da mesa.',
    ],
  },
  caveira: {
    icon: '☠',
    pitch: 'Três rosas e uma caveira. Aposte quantas cartas vira sem se estragar.',
    duration: '15-25 min',
    vibe: 'Blefe',
    howTo: [
      'Cada um tem 3 rosas e 1 caveira, e empilha cartas viradas para baixo.',
      'A qualquer momento alguém abre o leilão: "eu viro 3 cartas sem achar caveira".',
      'Os outros cobrem ou passam. Quem der o maior lance tem que cumprir.',
      'Você é obrigado a virar a SUA pilha primeiro — a única que você conhece.',
      'Achou caveira, perde uma carta. Cumpriu duas apostas, venceu.',
    ],
  },
  resistencia: {
    icon: '✶',
    pitch: 'Espiões infiltrados sabotam missões em segredo. Ninguém confia em ninguém.',
    duration: '30-45 min',
    vibe: 'Blefe',
    howTo: [
      'Alguns de vocês são espiões e se conhecem. O resto não sabe de nada.',
      'A cada missão, o líder propõe uma equipe e a mesa vota em aberto.',
      'Aprovada a equipe, só quem foi enviado joga uma carta secreta.',
      'Uma sabotagem derruba a missão — mas nunca se revela quem sabotou.',
      'Três missões cumpridas e a Resistência vence. Três falhas e os espiões levam.',
      'Cinco propostas recusadas seguidas também entregam o jogo aos espiões.',
    ],
  },
  'palavra-chave': {
    icon: '▦',
    pitch: 'Uma palavra e um número. Seu time tem que adivinhar o resto.',
    duration: '20-30 min',
    vibe: 'Dedução',
    howTo: [
      'Vinte e cinco palavras na mesa e dois times.',
      'Cada time tem um espião-mestre que vê quais palavras são suas.',
      'O mestre fala UMA palavra e um número: "OCEANO, 3".',
      'O time tenta adivinhar quais palavras ele quis dizer.',
      'Errar passa a vez. Encostar no assassino perde a partida na hora.',
    ],
  },
  'o-infiltrado': {
    icon: '◉',
    pitch: 'Todos sabem onde estão, menos um. E ele está fingindo muito bem.',
    duration: '10-15 min',
    vibe: 'Blefe',
    howTo: [
      'Todo mundo recebe o mesmo local e um papel diferente dentro dele.',
      'Menos uma pessoa: o infiltrado não sabe onde está.',
      'Perguntem uns aos outros coisas que provem conhecer o lugar — sem entregá-lo.',
      'A qualquer momento alguém pode acusar. Só vale se a mesa for unânime.',
      'O infiltrado vence se sobreviver ao tempo ou se acertar o local.',
    ],
  },
  perfil: {
    icon: '?',
    pitch: 'Dicas caindo uma a uma. Quem acerta primeiro leva mais pontos.',
    duration: '20-30 min',
    vibe: 'Dedução',
    howTo: [
      'Uma carta secreta: uma pessoa, um lugar, uma coisa, um ano ou uma ficção.',
      'As dicas aparecem uma a uma, da mais vaga para a mais óbvia.',
      'Qualquer um pode chutar a qualquer momento, direto do celular.',
      'Quanto menos dicas tiverem saído, mais vale o acerto.',
      'Errou? Fica alguns segundos travado enquanto os outros tentam.',
    ],
  },
  camaleao: {
    icon: '🦎',
    pitch: 'Todos sabem a palavra secreta, menos um. E ele vai fingir que sabe.',
    duration: '15-25 min',
    vibe: 'Blefe',
    howTo: [
      'A TV mostra uma grade de 16 palavras de um tema.',
      'Todo mundo vê no celular qual delas é a secreta — menos o camaleão, que só vê a grade.',
      'Na sua vez, diga UMA palavra relacionada à secreta. Vaga demais e você parece o camaleão; clara demais e entrega o jogo para ele.',
      'Depois de todos falarem, votem em quem está blefando.',
      'Camaleão pego ainda pode chutar a palavra: acertou, leva 1 ponto. Escapou, leva 2. Pego e errou, os outros levam 2.',
    ],
  },
  lobisomem: {
    icon: '🐺',
    pitch: 'Uma noite só. De manhã, ninguém tem certeza nem da própria carta.',
    duration: '10-15 min',
    vibe: 'Blefe',
    howTo: [
      'Cada um recebe um papel secreto no celular. Três cartas ficam no centro, sem dono.',
      'O app conduz a noite: lobisomens se reconhecem, o vidente espia, o ladrão troca de carta, a encrenqueira embaralha dois jogadores.',
      'Ninguém precisa fechar os olhos — cada ação é secreta no celular de quem age.',
      'De manhã, cinco minutos de conversa. Quem é lobisomem? Você ainda é o que era?',
      'Votem. Morre quem tiver mais votos (com pelo menos dois). Se um lobisomem morrer, a aldeia vence.',
      'Você vence com o time da carta que está na sua mão AO AMANHECER, não da que recebeu.',
    ],
  },
  'future-sugoroku': {
    icon: '🎲',
    pitch: 'Um labirinto onde as portas só deixam passar alguns de vocês.',
    duration: '20-30 min',
    vibe: 'Corrida',
    howTo: [
      'Todos começam no canto do labirinto 5×5 com 15 pontos.',
      'A cada turno, os dados dizem quantas pessoas cabem em cada porta.',
      'Se mais gente escolher a mesma porta do que cabe, o excesso fica trancado.',
      'Cada passo custa 1 ponto. Chegue à saída em 15 turnos ou fique para trás.',
    ],
  },
}

const FALLBACK: GameMeta = {
  icon: '🎮',
  pitch: 'Um minigame novo para a mesa.',
  duration: '—',
  vibe: 'Dedução',
  howTo: ['As regras deste jogo ainda não foram cadastradas.'],
}

export function getGameMeta(slug: string): GameMeta {
  return CATALOG[slug] ?? FALLBACK
}

/** Cor do jogo — a mesma usada dentro da partida, para dar continuidade visual. */
export function getGameColor(slug: string) {
  return getAccent(slug).main
}

/**
 * Rota da tela de um jogo. `/game/:code` sabe redirecionar sozinho, então
 * ninguém mais precisa tratar `read-my-mind` como caso especial.
 */
export function gameRoute(code: string, view: 'tv' | 'host' | 'player') {
  return `/game/${code.toUpperCase()}?view=${view}`
}
