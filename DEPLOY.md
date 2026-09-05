# Deploy

O projeto tem duas metades hospedadas em lugares diferentes:

| Parte | Onde | Domínio |
|---|---|---|
| Frontend (React/Vite) | Vercel | `sabadogames.app` |
| Backend (Django/DRF) | PythonAnywhere | `api.sabadogames.app` |

---

## Frontend — Vercel

Deploy automático a cada push na `main`. Não precisa fazer nada além do commit.

O `frontend/vercel.json` reescreve todas as rotas para `/` — sem isso, abrir
`sabadogames.app/lobby` direto no navegador daria 404, porque o roteamento é
do React e não do servidor.

A URL da API vem de `VITE_API_URL`, com `https://api.sabadogames.app` como
padrão em [frontend/src/lib/api.ts](frontend/src/lib/api.ts). Só configure a
variável na Vercel se for apontar para outro backend.

---

## Backend — PythonAnywhere

**Conta:** `RenanPontes` · **Webapp:** `api.sabadogames.app` · **Python 3.13**
**Código:** `/home/RenanPontes/SabadoGamesAPI` · **sem virtualenv** (usa
`pip install --user`)

### Deploy normal

Abra um console Bash no PythonAnywhere e rode:

```bash
cd ~/SabadoGamesAPI
bash scripts/pythonanywhere_deploy.sh
```

O script instala dependências, aplica migrações, coleta estáticos, semeia o
catálogo de jogos e recarrega o webapp. É idempotente — pode rodar quantas
vezes quiser.

> O script **não apaga o banco**. A versão antiga apagava, o que zerava todas
> as contas a cada deploy.

### Configuração

As variáveis de produção ficam em `/home/RenanPontes/SabadoGamesAPI/.env`, que
**não está no git**. Use [backend/.env.example](backend/.env.example) como
modelo. O arquivo é lido pelo WSGI em `/var/www/api_sabadogames_app_wsgi.py`
antes do Django subir — o PythonAnywhere não tem painel de variáveis de
ambiente para webapps.

Para gerar uma `SECRET_KEY` nova:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Conta de administrador

Os 17 jogos entram pelo `seed_games` — **não é preciso admin para tê-los**. A
conta de administrador serve para o painel do Django: ver salas em andamento,
inspecionar jogadores, desativar um jogo do catálogo.

Num console Bash do PythonAnywhere:

```bash
cd ~/SabadoGamesAPI
set -a && . ./.env && set +a
python3.13 manage.py ensure_admin --email voce@exemplo.com --nickname SeuApelido
```

Ele pede a senha no prompt (nada fica no histórico do shell) e cria o
superusuário junto com o `Profile` — o `createsuperuser` do Django cria só o
usuário, e aí a conta aparece na mesa como o e-mail inteiro em vez do apelido.

O comando é idempotente: rodar de novo só redefine a senha. Para automatizar,
a senha também pode vir de `DJANGO_SUPERUSER_PASSWORD`.

### HTTPS

O certificado precisa ser criado **pelo painel**, uma vez só:

1. Web tab → `api.sabadogames.app` → seção **Security**
2. Em *HTTPS certificate*, clique em **Auto-renewal Let's Encrypt certificate**
3. Espere alguns minutos e ligue **Force HTTPS**
4. Recarregue o webapp

Enquanto não houver certificado, o navegador recusa `https://api.sabadogames.app`
e o frontend (que é HTTPS) não consegue chamar a API — conteúdo misto é
bloqueado.

### O que não fazer

- **Não rode `seed_dev_users` em produção.** Ele cria contas com senha
  conhecida e se recusa a rodar com `DEBUG` desligado, mas não force com
  `--force`.
- **Não versione `db.sqlite3`.** Ele já saiu do índice do git; se voltar, um
  deploy sobrescreveria o banco de produção com o de desenvolvimento.

---

## Conferindo se subiu

```bash
curl https://api.sabadogames.app/api/games/
```

Deve listar os 17 jogos. Se der 500, o erro está em
`/var/log/api.sabadogames.app.error.log`, acessível pela aba Files.
