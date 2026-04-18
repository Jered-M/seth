FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    USE_SQLITE=false \
    ENABLE_SCHEDULER=true

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 5000

# Use gunicorn for production, binding to the port provided by Render
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 run:app"]
