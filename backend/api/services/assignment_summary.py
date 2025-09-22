"""Utilities for generating assignment descriptions from memories."""

from __future__ import annotations

import logging
from typing import Iterable, List, Optional

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = (
    "You are an assistant that summarizes grouped memories for Master Mind AI. "
    "Given the following memory snippets, respond with a single concise sentence "
    "describing the theme of these memories. Do not exceed 20 words and do not "
    "include quotation marks."
)


def summarize_memories(snippets: Iterable[str]) -> Optional[str]:
    """Generate a short description summarizing the provided memory snippets."""

    texts: List[str] = [snippet.strip() for snippet in snippets if snippet]
    if not texts:
        return None

    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        logger.info("Skipping assignment summary generation; OPENAI_API_KEY is not configured")
        return None

    model = getattr(
        settings,
        "OPENAI_ASSIGNMENT_MODEL",
        getattr(settings, "OPENAI_ERROR_MODEL", "gpt-4o-mini"),
    )
    temperature = getattr(settings, "OPENAI_ASSIGNMENT_TEMPERATURE", 0.2)
    try:
        temperature_value = float(temperature)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid OPENAI_ASSIGNMENT_TEMPERATURE %s; defaulting to 0.2",
            temperature,
        )
        temperature_value = 0.2

    client = OpenAI(api_key=api_key)
    prompt = "\n".join([SUMMARY_PROMPT, "", *[f"- {text}" for text in texts]])

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature_value,
        )
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Failed to generate assignment summary: %s", exc)
        return None

    choice = response.choices[0] if getattr(response, "choices", None) else None
    content = choice.message.content.strip() if choice and choice.message else ""
    return content or None


__all__ = ["summarize_memories"]
