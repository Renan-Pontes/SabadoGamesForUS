#!/usr/bin/env bash
set -euo pipefail

# DANGER: This script deletes the SQLite database before deploying.

APP_DIR="${APP_DIR:-$HOME/SabadoGamesForUS/backend}"
DB_PATH="${DB_PATH:-$APP_DIR/db.sqlite3}"
VENV_PATH="${VENV_PATH:-}"
USERNAME="${PYTHONANYWHERE_USERNAME:-Nghetsis}"
HOSTNAME="$(printf '%s' "$USERNAME" | tr 'A-Z' 'a-z')"

if [ ! -d "$APP_DIR" ]; then
  echo "APP_DIR not found: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

if [ -n "$VENV_PATH" ]; then
  # shellcheck disable=SC1090
  . "$VENV_PATH/bin/activate"
fi

if [ -f "$DB_PATH" ]; then
  echo "Removing database: $DB_PATH"
  rm -f "$DB_PATH"
fi

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_games

if command -v pa_reload_webapp >/dev/null 2>&1; then
  pa_reload_webapp "$HOSTNAME"
else
  echo "Reload the web app in the PythonAnywhere dashboard."
fi

echo "Backend ready. Access: https://${HOSTNAME}.pythonanywhere.com"
