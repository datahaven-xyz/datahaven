#!/bin/bash
# Quick script to benchmark a single pallet using frame-omni-bencher

set -e

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <pallet_name> [runtime] [steps] [repeat]"
    echo "Example: $0 pallet_external_validators testnet 50 20"
    exit 1
fi

PALLET=$1
RUNTIME=${2:-testnet}
STEPS=${3:-50}
REPEAT=${4:-20}

# Map pallet names to directories
declare -A PALLET_DIRS=(
    ["pallet_external_validators"]="external-validators"
    ["pallet_external_validators_rewards"]="external-validators-rewards"
    ["pallet_datahaven_native_transfer"]="datahaven-native-transfer"
    ["pallet_ethereum_client"]="ethereum-client"
    ["pallet_inbound_queue_v2"]="inbound-queue-v2"
    ["pallet_outbound_queue_v2"]="outbound-queue-v2"
    ["pallet_system"]="system"
    ["pallet_system_v2"]="system-v2"
)

# Get the directory for this pallet
DIR="${PALLET_DIRS[$PALLET]}"
if [ -z "$DIR" ]; then
    echo "Error: Unknown pallet $PALLET"
    echo "Available pallets:"
    for p in "${!PALLET_DIRS[@]}"; do
        echo "  - $p"
    done
    exit 1
fi

# Ensure frame-omni-bencher is installed
if ! command -v frame-omni-bencher &> /dev/null; then
    echo "Installing frame-omni-bencher..."
    cargo install frame-omni-bencher
fi

# Ensure weight template exists
if [ ! -f "weight.hbs" ]; then
    echo "Error: weight.hbs template file not found!"
    echo "Please run from the operator directory where weight.hbs exists"
    exit 1
fi

# Build runtime if needed
WASM_PATH="target/release/wbuild/datahaven-runtime-$RUNTIME/datahaven_runtime_${RUNTIME}.compact.compressed.wasm"
if [ ! -f "$WASM_PATH" ] || [ "$WASM_PATH" -ot "runtime/$RUNTIME/src/lib.rs" ]; then
    echo "Building runtime $RUNTIME..."
    cargo build --release --features "runtime-benchmarks" -p datahaven-runtime-$RUNTIME
fi

# Run the benchmark
echo "Benchmarking $PALLET (runtime: $RUNTIME, steps: $STEPS, repeat: $REPEAT)..."
frame-omni-bencher v1 benchmark pallet \
    --runtime "$WASM_PATH" \
    --pallet "$PALLET" \
    --extrinsic "" \
    --template weight.hbs \
    --output "pallets/$DIR/src/weights.rs" \
    --steps "$STEPS" \
    --repeat "$REPEAT"

echo "Benchmark complete! Weights written to pallets/$DIR/src/weights.rs"