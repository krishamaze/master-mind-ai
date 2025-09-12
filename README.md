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

## Technology Stack
- Django
- PostgreSQL
- pgvector
- Mem0.ai
- Chrome Extension (Manifest V3)

## Development Setup

### Browser Extension
The extension source resides in the `extension/` directory. Load this folder as
an unpacked extension from Chrome's Extensions page (Developer Mode). Configure
the backend URL and API token through the popup before capturing
conversations.

## Contributing Guidelines
*Contribution instructions forthcoming. Stay tuned!*

