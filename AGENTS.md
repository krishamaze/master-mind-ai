# AGENTS Instructions
- Extension priority: align all calls with FastAPI `/api/v1` routes, drop `/api/v1/conversations` & `/api/debug-logs`, and allow app IDs with 3+ characters.
- Before adding new helpers, confirm no existing utility already covers the need.
- Deployments target FastAPI on Uvicorn; avoid Django commands or Gunicorn configs when updating scripts.
