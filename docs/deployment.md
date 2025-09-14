# Deployment Guide

## Docker
- Build and run: `docker-compose up --build`
- Services: Django backend and PostgreSQL.

## Environment
- Configure `MEM0_API_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL`, and `SUPABASE_KEY` before running.
- Copy `env.example` to `.env` and populate values. The `.env` file is git-ignored; use platform secrets for production.

## Security Best Practices
- Rotate secrets regularly.
- Limit database network exposure.
- Enable HTTPS when deploying behind a proxy.

## Troubleshooting
- Check container logs with `docker-compose logs`.
- Run `deployment/healthcheck.sh` to verify service availability.
