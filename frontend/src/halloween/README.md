# Noite do Terror — como escrever um jogo

A TV é o juiz: o **motor** do jogo roda no navegador da TV (ou no celular do
host, se a TV sumir), lê as respostas que os celulares gravaram e devolve o
estado novo da partida. O backend só guarda JSON. Você escreve **uma pasta**;
o framework cuida de poll, relógio, contrato de juiz, configuração, espectador,
fim de partida e controles do host.

O jogo de referência, completo e comentado, é
[`games/quem-morre-primeiro/`](games/quem-morre-primeiro/). Copie dele.

## A pasta `games/<slug>/`

| Arquivo | O que tem |
|---|---|
| `meta.ts` | nome, ícone, tagline, pitch, `howTo` (3–5 passos, ≤ ~14 palavras), duração, vibe, min/max, cores (`accent`), `options`, `music`, `phonePollMs?` |
| `engine.ts` | o tipo do estado (`S extends BaseState`) e `engine = { init, step, bot }` |
| `content.ts` | perguntas, palavras, lugares… (conteúdo original, em pt-BR) |
| `Tv.tsx` | `export default` — só desenha o estado, letras para 3 metros |
| `Phone.tsx` | `export default` — uma ação clara por tela, 360 px |
| `index.ts` | `defineHalloweenGame<S>({ meta, engine, Tv, Phone })` com `lazy()` (já pronto) |
| `engine.test.ts` | regras, pontuação e simulações (obrigatório) |

`registry.ts` e `catalog.ts` já importam as dez pastas — não precisa mexer.

## O contrato (`engine/types.ts`)

```ts
init(ctx): S                  // o host apertou "Começar"
step(state, ctx): S           // puro, idempotente; devolve o MESMO objeto se nada mudou
bot(state, playerId, ctx)     // resposta plausível (só para testes/simulação)
```

`ctx` traz `players` (ordem de entrada, com `online`), `inputs`, `slots`,
`command` (comando do host ainda não visto — chega **uma vez só**), `now`
(ms do servidor), `rng` (use sempre este) e `options` (as do meta, já
validadas). O estado precisa ter `phase`, `inputKey`, `deadline` (número ou
`null`, nunca `undefined`), `roster` e `over`.

- **`roster`**: quem joga, fixo desde o `init` (`onlineRoster(ctx)`). Quem
  entra depois vê "Partida rolando — você entra na próxima".
- **`acted`**: quem já respondeu (a TV mostra ✓). Atualize com
  `refreshActed(state, ctx)`, que devolve o mesmo objeto se nada mudou.
- **`scores`**: `{ [id]: pontos }` (`emptyScores`, `addScores`, `ranking`).
- **`private`**: `{ [id]: segredo }`. Só o dono recebe, pela prop `mine`. A
  TV e o `state` das telas chegam **sem** `private`.
- Estado é JSON: nada de `Map`, `Set`, `Date`, `NaN` ou `undefined` em lista.

## Respostas e `inputKey`

O celular chama `send({ vote: 12 })` e o framework grava
`{ k: state.inputKey, vote: 12 }`. No motor, leia com
`inputFor(ctx, state.inputKey, id)` — resposta com outro `k` é de outra fase e
não vale. **Mude o `inputKey` a cada rodada de respostas** (`vote-3`,
`guess-2-7`…): uma resposta por chave. Precisa de várias respostas na mesma
fase (passar a abóbora)? Mude a chave a cada uma.

`sendSlot('draw', {...})` grava num slot que não some na troca de fase; leia
com `slotFor(ctx, 'draw', id, chavesAceitas)`. A TV recebe os slots de todo
mundo na prop `slots`.

Respostas de outra partida (mesma chave, "Jogar de novo") são descartadas pelo
framework — não precisa se preocupar.

## Prazos

- Fase de resposta: `deadline: answerDeadline(ctx.now, 25)` (25 s + 2 s de
  folga). Na tela, mostre `useCountdown(state.deadline, now, GRACE_MS)`: o
  relógio zera na hora prometida e quem respondeu em cima do laço conta.
- Fase sem resposta (revelação, placar): `deadlineIn(ctx.now, 8)`.
- Avançar: `if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster))`.
  `timeUp` já trata o **"⏭ Pular" do host** (`skip`) como prazo vencido.
