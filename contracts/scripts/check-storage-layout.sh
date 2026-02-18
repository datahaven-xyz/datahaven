#!/bin/bash
set -e

# Storage Layout Check Script
# Compares current storage layout against committed snapshot to detect unintended changes.

CONTRACT="${CONTRACT:-DataHavenServiceManager}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-storage-snapshots}"
SNAPSHOT="${SNAPSHOT:-${SNAPSHOT_DIR}/${CONTRACT}.storage.json}"

# Ensure we're in the contracts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if snapshot exists
if [ ! -f "$SNAPSHOT" ]; then
    echo "ERROR: Snapshot file not found: $SNAPSHOT"
    echo "Generate it with: mkdir -p $SNAPSHOT_DIR && forge inspect $CONTRACT storage --json > $SNAPSHOT"
    exit 1
fi

# Generate current layout
echo "Generating current storage layout for $CONTRACT..."
forge inspect "$CONTRACT" storage --json > /tmp/current_layout.json

# Normalize both files for comparison:
# - Remove astId (changes with compiler runs)
# - Remove contract field (contains full path)
# - Remove types section (contains unstable AST IDs)
# - Sort by slot number
normalize_json() {
    jq 'del(.types)
        | .storage
        | map(
            del(.astId, .contract)
            # Remove unstable AST IDs from type strings (e.g., t_contract(IGatewayV2)12345, nested mappings)
            | .type |= gsub("\\)[0-9]+"; ")")
          )
        | sort_by(.slot | tonumber)' "$1"
}

echo "Comparing storage layouts..."
normalize_json "$SNAPSHOT" > /tmp/snap_normalized.json
normalize_json /tmp/current_layout.json > /tmp/curr_normalized.json

if ! diff -q /tmp/snap_normalized.json /tmp/curr_normalized.json > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "ERROR: Storage layout has changed!"
    echo "=========================================="
    echo ""
    echo "Differences found:"
    diff /tmp/snap_normalized.json /tmp/curr_normalized.json || true
    echo ""
    echo "If this change is intentional, update the snapshot:"
    echo "  forge inspect $CONTRACT storage --json > $SNAPSHOT"
    echo ""
    echo "WARNING: Unintended storage layout changes can corrupt state during upgrades!"
    exit 1
fi

echo "Storage layout OK - no changes detected"
