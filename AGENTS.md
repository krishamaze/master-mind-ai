# AGENTS Instructions

## Project Architecture & Component Overview
- **Browser Extension**: Content scripts capture conversations, background workers manage messaging, popup provides user interface.
- **Django Backend**: REST API for conversation storage and prompt enhancement.
- **Database**: PostgreSQL with pgvector for vector storage.
- **Memory Layer**: Mem0.ai for intelligent memory management and retrieval.

## Coding Standards
- **Python/Django**: Follow PEP 8, use Django best practices, and type hints where practical.
- **JavaScript**: Use ES6+ syntax and modular structure.

## File Structure & Organization
- Group Django apps by feature; keep settings, urls, models, views, and serializers organized.
- Browser extension files should separate content scripts, background scripts, and popup assets.

## Database Migration & Model Guidelines
- Use Django migrations for all schema changes.
- Keep pgvector fields named with `_embedding` suffix.

## API Endpoint Naming Conventions
- Use RESTful patterns: `/api/conversations/`, `/api/prompts/`.
- Version API routes via `/api/v1/` as needed.

## Browser Extension Development Guidelines
- Follow Chrome Extension Manifest V3 specifications.
- Keep content scripts lightweight and delegate heavy work to background workers.

## Testing Requirements
- Write unit tests for Django views, serializers, and models.
- Include integration tests for Mem0.ai interactions when possible.

## Dependencies & Version Management
- Pin Python packages in `requirements.txt` and JavaScript packages in `package.json`.
- Use pgvector-compatible PostgreSQL versions.

## Development Workflow
- Web-based development workflow only; avoid terminal commands in production setup.
- Commit small, focused changes with descriptive messages.

## Integration Patterns with Mem0.ai
- Use the official Mem0.ai SDK for memory operations.
- Store embeddings in pgvector and reference Mem0.ai identifiers for retrieval.

