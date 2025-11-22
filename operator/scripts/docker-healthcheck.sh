#!/bin/sh
# Health check script for DataHaven nodes
# Uses only tools available in debian:stable-slim (shell, /proc filesystem)

# Default RPC port
RPC_PORT=${RPC_PORT:-9944}

# Convert port to hex (9944 = 0x26D8)
PORT_HEX=$(printf '%04X' "$RPC_PORT")

# Check /proc/net/tcp for listening port
# Format: local_address is IP:PORT in hex, st is state (0A = LISTEN)
if [ -f /proc/net/tcp ]; then
  # Look for the port in LISTEN state (0A)
  # The format is: slot: local_address rem_address st ...
  # We're looking for :26D8 (or our PORT_HEX) with state 0A
  if grep -q " [0-9A-F]*:${PORT_HEX} .* 0A " /proc/net/tcp 2>/dev/null; then
    echo "RPC port ${RPC_PORT} is listening"
    exit 0
  fi
fi

# Fallback: check if process is running
# If port not listening yet, still fail health check
if ps | grep -v grep | grep -q datahaven-node; then
  echo "Node process running, waiting for RPC port..."
  exit 1
fi

echo "Node is not ready"
exit 1
