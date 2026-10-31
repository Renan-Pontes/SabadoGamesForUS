# Noite do Terror — plano do Halloween 2026

Plano de trabalho da edição de Halloween do Sábado Games. Serve de guia para
as várias IAs que trabalham em paralelo e de registro do que foi decidido.

## O que vai mudar

1. **Backend migrado** para a conta `SabadoGames` do PythonAnywhere
   (`sabadogames.pythonanywhere.com`). ✅ feito na `main`.
2. **Plataforma inteira com cara de Halloween**: cores, fontes, neblina,
   morcegos, teias, música na TV e sustos de meme de vez em quando.
3. **10 jogos novos de Halloween, todos para até 15 pessoas**, com regras
   curtinhas — a lição da mesa é: quanto mais simples, mais o povo joga.
4. **A TV é o juiz.** A lógica dos jogos novos roda no navegador da TV; o
   backend só guarda e entrega JSON. Menos CPU no PythonAnywhere (conta
   gratuita) e jogos mais rápidos de escrever. Segurança fica em segundo plano:
   é uma mesa de amigos — quem abrir o DevTools consegue espiar, e tudo bem.

## Os 10 jogos

| # | Slug | Nome | Tipo | Pessoas |
|---|---|---|---|---|
| 1 | `espiao-assombrado` | 🕵️ Espião Assombrado | Dedução social (o favorito da mesa) | 3–15 |
| 2 | `cidade-dorme` | 🔪 Cidade Dorme | Dedução social, sem ninguém fechar o olho | 5–15 |
| 3 | `retrato-assombrado` | 🎨 Retrato Assombrado | Desenho + impostor | 3–15 |
| 4 | `mentira-macabra` | 🤥 Mentira Macabra | Estilo Jackbox: invente a mentira | 3–15 |
| 5 | `resposta-do-alem` | 💬 Resposta do Além | Estilo Jackbox: a resposta mais engraçada | 3–15 |
| 6 | `quem-morre-primeiro` | ⚰️ Quem Morre Primeiro? | Votação na galera | 3–15 |
| 7 | `abobora-bomba` | 🎃 Abóbora-Bomba | Batata quente com pavio individual | 2–15 |
| 8 | `portas-do-alem` | 🚪 Portas do Além | Sobrevivência com sustos | 2–15 |
| 9 | `quiz-do-terror` | 🧠 Quiz do Terror | Perguntas e respostas | 1–15 |
| 10 | `corrida-de-vassouras` | 🧹 Corrida de Vassouras | Corrida na TV com apostas | 2–15 |

Os 25 jogos antigos continuam no catálogo, abaixo da prateleira de Halloween,
e também ganham o visual novo (as cores vêm das variáveis CSS globais).

---

## Etapas e quem faz o quê

Cada IA é dona de um conjunto de arquivos e **não edita arquivo de outra**. Se
precisar de uma mudança fora do que é seu, descreva no relatório final em
"Pedidos de mudança compartilhada" — a integração aplica.

### Etapa 0 — infraestrutura (feita)
Migração do backend, branch `halloween-2026`, este plano, dependências novas
(`vitest`, `@fontsource/creepster`, `@fontsource/nosifer`, `qrcode.react`) e a
fiação mínima compartilhada:
- `frontend/src/halloween/slugs.ts` — a lista dos 10 slugs.
- `App.tsx` já monta `<HalloweenLayer />` e a rota `/game/:code/:slug` →
  `HalloweenGameScreen`; `pages/Game.tsx` já roteia os 10 slugs.
- `lib/api.ts` exporta `request()` para ninguém duplicar a URL da API.
- Placeholders com o contrato: `halloween/audio/index.ts`,
  `halloween/scare/index.ts`, `halloween/fx/api.ts`, `HalloweenLayer.tsx`,
  `HalloweenGameScreen.tsx`.

### Etapa 1 — fundação (4 IAs em paralelo)
| IA | Dona de | Entrega |
|---|---|---|
| **F1 Backend** | `backend/**` | API "depósito": `sync`, `sync_room`, `fx`, versão da sala, login de convidado, throttle de escrita, seeds dos 10 jogos, testes |
| **F2 Motor** | `frontend/src/halloween/{engine,net,framework,games}/**`, `HalloweenGameScreen.tsx`, `registry.ts`, `lib/gameCatalog.ts`, `games/theme.ts` | Contrato do motor, laço da TV-juiz, fila de envio, relógio do servidor, telas genéricas (configurar, espectador, fim), kit de testes, placeholders dos 10 jogos |
| **F3 Som & sustos** | `frontend/src/halloween/{audio,scare,fx,ui}/**`, `HalloweenLayer.tsx` | Sintetizador de trilhas e efeitos, sustos de meme, cenário (neblina, morcegos, teias), kit visual para os jogos |
| **F4 Visual & entrada** | `index.css`, `theme.ts`, `components/ui/**`, `pages/*.tsx` (fora `Game.tsx`), `games/ui/**`, `context/**`, `lib/api.ts`, `lib/types.ts` | Tema de Halloween no app todo, prateleira de Halloween no topo, entrada rápida só com apelido, QR code na TV, botões de susto no host |

