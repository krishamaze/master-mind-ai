"""Endpoint for prompt enhancement using stored memories."""

from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..services.memory_service import MemoryService
from mem0.client.utils import APIError

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def enhance_prompt(request):
    """Enhance a user prompt with relevant memories."""
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "invalid JSON"}, status=400)

    prompt = data.get("prompt")
    user_id = data.get("user_id")
    if not prompt:
        return JsonResponse({"detail": "prompt is required"}, status=400)
    if not user_id:
        return JsonResponse({"detail": "user_id is required"}, status=400)

    try:
        enhanced = MemoryService().enhance_prompt(prompt, user_id=user_id)
        return JsonResponse({"enhanced_prompt": enhanced})
    except APIError as exc:  # pragma: no cover - external dependency
        logger.error("Prompt enhancement failed: %s", exc)
        return JsonResponse({"detail": str(exc)}, status=400)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Prompt enhancement failed: %s", exc)
        return JsonResponse({"detail": "enhancement failed"}, status=500)
