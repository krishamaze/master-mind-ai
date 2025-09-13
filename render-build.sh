#!/usr/bin/env bash
set -o errexit

# Build script for Render
# Dependencies are installed during the Docker build stage, so this script
# only needs to collect static assets.
cd /app
python manage.py collectstatic --noinput
