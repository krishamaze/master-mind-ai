# Current State Report (Phase 1 - Task 1.1)

The following inventory captures the present-day implementation status for the highest-priority runtime files.
Each entry follows the requested template and flags misalignments with the documented architecture.

## Backend Services

### File name : backend-v2/app/services/memory.py
Status: ACCURATE
Key Info:
- Implements `AsyncMemoryService` with Mem0 v2 GraphMemory workflows and hardened OpenAI completion safeguards.
- Provides async helpers for app discovery, assignment seeding, memory insertion, search, and two-stage prompt enhancement.
- Enforces strict logging, retry fallbacks, vocabulary whitelisting, and post-processing guardrails for completions.
Conflicts With:
- `README.md` (describes legacy Django service logic and different Mem0 flows).
- `docs/mem0-migration.md` (focuses on proxy client toggles absent from this implementation).
Missing Critical Info:
- Environment configuration for new required variables (`MEM0_API_KEY`, `OPENAI_API_KEY`) scoped to FastAPI service.
- External dependency expectations (Mem0 GraphMemory enablement, OpenAI model quotas).
Recommendation: KEEP (reference implementation for HARDENED pipeline).

### File name : backend-v2/app/routers/health.py
Status: ACCURATE
Key Info:
- Exposes `/api/v1/health` returning static service metadata and timestamp.
- Avoids downstream dependencies for quick readiness checks.
- Intended for Render/extension heartbeat pings.
Conflicts With:
- `docs/render-deployment.md` (claims `/` root health endpoint with database verification).
Missing Critical Info:
- Documented SLA/monitoring expectations for health probes.
Recommendation: KEEP.

### File name : backend-v2/app/routers/users.py
Status: ACCURATE
Key Info:
- Provides `/api/v1/users/{user_id}/app-ids` using `AsyncMemoryService.get_user_app_ids`.
- Validates `user_id` length (1-255 chars) and logs request/response lifecycle.
- Returns sorted app identifiers discovered via Mem0 Entities API.
Conflicts With:
- `extension/popup.js` (caches assignments via legacy Django `/assignments` endpoint).
- `extension/api.js` (mixes `GET /assignments` flow with this new endpoint).
Missing Critical Info:
- Documentation for Entities API quota limits and pagination behavior.
Recommendation: KEEP (align extension to this contract).

### File name : backend-v2/app/routers/assignments.py
Status: ACCURATE
Key Info:
- Defines `/api/v1/assignments` `POST` to create lightweight assignment metadata without touching Django models.
- Generates deterministic namespace data via `AsyncMemoryService.create_assignment`.
- Returns Pydantic `AssignmentResponse` for extension consumption.
Conflicts With:
- `README.md` and `docs/file-structure.md` (describe Django serializer-backed assignment creation with database persistence).
- `extension/popup.js` (expects validation requiring ≥8 character app IDs and caching semantics).
Missing Critical Info:
- Guidance on idempotency vs. duplicate assignment creation; persistence behavior across restarts.
Recommendation: KEEP (update docs + extension flows).

### File name : backend-v2/app/routers/enhancement.py
Status: ACCURATE
Key Info:
- Exposes `/api/v1/prompts/enhance` to drive hardened two-stage enhancement via Mem0 GraphMemory.
- Wraps service exceptions in HTTP 500 for uniform error handling.
- Accepts optional `app_id` and `run_id` to scope context.
Conflicts With:
- `README.md` (describes Django `MemoryService.enhance_prompt` internals).
- `docs/mem0-migration.md` (references legacy proxy flag for enhancement).
Missing Critical Info:
- Rate limiting strategy, latency expectations, and structured error schema.
Recommendation: KEEP.

### File name : backend-v2/app/routers/memories.py
Status: ACCURATE
Key Info:
- Provides `/api/v1/memories/search` returning normalized `MemoryResult` objects.
- Delegates to `AsyncMemoryService.search_memories` with GraphMemory-aware parameters.
- Normalizes optional metadata payloads for downstream UI.
Conflicts With:
- `README.md` (documents `/api/v1/conversations/search` endpoint with Django persistence).
- `extension/background.js` (invokes `/api/v1/conversations/search`).
Missing Critical Info:
- Response example for GraphMemory relations and pagination semantics.
Recommendation: KEEP.

## Browser Extension

