# Master Mind AI - Project File Structure

This document provides an organized overview of the repository structure with direct links to each file.

## 📋 Root Configuration Files

| File | Description | Link |
|------|-------------|------|
| `.gitignore` | Git ignore rules | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/.gitignore) |
| `AGENTS.md` | Guidelines for contributors and agents | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/AGENTS.md) |
| `CONTEXT.md` | Project background and architectural context | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/CONTEXT.md) |
| `README.md` | Project overview and quick start guide | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/README.md) |
| `Dockerfile` | Docker image definition for backend and extension | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/Dockerfile) |
| `docker-compose.yml` | Docker Compose setup for services | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docker-compose.yml) |

## 🔧 Environment & Deployment

| File | Description | Link |
|------|-------------|------|
| `env.example` | Example environment variables for local setup | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/env.example) |
| `.env.render.example` | Example environment variables for Render deployment | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/.env.render.example) |
| `render.yaml` | Render service configuration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/render.yaml) |
| `render-build.sh` | Build script for Render deployments | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/render-build.sh) |
| `render-predeploy.sh` | Pre-deployment script for Render | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/render-predeploy.sh) |
| `render-start.sh` | Startup script for Render | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/render-start.sh) |

## 🚀 CI/CD & GitHub Actions

| File | Description | Link |
|------|-------------|------|
| `.github/workflows/ci.yml` | Continuous integration pipeline | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/.github/workflows/ci.yml) |

## 🐍 Backend (Django REST API)

### Core Files
| File | Description | Link |
|------|-------------|------|
| `backend/manage.py` | Django management commands entry point | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/manage.py) |
| `backend/requirements.txt` | Python dependencies for backend | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/requirements.txt) |
| `backend/pytest.ini` | Pytest configuration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/pytest.ini) |
| `backend/supabase_setup.sql` | SQL setup script for Supabase | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/supabase_setup.sql) |

### API Module
| File | Description | Link |
|------|-------------|------|
| `backend/api/admin.py` | Django admin configuration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/admin.py) |
| `backend/api/models.py` | Database models | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/models.py) |
| `backend/api/serializers.py` | API serializers | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/serializers.py) |
| `backend/api/urls.py` | API URL patterns | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/urls.py) |

### Views & Services
| File | Description | Link |
|------|-------------|------|
| `backend/api/views/enhancement.py` | Enhancement API views | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/views/enhancement.py) |
| `backend/api/services/memory_service.py` | Memory management service | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/backend/api/services/memory_service.py) |

## 🔌 Chrome Extension

### Core Extension Files
| File | Description | Link |
|------|-------------|------|
| `extension/manifest.json` | Extension manifest (MV3) | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/manifest.json) |
| `extension/background.js` | Background script handling events | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/background.js) |
| `extension/config.js` | Extension configuration values | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/config.js) |
| `extension/api.js` | Client for backend API requests | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/api.js) |

### User Interface
| File | Description | Link |
|------|-------------|------|
| `extension/popup.html` | Popup UI markup | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/popup.html) |
| `extension/popup.js` | Logic for popup interactions | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/popup.js) |
| `extension/styles.css` | Styling for popup | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/styles.css) |

### Content Scripts (Platform Integration)
| File | Description | Link |
|------|-------------|------|
| `extension/content/chatgpt.js` | ChatGPT platform integration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/content/chatgpt.js) |
| `extension/content/claude.js` | Claude platform integration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/content/claude.js) |
| `extension/content/gemini.js` | Gemini platform integration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/content/gemini.js) |
| `extension/content/utils.js` | Content script utilities | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/content/utils.js) |

### Shared Components
| File | Description | Link |
|------|-------------|------|
| `extension/shared/dom-observer.js` | DOM observation utilities | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/shared/dom-observer.js) |
| `extension/shared/enhancement-ui.js` | Enhancement user interface | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/shared/enhancement-ui.js) |
| `extension/shared/floating-enhance-button.js` | Floating enhancement button | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/shared/floating-enhance-button.js) |
| `extension/shared/platform-config.js` | Platform configuration | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/shared/platform-config.js) |
| `extension/shared/text-replacement-manager.js` | Text replacement management | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/shared/text-replacement-manager.js) |

### Package Management
| File | Description | Link |
|------|-------------|------|
| `extension/package.json` | Node dependencies and scripts | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/package.json) |
| `extension/package-lock.json` | Locked dependency versions | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/package-lock.json) |

## 🧪 Testing

### Extension Tests
| File | Description | Link |
|------|-------------|------|
| `extension/tests/dom-observer.test.js` | DOM observer tests | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/tests/dom-observer.test.js) |
| `extension/tests/platform-config.test.js` | Platform configuration tests | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/tests/platform-config.test.js) |
| `extension/tests/utils.test.js` | Utility function tests | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/extension/tests/utils.test.js) |

## 📚 Documentation

| File | Description | Link |
|------|-------------|------|
| `docs/deployment.md` | Deployment instructions | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docs/deployment.md) |
| `docs/extension-setup.md` | Extension installation guide | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docs/extension-setup.md) |
| `docs/render-deployment.md` | Render-specific deployment guide | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docs/render-deployment.md) |
| `docs/testing.md` | Testing instructions | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docs/testing.md) |
| `docs/file-structure.md` | Repository layout guide (this file) | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/docs/file-structure.md) |

## 🚀 Deployment Scripts

| File | Description | Link |
|------|-------------|------|
| `deployment/healthcheck.sh` | Health check script | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/deployment/healthcheck.sh) |
| `deployment/start.sh` | Startup helper script | [View](https://raw.githubusercontent.com/krishamaze/master-mind-ai/main/deployment/start.sh) |

---

## 📂 Directory Structure Summary

```
master-mind-ai/
├── 📁 .github/workflows/     # CI/CD workflows
├── 📁 backend/               # Django REST API
│   ├── 📁 api/              # API endpoints & logic
│   ├── 📁 mastermind/       # Django project config
│   └── 📁 tests/            # Backend tests
├── 📁 extension/            # Chrome extension
│   ├── 📁 content/          # Platform integrations
│   ├── 📁 shared/           # Reusable components
│   └── 📁 tests/            # Extension tests
├── 📁 docs/                 # Documentation
└── 📁 deployment/           # Deployment scripts
```

> **Note**: Click any "View" link to access the raw file content. Links that return 404 errors indicate files that may not exist yet in the repository.