### Etapa 2 — os 10 jogos (10 IAs em paralelo)
Cada IA é dona de `frontend/src/halloween/games/<slug>/` e entrega motor,
testes, tela da TV, tela do celular, regras e conteúdo.

### Etapa 3 — revisão adversarial (10 IAs, uma por jogo)
Outra IA tenta quebrar cada jogo: regras contra a especificação, 3 e 15
jogadores, gente offline, prazos, vazamento de segredo na TV, telas no
celular de 360 px. Corrige o que achar e amplia os testes.

### Etapa 4 — integração, ponta a ponta e deploy
Suíte completa (Django + Vitest), `tsc`, `eslint`, `vite build`, simulação
de partida inteira contra o backend local, conferência visual no navegador,
PR com a etiqueta **finalizado**, merge na `main` (Vercel) e deploy no
PythonAnywhere.

A simulação contra o backend local já existe (Etapa 1): suba o Django
(`py manage.py migrate && py manage.py seed_games && py manage.py runserver
127.0.0.1:8765`) e rode
`HALLOWEEN_E2E_API=http://127.0.0.1:8765 npx vitest run src/halloween/e2e`
(sem a variável, os testes ficam pulados).

---

## Arquitetura: a TV é o juiz

```
 celulares ── POST /state/ (só o próprio jogador) ──►┐
                                                     │  backend = depósito
 TV (juiz) ── GET /sync/ ◄── versão mudou? ──────────┤  (Room.state, Player.state,
 TV (juiz) ── POST /sync_room/ (estado novo) ───────►┘   Room.version, Room.fx)
 celulares ── GET /sync/?mine=1 ◄── estado público + o próprio
```

- **Jogadores só escrevem no próprio `player.state`** (respostas, votos,
  desenhos, comandos do host). Nunca há duas pessoas escrevendo o mesmo JSON.
- **Só o juiz escreve `room.state`.** O juiz é a TV; se nenhuma TV renovar o
  "contrato de juiz" por alguns segundos, o celular do host assume.
- **O backend não conhece as regras** dos jogos novos. `start` só zera o
  estado e põe a sala ao vivo; o juiz faz o resto.
- **Relógio:** todo prazo é em milissegundos do relógio do servidor
  (`t` vem em toda resposta do `sync`). Cada aparelho calcula a diferença.

### Backend (F1) — contrato HTTP

Todos sob `/api/rooms/{code}/`, sem exigir login (a TV é anônima), salvo onde
indicado. `sync`, `sync_room`, `fx` e `auth/guest` rodam sem a autenticação do
DRF: o token, se vier, só identifica o jogador — token velho vira anônimo,
nunca 401. Código no backend: `api/deposito.py` (depósito) e
`api/halloween.py` (`HALLOWEEN_SLUGS`, `is_halloween`).

- `GET sync/?v=<n>&mine=1&tv=1`
  - Se `n` é a versão atual: `{"same": true, "v": n, "t": <ms>}` (barato:
    1 consulta na TV, 2 no celular).
  - Senão: `{"same": false, "v", "t", "me": <player_id|null>, "room": {code,
    status, game: {slug, name, min_players, max_players}, state, fx,
    tv_connected}, "players": [{id, name, is_host, ready, online,
    joined_at, state}]}` — jogadores na ordem de entrada.
  - `mine=1`: o `state` dos outros jogadores vem `null` (só o seu vem cheio) —
    economiza banda dos celulares. A TV pede sem `mine`. O `room.state` vem
    inteiro para todo mundo (segredo em `private` só é escondido pela tela).
  - `tv=1`: marca a TV como conectada (grava no máximo a cada 10 s).
  - Com token: renova o `last_seen_at` do jogador, no máximo a cada 15 s.
  - `online` = visto nos últimos 30 s; `tv_connected` = últimos 20 s. Jogador
    que volta depois de >30 s offline (ou TV depois de >20 s) sobe a versão,
    e essa própria chamada já responde completo.
  - `v` ausente ou inválido → resposta completa. Sala de jogo antigo: o
    `state` dos jogadores vem sempre `null` e o `room.state` redigido como no
    GET antigo. Sala inexistente → 404. Resposta com `Cache-Control: no-store`.