- Toda fase tem prazo; offline nunca segura a fase; o host nunca é obrigatório.

## Comandos do host

O framework trata `begin` (configuração → `init`), `replay` (fim → nova
configuração, mesmas opções) e `end` (`over = true`, sem chamar o motor). O
resto chega em `ctx.command` (o `skip` vem de graça pela barra do host). Comando
próprio: `command('reveal-now')` no celular do host → `ctx.command?.type`.

## Telas

`Tv` e `Phone` recebem `HalloweenViewProps<S>`: `state` (sem `private`),
`players`, `me` (null na TV), `isHost`, `myInput` (minha resposta da fase, já
otimista), `mine`, `now()`, `send`, `sendSlot`, `command`, `slots` (TV: de
todos; celular: só os meus) e `options`. O `Phone` só aparece para quem está
no `roster` — quem entrou no meio vê "Partida rolando" (o framework cuida).

- Redesenhar com o tempo: `useServerNow(now)` / `useCountdown(...)` de
  `framework/clockHooks`.
- **Kit visual** (`../../ui`): `CandleTimer` (vela-cronômetro: `deadline`,
  `total`, `now`), `Tombstone`, `PlayerBadge` (nome + ✓ + 👻; `size="lg"` na
  TV), `BigReveal` (revelação em tela cheia, já segura os sustos), `DoorSvg`,
  `PumpkinSvg`, `Cauldron`, `CandyRain`, `SpiderSvg`, `HauntedTitle`,
  `SPOOKY_COLORS`. Use o kit em vez de recriar (a lápide do QMP é própria só
  porque ele nasceu antes do kit). Cada arquivo do kit traz um exemplo de uso.
- **Som** (`../../audio`), só na TV: `playSfx(nome, { volume, delay })`
  devolve a duração em segundos — encadeie com
  `const d = playSfx('drumroll'); playSfx('scream', { delay: d })`.
  `speakSpooky(texto)` narra com voz grave (devolve o cancelador). Toque num
  `useEffect` com a chave `${round}-${phase}` — uma vez por momento, nunca a
  cada poll.
- **Música**: vem do `meta.music` (sem trilha, a TV fica no `'lobby'`; no
  fim, `'victory'`). Para trocar por fase, chame `useMusic('night')` dentro da
  `Tv` — o pedido do jogo vence o da moldura.
- **Sustos** (`../../scare`), só na TV: `triggerScare('pumpkin')`,
  `triggerScare('zoom', { name })`; `useSuppressScares(phase === 'reveal')`
  segura os aleatórios nos momentos importantes. Os nomes da mesa (para o zoom
  e os olhos) a tela do jogo já informa.
- **A tela só desenha.** Quem decide fase, pontos e vencedor é o motor.
- O fim (`state.over`) é desenhado pelo seu jogo; o framework põe "Jogar de
  novo" e "Voltar à sala" no celular do host. O "⏹ Encerrar" do host põe
  `over = true` **em qualquer fase** (sem chamar o motor): teste `over`
  antes da fase — `if (state.over) return <Fim />` — senão a TV desenha a
  votação e o fim juntos.
- **Rodapé do celular é do framework**: a barra do host (Pular / Encerrar /
  Susto) fica fixa embaixo e o botão de som ocupa o canto inferior esquerdo
  (38 px). Nada de botão fixo no rodapé do `Phone`.
- Nomes: `nameOf(players, id)` e `listNames([...])` ("Ana, Bia e Caio").

## Testes (`engine/testkit.ts`)

```ts
const result = runSimulation(engine, { players: 15, seed: 3, options: { rounds: 6 } })
expect(result.state.over).toBe(true)
```

`runSimulation` joga a partida só com o `bot` (cada bot responde uma vez por
`inputKey`; `{ _slot: 'draw', ... }` vai para o slot), passa o estado por JSON
e avança o relógio. Falha com mensagem clara se `init`/`step`/`bot` lançar,
se `step` não for idempotente (repetir o mesmo ctx muda algo ou devolve objeto
novo), se o `roster` mudar ou se não chegar em `over`. Opções:
`offlineIds`, `actProbability`, `skipProbability`, `maxSteps`, `stepMs`.

