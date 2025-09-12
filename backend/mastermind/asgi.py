"""ASGI config for Master Mind AI project."""
from __future__ import annotations

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mastermind.settings")

application = get_asgi_application()
