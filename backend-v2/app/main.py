"""FastAPI application entry point for Master Mind AI."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.routers import assignments, enhancement, health, memories, users


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown hooks."""

    logger.info("\U0001F680 Starting Master Mind AI FastAPI server")
    try:
        yield
    finally:
        logger.info("\U0001F6D1 Shutting down Master Mind AI server")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered conversation enhancement with Mem0",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_exception_handlers(app)

app.include_router(health.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")
app.include_router(enhancement.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")


__all__ = ["app"]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
