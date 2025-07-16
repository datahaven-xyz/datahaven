#!/bin/bash

# Test script for monitoring stack

echo "🧪 Testing monitoring stack..."

# Create the DataHaven network if it doesn't exist
echo "📦 Creating DataHaven network..."
docker network create datahaven-net 2>/dev/null || echo "Network already exists"

# Start the monitoring stack
echo "🚀 Starting monitoring stack..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check if all services are running
echo "🔍 Checking service status..."
docker compose ps

# Show logs from Alloy to verify it's collecting logs
echo "📋 Alloy logs (last 20 lines):"
docker compose logs alloy --tail=20

echo "✅ Test complete!"
echo "📊 Access Grafana at: http://localhost:3000 (admin/admin)"
echo "📝 Access Loki at: http://localhost:3100"
echo ""
echo "🛑 To stop the monitoring stack, run: docker compose down"