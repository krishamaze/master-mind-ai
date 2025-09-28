# Master Mind AI – FastAPI Backend v2

Master Mind AI pairs a Chrome extension with a hardened FastAPI backend to deliver context-aware prompt enhancement powered by Mem0 GraphMemory. The `backend-v2/` service is the production path: it runs on Uvicorn, speaks to the Mem0 v2 API, and exposes a lean surface area that keeps the browser extension responsive even on slow networks.

## Architecture at a Glance
- **Browser Extension** captures AI conversations, lets users pick an app namespace, and calls the FastAPI service for enhancement and memory search.
- **FastAPI backend-v2** (`uvicorn backend-v2.app.main:app`) hosts `/api/v1` routes, wraps the hardened `AsyncMemoryService`, and handles CORS for the extension.【F:backend-v2/app/main.py†L24-L49】
- **Mem0 GraphMemory** is enabled project-wide so every assignment seeds a relationship graph that future enhancement calls can reuse.【F:backend-v2/app/services/memory.py†L48-L116】【F:backend-v2/app/services/memory.py†L254-L358】
- **OpenAI integration** uses async chat completions with strict vocabulary whitelists and post-processing guardrails to stop hallucinations.【F:backend-v2/app/services/memory.py†L256-L358】【F:backend-v2/app/services/memory.py†L482-L575】

## Hardened Enhancement System
`AsyncMemoryService` combines GraphMemory search with multi-layer safety controls:
- Seeds every assignment with a Mem0 v2 memory so GraphMemory relationships exist before the first enhancement.【F:backend-v2/app/services/memory.py†L118-L167】
- Searches hierarchically (app scope → user scope → legacy fallback) with GraphMemory enabled wherever possible.【F:backend-v2/app/services/memory.py†L280-L358】
- Builds a vocabulary whitelist from the prompt and retrieved context, then enforces stop sequences, character ceilings, and post-processing cleanup on the final response.【F:backend-v2/app/services/memory.py†L420-L575】
- Provides async helpers for Entities API lookups so the extension can discover valid app IDs without extra endpoints.【F:backend-v2/app/services/memory.py†L70-L117】

## FastAPI Endpoints
All routes live under `/api/v1` and return Pydantic models:
- `GET /api/v1/health` → service heartbeat.【F:backend-v2/app/routers/health.py†L13-L22】
- `GET /api/v1/users/{user_id}/app-ids` → app discovery via Mem0 Entities API (3+ character IDs only).【F:backend-v2/app/routers/users.py†L13-L35】
- `POST /api/v1/assignments` → create assignment metadata and seed GraphMemory.【F:backend-v2/app/routers/assignments.py†L12-L23】
- `POST /api/v1/prompts/enhance` → run the hardened enhancement pipeline.【F:backend-v2/app/routers/enhancement.py†L12-L30】
- `POST /api/v1/memories/search` → query Mem0 with optional app scoping and GraphMemory output.【F:backend-v2/app/routers/memories.py†L15-L44】

## Quick Start (FastAPI)
1. Copy `env.example` to `.env` and fill in Mem0 and OpenAI keys.
2. Install backend dependencies:
   ```bash
   cd backend-v2
   pip install -r requirements.txt
   ```
3. Launch the service:
   ```bash
   uvicorn backend-v2.app.main:app --reload
   ```
4. Load the extension from `extension/` in Chrome (Developer Mode) and point it at `http://localhost:8000`.

## Environment Variables
The FastAPI service reads only the following variables (see `backend-v2/app/core/config.py`):
- `MEM0_API_KEY` – required for Mem0 GraphMemory operations.
- `OPENAI_API_KEY` – optional; enables hardened enhancement when set.
Additional extension values (`ENVIRONMENT`, cached IDs) remain in Chrome storage.

## Deployment Notes
- **Docker**: The root `Dockerfile` installs `backend-v2` dependencies and starts Uvicorn directly. Combine with `docker-compose.yml` to run FastAPI alongside optional services.
- **Render**: `render*.sh` scripts skip Django commands and boot Uvicorn with the `/api/v1/health` check path so the platform knows the service is ready.
- **Health checks**: ensure `/api/v1/health` returns HTTP 200 before routing traffic.

## Extension Alignment Checklist
- Update popup validation to accept app IDs with **three or more** characters so Entities API results load correctly.【F:extension/popup.js†L168-L203】
- Extension API calls now target `/api/v1/assignments`, `/api/v1/users/{id}/app-ids`, `/api/v1/prompts/enhance`, and `/api/v1/memories/search`; conversation archiving and `/api/debug-logs` are disabled to match the FastAPI backend.【F:extension/api.js†L5-L99】【F:extension/background.js†L40-L102】
- Background enhancement keeps using stored `user_id`, `app_id`, and optional `run_id`, ensuring prompts always travel through the hardened pipeline.【F:extension/background.js†L103-L143】

## Testing
- **Backend**: run `pytest` inside `backend-v2/` after configuring `.env` to exercise service modules.
- **Extension**: run `npm test` inside `extension/` for Jest coverage of popup flows, API client changes, and DOM observers.

## Migration Status
- Old Django-specific docs (`docs/*.md`) were removed; this README is now the single source of truth.
- Deployment scripts, environment templates, and extension code paths have been rewritten for the FastAPI/Uvicorn stack.