- `POST sync_room/` `{"state": {...}, "status"?: "live"|"ended"|"lobby",
  "slug"?: "<slug do jogo>"}` → substitui `room.state` (e o status) no mesmo
  UPDATE que sobe a versão; devolve `{"v": <versão exata desta gravação>,
  "t"}`. 400 se `state` não é objeto; 404 sem sala; **409** se a sala não está
  num jogo de Halloween ou, com `slug`, se já trocou de jogo (juiz atrasado).
  O juiz só adota o `v` devolvido se `v === versão_base + 1`.
- `POST state/` (exige login) — substitui o `player.state` de quem chama
  inteiro; também sobe a versão da sala. Responde `{player_id, state}`.
- `POST fx/` `{"scare"?, "music"?, "name"?}` → `room.fx = {id: anterior+1,
  at: <ms>, ...só as chaves enviadas}` (cada POST substitui o fx inteiro);
  responde `{"fx", "v", "t"}` e sobe a versão. `scare: "auto-on"|"auto-off"`
  liga/desliga os sustos aleatórios da TV. `GET fx/` → `{"fx": {...} ou {},
  "t"}` (1 consulta, a TV consulta a cada 1,5 s).
- `POST /api/auth/guest/` `{"nickname"}` → 201 `{"token", "user"}` (mesmo
  formato do register); conta sem senha, e-mail sintético
  `convidado-…@convidado.sabadogames`. Apelido repetido (sem ligar para
  maiúsculas) vira "Apelido 2", "Apelido 3"...; vazio → 400
  `{"nickname": ["Diga um apelido para entrar."]}`.
- A versão sobe (+1) em: join, ready, start, end, change_game, restart,
  state, sync_room, fx, tutorial — e na volta de jogador/TV (acima).
- `start` num slug de Halloween: zera `room.state` e o `state` dos jogadores e
  põe a sala ao vivo. **Não cobra "pronto"** (quem joga sai de quem está
  online no "Começar" da tela do jogo); os jogos antigos continuam cobrando.

### Motor (F2) — contrato TypeScript

```ts
type HPlayer = { id: number; name: string; isHost: boolean; online: boolean }
type HInput = { k: string; [field: string]: unknown }   // k = inputKey respondido
type HCommand = { id: number; type: string; [field: string]: unknown }

type EngineCtx = {
  players: HPlayer[]                          // todos na sala, ordem de entrada
  inputs: Record<number, HInput | undefined>  // resposta atual de cada jogador
  slots: Record<string, Record<number, HInput | undefined>>  // respostas persistentes nomeadas (ex.: 'draw')
  command: HCommand | null                    // comando do host ainda não visto pelo motor
  now: number                                 // ms, relógio do servidor
  rng: () => number                           // [0, 1)
  options: Record<string, unknown>            // escolhidas pelo host na tela de configuração
}

type BaseState = {
  phase: string
  inputKey: string        // muda a cada nova rodada de respostas; respostas com outro k são ignoradas
  deadline: number | null // quando a fase avança sozinha (ms do servidor)
  roster: number[]        // quem está na partida (fixo desde o início)
  over: boolean           // acabou: telas mostram o resultado final
  acted?: number[]        // quem já respondeu na fase (público)
  scores?: Record<string, number>
  private?: Record<string, unknown>  // segredo por jogador (chave = id); só o dono vê
  round?: number
  totalRounds?: number
}

type HalloweenEngine<S extends BaseState> = {
  init(ctx: EngineCtx): S
  step(state: S, ctx: EngineCtx): S   // puro e idempotente; devolve o MESMO objeto se nada mudou
  bot(state: S, playerId: number, ctx: EngineCtx): Record<string, unknown> | null  // resposta plausível (testes e simulação)
}
```

- **Respostas:** o celular manda `send({ vote: 12 })` e o framework grava
  `player.state.hw = { k: state.inputKey, vote: 12 }`. `sendSlot('draw', {...})`
  grava em `player.state.hws.draw` (não some quando a fase muda).
- **Comandos do host:** `command('next')` grava `player.state.cmd = {id, type}`.
  O framework trata `begin` (configuração → `init`), `replay` (fim → nova
  configuração) e `end` (encerra: `over = true`). `skip` e os demais chegam ao
  motor em `ctx.command`. **Todo motor trata `skip` como prazo vencido.**
- **Nada pode travar:** toda fase tem prazo; quem está offline não segura a
  fase; o host nunca é obrigatório para avançar.
