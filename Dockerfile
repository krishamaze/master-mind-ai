# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required by Mem0/OpenAI clients
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend-v2/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

COPY backend-v2 /app/backend-v2

ENV PORT=8000
EXPOSE ${PORT}

CMD ["uvicorn", "backend-v2.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
