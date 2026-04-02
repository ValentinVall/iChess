#!/bin/bash

# iChess Docker Setup Script
set -e

echo ""
echo "🐳 iChess Docker Setup"
echo "===================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

echo "✓ Docker is installed"
echo "  Version: $(docker --version)"
echo ""

# Setup environment file
if [ -f ".env" ]; then
    echo "✓ .env file already exists"
else
    cp .env.docker .env
    echo "✓ Created .env file from .env.docker"
    echo "  Please update Apple Sign In keys in .env"
fi

echo ""
echo "Building Docker images..."
docker-compose build

echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for database..."
sleep 5

echo ""
echo "Running database migrations..."
docker-compose exec -T backend npm run db:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000/api"
echo "  Database: localhost:5432"
echo ""
echo "View logs: docker-compose logs -f"
echo "Stop: docker-compose down"
echo ""
