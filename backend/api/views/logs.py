"""Views for ingesting console logs from the browser extension."""

from __future__ import annotations

import logging
from typing import Any, Dict

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..serializers import ConsoleLogBatchSerializer

logger = logging.getLogger(__name__)

LEVEL_MAPPING = {
    "error": logging.ERROR,
    "warn": logging.WARNING,
    "warning": logging.WARNING,
    "info": logging.INFO,
    "log": logging.INFO,
    "debug": logging.DEBUG,
}


@api_view(["POST"])
@permission_classes([AllowAny])
def ingest_console_logs(request) -> Response:
    """Accept console log batches forwarded by the browser extension."""

    serializer = ConsoleLogBatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data

    entries = payload["entries"]
    platform = payload.get("platform")
    page_url = payload.get("page_url")
    first_logged_at = payload.get("first_logged_at")

    logger.info(
        "Received console log batch",
        extra={
            "platform": platform,
            "page_url": page_url,
            "entries": len(entries),
            "first_logged_at": first_logged_at.isoformat()
            if first_logged_at
            else None,
        },
    )

    for entry in entries:
        log_level = LEVEL_MAPPING.get(entry["level"].lower(), logging.INFO)
        logger.log(
            log_level,
            "Console log entry",
            extra=_build_entry_metadata(entry, platform, page_url),
        )

    return Response(
        {"status": "accepted", "entries": len(entries)},
        status=status.HTTP_202_ACCEPTED,
    )


def _build_entry_metadata(
    entry: Dict[str, Any], platform: str | None, page_url: str | None
) -> Dict[str, Any]:
    """Normalize console log entry metadata for structured logging."""

    timestamp = entry.get("timestamp")
    return {
        "platform": platform,
        "page_url": page_url,
        "level": entry.get("level"),
        "timestamp": timestamp.isoformat() if timestamp else None,
        "messages": entry.get("messages", []),
    }
