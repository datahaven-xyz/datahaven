#!/bin/bash
set -euo pipefail

# Negative check: ensure the snapshot-diff storage layout script fails when the layout is broken.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

set +e
OUTPUT="$(
    CONTRACT="DataHavenServiceManagerBadLayout" \
        SNAPSHOT="storage-snapshots/DataHavenServiceManager.storage.json" \
        ./scripts/check-storage-layout.sh 2>&1
)"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "ERROR: Expected storage layout check to fail for DataHavenServiceManagerBadLayout, but it succeeded."
    exit 1
fi

if ! printf '%s\n' "$OUTPUT" | grep -q "ERROR: Storage layout has changed!"; then
    echo "ERROR: Storage layout check failed, but not for the expected reason."
    echo ""
    echo "Output:"
    echo "$OUTPUT"
    exit 1
fi

echo "Negative check OK: storage layout check failed as expected for DataHavenServiceManagerBadLayout."

