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

# Validate pallet name
VALID_PALLETS=(
    "pallet_external_validators"
    "pallet_external_validators_rewards"
    "pallet_datahaven_native_transfer"
    "pallet_ethereum_client"
    "pallet_inbound_queue_v2"
    "pallet_outbound_queue_v2"
    "pallet_system"
    "pallet_system_v2"
    "pallet_balances"
    "pallet_multisig"
    "pallet_proxy"
    "pallet_session"
    "pallet_sudo"
    "pallet_timestamp"
    "pallet_transaction_payment"
    "pallet_utility"
    "cumulus_pallet_parachain_system"
    "cumulus_pallet_xcmp_queue"
    "pallet_xcm"
)

if [[ ! " ${VALID_PALLETS[@]} " =~ " ${PALLET} " ]]; then
    echo "Error: Unknown pallet $PALLET"
    echo "Available pallets:"
    for p in "${VALID_PALLETS[@]}"; do
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

# Create runtime weights directory if it doesn't exist
WEIGHTS_DIR="runtime/$RUNTIME/src/weights"
mkdir -p "$WEIGHTS_DIR"

# Run the benchmark
echo "Benchmarking $PALLET (runtime: $RUNTIME, steps: $STEPS, repeat: $REPEAT)..."
frame-omni-bencher v1 benchmark pallet \
    --runtime "$WASM_PATH" \
    --pallet "$PALLET" \
    --extrinsic "" \
    --template weight.hbs \
    --output "$WEIGHTS_DIR/$PALLET.rs" \
    --steps "$STEPS" \
    --repeat "$REPEAT"

echo "Benchmark complete! Weights written to $WEIGHTS_DIR/$PALLET.rs"