- **Quem entra no meio** é espectador até a próxima partida (fora do `roster`).
- `room.state` = `{ g: <estado do motor>, setup?: {...}, _cmd: <último id>,
  _auth: {d: <aparelho>, u: <ms>}, _m: <id da partida, novo a cada
  "Começar">, _err: <último erro do motor> }`.
- `player.state` = `{ m: <id da partida>, hw: {k, ...}, hws: {<slot>: {k,
  ...}}, cmd: {id, type, ...} }`, gravado inteiro pela fila do celular
  (`net/stateWriter`). Resposta de outra partida (`m` diferente) não vale;
  resposta sem `m` (escrita crua) vale.
- `begin` (com as opções) só começa com pelo menos `minPlayers` online; o
  `roster` é quem está online nesse momento. `replay` volta à configuração
  com as mesmas opções; `end` põe `over = true` sem chamar o motor.
- Juiz: a TV tem preferência; o celular do host assume se o contrato
  (`_auth`, 9 s) vencer há 6 s. Poll: TV 1 s, celulares 1,5 s (ou
  `meta.phonePollMs`), juiz roda o motor a cada 400 ms e só grava quando o
  JSON muda (no mínimo 250 ms entre gravações). 409 do `sync_room` → o juiz
  para de gravar e a tela volta para a sala certa.
- Cada jogo exporta de `games/<slug>/index.ts` (já pronto):
  `{ meta, engine, Tv, Phone }` e `game = defineHalloweenGame<State>(...)`,
  com `meta = { slug, name, icon, tagline, pitch, howTo, duration, vibe,
  minPlayers, maxPlayers, accent, options, music?, phonePollMs? }`. O
  `index.ts` importa `{ engine, type State }` de `./engine` e as telas por
  `lazy()` de `./Tv` e `./Phone` (`export default`).
- `Tv` e `Phone` recebem `HalloweenViewProps<S>`: `code, view, state (sem
  private), players, me (null na TV), isHost, myInput, mine (=
  state.private[me.id]), now(), send, sendSlot, command, slots (TV: de
  todos; celular: só os meus), options`.
- Guia de quem escreve jogo, com armadilhas: `frontend/src/halloween/README.md`.

### Som e sustos (F3) — contrato

```ts
// halloween/audio
useMusic(track: 'lobby'|'tension'|'night'|'day'|'party'|'race'|'quiz'|'chase'|'victory'|null)
  // só toca na TV; vale o pedido mais recente (o jogo vence a moldura); null = silêncio
playSfx(name: 'scream'|'thunder'|'creak'|'door'|'heartbeat'|'bell'|'ghost'|'doot'|'boom'|'clang'|'tick'|
        'explosion'|'win'|'fail'|'reveal'|'whoosh'|'pop'|'laugh'|'organ'|'drumroll'|'buzzer'|'ding'|
        'fuse'|'monster'|'gong'|'bones'|'hiss'|'static'|'whisper'|'jumpscare',
        { volume?: 0..2, delay?: segundos }): number   // duração em s; 0 = não tocou
speakSpooky(text, { pitch?, rate? }): () => void       // devolve o cancelador
// halloween/scare
triggerScare(kind?: 'random'|'doot'|'zoom'|'scream'|'pumpkin'|'pipe'|'skeletons'|'spider'|'static'|'bruh'|'eyes'|'penetra', { name? })
  // 'penetra' (RARE_SCARE) nunca sai no 'random': é o susto raro, 1 em 5000 por segundo
useSuppressScares(active: boolean)   // segura só os sustos ALEATÓRIOS
useScareNames(names: string[])       // nomes para zoom/olhos (a tela do jogo já informa)
// halloween/fx/api (host → TV)
sendRoomFx(code, { scare?, music?, name? }), scareRoomTv(code, kind?, name?),
setRoomMusic(code, on), setRoomRandomScares(code, on)
```

- Kit visual em `halloween/ui`: `SpookyBackdrop`, `HauntedTitle`,
  `CandleTimer`, `Tombstone`, `PlayerBadge`, `BigReveal` (segura os sustos
  enquanto aberto), `DoorSvg`, `PumpkinSvg`, `Cauldron`, `CandyRain`,
  `SpiderSvg`, `SoundToggle`, mais `SPOOKY_COLORS`, `CREEPY_FONT`,
  `BLOODY_FONT`, `withAlpha`, `useReducedMotion`.
- A camada global (`HalloweenLayer`) já monta cenário, palco dos sustos, o
  fx da TV (`TvFxLayer`, em `/tv/:code` e em toda rota com `?view=tv`), o
  aviso de desbloqueio do som e o botão de som flutuante do celular (canto
  inferior esquerdo, 38 px).

