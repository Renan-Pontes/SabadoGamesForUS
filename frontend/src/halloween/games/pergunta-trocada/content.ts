/**
 * Conteúdo da "Pergunta Trocada": pares de perguntas parecidas.
 *
 * Em cada rodada a mesa recebe uma pergunta do par e o impostor recebe a
 * outra (qual é qual é sorteado na hora, então cada par vale por dois). As
 * duas pedem o MESMO tipo de resposta — um número, um nome ou poucas
 * palavras — e as respostas de uma cabem na outra, para o impostor passar
 * despercebido até a pergunta de verdade aparecer na TV.
 */

/** Tipo de resposta: muda a dica e o teclado do celular. */
export type AnswerKind = 'numero' | 'nome' | 'curta'

export type QuestionPair = {
  kind: AnswerKind
  /** As duas perguntas do par (a mesa recebe uma, o impostor a outra). */
  a: string
  b: string
}

const n = (a: string, b: string): QuestionPair => ({ kind: 'numero', a, b })
const p = (a: string, b: string): QuestionPair => ({ kind: 'nome', a, b })
const w = (a: string, b: string): QuestionPair => ({ kind: 'curta', a, b })

export const PAIRS: readonly QuestionPair[] = [
  // --- Números ------------------------------------------------------------
  n('Quantas fatias de panetone você come no Natal?', 'Quantos presentes você ganhou no Natal passado?'),
  n('Com quantos anos você descobriu que Papai Noel não existe?', 'Com quantos anos você aprendeu a andar de bicicleta?'),
  n('Quantas uvas você come na virada do ano?', 'Quantos copos de água você bebe por dia?'),
  n('Quantas pessoas vão na ceia da sua família?', 'Quantas pessoas tem no grupo da família no WhatsApp?'),
  n('Quantos reais você gasta no presente do amigo secreto?', 'Quantos reais você pagaria num corte de cabelo?'),
  n('De 0 a 10, quanto você gosta de pavê?', 'De 0 a 10, quanto você gosta de acordar cedo?'),
  n('Quantos minutos você aguenta a piada do tio do pavê?', 'Quantos minutos você leva no banho?'),
  n('Quantas fotos você tira na noite de Natal?', 'Quantas mensagens não lidas você tem agora?'),
  n('Quantas rabanadas você come de uma vez?', 'Quantas fatias de pizza você come de uma vez?'),
  n('Quantas vezes você já fingiu gostar de um presente?', 'Quantas vezes você já foi a um casamento?'),
  n('Até que horas você aguenta acordado no réveillon?', 'Que horas você vai dormir num sábado normal?'),
  n('Quantas promessas de Ano Novo você faz?', 'Quantas promessas de Ano Novo você cumpre?'),
  n('De 0 a 10, quão bom você é embrulhando presente?', 'De 0 a 10, quão bom você é na cozinha?'),
  n('Quantos anos você tinha no seu primeiro amigo secreto?', 'Quantos anos você tinha quando ganhou o primeiro celular?'),
  n('Quantas vezes por dia você belisca a sobra da ceia?', 'Quantas vezes por dia você abre a geladeira sem fome?'),
  n('Quantos presentes você ainda não comprou?', 'Quantas abas estão abertas no seu celular agora?'),
  n('Quantos anos tem o pisca-pisca da sua casa?', 'Quantos anos tem o seu celular?'),
  n('Quantas vezes você ouve "All I Want for Christmas" em dezembro?', 'Quantas vezes por mês você pede delivery?'),
  n('Quantas pessoas você abraça na virada do ano?', 'Quantos convidados teria o seu aniversário ideal?'),
  n('Quantos pares de meia você já ganhou de Natal?', 'Quantos pares de chinelo você tem?'),
  n('Quantas músicas de Natal você sabe cantar inteiras?', 'Quantas senhas diferentes você usa?'),
  n('Quantos dias antes do Natal você monta a árvore?', 'Quantos dias você leva para responder uma mensagem?'),
  n('Quantas vezes você repete o prato na ceia?', 'Quantas vezes você aperta a soneca de manhã?'),
  n('Quantas ondas você pula no réveillon?', 'Quantos cafés você toma por dia?'),

  // --- Nomes --------------------------------------------------------------
  p('Quem da família sempre chega atrasado na ceia?', 'Quem da família mais fala no grupo do WhatsApp?'),
  p('Quem você chamaria para se vestir de Papai Noel?', 'Quem você chamaria para ajudar numa mudança?'),
  p('Que famoso você queria tirar no amigo secreto?', 'Que famoso você queria ter como vizinho?'),
  p('Quem aqui come mais na ceia?', 'Quem aqui dorme primeiro numa festa?'),
  p('Quem aqui daria o pior presente de amigo secreto?', 'Quem aqui chegaria atrasado no próprio casamento?'),
  p('Quem aqui seria o melhor Papai Noel de shopping?', 'Quem aqui seria o melhor professor de escola?'),
  p('Quem aqui chora em filme de Natal?', 'Quem aqui chora em final de novela?'),
  p('Quem aqui sobreviveria sozinho no Polo Norte?', 'Quem aqui ganharia um reality show?'),
  p('Que personagem de filme de Natal você seria?', 'Que personagem de desenho animado você seria?'),
  p('Quem aqui mais posta foto da ceia?', 'Quem aqui mais manda áudio de 3 minutos?'),
  p('Que cantor devia fazer o especial de fim de ano?', 'Que cantor você mais canta no chuveiro?'),
  p('Quem aqui ganharia o concurso de dança do réveillon?', 'Quem aqui ganharia uma guerra de travesseiro?'),
  p('Qual parente faz a melhor comida de Natal?', 'Qual parente dá os melhores conselhos?'),
  p('Quem aqui abriria o presente antes da hora?', 'Quem aqui leria o final do livro primeiro?'),
  p('Que famoso você levaria para a ceia da sua família?', 'Que famoso você levaria para uma ilha deserta?'),
  p('Quem aqui seria o duende mais preguiçoso do Papai Noel?', 'Quem aqui seria o pior motorista de aplicativo?'),
  p('Quem aqui esconde o melhor pedaço do peru?', 'Quem aqui pega o último pedaço da pizza sem perguntar?'),
  p('Quem aqui esquece de comprar o presente do amigo secreto?', 'Quem aqui esquece o aniversário dos amigos?'),
  p('Quem aqui seria o Grinch da festa?', 'Quem aqui reclama de tudo no restaurante?'),
  p('Quem aqui puxaria a oração antes da ceia?', 'Quem aqui faria o discurso num casamento?'),

  // --- Poucas palavras ----------------------------------------------------
  w('O que não pode faltar na ceia de Natal?', 'O que não pode faltar num churrasco?'),
  w('Qual o pior presente que dá para ganhar?', 'O que você nunca compraria para você mesmo?'),
  w('O que você vai pedir para o Papai Noel este ano?', 'O que você compraria se ganhasse na Mega da Virada?'),
  w('Qual cor de roupa você usa no réveillon?', 'Qual a cor do carro dos seus sonhos?'),
  w('Qual a melhor comida de Natal?', 'Qual a melhor comida de domingo na casa da vó?'),
  w('O que você faz enquanto espera dar meia-noite?', 'O que você faz quando a internet cai?'),
  w('Qual a sua promessa para o Ano Novo?', 'O que você sempre diz que vai começar "na segunda"?'),
  w('Que música toca em toda festa de fim de ano?', 'Que música você escolhe no karaokê?'),
  w('Onde seria o seu réveillon dos sonhos?', 'Onde você moraria se pudesse escolher?'),
  w('Qual a primeira coisa que você faz no dia 1º de janeiro?', 'Qual a primeira coisa que você faz quando acorda?'),
  w('Que presente você daria para o seu chefe?', 'Que presente você daria para um vizinho que mal conhece?'),
  w('O que você diz quando ganha um presente ruim?', 'O que você diz quando encontra um ex na rua?'),
  w('Qual a sua desculpa para fugir da ceia da família?', 'Qual a sua desculpa para faltar no trabalho?'),
  w('Qual comida da ceia sempre sobra?', 'Qual comida você nunca come?'),
  w('Se o Papai Noel fosse um bicho, qual seria?', 'Se você fosse um bicho, qual seria?'),
  w('Qual sobremesa de Natal você dispensa?', 'Qual sobremesa você nunca pediria num restaurante?'),
  w('O que você faria com o 13º salário?', 'O que você faria se achasse 100 reais na rua?'),
  w('O que você faz assim que chega na casa da vó?', 'O que você faz assim que chega em casa?'),
  w('O que o Papai Noel faz no resto do ano?', 'O que você faz num feriado prolongado?'),
  w('Qual a melhor parte do Natal?', 'Qual a melhor parte das férias?'),
  w('Qual a comida mais estranha que já apareceu numa ceia?', 'Qual a comida mais estranha que você já comeu?'),
  w('Qual emoji resume o seu Natal?', 'Qual emoji você mais usa?'),
  w('Que nome você daria para uma rena?', 'Que nome você daria para um cachorro?'),
  w('O que você grita na contagem regressiva do Ano Novo?', 'O que você grita quando seu time faz gol?'),
  w('Qual o pior lugar para passar o Natal?', 'Qual o pior lugar para ficar sem bateria no celular?'),
  w('Qual a pior parte de ser Papai Noel?', 'Qual a pior parte de trabalhar num shopping?'),
  w('O que tem no fundo da sua sacola de presentes?', 'O que tem no fundo da sua bolsa ou mochila?'),
  w('Qual a primeira coisa que você come na ceia?', 'Qual a primeira coisa que você come no café da manhã?'),
]

/** Dica do tipo de resposta (celular e TV). */
export const KIND_HINT: Record<AnswerKind, { icon: string; label: string; placeholder: string }> = {
  numero: { icon: '🔢', label: 'Responda com um número', placeholder: 'Ex.: 7' },
  nome: { icon: '🙋', label: 'Responda com um nome', placeholder: 'Ex.: Tia Cleide' },
  curta: { icon: '✍️', label: 'Responda em poucas palavras', placeholder: 'Ex.: farofa' },
}

/** Respostas dos bots dos testes (plausíveis para os dois lados do par). */
export const BOT_ANSWERS: Record<AnswerKind, readonly string[]> = {
  numero: ['0', '1', '2', '3', '4', '5', '7', '8', '10', '12', '15', '20', '30', '50', 'uns 6', 'mais de 100'],
  nome: ['Tia Cleide', 'Vô Zé', 'Papai Noel', 'eu mesmo', 'Roberto Carlos', 'Xuxa', 'Faustão', 'minha mãe', 'o primo Juninho'],
  curta: ['farofa', 'uva-passa', 'dormir', 'pavê', 'meia', 'praia', 'branco', 'comer muito', 'nada', 'sei lá', 'viajar'],
}
