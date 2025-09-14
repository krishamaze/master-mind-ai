import os

SECRET_KEY = "test-secret"
os.environ.setdefault("SECRET_KEY", SECRET_KEY)

from .settings import *  # noqa

DEBUG = True
SECURE_SSL_REDIRECT = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
