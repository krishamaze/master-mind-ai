#!/usr/bin/env bash
set -o errexit

# No migrations required for the FastAPI service
echo "Render predeploy: no-op for backend-v2"
