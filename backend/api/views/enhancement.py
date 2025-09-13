"""Endpoint for prompt enhancement using stored memories."""
from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..services.memory_service import MemoryService

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
    if not prompt:
        return JsonResponse({"detail": "prompt is required"}, status=400)

    try:
        enhanced = MemoryService().enhance_prompt(prompt)
        return JsonResponse({"prompt": enhanced})
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Prompt enhancement failed: %s", exc)
        return JsonResponse({"detail": "enhancement failed"}, status=500)
