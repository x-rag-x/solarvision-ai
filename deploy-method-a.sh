#!/usr/bin/env bash
set -euo pipefail

echo "=============================================================================="
echo "SolarVision AI — Method A: Docker Compose Deployment"
echo "=============================================================================="

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Install Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check for Docker Compose V2
if ! docker compose version >/dev/null 2>&1; then
    echo "[ERROR] 'docker compose' is not available. Please install Docker Compose plugin."
    exit 1
fi

echo "[OK] Docker and Docker Compose detected."

# Setup .env if missing
if [ ! -f ".env" ]; then
    echo "[INFO] .env not found. Copying from .env.example..."
    cp .env.example .env
    # Generate random 32-character JWT_SECRET if OpenSSL is available
    if command -v openssl >/dev/null 2>&1; then
        RANDOM_SECRET=$(openssl rand -hex 24)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=${RANDOM_SECRET}/" .env
        echo "[INFO] Generated random 48-character JWT_SECRET in .env"
    fi
fi

# Build and launch
echo "[INFO] Building and starting SolarVision AI container with Docker Compose..."
docker compose up --build -d

echo "=============================================================================="
echo "[SUCCESS] SolarVision AI container launched successfully!"
echo "=============================================================================="
echo ""
docker compose ps
echo ""
echo "Application URL: http://localhost:3000"
echo "Check logs:      docker compose logs -f solarvision"
echo "Stop container:  docker compose down"
