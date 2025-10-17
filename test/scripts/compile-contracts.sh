#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bun x tsx "${SCRIPT_DIR}/compile-contracts.ts" "$@"

