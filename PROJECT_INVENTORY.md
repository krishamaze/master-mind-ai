# Project Inventory

Comprehensive inventory of the Master Mind AI repository. Entries are grouped by major directories to align with deployment boundaries and legacy tracking requirements.

## backend-v2/

| Path | Purpose | Wiring | Status |
| --- | --- | --- | --- |
| `backend-v2/README.md` | Setup and architecture notes for the FastAPI service, including run commands. | Referenced by developers for onboarding; no code-level imports. | Active |
| `backend-v2/Dockerfile` | Container build instructions for deploying the FastAPI app on Uvicorn. | Consumed by container tooling (Docker/Render); installs `requirements.txt` and exposes port 8000. | Active |
| `backend-v2/requirements.txt` | Locked Python dependencies for the FastAPI service. | Installed by Dockerfile and local tooling; feeds `pip` and `poetry` equivalents. | Active |
| `backend-v2/app/__init__.py` | Marks `app` as a Python package. | Enables relative imports across routers, services, and core modules. | Active |
| `backend-v2/app/main.py` | FastAPI application entry point registering routers, middleware, and lifespan hooks. | Imports `app.core.config`, `app.core.exceptions`, and routers from `app.routers`; exported `app` used by Uvicorn/ASGI. | Active |
| `backend-v2/app/models.py` | Pydantic models defining request/response schemas across APIs. | Imported by routers and services to enforce validation and response typing. | Active |
| `backend-v2/app/core/__init__.py` | Package marker for core utilities. | Supports imports of configuration and exception handlers. | Active |
| `backend-v2/app/core/config.py` | Environment-driven configuration via Pydantic settings. | Imported by services and main app to read API keys and metadata. | Active |
| `backend-v2/app/core/exceptions.py` | Centralized FastAPI exception handler registration. | Imported by `app.main` to bind validation handlers. | Active |
| `backend-v2/app/routers/__init__.py` | Router package marker aggregating API modules. | Exposes router modules for import in `app.main`. | Active |
| `backend-v2/app/routers/health.py` | `/api/v1/health` heartbeat endpoint returning service status. | Imports `app.models.HealthResponse`; included by `app.main`. | Active |
| `backend-v2/app/routers/users.py` | `/api/v1/users/{user_id}/app-ids` endpoint for retrieving Mem0 app IDs. | Uses `AsyncMemoryService` and `AppIdsResponse`; error handling via FastAPI `HTTPException`. | Active |
| `backend-v2/app/routers/assignments.py` | `/api/v1/assignments` endpoint to create Mem0 assignments. | Depends on `AsyncMemoryService` for persistence and `Assignment*` models. | Active |
| `backend-v2/app/routers/enhancement.py` | `/api/v1/prompts/enhance` endpoint orchestrating two-stage prompt enhancement. | Calls `AsyncMemoryService.two_stage_enhance`; returns `EnhanceResponse`. | Active |
| `backend-v2/app/routers/memories.py` | `/api/v1/memories/search` endpoint for Mem0 memory retrieval. | Transforms Mem0 results using `Memory*` models; relies on `AsyncMemoryService.search_memories`. | Active |
| `backend-v2/app/services/__init__.py` | Service package marker. | Enables importing `AsyncMemoryService` via `app.services`. | Active |
| `backend-v2/app/services/memory.py` | Async wrapper around Mem0 and OpenAI clients providing enhancement/search APIs. | Imports `httpx`, `mem0`, `AsyncOpenAI`, and `settings`; exposes methods used by routers. | Active |

## extension/

