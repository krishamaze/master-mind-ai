# Copilot Instructions for Master Mind AI

## Project Overview
- **Purpose:** Capture, store, and enhance AI conversations (ChatGPT, Gemini, Claude, etc.) with context-aware memory and prompt improvement.
- **Architecture:**
  - **Browser Extension:** Captures conversations, manages popup UI, and syncs user/app IDs via Chrome storage.
  - **Django Backend:** REST API for conversation storage, prompt enhancement, and assignment management. Uses PostgreSQL (with pgvector) for vector storage.
  - **Mem0.ai Memory Layer:** Handles memory retrieval and enhancement logic, integrated via SDK and API.
  - **Experimental FastAPI Backend:** (`backend-v2/`) Stateless, no PostgreSQL, for migration/testing.

## Key Workflows
- **User/App ID Management:**
  - User IDs and app IDs are managed in the extension popup and synced via Chrome storage.
  - Assignments are created/fetched via `/api/v1/assignments/` endpoints.
- **Prompt Enhancement:**
  - Highlighted text is sent to `/api/v1/prompts/enhance/`.
  - Backend performs OpenAI-style cleanup, then queries Mem0 for relevant context, blending results into the enhanced prompt.
- **Cross-Device Continuity:**
  - User/app IDs and assignments sync across browsers via Chrome sync storage and backend fetches.

## Conventions & Patterns
- **Django:**
  - Apps grouped by feature; migrations required for all schema changes.
  - Use `_embedding` suffix for pgvector fields.
  - RESTful API patterns, versioned under `/api/v1/`.
- **Extension:**
  - Manifest V3, content scripts are lightweight, heavy logic in background scripts.
  - Popup state managed in `config.js` and `popup.js`.
- **Testing:**
  - Django: Unit tests for views, serializers, models in `backend/tests/`.
  - Integration tests for Mem0.ai interactions when possible.
- **Dependencies:**
  - Python: Pin in `requirements.txt` (Mem0 SDK at `0.1.117`).
  - JS: Pin in `package.json`.

## Build & Run
- **Backend:**
  - `cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver`
- **FastAPI (experimental):**
  - `cd backend-v2 && pip install -r requirements.txt && uvicorn app.main:app --reload`
- **Extension:**
  - Load `extension/` as an unpacked extension in Chrome.

## Integration Points
- **Mem0.ai:** Use official SDK for memory operations; reference Mem0 IDs in DB.
- **pgvector:** Store embeddings in PostgreSQL with `_embedding` fields.

## References
- See `AGENTS.md` for detailed architecture and standards.
- See `README.md` for workflow and setup.
- See `docs/mem0-migration.md` for migration details.

---
_Keep instructions concise and actionable. Update this file as project structure or workflows evolve._
