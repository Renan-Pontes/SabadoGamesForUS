/**
 * As perguntas do "Quem Morre Primeiro?": clichês de filme de terror, cada
 * uma com o epitáfio que vai na lápide de quem a galera escolher.
 *
 * Regras do conteúdo: "Quem..." no começo e "?" no fim, curtinha (cabe em
 * duas linhas na TV), humor leve — é para rir de quem levou a lápide, não
 * para ofender. O id é a posição na lista; não reordene no meio da festa.
 */
export type Question = { text: string; epitaph: string }

export const QUESTIONS: readonly Question[] = [
  { text: 'Quem iria investigar o barulho no porão?', epitaph: 'Só ia dar uma olhadinha.' },
  { text: 'Quem diria “já volto” e nunca mais voltaria?', epitaph: 'Disse que já voltava.' },
  { text: 'Quem leria em voz alta o livro amaldiçoado?', epitaph: 'Achou que era só latim.' },
  { text: 'Quem se separaria do grupo para procurar ajuda?', epitaph: 'Foi buscar ajuda. Achou outra coisa.' },
  { text: 'Quem tropeçaria correndo do monstro?', epitaph: 'Tropeçou no próprio cadarço.' },
  { text: 'Quem atenderia uma ligação de número desconhecido à meia-noite?', epitaph: 'Atendeu no terceiro toque.' },
  { text: 'Quem tiraria uma selfie com o fantasma?', epitaph: 'A foto ficou ótima.' },
  { text: 'Quem abriria a porta escrito “NÃO ABRA”?', epitaph: 'Ninguém manda em mim.' },
  { text: 'Quem brincaria com o tabuleiro Ouija sozinho?', epitaph: 'O tabuleiro respondeu.' },
  { text: 'Quem chamaria a Loira do Banheiro três vezes?', epitaph: 'Era só uma brincadeira…' },
  { text: 'Quem adotaria o boneco antigo que pisca sozinho?', epitaph: 'Era tão fofinho.' },
  { text: 'Quem entraria na casa abandonada por causa de um desafio?', epitaph: 'Valeu o desafio.' },
  { text: 'Quem seria possuído primeiro?', epitaph: 'Não era ele falando.' },
  { text: 'Quem acharia uma ótima ideia acampar no cemitério?', epitaph: 'A barraca aguentou. Ele, não.' },
  { text: 'Quem comeria o doce misterioso deixado na porta?', epitaph: 'Estava uma delícia.' },
  { text: 'Quem daria carona para a moça de branco na estrada?', epitaph: 'Foi gentil até o fim.' },
  { text: 'Quem tentaria fazer carinho no lobisomem?', epitaph: 'Parecia um cachorrão.' },
  { text: 'Quem cairia no papo do vampiro charmoso?', epitaph: 'Foi só um jantarzinho.' },
  { text: 'Quem desceria no escuro para pegar água na cozinha?', epitaph: 'Estava com muita sede.' },
  { text: 'Quem gritaria “tem alguém aí?” numa casa vazia?', epitaph: 'Tinha.' },
  { text: 'Quem daria corda na caixinha de música do sótão?', epitaph: 'A música era bonita.' },
  { text: 'Quem já seria fantasma e ainda não percebeu?', epitaph: 'Até hoje acha que está vivo.' },
  { text: 'Quem tentaria pegar o gorro do Saci?', epitaph: 'Quase conseguiu.' },
  { text: 'Quem seguiria a luz estranha no meio da mata?', epitaph: 'Achou que era vaga-lume.' },
  { text: 'Quem iria nadar no lago à meia-noite?', epitaph: 'A água estava ótima.' },
  { text: 'Quem ficaria encarando o espelho no escuro esperando alguém aparecer?', epitaph: 'Apareceu.' },
  { text: 'Quem pegaria a boneca largada no meio da estrada?', epitaph: 'Ela pediu colo.' },
  { text: 'Quem estaria com 1% de bateria no apocalipse zumbi?', epitaph: 'Morreu antes do celular.' },
  { text: 'Quem confundiria um zumbi com alguém bêbado na festa?', epitaph: 'Achou que era o tio.' },
  { text: 'Quem se esconderia justo no armário onde o monstro mora?', epitaph: 'Escolheu o pior armário.' },
  { text: 'Quem compraria a casa baratinha onde “aconteceu uma coisa”?', epitaph: 'O preço era imperdível.' },
  { text: 'Quem ignoraria o aviso do velhinho misterioso do posto de gasolina?', epitaph: 'Ele bem que avisou.' },
  { text: 'Quem tiraria a estaca do peito do vampiro “só para ver”?', epitaph: 'Só pra ver.' },
  { text: 'Quem enfiaria a mão no buraco escuro da parede?', epitaph: 'Tinha alguma coisa lá.' },
  { text: 'Quem abriria o sarcófago da múmia no museu?', epitaph: 'Queria só uma fotinho.' },
  { text: 'Quem usaria a fantasia amaldiçoada na festa de Halloween?', epitaph: 'Ficou perfeita. Não sai mais.' },
  { text: 'Quem gritaria tão alto que atrairia todos os monstros?', epitaph: 'Tinha um pulmão de ouro.' },
  { text: 'Quem iria até o fim da trilha no escuro só para provar coragem?', epitaph: 'Provou.' },
  { text: 'Quem estaria de fone e não ouviria o aviso para correr?', epitaph: 'A música estava boa.' },
  { text: 'Quem acreditaria na criança que fala com o amigo imaginário?', epitaph: 'O amigo era real.' },
  { text: 'Quem invocaria um demônio sem querer lendo um meme?', epitaph: 'Era só um meme.' },
  { text: 'Quem voltaria correndo para pegar o celular que caiu?', epitaph: 'O celular sobreviveu.' },
  { text: 'Quem passaria o filme inteiro dizendo “relaxa, monstro não existe”?', epitaph: 'Monstro existe.' },
  { text: 'Quem tomaria a poção da bruxa achando que era suco?', epitaph: 'Tinha gosto de uva.' },
  { text: 'Quem seria o vilão disfarçado que volta na continuação?', epitaph: 'Volta na parte 2.' },
  { text: 'Quem ficaria para trás porque parou para comer?', epitaph: 'Morreu de barriga cheia.' },
  { text: 'Quem desmaiaria de medo antes do monstro aparecer?', epitaph: 'Nem viu o monstro.' },
  { text: 'Quem faria uma live no meio do ritual proibido?', epitaph: 'Bateu recorde de audiência.' },
]
