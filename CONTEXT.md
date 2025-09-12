# Master Mind AI Project Context

## Architecture Context
- **Browser Extension**: Includes content scripts, background scripts, and a popup interface that capture and relay AI conversations.
- **Django Backend**: Provides REST API endpoints for conversation storage and prompt enhancement.
- **Database**: PostgreSQL with the pgvector extension for semantic embeddings.
- **Memory Layer**: Mem0.ai manages intelligent organization and retrieval of stored conversations.
- **Integration**: The extension captures conversations and the backend enriches future prompts with relevant context.

## Development Context
- Web-based development workflow (GitHub web UI, Codex agent).
- No terminal or VSCode usage; rely on browser-based tools only.
- Iterate on single components at a time.
- Provide evidence-driven problem solving with complete logs.
- Handle complexity progressively.

## Technical Context
- Django REST Framework powers API endpoints.
- Chrome Extension Manifest V3 for extension architecture.
- PostgreSQL with pgvector enables vector similarity search.
- Mem0.ai SDK handles memory operations.
- CORS configured to allow extension communication.

## Business Context
- Delivers universal AI memory enhancement across platforms.
- Maintains persistent context awareness for AI conversations.
- Supports automated project detection and categorization.
- Optimizes token usage through intelligent context provision.

