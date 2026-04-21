# STAGE 1: Build the Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# STAGE 2: Build the Backend and Final Image
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    USE_SQLITE=false

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Expose the port (Render will provide $PORT)
EXPOSE 5000

# Start command
WORKDIR /app/backend
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 run:app"]
