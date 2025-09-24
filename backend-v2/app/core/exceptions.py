"""Exception handling utilities."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return a JSON payload when validation fails."""

    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body,
        },
    )


def setup_exception_handlers(app: FastAPI) -> None:
    """Register shared exception handlers for the application."""

    app.add_exception_handler(RequestValidationError, validation_exception_handler)


__all__ = ["setup_exception_handlers"]
