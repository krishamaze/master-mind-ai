# Master Mind AI

Universal AI Conversation Memory & Prompt Enhancement System.

## Project Description & Key Features
- Capture conversations from AI platforms like Gemini, ChatGPT, and Claude.
- Store dialogues in an intelligent memory layer for later retrieval.
- Enhance future prompts with context-aware suggestions.

## Architecture Overview
Browser Extension → Django API → Mem0 Memory Layer

> **FastAPI preview:** An experimental stateless FastAPI service that removes the PostgreSQL dependency is available under [`backend-v2/`](backend-v2/). It exposes health, assignment, enhancement, and memory search endpoints so the Chrome extension can be tested against both backends during the migration.

1. **Browser Extension**: Captures conversations and sends data to the backend.
2. **Django Backend**: Processes requests and stores conversations in PostgreSQL with pgvector.
3. **Mem0.ai Memory Layer**: Organizes and retrieves contextual memory to improve subsequent prompts.

## End-to-End Workflow

### Extension Startup
- A user signs in through the popup, entering their desired identifier. The popup stores the selection with `chrome.storage.sync` so it can be reused across sessions and browsers.【F:extension/config.js†L6-L29】
- Once a user ID is saved, the popup loads existing assignments by calling `GET /api/v1/assignments/?user_id=<id>` through the shared API client and renders the returned app IDs as dropdown options.【F:extension/api.js†L33-L59】【F:extension/popup.js†L207-L309】
- New users see an empty list and can choose to add a fresh app ID directly from the popup UI.【F:extension/popup.js†L231-L309】

### App ID Creation
- Creating an app ID triggers `POST /api/v1/assignments/` with the desired identifier; the serializer normalizes the payload and ensures the app ID is the canonical name.【F:extension/api.js†L61-L78】【F:backend/api/serializers.py†L21-L80】
- The backend resolves or creates the Django user (via `user_id`) and persists an `Assignment` record, initialising its Mem0 namespace with an `[init] assignment <app_id>` memory so future searches know about the project.【F:backend/api/views/__init__.py†L46-L117】
- The extension stores the chosen combination of `environment`, `userId`, and `assignmentId`, keeping popup state in sync with the backend.【F:extension/config.js†L21-L29】【F:extension/popup.js†L372-L474】

### Smart Enhancement Flow
- Highlighted text from the active page is sent to `POST /api/v1/prompts/enhance/` with the saved `user_id` and `app_id`.
- The backend performs a two-stage enhancement: `MemoryService.openai_light_cleanup` first applies a lightweight OpenAI-style cleanup, then `multi_level_memory_search` queries Mem0 for contextual snippets scoped to the user/app combination (with documentation fallbacks) before delegating to chat completions.【F:backend/api/views/enhancement.py†L1-L41】【F:backend/api/services/memory_service.py†L159-L281】
- If relevant memories are found they are blended into the enhanced prompt; otherwise the cleaned prompt is returned, ensuring graceful behavior when a namespace is empty.【F:backend/api/services/memory_service.py†L200-L281】
- The extension replaces the user’s original selection with the enhanced output, giving an immediate context-aware rewrite.【F:extension/api.js†L80-L98】

### Cross-Device Continuity
- Installing the extension on a new device and entering the same user ID triggers another `assignments` fetch; the backend syncs Mem0 memories into Assignment records so every saved app ID (for example, `PersonalBlog` or `EcommerceApp`) appears automatically.【F:extension/api.js†L49-L59】【F:backend/api/views/__init__.py†L66-L188】
- Because settings are kept in Chrome sync storage, the selected environment and assignment move with the user, providing a seamless hand-off across browsers.【F:extension/config.js†L6-L29】

## Quick Start Guide
1. Clone the repository.
2. Copy `env.example` to `.env` and update values. The Mem0 proxy client can be
   toggled with the `MEM0_USE_PROXY_CLIENT` flag and chat completions are
   configurable via `MEM0_CHAT_MODEL` and `MEM0_CHAT_TEMPERATURE`.
3. Install backend dependencies and run migrations (Mem0.ai SDK pinned at `0.1.117`):
   ```bash
   cd backend
   pip install -r requirements.txt
   python manage.py migrate
   ```
4. Launch the Django server:
   ```bash
   python manage.py runserver
   ```
5. Load the browser extension in developer mode.

For upgrading existing deployments, see the migration guide at
[`docs/mem0-migration.md`](docs/mem0-migration.md).

## File Structure
See [`docs/file-structure.md`](docs/file-structure.md) for an overview of repository files and directories.

## Testing & Deployment
See [`docs/testing.md`](docs/testing.md) for running backend and extension tests.
Deployment steps and security practices are described in [`docs/deployment.md`](docs/deployment.md).

## API Endpoints

- `GET /api/v1/health/` – Service health check
- `POST /api/v1/conversations/` – Store a conversation
- `POST /api/v1/conversations/search/` – Search stored memories (requires `query` and `user_id`)
- `POST /api/v1/prompts/enhance/` – Enhance a prompt with relevant memories (requires `prompt` and `user_id`; accepts optional `app_id` and `run_id` for richer context)

## Technology Stack
- Django
- PostgreSQL
- pgvector
- Mem0.ai
- Chrome Extension (Manifest V3)

## Development Setup

### Browser Extension
The extension source resides in the `extension/` directory. Load this folder as
an unpacked extension from Chrome's Extensions page (Developer Mode). Choose the
desired environment (production or development) and set the API token and user
ID through the popup before capturing conversations. See
[`docs/extension-setup.md`](docs/extension-setup.md) for configuration and
testing instructions.

## Contributing Guidelines
*Contribution instructions forthcoming. Stay tuned!*

