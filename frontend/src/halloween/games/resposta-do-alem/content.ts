/**
 * As frases do "Resposta do Além": cada uma tem uma lacuna (`___`) que a
 * galera completa no celular, e a `alem` — a resposta que o próprio além dá
 * quando ninguém da mesa escreve nada (a TV lê com a voz de terror).
 *
 * Regras do conteúdo: uma lacuna só, curtinha (cabe em duas linhas na TV),
 * humor leve de Halloween e de festa — é para rir junto, não de alguém. A
 * `alem` tem no máximo 60 letras, como as respostas da mesa. O id é a posição
 * na lista; não reordene no meio da festa.
 */
export type Prompt = { text: string; alem: string }

/** Marca da lacuna no texto da frase. */
export const BLANK = '___'

export const PROMPTS: readonly Prompt[] = [
  { text: 'O pior lugar para se esconder de um zumbi é ___.', alem: 'Num açougue com placa de "cérebro fresco".' },
  { text: 'O fantasma desta casa só aparece quando alguém ___.', alem: 'Esquece de pagar a conta de luz.' },
  { text: 'O verdadeiro motivo de o vampiro não sair de dia: ___.', alem: 'Não acha protetor solar fator 1000.' },
  { text: 'A bruxa aposentou a vassoura e agora anda de ___.', alem: 'Patinete elétrico alugado.' },
  { text: 'A fantasia mais assustadora desta festa seria ___.', alem: 'A fatura do cartão de crédito.' },
  { text: 'Embaixo de tantas faixas, a múmia esconde ___.', alem: 'Uma tatuagem escrito "amor de mãe".' },
  { text: 'Se o Drácula tivesse Instagram, a bio seria: ___.', alem: 'Noturno, sedento e solteiro 🦇' },
  { text: 'O nome do novo filme de terror brasileiro: ___.', alem: 'A Volta do Fiscal da Receita.' },
  { text: 'O lobisomem só se transforma na lua cheia porque ___.', alem: 'É o único dia em que a academia fecha.' },
  { text: 'A pior coisa para ouvir de uma vidente: ___.', alem: 'Ih… atrás de você. Não olha.' },
  { text: 'O Saci perdeu o gorro e agora ___.', alem: 'Usa boné de aba reta.' },
  { text: 'No fundo do caldeirão da bruxa tem ___.', alem: 'Uma meia que sumiu em 2009.' },
  { text: 'O esqueleto não veio à festa porque ___.', alem: 'Estava sem corpo para isso.' },
  { text: 'Em vez de doces, a casa da esquina distribui ___.', alem: 'Brócolis e conselhos de vida.' },
  { text: 'A frase que nenhum fantasma quer ouvir: ___.', alem: 'Essa casa vai virar estacionamento.' },
  { text: 'O Frankenstein reclamou no SAC porque ___.', alem: 'Veio com um parafuso a menos.' },
  { text: 'O verdadeiro terror de uma festa: ___.', alem: 'Acabar o gelo às dez da noite.' },
  { text: 'A Cuca parou de pegar criança porque ___.', alem: 'Agora só trabalha de home office.' },
  { text: 'A mensagem que chegou do além no grupo da família: ___.', alem: 'Bom dia 🌹 (enviado do caixão)' },
  { text: 'O zumbi foi demitido porque ___.', alem: 'Chegava sempre arrastando o pé.' },
  { text: 'O pior presente para dar a um vampiro: ___.', alem: 'Um colar de alho artesanal.' },
  { text: 'A Loira do Banheiro finalmente saiu do banheiro para ___.', alem: 'Reclamar que acabou o papel.' },
  { text: 'Se o seu celular fosse assombrado, ele ___.', alem: 'Curtiria fotos antigas do seu ex às 3h.' },
  { text: 'O caçador de fantasmas largou a profissão depois de ___.', alem: 'Descobrir que o fantasma era o vizinho.' },
  { text: 'A regra número 1 para sobreviver a um filme de terror: ___.', alem: 'Nunca dizer "já volto".' },
  { text: 'O morcego pediu no delivery: ___.', alem: 'Suco de tomate, por precaução.' },
  { text: 'A pior hora para um fantasma aparecer: ___.', alem: 'Bem na hora do pênalti da final.' },
  { text: 'O monstro debaixo da cama quer se mudar porque ___.', alem: 'Ninguém limpa ali desde 2015.' },
  { text: 'A abóbora de Halloween vive reclamando que ___.', alem: 'Ninguém nunca faz um docinho com ela.' },
  { text: 'Quando ninguém está olhando, o fantasminha camarada ___.', alem: 'Treina cara de mau no espelho.' },
  { text: 'O feitiço mais útil do dia a dia: ___.', alem: 'Fazer o Wi-Fi pegar no banheiro.' },
  { text: 'Dá para saber que a casa é mal-assombrada porque ___.', alem: 'A geladeira abre sozinha e come o pudim.' },
  { text: 'O segredo da juventude eterna da vampira: ___.', alem: 'Dormir cedo. Tipo seis da manhã.' },
  { text: 'O fantasma escreveu no espelho embaçado: ___.', alem: 'Limpa esse espelho, pelo amor.' },
  { text: 'A bruxa errou o feitiço e transformou o príncipe em ___.', alem: 'Um pen drive de 2 GB.' },
  { text: 'O título do livro de autoajuda do Zé do Caixão: ___.', alem: 'Unhas grandes, sonhos maiores.' },
  { text: 'O que realmente acontece à meia-noite no Halloween: ___.', alem: 'Todo mundo come os doces escondido.' },
  { text: 'A desculpa para não entrar na casa abandonada: ___.', alem: 'Tô de chinelo.' },
  { text: 'O pior nome para um gato preto: ___.', alem: 'Sortudo.' },
  { text: 'O espírito que mora no seu guarda-roupa só quer ___.', alem: 'Que você doe as roupas que não usa.' },
  { text: 'A maldição da múmia, na verdade, é ___.', alem: 'Ouvir áudio de cinco minutos.' },
  { text: 'O vampiro vegano se alimenta de ___.', alem: 'Suco de beterraba e muita fé.' },
  { text: 'O fantasma foi expulso da festa porque ___.', alem: 'Atravessava a fila do banheiro.' },
  { text: 'A senha do Wi-Fi do castelo do Drácula é ___.', alem: 'mordida123' },
  { text: 'No aplicativo de namoro, o zumbi escreveu: ___.', alem: 'Procuro alguém com muito cérebro.' },
  { text: 'A trilha sonora perfeita para fugir de um monstro: ___.', alem: 'Música de academia no último volume.' },
  { text: 'Para disfarçar os pelos no trabalho, o lobisomem ___.', alem: 'Diz que é um suéter de lã.' },
  { text: 'O castelo assombrado está à venda porque ___.', alem: 'O condomínio é um terror.' },
  { text: 'Nunca diga isto para um fantasma: ___.', alem: 'Você tá meio transparente hoje.' },
  { text: 'No fim de semana, o espantalho ___.', alem: 'Vai ao forró espantar os casais.' },
  { text: 'O maior medo de um fantasma: ___.', alem: 'Ser visto sem o lençol.' },
  { text: 'A poção mais vendida da loja da bruxa: ___.', alem: 'Poção anti-ressaca de domingo.' },
  { text: 'O jeito mais rápido de esvaziar esta festa: ___.', alem: 'Colocar a playlist do tio no máximo.' },
  { text: 'A caveira viu a própria foto e disse: ___.', alem: 'Nossa, eu tô só o osso.' },
  { text: 'O boneco assassino pediu de Natal: ___.', alem: 'Um abraço. Só um abraço.' },
  { text: 'Se a morte tivesse um podcast, o nome seria ___.', alem: 'Papo de Outro Mundo.' },
  { text: 'O pior lugar para fazer um ritual de invocação: ___.', alem: 'No grupo do trabalho.' },
  { text: 'No porão tem uma caixa que ninguém tem coragem de abrir: ___.', alem: 'A dos cabos que "um dia vão servir".' },
  { text: 'A primeira coisa que o zumbi faz quando acorda: ___.', alem: 'Olha o celular e geme.' },
  { text: 'Se ninguém completar esta frase, a TV vai ___.', alem: 'Responder por vocês. Tipo agora.' },
]

/**
 * Respostas dos bots (só nos testes e na simulação): pedaço + complemento,
 * para sair variado e de vez em quando repetir (as respostas iguais viram
 * uma carta só).
 */
export const BOT_STARTS: readonly string[] = [
  'Um zumbi',
  'Três morcegos',
  'O tio do pavê',
  'Um fantasma',
  'A abóbora',
  'Um esqueleto',
  'O gato preto',
  'Um vampiro vegano',
  'A bruxa do prédio',
  'O vizinho',
]

export const BOT_ENDS: readonly string[] = [
  'de pijama',
  'num casaco só',
  'com ansiedade',
  'dançando forró',
  'sem Wi-Fi',
  'pedindo pudim',
  'de chinelo',
  'no porão',
]
