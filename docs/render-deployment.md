# Deploying Master Mind AI to Render

This guide explains how to deploy the Master Mind AI backend to [Render](https://render.com).

## Prerequisites
- Render account with access to Docker services
- GitHub repository connected to Render
- Mem0 API key

## Setup Steps
1. **Create a PostgreSQL database** using Render's dashboard. Enable the `pgvector` extension.
2. **Create a new Web Service** and select "Deploy from a Git repository".
3. **Specify the root directory** containing the `Dockerfile` and `render.yaml`.
4. **Set the Build Command** to `./render-build.sh` and the Start Command to `./render-start.sh`.
   The build script only collects static files because dependencies are baked into the Docker image.
5. **Add a Pre-deploy Command** of `./render-predeploy.sh` to run migrations before each deploy.
6. **Configure environment variables** as described in `.env.render.example` using the Render dashboard. Render will inject `DATABASE_URL` automatically.
7. **Trigger the first deploy**. Render will build the image, run migrations, and start the service.

## Environment Variables
Refer to `.env.render.example` for required variables. At minimum, set:
- `SECRET_KEY`
- `MEM0_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `MEM0_API_BASE_URL`
- `MEM0_PROVIDER`
- `MEM0_EMBEDDING_DIM`
- `MEM0_INDEX_METHOD`
- `ENVIRONMENT`

## Database Initialization
Render executes the `pgvector` extension automatically as defined in `render.yaml`. If you need to run additional SQL setup, use the [Render shell](https://render.com/docs/deploys#manual-deploys) or add commands to `render-predeploy.sh`.

## Health Checks
Render's health check pings the root path (`/`). The included `health` view verifies database connectivity and returns `{ "status": "ok" }` when the service is running.

## Troubleshooting
- **Image fails to build**: Ensure dependencies in `backend/requirements.txt` are pinned and the Docker cache is not stale.
- **Database errors**: Verify `DATABASE_URL` is correctly populated and the `pgvector` extension is installed.
- **Static files missing**: Check logs to confirm `render-build.sh` ran and `collectstatic` succeeded.

## Scaling
`render.yaml` defaults to the free instance type. Adjust the `plan` or scaling options in `render.yaml` for higher tiers.
