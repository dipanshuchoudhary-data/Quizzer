#!/usr/bin/env bash
set -euo pipefail

alembic upgrade head

exec gunicorn backend.main:app \
  -w "${WEB_CONCURRENCY:-2}" \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}"
