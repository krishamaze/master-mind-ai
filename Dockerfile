# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for deploying Master Mind AI on Render

# Base build stage
FROM python:3.11-slim AS build

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install Python dependencies separately to leverage Docker layer caching
COPY backend/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy application source
COPY backend /app

# Production stage
FROM python:3.11-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy installed packages and application code from build stage
COPY --from=build /usr/local /usr/local
COPY --from=build /app /app

# Expose port provided by Render
ENV PORT=8000
EXPOSE $PORT

# Gunicorn startup command uses Render's PORT environment variable
CMD gunicorn mastermind.wsgi:application --bind 0.0.0.0:$PORT
