# Deploy

O projeto tem duas metades hospedadas em lugares diferentes:

| Parte | Onde | Domínio |
|---|---|---|
| Frontend (React/Vite) | Vercel | `sabadogames.app` |
| Backend (Django/DRF) | PythonAnywhere (conta `SabadoGames`) | `sabadogames.pythonanywhere.com` |

> Até out/2026 o backend ficava na conta `RenanPontes`, em `api.sabadogames.app`.
> Aquela conta caiu; a conta nova é gratuita, e conta gratuita não aceita
> domínio próprio — por isso a API agora atende no subdomínio do PythonAnywhere.
> As contas de jogador do banco antigo não vieram junto.

---

## Frontend — Vercel

Deploy automático a cada push na `main`. Não precisa fazer nada além do commit.

O `frontend/vercel.json` reescreve todas as rotas para `/` — sem isso, abrir
`sabadogames.app/lobby` direto no navegador daria 404, porque o roteamento é
do React e não do servidor.

A URL da API vem de `VITE_API_URL`, com `https://sabadogames.pythonanywhere.com`
como padrão em [frontend/src/lib/api.ts](frontend/src/lib/api.ts). Só configure a
variável na Vercel se for apontar para outro backend.

---

## Backend — PythonAnywhere

**Conta:** `SabadoGames` (gratuita) · **Webapp:** `sabadogames.pythonanywhere.com`
· **Python 3.13** · **sem virtualenv** (usa `pip install --user`)
**Código:** clone do repositório em `/home/SabadoGames/SabadoGamesForUS`; o
Django roda de `.../SabadoGamesForUS/backend`.

### Deploy normal

Abra um console Bash no PythonAnywhere e rode:

```bash
bash ~/SabadoGamesForUS/backend/scripts/pythonanywhere_deploy.sh
```

O script puxa a `main`, instala dependências, aplica migrações, coleta
estáticos, semeia o catálogo de jogos e recarrega o webapp. É idempotente —
pode rodar quantas vezes quiser. Para publicar outra branch:
`DEPLOY_BRANCH=minha-branch bash ...`.

> O script **não apaga o banco**. Uma versão antiga apagava, o que zerava todas
> as contas a cada deploy.

### Configuração

As variáveis de produção ficam em `/home/SabadoGames/SabadoGamesForUS/backend/.env`,
que **não está no git**. Use [backend/.env.example](backend/.env.example) como
modelo. O arquivo é lido pelo WSGI em
`/var/www/sabadogames_pythonanywhere_com_wsgi.py` antes do Django subir — o
PythonAnywhere não tem painel de variáveis de ambiente para webapps.

O mapeamento de estáticos do webapp é `/static/` →
`/home/SabadoGames/SabadoGamesForUS/backend/staticfiles`, e o *Force HTTPS*
está ligado (o subdomínio `*.pythonanywhere.com` já vem com certificado).

Para gerar uma `SECRET_KEY` nova:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Limites da conta gratuita

- **CPU de console:** 100 segundos por dia. `pip install` e migrações gastam
  daí; rode a suíte de testes na sua máquina, não no console.
- **Webapp:** um só, sem domínio próprio, e precisa ser renovado a cada três
  meses no painel (botão *Run until 3 months from today*).

### Conta de administrador

Os jogos entram pelo `seed_games` — **não é preciso admin para tê-los**. A
conta de administrador serve para o painel do Django: ver salas em andamento,
inspecionar jogadores, desativar um jogo do catálogo.

Num console Bash do PythonAnywhere:

```bash
cd ~/SabadoGamesForUS/backend
set -a && . ./.env && set +a
python3.13 manage.py ensure_admin --email voce@exemplo.com --nickname SeuApelido
```

Ele pede a senha no prompt (nada fica no histórico do shell) e cria o
superusuário junto com o `Profile` — o `createsuperuser` do Django cria só o
usuário, e aí a conta aparece na mesa como o e-mail inteiro em vez do apelido.

O comando é idempotente: rodar de novo só redefine a senha. Para automatizar,
a senha também pode vir de `DJANGO_SUPERUSER_PASSWORD`.

### O que não fazer

- **Não rode `seed_dev_users` em produção.** Ele cria contas com senha
  conhecida e se recusa a rodar com `DEBUG` desligado, mas não force com
  `--force`.
- **Não versione `db.sqlite3`.** Ele já saiu do índice do git; se voltar, um
  deploy sobrescreveria o banco de produção com o de desenvolvimento.

---

## Conferindo se subiu

```bash
curl https://sabadogames.pythonanywhere.com/api/games/
```

Deve listar os jogos. Se der 500, o erro está em
`/var/log/sabadogames.pythonanywhere.com.error.log`, acessível pela aba Files.
