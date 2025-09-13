#!/usr/bin/env bash
set -o errexit

# Start script for Render
cd /app
gunicorn mastermind.wsgi:application --bind 0.0.0.0:${PORT:-8000}
