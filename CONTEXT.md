# Technical Context for Agents

- `AsyncMemoryService` powers GraphMemory search, Graph-enabled assignment seeding, and vocabulary whitelisting so enhancements stay within hard stop sequences and character ceilings.【F:backend-v2/app/services/memory.py†L48-L167】【F:backend-v2/app/services/memory.py†L280-L575】
- Stop sequences (`\n`, `—`, `•`) and strict char limits are enforced after every OpenAI call, with fallback to the original prompt when guardrails trigger.【F:backend-v2/app/services/memory.py†L494-L575】
- App-scoped context comes from the Mem0 Entities API plus per-app GraphMemory relations; the service filters relations by `app_id` before building context payloads.【F:backend-v2/app/services/memory.py†L70-L167】【F:backend-v2/app/services/memory.py†L358-L452】
- Key Pydantic responses: `AssignmentResponse` exposes seeded assignment metadata, while `MemoryResult` captures search hits with optional metadata for the extension UI.【F:backend-v2/app/models.py†L95-L133】
- Extension code must follow the updated FastAPI contracts used by `background.js` and `api.js`, aligning popup validation with the backend’s `/api/v1/assignments`, `/api/v1/users/{id}/app-ids`, `/api/v1/memories/search`, and `/api/v1/prompts/enhance` routes.【F:extension/background.js†L40-L143】【F:extension/api.js†L5-L99】