- Tudo sintetizado na hora com Web Audio (nada de MP3 com direitos autorais).
  Melodias de domínio público são bem-vindas: Tocata e Fuga em Ré menor
  (Bach), Marcha Fúnebre (Chopin), Na Gruta do Rei da Montanha (Grieg),
  Dança Macabra (Saint-Saëns), Dies Irae.
- Música e sustos tocam **na TV**. Celulares ficam mudos por padrão (botão de
  som disponível); vibração continua.
- Os navegadores bloqueiam som até o primeiro clique: a TV mostra
  "🔊 Clique para acordar os mortos" uma vez.
- Sustos aleatórios na TV a cada 4–9 minutos (liga/desliga na própria TV e
  pelo host), suspensos durante revelações. O host pode mandar um susto na
  hora pelo celular ("😱 Assustar a TV").
- O susto raro (`fx/rareScare.ts`), à la "Foxy 1 em 10.000": a cada segundo a
  TV tem 1 chance em 5000 de soltar o **Penetra**, um jumpscare de verdade
  (entra sem aviso, grita ~1 s, corta para estática). Média de 83 min entre
  aparições; ~51% de chance em 1 h, ~88% em 3 h. Mesmo liga/desliga dos
  sustos aleatórios, não rola durante revelação nem com outro susto na tela.
  Testar: fantasminha da TV → "Testar o susto raro". Jumpscare próprio:
  vídeo/imagem/som em `frontend/public/jumpscare/` trocam o Penetra
  (`scare/customJumpscare.ts`; nomes no LEIA-ME da pasta).
- Sustos são memes originais: esqueleto do "doot doot" 🎺, zoom suspeito 🤨
  no nome de alguém com "vine boom", cano de metal caindo, aranha descendo,
  TV chiando "ELE ESTÁ AQUI", olhos no escuro sussurrando um nome... Curtos
  (1,5–2,5 s), sem pisca-pisca estroboscópico.

---

## Regras de ouro para todo jogo

- **"Como jogar" com 3 a 5 passos de no máximo ~14 palavras.** Se não cabe,
  o jogo está complicado demais.
- **Celular:** uma ação clara por tela, botões grandes, funciona em 360 px,
  mostra "esperando os outros (7/15)" depois de agir, vibra ao enviar,
  nunca mostra segredo de outra pessoa.
- **TV:** legível a 3 metros (texto ≥ 28 px, títulos ≥ 64 px), mostra quem já
  respondeu (✓ nos nomes, sem revelar o quê), cronômetro sempre visível,
  revelação com drama (som + animação), placar entre rodadas.
- **Prazos com folga:** os celulares veem o estado com até ~2 s de atraso;
  some 2 s de tolerância nos prazos de resposta.
- **Português do Brasil, com humor de Halloween.** Conteúdo próprio e
  original (palavras, locais, perguntas). Fatos do Quiz e da Mentira Macabra
  precisam ser verdadeiros e conhecidos — na dúvida, deixe de fora.
- **Testes obrigatórios (Vitest):** regras e pontuação, rodadas especiais,
  simulação de partidas inteiras com 3, 8 e 15 jogadores (várias sementes)
  terminando em `over`, cenário com gente offline e cenário com `skip`.

---

## Especificação dos jogos

### 1. 🕵️ Espião Assombrado — `espiao-assombrado` (3–15)

**Como jogar:** todo mundo sabe o lugar assombrado, menos o espião. Façam
perguntas uns aos outros sem entregar o lugar. Desconfiou? Acuse — a maioria
decide. O espião pode **digitar** o lugar a qualquer momento: acertou, ganhou.

- **Opções:** rodadas (3/5/7, padrão 5); tempo de conversa (5/7/9 min,
  padrão 7); rodadas malucas (sim/não, padrão sim).
