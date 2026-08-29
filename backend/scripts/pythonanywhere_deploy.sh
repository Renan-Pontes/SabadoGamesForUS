#!/usr/bin/env bash
#
# Deploy do backend no PythonAnywhere.
#
# Roda dentro de um console Bash do PythonAnywhere. É idempotente: pode
# rodar quantas vezes quiser. NÃO apaga o banco — a versão anterior deste
# script apagava, o que zerava as contas a cada deploy.
#
#   bash ~/SabadoGamesAPI/scripts/pythonanywhere_deploy.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/SabadoGamesAPI}"
PYTHON_BIN="${PYTHON_BIN:-python3.13}"
DOMAIN="${PA_DOMAIN:-api.sabadogames.app}"

if [ ! -f "$APP_DIR/manage.py" ]; then
  echo "manage.py não encontrado em $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

echo "==> Dependências"
# --user porque este webapp roda no Python do sistema, sem virtualenv.
"$PYTHON_BIN" -m pip install --user --upgrade pip
"$PYTHON_BIN" -m pip install --user -r requirements.txt

echo "==> Variáveis de ambiente"
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  set +a
  echo "    .env carregado"
else
  echo "    AVISO: .env não encontrado — as configurações de produção virão dos padrões." >&2
fi

echo "==> Migrações"
"$PYTHON_BIN" manage.py migrate --noinput

echo "==> Arquivos estáticos"
"$PYTHON_BIN" manage.py collectstatic --noinput

echo "==> Catálogo de jogos"
"$PYTHON_BIN" manage.py seed_games

echo "==> Verificação de produção"
"$PYTHON_BIN" manage.py check --deploy || true

echo "==> Recarregando o webapp"
if command -v pa_reload_webapp.py >/dev/null 2>&1; then
  pa_reload_webapp.py "$DOMAIN"
elif command -v pa >/dev/null 2>&1; then
  pa website reload --domain "$DOMAIN" || touch "/var/www/${DOMAIN//./_}_wsgi.py"
else
  # O toque no arquivo WSGI é o que o próprio painel faz ao recarregar.
  touch "/var/www/${DOMAIN//./_}_wsgi.py"
fi

echo
echo "Pronto: https://${DOMAIN}/api/games/"
