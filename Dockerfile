# Production Dockerfile for PhotoBill on GCP Cloud Run
FROM node:20-slim

# Install system dependencies: poppler-utils (pdftotext) and qpdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    qpdf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install frontend and backend dependencies
WORKDIR /app/frontend
RUN npm install

WORKDIR /app/backend
RUN npm install

# Copy application source code
WORKDIR /app
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend production bundle
WORKDIR /app/frontend
RUN npm run build

# Prepare backend runtime
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