- **Espiões:** 1 até 8 jogadores, 2 a partir de 9. Um não sabe do outro.
- **Fases:** `reveal` (10 s, cada um olha a carta: lugar + papel, ou "VOCÊ É O
  ESPIÃO") → `talk` (TV mostra quem começa perguntando e o tempo) →
  `accuse` (alguém acusou: todos menos o acusado votam SIM/NÃO, 30 s; passa
  com SIM > NÃO) → se não passou, volta a `talk` (cada um acusa uma vez por
  rodada) → `final_vote` quando o tempo acaba (todos apontam um suspeito; o
  mais votado, sem empate, é o acusado) → `last_chance` (espião pego tem 30 s
  para digitar o lugar) → `result` → `scores` → próxima rodada ou fim.
- **Chute digitado** (sem lista de lugares — são muitos): comparação
  tolerante (sem acento, sem maiúsculas, sem artigos, apelidos por lugar,
  até 1–2 letras erradas). Uma chance por espião por rodada. Errou = a mesa
  vence a rodada. Peça confirmação no celular ("só tem uma chance").
- **Pontos:** mesa vence → cada não-espião +1, e quem fez a acusação certeira
  +1 extra. Espiões vencem → cada espião +2; o que acertou o lugar +3.
- **Rodadas malucas** (a partir da 2ª, ~18% de chance, no máximo uma de cada
  por partida), impossíveis de perceber pelo celular ou pela TV antes do fim:
  - *Todo mundo é espião:* todos recebem "VOCÊ É O ESPIÃO". Qualquer acusação
    aprovada, chute ou votação final revela: "TODO MUNDO ERA ESPIÃO 🤡". Sem
    pontos — é para rir.
  - *Ninguém é espião:* todos recebem o lugar. Quem for condenado ganha +2
    ("inocente injustiçado"); se ninguém for condenado, +1 para todo mundo.
- **Conteúdo:** 40+ lugares assombrados/divertidos, cada um com 8+ papéis e
  apelidos aceitos no chute.
- **TV:** vela gigante como cronômetro, drama da acusação (acusador → acusado
  com barras de SIM/NÃO ao vivo), contagem da última chance, revelação com
  grito/risada, placar. Trilha `tension`.

### 2. 🔪 Cidade Dorme — `cidade-dorme` (5–15)

**Ninguém fecha o olho.** Toda noite, **todo mundo mexe no celular** ao mesmo
tempo — assim ninguém descobre quem é quem por quem está tocando a tela.

- **Papéis:** Assassino (1 com 5–7 jogadores, 2 com 8–11, 3 com 12–15; os
  assassinos se conhecem), Detetive (1), Anjo (1), Cidadãos (o resto).
- **Opções:** tempo de conversa de dia (2/3/4 min, padrão 3); revelar o papel
  de quem morre (sim/não, padrão sim).
- **Noite** (60 s, acaba antes se todos os vivos agirem). Toda tela de noite
  é igual — "Escolha alguém" + um campo opcional de recado — só o título muda:
  - Assassino: escolhe quem morre (vê ao vivo a escolha dos parceiros; vale a
    mais escolhida, empate sorteia).
  - Detetive: investiga alguém; de manhã recebe em segredo "É assassino" /
    "Não é assassino".
  - Anjo: protege alguém (pode ser ele mesmo; não repete a mesma pessoa duas
    noites seguidas).
  - Cidadão: **aposta** em quem é o assassino (vale pontos de "faro" no fim)
    e pode mandar um **recado anônimo para o assassino** ("me poupa 🙏",
    "mata o Pedro 😈").
  - Assassino também pode deixar um **bilhete anônimo para a cidade**, lido
    na TV de manhã.
  - Mortos viram fantasmas 👻 e podem "assombrar" alguém (só aparece na TV,
    sem efeito).
- **Manhã:** a TV narra com voz de terror quem morreu (ou "o anjo salvou
  alguém esta noite!"), o bilhete do assassino e quem foi assombrado. Os
  assassinos veem no celular os recados anônimos recebidos.
- **Dia:** conversa com cronômetro (host pode pular) → **votação** (45 s, no
  celular; votos aparecem na TV ao vivo). Sai quem tiver mais votos (mínimo
  2, sem empate); senão ninguém sai.
- **Vitória:** cidade vence quando todos os assassinos saem; assassinos vencem
  quando são tantos quanto os outros vivos.
- **Fim:** todos os papéis revelados, linha do tempo das noites, ranking de
  "melhor faro" (apostas certas dos cidadãos).
- **TV:** lua, neblina, "9/12 já agiram" (sem dizer quem é o quê), narração
  `speakSpooky`, trilhas `night`/`day`, ferroada sonora em cada morte.

### 3. 🎨 Retrato Assombrado — `retrato-assombrado` (3–15)

Dinâmica nova para o desenho de impostor: **todo mundo desenha ao mesmo tempo**
(nada de esperar 15 pessoas fazerem um traço cada), em duas etapas curtas com
uma espiadinha no meio — que é a chance do impostor copiar.

- **Opções:** rodadas (3/4/5, padrão 4); rodadas malucas (sim/não, padrão sim).
- **Impostores:** 1 até 8 jogadores, 2 a partir de 9 (não se conhecem). Todo
  mundo vê a **categoria**; só os não-impostores veem a **palavra**.
- **Fases:** `show` (8 s) → `draw1` (25 s, todos desenham no celular) →
  `peek` (10 s, a TV mostra todos os desenhos) → `draw2` (20 s, continua o
  mesmo desenho) → `gallery` (12 s) → `vote` (40 s, "quem é o impostor?") →
  `reveal` → se pegaram um impostor, `guess` (30 s, ele digita a palavra,
  comparação tolerante) → `result` → `scores`.
- **Pontos:** impostor escapou → +2 para cada impostor. Pegaram → +1 para
  quem votou num impostor; impostor pego que acerta a palavra → +2 para ele.
- **Rodadas malucas:** *todo mundo é impostor* (só categoria para todos;
  revela "TODO MUNDO ERA IMPOSTOR 🤡", sem pontos) e *ninguém é impostor*
  (todos com a palavra; o mais votado ganha +2 de consolação).
- **Desenho:** usa `games/ui/DrawingBoard` (coordenadas 0..1), paleta de 5–6
  cores e desfazer; traços enviados por `sendSlot('draw', ...)` ao levantar
  o dedo, com pontos reduzidos. Galeria na TV em grade de até 15 (5×3) com os
  nomes.
- **Conteúdo:** 8+ categorias de Halloween com 12+ palavras desenháveis cada.

### 4. 🤥 Mentira Macabra — `mentira-macabra` (3–15)

**Como jogar:** a TV mostra um fato verdadeiro e bizarro com uma lacuna. Todo
mundo inventa uma mentira para completar. Depois, ache a verdade no meio das
mentiras. Enganar os outros dá pontos.

- **Opções:** rodadas (4/6/8, padrão 6). Última rodada vale o dobro.
- **Fases:** `write` (45 s; se a mentira for igual à verdade, o celular recusa:
  "Isso é verdade! Invente outra") → `choose` (30 s; opções = mentiras únicas
  + a verdade, embaralhadas; não dá para escolher a própria) → `reveal` (a TV
  revela mentira por mentira — quem caiu, de quem era — e por último a
  verdade) → `scores`.
- **Pontos:** achou a verdade +2; cada pessoa que caiu na sua mentira +1
  (dobro na última rodada). Mentiras iguais dividem o crédito.
- **Conteúdo:** 40+ fatos verdadeiros e conhecidos (Halloween, folclore,
  filmes de terror, história esquisita), resposta curta (1–3 palavras) e
  variações aceitas.

### 5. 💬 Resposta do Além — `resposta-do-alem` (3–15)

**Como jogar:** a TV mostra uma frase para completar. Todo mundo escreve a
resposta mais engraçada. Depois, vote na melhor — sem saber de quem é.

- **Opções:** rodadas (3/5/7, padrão 5).
- **Fases:** `write` (60 s, até 60 caracteres) → `vote` (40 s; respostas
  anônimas, não dá para votar na própria) → `reveal` (autores e votos) →
  `scores`.
- **Pontos:** +1 por voto recebido; +2 para a resposta mais votada da rodada
  (empate divide).
- **Conteúdo:** 50+ frases engraçadas de Halloween/festa, humor leve.
- **TV:** a voz de terror lê a frase; respostas em grade; revelação com nomes.

### 6. ⚰️ Quem Morre Primeiro? — `quem-morre-primeiro` (3–15)

**Como jogar:** a TV pergunta "quem da galera...?" no estilo filme de terror.
Todo mundo vota em alguém. O mais votado ganha uma lápide. Votou com a
maioria? Ponto para você.

- **Opções:** rodadas (6/8/10, padrão 8).
- **Fases:** `vote` (25 s; pode votar em qualquer um, inclusive em si) →
  `reveal` (ranking em barras; o mais votado ganha lápide "AQUI JAZ..." com
  epitáfio engraçado; grito) → `scores`.
- **Pontos:** +1 para quem votou no mais votado (empate: qualquer um dos
  empatados vale).
- **Fim:** "quem morreu mais vezes" e "vidente da noite" (mais pontos).
- **Conteúdo:** 40+ perguntas de clichês de terror ("quem iria investigar o
  barulho no porão?", "quem seria o assassino mascarado?").

### 7. 🎃 Abóbora-Bomba — `abobora-bomba` (2–15)

Conserto do Bomba-Relógio: o povo passava sem falar. Agora **cada um tem o
próprio pavio**, que só queima enquanto a abóbora está na sua mão — passou,
o seu pausa e o do próximo volta a queimar. Ficar parado sem falar só
queima o seu tempo.

- **Como jogar:** a TV mostra um tema. Com a abóbora na mão, fale uma palavra
  do tema e **segure o botão** para passar. Seu pavio só queima com a abóbora
  na sua mão. Acabou o pavio, BUM: você perde uma vida.
- **Opções:** pavio (10/15/20 s; padrão automático: 15 s até 6 pessoas, 12 s
  até 10, 10 s com mais); vidas (1/2/3, padrão 2); modo (falar/digitar,
  padrão falar — no "digitar", é preciso escrever uma palavra nova do tema
  para passar, e ela aparece na TV).
- **Passar:** botão "SEGURE PARA PASSAR" (1,2 s apertado — tempo de falar a
  palavra). O motor ignora passe que chega menos de 1 s depois de a abóbora
  chegar. Vai para o próximo vivo na ordem da mesa.
- **Justiça com o atraso da rede:** o pavio de quem recebe só começa a
  queimar 1,5 s depois do passe; o passe vale pelo horário do toque (`at`
  no input, limitado ao intervalo válido).
- **BUM:** explosão + susto na TV, quem estava com a abóbora perde 1 vida
  (0 vidas = fantasma). Nova rodada com tema novo, pavios recarregados,
  começando pelo próximo vivo.
- **Fim:** sobrou um vivo, ou 12 rodadas (vence quem tem mais vidas, depois
  mais pavio sobrando).
- **TV:** mesa em círculo com a abóbora pulando de nome em nome, uma vela-pavio
  embaixo de cada nome, tique-taque acelerando quando o pavio de quem segura
  passa de 5 s. Trilha `chase`. Celular de quem segura: tela laranja, tema,
  pavio gigante e o botão; o celular pode pedir poll mais rápido
  (`phonePollMs` ~700).
- **Conteúdo:** 40+ temas (metade de Halloween, metade geral e fácil).

### 8. 🚪 Portas do Além — `portas-do-alem` (2–15)

**Como jogar:** escolha uma porta em segredo. O monstro está atrás de uma
delas. Quem escolheu a porta do monstro vira fantasma — e os fantasmas
decidem onde o monstro ataca na rodada seguinte. Último vivo vence.

- **Portas:** 3 (até 4 vivos), 4 (até 8), 5 (9 ou mais). **Dois monstros**
  quando há 10+ vivos.
- **Fases:** `choose` (15 s; vivos escolhem porta; fantasmas votam a porta do
  monstro — mais votada, empate sorteia; sem fantasmas, sorteio; quem não
  escolheu cai numa porta aleatória) → `reveal` (portas abrem uma a uma na TV,
  a do monstro por último, com susto) → `status` (6 s) → próxima rodada.
- **Salvação:** se TODOS os vivos estiverem atrás de porta com monstro,
  ninguém morre ("o monstro tropeçou!").
- **Fim:** um vivo (ou empate dos últimos). Prêmio extra: "fantasma mais
  vingativo" (quem mais acertou como fantasma).
- **TV:** corredor com portas grandes, rangidos, monstro com `triggerScare`.
  Trilha `tension`. Celular: portas grandes; fantasma vê "escolha onde o
  monstro ataca".

### 9. 🧠 Quiz do Terror — `quiz-do-terror` (1–15)

- **Opções:** perguntas (8/10/15, padrão 10); tempo (15/20 s, padrão 20).
- **Fases:** `question` (4 alternativas coloridas no celular; acaba quando
  todos responderem ou no prazo) → `reveal` (6 s: certa, barras de quem
  escolheu o quê) → `scores` a cada 3 perguntas → pódio no fim.
- **Pontos:** acerto = 500 + até 500 pela rapidez; sequência de acertos dá
  +100 por acerto seguido (máx. +300).
- **Conteúdo:** 60+ perguntas verdadeiras e conhecidas: filmes de terror,
  monstros clássicos, folclore brasileiro, origens do Halloween.

### 10. 🧹 Corrida de Vassouras — `corrida-de-vassouras` (2–15)

**Como jogar:** cinco bruxas apostam corrida na TV. A cada etapa, aposte em
quem vai estar na frente e jogue uma maldição numa rival. Os dados decidem o
resto. Mais doces no fim vence.

- **Bruxas:** cinco, com nomes e cores próprios (folclore e nomes
  inventados — a Cuca é bem-vinda).
- **Fases:** na 1ª etapa, todos também apostam em quem **vence a corrida**.
  `bet` (20 s: aposta da etapa + maldição opcional) → `race` (TV: cada bruxa
  anda 1–3 casas em ordem sorteada; a bruxa mais amaldiçoada — 2+ maldições,
  sem empate — cai da vassoura e volta 2 casas) → `payout` (8 s) → próxima
  etapa até alguém cruzar a chegada (pista de 16 casas).
- **Pontos (doces 🍬):** líder da etapa paga 3, segunda paga 1; aposta certa na
  vencedora da corrida paga 5.
- **TV:** pista com as bruxas nas vassouras, dados rolando, caldeirão de
  doces. Trilha `race`.
