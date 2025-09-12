# Deployment Guide

## Docker
- Build and run: `docker-compose up --build`
- Services: Django backend and PostgreSQL.

## Environment
- Set `MEM0_API_KEY` and `SUPABASE_DB_URL` before running.
- Use `.env` files or platform secrets, never commit keys.

## Security Best Practices
- Rotate secrets regularly.
- Limit database network exposure.
- Enable HTTPS when deploying behind a proxy.

## Troubleshooting
- Check container logs with `docker-compose logs`.
- Run `deployment/healthcheck.sh` to verify service availability.
