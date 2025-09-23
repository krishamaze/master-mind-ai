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
    app_id = data.get("app_id")
    run_id = data.get("run_id")
    if not prompt:
        return JsonResponse({"detail": "prompt is required"}, status=400)
    if not user_id:
        return JsonResponse({"detail": "user_id is required"}, status=400)

    try:
        service = MemoryService()
        cleaned_prompt = service.openai_light_cleanup(prompt)

        filters = {}
        if app_id:
            filters["app_id"] = app_id
        if run_id:
            filters["run_id"] = run_id

        memories = service.search_memories(
            cleaned_prompt,
            user_id=user_id,
            filters=filters or None,
        )

        context_snippets = []
        seen_snippets = set()
        for memory in memories:
            text = MemoryService.extract_memory_text(memory)
            if isinstance(text, str) and text and text not in seen_snippets:
                context_snippets.append(text)
                seen_snippets.add(text)

        if not context_snippets:
            return JsonResponse({"enhanced_prompt": cleaned_prompt})

        context_block = "\n".join(context_snippets)
        contextual_prompt = f"{context_block}\n\n{cleaned_prompt}" if context_block else cleaned_prompt
        enhanced = service.enhance_prompt(contextual_prompt, user_id=user_id)
        return JsonResponse({"enhanced_prompt": enhanced or cleaned_prompt})
    except APIError as exc:  # pragma: no cover - external dependency
        logger.error("Prompt enhancement failed: %s", exc)
        return JsonResponse({"detail": str(exc)}, status=400)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Prompt enhancement failed: %s", exc)
        return JsonResponse({"detail": "enhancement failed"}, status=500)
