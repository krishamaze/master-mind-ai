# Master Mind AI FastAPI Service

This directory contains the experimental FastAPI implementation of the Master Mind AI backend.

## Features

- Lightweight health check endpoint that avoids Mem0 calls
- User app ID discovery via Mem0
- Assignment namespace initialisation without a relational database
- Two-stage prompt enhancement using Mem0 memories and OpenAI chat completions
- Memory search endpoint that replaces the legacy conversation search

## Getting Started

```bash
cd backend-v2
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export MEM0_API_KEY="your_mem0_key"
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for automatically generated API documentation.

## Environment Variables

- `MEM0_API_KEY` (required): API key for Mem0.
- `OPENAI_API_KEY` (optional): Forwarded to Mem0 chat completions when set.

## Docker

```bash
docker build -t mastermind-fastapi .
docker run -p 8000:8000 -e MEM0_API_KEY=your_key mastermind-fastapi
```