### File name : extension/manifest.json
Status: OUTDATED
Key Info:
- Declares Manifest V3 extension with background service worker and popup UI.
- Grants host permissions for ChatGPT, Claude, Gemini, Perplexity, and backend endpoints.
- Lists shared modules (UI overlays, config) as web-accessible resources.
Conflicts With:
- `backend-v2/app/main.py` (expects `/api/v1/*` FastAPI routes; manifest still references Render Django host).
- Deployment reality (no longer deploying Django/Gunicorn stack documented in Render scripts).
Missing Critical Info:
- Updated backend domain/environment strategy post-FastAPI migration.
Recommendation: MAJOR UPDATE (align permissions and documentation).

### File name : extension/background.js
Status: CONFLICTING
Key Info:
- Handles health checks, conversation saves, prompt enhancement, search, and debug log forwarding via `apiClient`.
- Persists exponential backoff for health checks and API retries.
- Sends conversations to `/api/v1/conversations` and debug logs to `/api/debug-logs/` (endpoints absent in FastAPI).
Conflicts With:
- `backend-v2/app/routers/*` (actual API set lacks `/api/v1/conversations` and `/api/debug-logs/`).
- `backend-v2/app/services/memory.py` (expects GraphMemory-first flows not invoked here).
Missing Critical Info:
- Revised messaging contracts for conversation ingestion and logging in hardened pipeline.
Recommendation: MAJOR UPDATE (align requests to new API surface or deprecate unsupported flows).

### File name : extension/config.js
Status: CONFLICTING
Key Info:
- Maintains environment map pointing to both Django Render host and local FastAPI endpoint.
- Persists user/app identifiers in Chrome sync storage with fallback to assignment/project IDs.
- Lacks differentiation between FastAPI (stateless) and Django (stateful) namespaces.
Conflicts With:
- `backend-v2/app/models.py` (expects 3+ character `app_id`; extension still assumes ≥8 characters elsewhere).
- Actual deployment (Django stack deprecated; Render scripts outdated).
Missing Critical Info:
- Definitive list of supported environments and migration guidance for FastAPI-only backend.
Recommendation: MAJOR UPDATE (simplify environments, update validation rules).

### File name : extension/api.js
Status: CONFLICTING
Key Info:
- Implements fetch wrapper with retries and header injection for `X-User-Id` / `X-App-Id`.
- Hardcodes REST paths for legacy Django endpoints (`/api/v1/conversations`, `/api/v1/assignments/`, etc.).
- Attempted migration to FastAPI partially present via `fetchUserAppIds` call.
Conflicts With:
- `backend-v2/app/routers/*` (no `/api/v1/conversations` endpoint; trailing slashes differ).
- `backend-v2/app/models.py` (app ID validation mismatch, optional fields mis-normalized).
Missing Critical Info:
- Documented payload schema for FastAPI responses (e.g., `AssignmentResponse`).
Recommendation: MAJOR UPDATE (remove deprecated endpoints, sync payloads with FastAPI models).

### File name : extension/popup.js
Status: CONFLICTING
Key Info:
- Manages setup wizard for selecting environment, saving user/app IDs, and caching assignments locally.
- Validates app IDs with minimum length of 8 characters, conflicting with backend (3+).
- Fetches assignments via `/api/v1/assignments?userid=` and expects Django-specific shapes.
Conflicts With:
- `backend-v2/app/routers/users.py` (`GET /users/{user_id}/app-ids` intended replacement).
- `backend-v2/app/routers/assignments.py` (payload schema diverges; UI expects stored assignments list).
Missing Critical Info:
- Updated UX flow for stateless assignment creation and Mem0-backed discovery.
Recommendation: MAJOR UPDATE (rebuild against hardened FastAPI contract).

## Environment & Deployment

### File name : env.example
Status: OUTDATED
Key Info:
- Configures Django settings, PostgreSQL, Supabase, and proxy client toggles.
- Mentions `MEM0_USE_PROXY_CLIENT` and chat temperature flags from legacy stack.
- Omits required `OPENAI_API_KEY` despite new hardened enhancement service relying on it.
Conflicts With:
- `backend-v2/app/core/config.py` (expects only `MEM0_API_KEY` and optional `OPENAI_API_KEY`).
- Container reality (FastAPI service no longer depends on Django/Postgres env vars).
Missing Critical Info:
- FastAPI-specific env vars (e.g., `APP_VERSION`, `CORS_ALLOW_ORIGINS`, optional logging overrides).
Recommendation: MAJOR UPDATE (replace with FastAPI-focused example).

