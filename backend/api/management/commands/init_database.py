"""Management command to initialize Supabase database."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    """Run SQL statements to prepare Supabase database."""

    help = "Initialize database with pgvector and memories table"

    def handle(self, *args: Any, **options: Any) -> None:
        sql_file = Path(settings.BASE_DIR) / "supabase_setup.sql"
        if not sql_file.exists():
            raise CommandError(f"SQL file not found: {sql_file}")

        self.stdout.write(f"Executing {sql_file}...")
        sql = sql_file.read_text()
        with connection.cursor() as cursor:
            cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS("Database initialized successfully"))
