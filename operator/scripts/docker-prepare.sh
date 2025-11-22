#!/bin/bash

set -e

echo "🔨 Building DataHaven node binary..."

# Check if fast-runtime flag should be used
if [ "$1" == "--fast" ]; then
    echo "📦 Building with fast-runtime feature..."
    cargo build --release --features fast-runtime
else
    echo "📦 Building production binary..."
    cargo build --release
fi

echo "📋 Copying binary to build directory..."
mkdir -p build
cp target/release/datahaven-node build/

echo "✅ Binary prepared for Docker build!"
echo ""
echo "You can now run:"
echo "  docker-compose up -d          # Start the network"
echo "  docker-compose logs -f        # View logs"
echo "  docker-compose down           # Stop the network"
