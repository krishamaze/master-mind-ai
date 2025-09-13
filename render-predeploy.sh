#!/usr/bin/env bash
set -o errexit

# Pre-deploy script for Render
cd /app
python manage.py migrate --noinput
