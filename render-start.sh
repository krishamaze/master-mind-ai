#!/usr/bin/env bash
set -o errexit

cd /app
exec uvicorn backend-v2.app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
