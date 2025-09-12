# Testing Guide

## Backend
- Install dependencies: `pip install -r backend/requirements.txt`
- Run tests: `cd backend && pytest`

## Browser Extension
- Install Node dependencies: `cd extension && npm install`
- Run tests: `npm test`

## Integration
- Backend tests mock Mem0 and database connections.
- Extend tests for real services when credentials available.