| Path | Purpose | Wiring | Status |
| --- | --- | --- | --- |
| `extension/manifest.json` | Chrome extension manifest defining permissions, scripts, and metadata. | Consumed by Chrome; references background, content, and popup scripts. | Active |
| `extension/package.json` | Node package definition for extension tooling and tests. | Used by npm for dependency management; declares build/test scripts. | Active |
| `extension/package-lock.json` | Locked dependency graph for extension build and tests. | Ensures deterministic installs via npm. | Active |
| `extension/node_modules/.package-lock.json` | npm internal metadata snapshot stored during install. | Read by npm when reifying dependencies. | Active (third-party) |
| `extension/node_modules/`* | Vendored third-party JavaScript packages (see `package-lock.json` for exact versions). | Imported indirectly via npm bundler/runtime; no direct source modifications expected. | Active (external) |
| `extension/api.js` | Fetch wrapper for communicating with FastAPI endpoints with retry/backoff. | Imports `getSettings`; exported `apiClient` used across popup/content scripts. | Active |
| `extension/background.js` | Background service worker coordinating extension lifecycle and message routing. | Imports shared utilities (if any) and listens to Chrome runtime events. | Active |
| `extension/config.js` | Chrome storage helpers for environment/user/app settings. | Exported `ENVIRONMENTS`, `getSettings`, `setSettings`; consumed by popup and API client. | Active |
| `extension/popup.html` | HTML template for setup UI. | References `popup.js` and `styles.css`; rendered in Chrome popup. | Active |
| `extension/popup.js` | Popup UI logic managing user/app selection, caching, and API calls. | Imports `config.js` and `api.js`; manipulates DOM elements defined in `popup.html`. | Active |
| `extension/styles.css` | Styling for popup UI. | Linked from `popup.html`; uses CSS variables defined locally. | Active |
| `extension/content/chatgpt.js` | Content script adapting extension to ChatGPT UI. | Imports shared DOM utilities; registered in manifest for ChatGPT domains. | Active |
| `extension/content/claude.js` | Content script for Anthropic Claude web UI integration. | Uses shared observers and UI injection helpers. | Active |
| `extension/content/dom_log_capture.js` | Diagnostic content script capturing DOM logs. | Hooked via manifest when debugging. | Active |
| `extension/content/gemini.js` | Google Gemini-specific content script for enhancement overlay. | Depends on shared DOM helpers. | Active |
| `extension/content/perplexity.js` | Perplexity AI content integration script. | Shares platform config utilities. | Active |
| `extension/content/utils.js` | Platform-agnostic helpers for content scripts. | Imported across platform adapters; exports query and DOM helpers. | Active |
| `extension/shared/dom-observer.js` | Central mutation observer managing conversation detection and input hooks. | Imports `thread-context` helpers; exported `DOMObserver` used by platform configs. | Active |
| `extension/shared/enhancement-ui.js` | Renders enhancement controls/buttons overlaying host UIs. | Depends on DOM observer and floating button modules; exports UI factory functions. | Active |
| `extension/shared/floating-enhance-button.js` | Floating button component logic for triggering enhancements. | Consumed by `enhancement-ui` and content scripts. | Active |
| `extension/shared/platform-config.js` | Platform-specific selectors and behaviors registry. | Imported by content scripts to initialize correct handlers. | Active |
| `extension/shared/text-replacement-manager.js` | Utilities to insert enhanced text back into host editors safely. | Used by content scripts post-enhancement. | Active |
| `extension/shared/thread-context.js` | Run/session tracking for conversations across platforms. | Exports run ID helpers used by DOM observer and universal enhancer. | Active |
| `extension/shared/universal-enhance.js` | Shared orchestration for fetching enhancements and updating UI state. | Relies on `apiClient`, DOM observer, and replacement manager; exported init helpers. | Active |
| `extension/tests/api.test.js` | Jest test verifying API client behavior. | Imports `apiClient` and mocks fetch/storage. | Active |
| `extension/tests/dom-observer.test.js` | Tests for `DOMObserver` mutation handling. | Imports DOM observer module; uses Jest DOM utilities. | Active |
| `extension/tests/platform-config.test.js` | Ensures platform configuration mappings behave as expected. | Imports `platform-config.js`. | Active |
| `extension/tests/popup.test.js` | Popup UI tests covering validation and workflow. | Mocks Chrome APIs and imports `popup.js`. | Active |
| `extension/tests/utils.test.js` | Shared utility tests for content scripts. | Imports `content/utils.js`. | Active |

\*All files under `extension/node_modules/` originate from third-party packages (see individual package directories for specific exports). Treat these as external, vendor-maintained resources.

## Legacy / Removal Candidates

| Path | Purpose | Wiring | Status |
| --- | --- | --- | --- |
| _None identified_ | Repository does not contain explicitly deprecated or legacy directories at this time. | — | — |

## Root Configuration & Tooling

| Path | Purpose | Wiring | Status |
| --- | --- | --- | --- |
| `AGENTS.md` | Agent-specific contribution guidelines emphasizing FastAPI `/api/v1` alignment. | Referenced by contributors and tooling to ensure compliance. | Active |
| `CONTEXT.md` | High-level context about the project domain and decision history. | Read by maintainers; no runtime usage. | Active |
| `README.md` | Top-level project overview and setup instructions. | Developer documentation entrypoint. | Active |
| `Dockerfile` | Root-level Dockerfile (if used outside backend scope). | Consumed by container tooling for alternate builds. | Active |
| `docker-compose.yml` | Compose stack definition for orchestrating services locally. | References backend service; used by `docker compose`. | Active |
| `env.example` | Example environment variables for local development. | Copied to `.env` before running backend. | Active |
| `render.yaml` | Render.com infrastructure definition referencing build/start scripts. | Used by Render deployment pipeline. | Active |
| `render-build.sh` | Build hook script for Render deployment. | Invoked by Render before deploy; calls backend install steps. | Active |
| `render-predeploy.sh` | Predeploy script for Render environment. | Executed by Render prior to start. | Active |
| `render-start.sh` | Startup script for Render to run the FastAPI service. | Called by Render runtime; runs Uvicorn server. | Active |
| `backend-v2/Dockerfile` | (See backend section) included here for visibility in deployment tooling. | Referenced by Render Docker builds when using backend image. | Active |

