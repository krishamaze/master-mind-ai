"""Services for analyzing console errors with OpenAI."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Iterable, List, Mapping, MutableMapping, Optional

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


class ErrorAnalysisConfigurationError(RuntimeError):
    """Raised when the OpenAI client cannot be configured."""


METAPROMPT = """You are Master Mind AI's automated debugger.
Your task is to analyze JavaScript console errors captured from our browser extension and produce the exact code change that resolves the failure.

Follow these steps carefully:
1. Identify the primary error category. Use one of: DOM_SELECTOR, API_FAILURE, JS_RUNTIME, NETWORK, CONFIGURATION, PERMISSION, UNKNOWN.
2. Decide which source file must be edited. Choose from only these areas:
   - extension/content scripts (e.g. extension/content/*.js)
   - backend Django views (e.g. backend/api/views/*.py)
   - extension configuration (e.g. extension/shared/*.js or manifest files)
3. Explain the root cause and outline the fix.
4. Produce the complete updated code for the selected file. Do not provide diff markers—return the full file contents exactly as it should appear after the fix.

Respond strictly with minified JSON using this structure:
{
  "error_type": "<CATEGORY>",
  "target_file": "<relative/path/to/file>",
  "explanation": "<one sentence summary>",
  "resolution": {
    "path": "<relative/path/to/file>",
    "code": "<entire updated file contents>"
  }
}
"""


def analyze_console_errors(
    entries: Iterable[Mapping[str, object]],
    *,
    platform: Optional[str] = None,
    page_url: Optional[str] = None,
    first_logged_at: Optional[datetime] = None,
) -> str:
    """Send console errors to OpenAI and return the structured response."""

    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise ErrorAnalysisConfigurationError("OPENAI_API_KEY is not configured")

    model = getattr(settings, "OPENAI_ERROR_MODEL", "gpt-4o-mini")
    temperature_setting = getattr(settings, "OPENAI_ERROR_TEMPERATURE", 0.0)
    try:
        temperature = float(temperature_setting)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid OPENAI_ERROR_TEMPERATURE %s; falling back to 0.0",
            temperature_setting,
        )
        temperature = 0.0

    client = OpenAI(api_key=api_key)

    prompt = _render_prompt(entries, platform=platform, page_url=page_url, first_logged_at=first_logged_at)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": METAPROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        raise RuntimeError("Empty response from OpenAI error analysis")

    message_content = choice.message.content

    _log_response_preview(message_content)

    return message_content


def _render_prompt(
    entries: Iterable[Mapping[str, object]],
    *,
    platform: Optional[str],
    page_url: Optional[str],
    first_logged_at: Optional[datetime],
) -> str:
    """Format console error entries into a prompt payload."""

    header: List[str] = [
        "Analyze the following console.error events and respond with the required JSON only.",
        f"Platform: {platform or 'unknown'}",
        f"Page URL: {page_url or 'unknown'}",
    ]
    if first_logged_at:
        header.append(f"First logged at: {first_logged_at.isoformat()}")

    details: List[str] = []
    for entry in entries:
        timestamp = _as_timestamp(entry.get("timestamp"))
        messages = entry.get("messages") or []
        if not isinstance(messages, list):
            messages = [str(messages)]
        formatted_messages = " | ".join(str(msg) for msg in messages)
        details.append(f"- {timestamp}: {formatted_messages}")

    if not details:
        details.append("- No console.error payload provided.")

    return "\n".join(header + ["Errors:"] + details)


def _as_timestamp(value: object) -> str:
    """Render timestamp-like objects as ISO strings."""

    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return "unknown"
    return str(value)


def _log_response_preview(content: str) -> None:
    """Emit a short preview of the OpenAI response for traceability."""

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        logger.debug("OpenAI analysis response is not JSON; raw content logged")
        preview: MutableMapping[str, object] = {"raw": content[:200]}
    else:
        preview = {k: parsed.get(k) for k in ("error_type", "target_file")}

    logger.info("Console error analysis response", extra={"preview": preview})


__all__ = [
    "ErrorAnalysisConfigurationError",
    "analyze_console_errors",
]

