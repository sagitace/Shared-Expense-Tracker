#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

stashed=0
if [[ -n "$(git status --porcelain)" ]]; then
    echo "==> Stashing local changes"
    git stash
    stashed=1
fi

echo "==> Pulling latest changes"
git pull --ff-only

if [[ "$stashed" -eq 1 ]]; then
    echo "==> Restoring stashed changes"
    git stash pop
fi

echo "==> Installing backend dependencies"
backend/.venv/bin/pip install -r backend/requirements.txt

echo "==> Running database migrations"
backend/.venv/bin/python backend/manage.py migrate --noinput

echo "==> Collecting static files"
backend/.venv/bin/python backend/manage.py collectstatic --noinput

echo "==> Building frontend"
(cd frontend && npm install && npm run build)

echo "==> Restarting services"
sudo systemctl restart gunicorn celery
sudo nginx -t
sudo systemctl reload nginx

echo "==> Done. Service status:"
systemctl is-active gunicorn celery nginx
