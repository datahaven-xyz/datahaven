#!/bin/bash
# DataHaven Benchmarking Script using frame-omni-bencher
# This script runs benchmarks for all DataHaven pallets using frame-omni-bencher directly

set -e

# Configuration
RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}
FEATURES="runtime-benchmarks"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}DataHaven Benchmarking Script${NC}"
echo "Runtime: $RUNTIME"
echo "Steps: $STEPS"
echo "Repeat: $REPEAT"
echo ""

# Ensure frame-omni-bencher is installed
if ! command -v frame-omni-bencher &> /dev/null; then
    echo -e "${YELLOW}Installing frame-omni-bencher...${NC}"
    cargo install frame-omni-bencher
fi

# Ensure weight template exists
if [ ! -f "weight.hbs" ]; then
    echo -e "${YELLOW}Weight template not found. Creating from default...${NC}"
    # Use the local template we just created
    if [ ! -f "weight.hbs" ]; then
        echo -e "${RED}Error: weight.hbs template file not found!${NC}"
        echo "Please ensure weight.hbs exists in the operator directory"
        exit 1
    fi
fi

# Build the runtime WASM
echo -e "${YELLOW}Building runtime $RUNTIME with features: $FEATURES${NC}"
cargo build --release --features "$FEATURES" -p datahaven-runtime-$RUNTIME

# Get the WASM path
WASM_PATH="target/release/wbuild/datahaven-runtime-$RUNTIME/datahaven_runtime_${RUNTIME}.compact.compressed.wasm"

if [ ! -f "$WASM_PATH" ]; then
    echo -e "${RED}Error: WASM runtime not found at $WASM_PATH${NC}"
    exit 1
fi

# List of custom pallets with their directory names
declare -A PALLETS=(
    ["pallet_external_validators"]="external-validators"
    ["pallet_external_validators_rewards"]="external-validators-rewards"
    ["pallet_datahaven_native_transfer"]="datahaven-native-transfer"
    ["pallet_ethereum_client"]="ethereum-client"
    ["pallet_inbound_queue_v2"]="inbound-queue-v2"
    ["pallet_outbound_queue_v2"]="outbound-queue-v2"
    ["pallet_system"]="system"
    ["pallet_system_v2"]="system-v2"
)

# Track success/failure
declare -A RESULTS

# Run benchmarks for each pallet using frame-omni-bencher
echo -e "\n${GREEN}Starting benchmarks...${NC}\n"

for PALLET in "${!PALLETS[@]}"; do
    DIR="${PALLETS[$PALLET]}"
    OUTPUT_PATH="pallets/$DIR/src/weights.rs"
    
    echo -e "${YELLOW}Benchmarking $PALLET...${NC}"
    
    if frame-omni-bencher v1 benchmark pallet \
        --runtime "$WASM_PATH" \
        --pallet "$PALLET" \
        --extrinsic "" \
        --template weight.hbs \
        --output "$OUTPUT_PATH" \
        --steps "$STEPS" \
        --repeat "$REPEAT" 2>&1 | tee benchmark_${PALLET}.log; then
        echo -e "${GREEN}✓ $PALLET benchmarked successfully${NC}"
        RESULTS[$PALLET]="SUCCESS"
    else
        echo -e "${RED}✗ Error benchmarking $PALLET${NC}"
        RESULTS[$PALLET]="FAILED"
    fi
    echo ""
done

# Summary
echo -e "\n${GREEN}Benchmarking Summary:${NC}"
echo "========================"
for PALLET in "${!RESULTS[@]}"; do
    if [ "${RESULTS[$PALLET]}" == "SUCCESS" ]; then
        echo -e "${GREEN}✓${NC} $PALLET"
    else
        echo -e "${RED}✗${NC} $PALLET"
    fi
done

# Check if all succeeded
FAILED_COUNT=0
for RESULT in "${RESULTS[@]}"; do
    if [ "$RESULT" == "FAILED" ]; then
        ((FAILED_COUNT++))
    fi
done

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}All benchmarks completed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}$FAILED_COUNT benchmark(s) failed. Check the logs for details.${NC}"
    exit 1
fi