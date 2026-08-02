#!/bin/bash
set -e

# Recapito Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Recapito Deployment - $ENVIRONMENT"
echo "=========================================="

# Check for required files
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Error: .env file not found!"
    echo "Copy .env.production.example to .env and configure it."
    exit 1
fi

cd "$PROJECT_DIR/docker"

# Load environment
set -a
source "$PROJECT_DIR/.env"
set +a

echo "Step 1: Pulling latest images..."
docker compose -f docker-compose.prod.yml pull

echo "Step 2: Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm backend node -e "
const { DataSource } = require('typeorm');
const config = require('./dist/config/typeorm.config').default;
config.initialize().then(ds => ds.runMigrations()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"

echo "Step 3: Starting services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "Step 4: Waiting for services to be healthy..."
sleep 10

echo "Step 5: Health check..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "Backend is healthy!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Error: Backend health check failed!"
    docker compose -f docker-compose.prod.yml logs backend
    exit 1
fi

echo "Step 6: Cleaning up old images..."
docker image prune -f

echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
docker compose -f docker-compose.prod.yml ps