### File name : docker-compose.yml
Status: OUTDATED
Key Info:
- Spins up Django app with Postgres and runs `manage.py migrate` + `runserver`.
- Sets `DJANGO_SETTINGS_MODULE` and expects Supabase connection string.
- No service definition for FastAPI backend-v2 or async workers.
Conflicts With:
- `backend-v2/app/main.py` (actual service entrypoint via Uvicorn, no Django runtime).
- `Dockerfile` (builds Django app, not FastAPI stack).
Missing Critical Info:
- Container orchestration for FastAPI + Mem0 integration (e.g., async worker dependencies).
Recommendation: DELETE or REPLACE (build new compose for backend-v2).

### File name : Dockerfile
Status: OUTDATED
Key Info:
- Multi-stage build installing `backend/requirements.txt` and running Django migrations + Gunicorn.
- Bundles PostgreSQL client and assumes `manage.py` entrypoint.
- Ignores `backend-v2` FastAPI code entirely.
Conflicts With:
- `backend-v2/app/main.py` (FastAPI/Uvicorn runtime expected).
- `render-start.sh` (same Django assumption).
Missing Critical Info:
- Instructions for running FastAPI via Uvicorn or hypercorn, installing async dependencies.
Recommendation: MAJOR UPDATE (switch build context to backend-v2 service).

### File name : render-build.sh
Status: OUTDATED
Key Info:
- Runs `python manage.py collectstatic` for Django static assets.
- Assumes dependencies pre-installed during Docker build.
- No FastAPI build tasks present.
Conflicts With:
- `backend-v2` stateless architecture (no static collection step).
Missing Critical Info:
- FastAPI-specific pre-build checks (e.g., `poetry install`, lint/test commands).
Recommendation: MAJOR UPDATE or DELETE (replace with FastAPI tasks).

### File name : render-predeploy.sh
Status: OUTDATED
Key Info:
- Executes `python manage.py migrate --noinput` before deployment.
- Requires Django ORM and database connection.
Conflicts With:
- FastAPI service (no Django migrations, Mem0 handles persistence).
Missing Critical Info:
- Any pre-deploy smoke tests or Mem0 connectivity verification.
Recommendation: DELETE or REWRITE for FastAPI.

### File name : render-start.sh
Status: OUTDATED
Key Info:
- Launches Gunicorn with `mastermind.wsgi:application`.
- Hardcodes Django WSGI entrypoint.
Conflicts With:
- FastAPI runtime (should call `uvicorn app.main:app`).
Missing Critical Info:
- Guidance on worker class, async event loop tuning for FastAPI.
Recommendation: MAJOR UPDATE.

### File name : render.yaml
Status: OUTDATED
Key Info:
- Provisions Render web service using Dockerfile + Render scripts with Django migrations.
- Binds to Postgres database and enables pgvector extension.
- Sets env vars for Mem0 proxy + Django secrets.
Conflicts With:
- FastAPI stateless deployment (no Postgres requirement, new env var set).
Missing Critical Info:
- Definition for FastAPI image, health check path (`/api/v1/health`), optional background tasks.
Recommendation: MAJOR UPDATE.

### File name : deployment/start.sh
Status: REDUNDANT
Key Info:
- Helper script presumably to launch Django service (not reviewed in detail because unused by backend-v2).
- Lives alongside other Django-centric scripts.
Conflicts With:
- backend-v2 operational flow (Uvicorn/ASGI, not Django manage commands).
Missing Critical Info:
- FastAPI startup instructions or reference to Uvicorn command.
Recommendation: DELETE once FastAPI deployment docs exist.

### File name : deployment/healthcheck.sh
Status: REDUNDANT
Key Info:
- Shell script to curl Django `/health/` endpoint and parse JSON.
- Not referenced by FastAPI build or docs.
Conflicts With:
- New `/api/v1/health` path (script still targets legacy route).
Missing Critical Info:
- Updated endpoint and expected response shape for FastAPI.
Recommendation: DELETE or UPDATE (after rewriting for new route).

## Additional Notes
- Documentation in `README.md`, `docs/file-structure.md`, and `docs/deployment.md` remains aligned with the deprecated Django + Postgres architecture and must be rewritten during subsequent phases.
- Browser extension code still assumes Django endpoints for conversations and assignments; conflicts above highlight where the hardened pipeline diverges.