Obrigatório (HALLOWEEN.md): regras e pontuação, rodadas especiais,
simulações com 3, 8 e 15 jogadores em várias sementes, gente offline e `skip`.
`registry.test.ts` também roda todo motor registrado — se o seu travar, ele
acusa. Rode: `npx vitest run src/halloween`.

Telas também têm teste de fumaça: `renderAllPhases({ engine, Tv, Phone },
{ players, seed, options })` (`engine/renderSmoke.ts`) joga uma partida
simulada e desenha a TV e cada celular em cada momento (antes e depois de
responder). Copie `games/quem-morre-primeiro/render.test.ts` para a sua pasta.

O jogo só aparece no catálogo quando o slug sai de `HALLOWEEN_WIP`
(`slugs.ts`) — isso é feito na integração/deploy, não pela pasta do jogo.

## Armadilhas

1. **Idempotência**: `step` roda a cada poll e a cada 400 ms. Sem mudança,
   devolva o próprio `state` (nada de `{ ...state }` "por garantia").
2. **Nada de `Date.now()`/`Math.random()` no motor** — use `ctx.now`/`ctx.rng`.
3. **Offline**: use `allOnlineActed`; nunca espere todo o roster.
4. **Folga de 2 s** nas fases de resposta (`answerDeadline`).
5. **Nunca mostre segredo na TV** — ponha no `private` e revele copiando
   para um campo público só na hora da revelação.
6. **Alvo de voto** precisa estar no `roster` (confira no motor).
7. Placeholders: as nove pastas usam `engine/placeholder.ts` e
   `framework/Placeholder.tsx`; troque `engine.ts`, `Tv.tsx` e `Phone.tsx`
   inteiros.
8. **`engine.ts` exporta `engine` e `type State`** — o `index.ts` (pronto)
   importa esses dois nomes, e as telas são `export default` em `Tv.tsx` e
   `Phone.tsx`. Troque o conteúdo, não os nomes.
9. **TypeScript do projeto**: `erasableSyntaxOnly` (nada de `enum`,
   `namespace` ou parâmetro com modificador no construtor) e
   `verbatimModuleSyntax` (tipo se importa com `import type` / `type X`).
   `Tv.tsx` e `Phone.tsx` exportam só o componente; constantes e funções
   auxiliares vão para outro arquivo (regra do react-refresh no eslint).
10. **`room.state` vai inteiro para todos os celulares a cada mudança** (o
    `mine=1` só corta o `player.state` dos outros): mantenha `g` enxuto — só
    o texto da pergunta da vez, nunca o conteúdo inteiro. Desenhos e listas
    grandes moram nos slots (`sendSlot`), que só a TV recebe; reduza os
    pontos dos traços.
11. **`private` não é cofre**: some da tela, mas viaja no JSON para todos
    (quem abrir o DevTools espia — combinado no plano). Mesmo assim, segredo
    nunca vai para campo público antes da revelação.
12. **O juiz pode ser o celular do host** (se a TV sumir): o motor roda em
    celular também — nada de laço pesado a cada passo.
13. **Comando desconhecido** em `ctx.command` (ou `skip` fora de hora): o
    motor ignora e devolve o mesmo estado.
14. **A resposta pode mudar**: `send` de novo na mesma fase substitui a
    anterior (vale a última que chegou ao juiz); o `bot` dos testes responde
    uma vez só por `inputKey`.
15. **Não importe `registry.ts` nem `catalog.ts`** de dentro do jogo (ciclo de
    import). Use só `../../engine`, `../../framework/clockHooks`,
    `../../audio`, `../../scare`, `../../ui`, peças avulsas do app (ex.:
    `../../../games/ui/DrawingBoard`, importado pelo arquivo, não pelo
    `index`) e os arquivos da sua pasta.

## Antes de entregar

```bash
cd frontend
npx vitest run src/halloween            # seus testes + registry.test (simula todo motor)
npx tsc -b                              # o projeto inteiro
npx eslint src/halloween/games/<slug>
# Opcional, com o Django local no ar (HALLOWEEN.md, Etapa 4):
HALLOWEEN_E2E_API=http://127.0.0.1:8765 npx vitest run src/halloween/e2e
```

`e2e/` mostra uma partida inteira passando pelo backend de verdade (15
convidados, TV-juíza anônima, celulares gravando por POST `state/`) — bom
para entender o caminho de uma resposta até a TV.
