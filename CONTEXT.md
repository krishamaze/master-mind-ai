# Agent Notes

- `Settings` loads `.env`, keeps `DEBUG` false, and requires `MEM0_API_KEY` before imports succeed.【F:backend-v2/app/core/config.py†L8-L24】
- Startup applies `setup_exception_handlers` ahead of `/api/v1` routers to normalize error payloads.【F:backend-v2/app/main.py†L24-L52】
- `AsyncMemoryService` enables GraphMemory, instantiates AsyncOpenAI, seeds assignments with `enable_graph=True`, and shares identifier rules with `MemorySearchRequest`.【F:backend-v2/app/services/memory.py†L48-L167】【F:extension/api.js†L69-L109】【F:backend-v2/app/models.py†L68-L88】
