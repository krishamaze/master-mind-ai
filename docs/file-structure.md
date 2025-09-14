# Project File Structure

Overview of the repository with brief descriptions for major files and directories.

```
root
├── .github/                  # GitHub workflows and configuration
│   └── workflows/
│       └── ci.yml            # Continuous integration pipeline
├── .gitignore                # Git ignore rules
├── AGENTS.md                 # Guidelines for contributors and agents
├── CONTEXT.md                # Project background and architectural context
├── Dockerfile                # Docker image definition for backend and extension
├── README.md                 # Project overview and quick start guide
├── docker-compose.yml        # Docker Compose setup for services
├── env.example               # Example environment variables for local setup
├── .env.render.example       # Example environment variables for Render deployment
├── render.yaml               # Render service configuration
├── render-build.sh           # Build script for Render deployments
├── render-predeploy.sh       # Pre-deployment script for Render
├── render-start.sh           # Startup script for Render
├── backend/                  # Django REST API and server-side logic
│   ├── manage.py             # Django management commands entry point
│   ├── requirements.txt      # Python dependencies for backend
│   ├── pytest.ini            # Pytest configuration
│   ├── supabase_setup.sql    # SQL setup script for Supabase
│   ├── api/                  # API app with views, serializers, and services
│   │   ├── admin.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── views/
│   │   │   └── enhancement.py
│   │   └── services/
│   │       └── memory_service.py
│   ├── mastermind/           # Django project configuration
│   └── tests/                # Backend test suite
├── extension/                # Chrome extension source
│   ├── manifest.json         # Extension manifest (MV3)
│   ├── background.js         # Background script handling events
│   ├── content/              # Content scripts for capturing conversations
│   │   ├── chatgpt.js
│   │   ├── claude.js
│   │   ├── gemini.js
│   │   └── utils.js
│   ├── shared/               # Reusable modules
│   │   ├── dom-observer.js
│   │   ├── enhancement-ui.js
│   │   ├── floating-enhance-button.js
│   │   ├── platform-config.js
│   │   └── text-replacement-manager.js
│   ├── popup.html            # Popup UI markup
│   ├── popup.js              # Logic for popup interactions
│   ├── api.js                # Client for backend API requests
│   ├── config.js             # Extension configuration values
│   ├── styles.css            # Styling for popup
│   ├── tests/                # Extension test suite
│   │   ├── dom-observer.test.js
│   │   ├── platform-config.test.js
│   │   └── utils.test.js
│   ├── package.json          # Node dependencies and scripts
│   └── package-lock.json     # Locked dependency versions
├── docs/                     # Project documentation
│   ├── deployment.md         # Deployment instructions
│   ├── extension-setup.md    # Extension installation guide
│   ├── render-deployment.md  # Render-specific deployment guide
│   ├── testing.md            # Testing instructions
│   └── file-structure.md     # (This file) repository layout guide
└── deployment/               # Runtime scripts for deployments
    ├── healthcheck.sh        # Health check script
    └── start.sh              # Startup helper script
```

