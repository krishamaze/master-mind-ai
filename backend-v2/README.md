# backend-v2 API Notes

`AssignmentCreateRequest` restricts `app_id` to 3–50 characters while seeding GraphMemory metadata; `EnhanceRequest` and `MemorySearchRequest` reuse the relaxed identifier pattern and bound search `limit` to 1–20 for `/memories/search`.【F:backend-v2/app/models.py†L17-L88】【F:backend-v2/app/services/memory.py†L118-L167】【F:backend-v2/app/routers/memories.py†L15-L44】
Enhancement cleans whitespace, tries app/user/basic searches, filters relations to the requested `app_id`, and applies whitelist plus stop guardrails before emitting `EnhanceResponse`.【F:backend-v2/app/services/memory.py†L232-L520】【F:backend-v2/app/models.py†L34-L41】
The search helper defaults to Mem0 v2 GraphMemory, mirrors optional `app_id`/`run_id` filters from the extension, and falls back to v1 if needed.【F:backend-v2/app/services/memory.py†L380-L438】【F:extension/api.js†L69-L109】
