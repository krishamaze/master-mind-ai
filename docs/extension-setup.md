# Extension Setup Guide

## CORS Configuration
Ensure the backend allows requests from the extension by setting the following
in Django settings:
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'https://master-mind-ai.onrender.com',
    'chrome-extension://<extension-id>'
]
```
Replace `<extension-id>` with the generated extension ID once the extension is
loaded in Chrome.

## Retrieve Extension ID
1. Load the `extension/` folder as an unpacked extension in Chrome.
2. On the extensions page, locate "Master Mind AI" and copy its ID.
3. Use this ID in backend CORS settings and any API configuration as needed.

## Render Environment Variables
Update `API_BASE_URL` and related secrets in Render dashboard:
- `API_BASE_URL` → `https://master-mind-ai.onrender.com`
- Any additional tokens required by the extension or backend.

## Background Worker Behavior
- The background script checks backend health on startup and when the extension is installed.
- Saved conversations automatically include an ISO timestamp in their request payload.

## Testing Procedures
- Run Jest tests for the extension:
  ```bash
  cd extension
  npm test
  ```
- Verify health endpoint:
  ```bash
  curl https://master-mind-ai.onrender.com/api/v1/health/
  ```
- Load the extension and confirm the popup shows a connected status.
- Trigger a conversation capture and check for successful API responses in the
  console.
