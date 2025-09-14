# Master Mind AI

Universal AI Conversation Memory & Prompt Enhancement System.

## Project Description & Key Features
- Capture conversations from AI platforms like Gemini, ChatGPT, and Claude.
- Store dialogues in an intelligent memory layer for later retrieval.
- Enhance future prompts with context-aware suggestions.

## Architecture Overview
Browser Extension → Django API → Mem0 Memory Layer

1. **Browser Extension**: Captures conversations and sends data to the backend.
2. **Django Backend**: Processes requests and stores conversations in PostgreSQL with pgvector.
3. **Mem0.ai Memory Layer**: Organizes and retrieves contextual memory to improve subsequent prompts.

## Quick Start Guide
1. Clone the repository.
2. Copy `env.example` to `.env` and update values.
3. Install backend dependencies and run migrations:
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

## Environment Variables

Configuration uses a `.env` file. Copy the example file and supply your values:

```bash
cp env.example .env
```

Key settings include:

- `DATABASE_URL` – PostgreSQL connection string (`postgresql://...`)
- `SUPABASE_URL` and `SUPABASE_KEY` – Supabase project credentials
- `SUPABASE_DB_URL` – Supabase PostgreSQL connection string
- `SUPABASE_SERVICE_ROLE_KEY` – optional service role key for admin tasks
- `MEM0_API_KEY` – Mem0.ai API key

The `.env` file is git-ignored and must be created in each environment.

## File Structure
See [`docs/file-structure.md`](docs/file-structure.md) for an overview of repository files and directories.

## Testing & Deployment
See [`docs/testing.md`](docs/testing.md) for running backend and extension tests.
Deployment steps and security practices are described in [`docs/deployment.md`](docs/deployment.md).

## API Endpoints

- `GET /api/v1/health/` – Service health check
- `POST /api/v1/conversations/` – Store a conversation
- `POST /api/v1/conversations/search/` – Search stored memories
- `POST /api/v1/prompts/enhance/` – Enhance a prompt with relevant memories

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
desired environment (production or development) and set the API token through
the popup before capturing conversations. See
[`docs/extension-setup.md`](docs/extension-setup.md) for configuration and
testing instructions.

## Contributing Guidelines
*Contribution instructions forthcoming. Stay tuned!*

