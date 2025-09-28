# Master Mind AI FastAPI Stack

Master Mind AI links the Chrome extension to a FastAPI backend that uses Mem0 v2 GraphMemory for hardened prompt enhancement.【F:backend-v2/app/main.py†L24-L52】【F:backend-v2/app/services/memory.py†L204-L520】

## Core
- FastAPI enables extension CORS, mounts `/api/v1` routers, and delegates to `AsyncMemoryService` for GraphMemory seeding, `app_id` filtering, and OpenAI guardrails.【F:backend-v2/app/main.py†L24-L52】【F:backend-v2/app/services/memory.py†L118-L205】【F:backend-v2/app/services/memory.py†L420-L520】
- The extension enforces ≥3 character app IDs before its retrying client calls the backend.【F:extension/popup.js†L174-L213】【F:extension/api.js†L1-L100】

## Run
Copy `env.example` to `.env`, set Mem0 (required) and OpenAI keys for `Settings`, install with `cd backend-v2 && pip install -r requirements.txt`, then launch `uvicorn backend-v2.app.main:app --reload` and point the extension at `http://localhost:8000`.【F:backend-v2/app/core/config.py†L8-L24】【F:backend-v2/requirements.txt†L1-L22】【F:backend-v2/app/main.py†L54-L57】【F:extension/background.js†L40-L143】

## API
`GET /api/v1/health` heartbeat.【F:backend-v2/app/routers/health.py†L13-L22】【F:backend-v2/app/models.py†L42-L48】 `GET /api/v1/users/{user_id}/app-ids` filters results to ≥3 characters.【F:backend-v2/app/routers/users.py†L13-L35】【F:backend-v2/app/services/memory.py†L70-L105】 `POST /api/v1/assignments` seeds GraphMemory and returns metadata.【F:backend-v2/app/routers/assignments.py†L13-L24】【F:backend-v2/app/services/memory.py†L118-L167】 `POST /api/v1/prompts/enhance` runs two-stage search plus hardened OpenAI output.【F:backend-v2/app/routers/enhancement.py†L13-L31】【F:backend-v2/app/services/memory.py†L204-L358】 `POST /api/v1/memories/search` performs GraphMemory-aware search with optional app/run filters.【F:backend-v2/app/routers/memories.py†L15-L44】【F:backend-v2/app/services/memory.py†L380-L438】

## Validation
Hardened enhancement layers hierarchical search, whitelist vocabularies, stop sequences, and truncation fallbacks; Entities API results match the ≥3 character rule enforced by the extension; tests: `pytest` (no suites yet, command completes).【F:backend-v2/app/services/memory.py†L212-L520】【F:backend-v2/app/services/memory.py†L70-L105】【F:extension/popup.js†L194-L213】【406a0e†L1-L7】
