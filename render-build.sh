#!/usr/bin/env bash
set -o errexit

# Build script for Render
cd /app
pip install --no-cache-dir -r requirements.txt
python manage.py collectstatic --noinput
