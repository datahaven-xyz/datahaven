#!/bin/bash
# DataHaven Benchmarking Script using frame-omni-bencher
# This script runs benchmarks for all DataHaven pallets using frame-omni-bencher directly

set -e

# Configuration
RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}
PALLET_GROUP=${4:-all}  # Options: all, datahaven, substrate, cumulus, xcm
FEATURES="runtime-benchmarks"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Display usage if help is requested
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Usage: $0 [runtime] [steps] [repeat] [pallet_group]"
    echo ""
    echo "Arguments:"
    echo "  runtime       - Runtime to benchmark (testnet, stagenet, mainnet). Default: testnet"
    echo "  steps         - Number of steps for benchmarking. Default: 50"
    echo "  repeat        - Number of repetitions. Default: 20"
    echo "  pallet_group  - Which pallets to benchmark. Default: all"
    echo "                  Options: all, datahaven, snowbridge, substrate"
    echo ""
    echo "Examples:"
    echo "  $0                                # Benchmark all pallets for testnet"
    echo "  $0 mainnet                        # Benchmark all pallets for mainnet"
    echo "  $0 testnet 100 50                 # Custom steps and repeat"
    echo "  $0 testnet 50 20 datahaven        # Only DataHaven pallets"
    exit 0
fi

echo -e "${GREEN}DataHaven Benchmarking Script${NC}"
echo "Runtime: $RUNTIME"
echo "Steps: $STEPS"
echo "Repeat: $REPEAT"
echo "Pallet Group: $PALLET_GROUP"
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
cargo build --release --features "$FEATURES" -p datahaven-$RUNTIME-runtime

# Get the WASM path
WASM_PATH="target/release/wbuild/datahaven-$RUNTIME-runtime/datahaven_${RUNTIME}_runtime.compact.compressed.wasm"

if [ ! -f "$WASM_PATH" ]; then
    echo -e "${RED}Error: WASM runtime not found at $WASM_PATH${NC}"
    exit 1
fi

# List of all pallets to benchmark
# DataHaven custom pallets
declare -A DATAHAVEN_PALLETS=(
    ["pallet_external_validators"]="pallet_external_validators"
    ["pallet_external_validators_rewards"]="pallet_external_validators_rewards"
    ["pallet_datahaven_native_transfer"]="pallet_datahaven_native_transfer"
)

# Snowbridge pallets
declare -A SNOWBRIDGE_PALLETS=(
    ["snowbridge_pallet_ethereum_client"]="snowbridge_pallet_ethereum_client"
    ["snowbridge_pallet_inbound_queue_v2"]="snowbridge_pallet_inbound_queue_v2"
    ["snowbridge_pallet_outbound_queue_v2"]="snowbridge_pallet_outbound_queue_v2"
    ["snowbridge_pallet_system"]="snowbridge_pallet_system"
    ["snowbridge_pallet_system_v2"]="snowbridge_pallet_system_v2"
)

# Substrate pallets
declare -A SUBSTRATE_PALLETS=(
    ["pallet_balances"]="pallet_balances"
    ["pallet_multisig"]="pallet_multisig"
    ["pallet_proxy"]="pallet_proxy"
    ["pallet_sudo"]="pallet_sudo"
    ["pallet_timestamp"]="pallet_timestamp"
    ["pallet_transaction_payment"]="pallet_transaction_payment"
    ["pallet_utility"]="pallet_utility"
)

# Combine all pallets
declare -A ALL_PALLETS
for key in "${!DATAHAVEN_PALLETS[@]}"; do ALL_PALLETS[$key]="${DATAHAVEN_PALLETS[$key]}"; done
for key in "${!SNOWBRIDGE_PALLETS[@]}"; do ALL_PALLETS[$key]="${SNOWBRIDGE_PALLETS[$key]}"; done
for key in "${!SUBSTRATE_PALLETS[@]}"; do ALL_PALLETS[$key]="${SUBSTRATE_PALLETS[$key]}"; done

# Track success/failure
declare -A RESULTS

# Create runtime weights directory if it doesn't exist
WEIGHTS_DIR="runtime/$RUNTIME/src/weights"
mkdir -p "$WEIGHTS_DIR"

# Run benchmarks for each pallet using frame-omni-bencher
echo -e "\n${GREEN}Starting benchmarks...${NC}\n"

# Function to run benchmark for a pallet
benchmark_pallet() {
    local PALLET=$1
    local OUTPUT_FILE=$2
    
    echo -e "${YELLOW}Benchmarking $PALLET...${NC}"
    
    if frame-omni-bencher v1 benchmark pallet \
        --runtime "$WASM_PATH" \
        --pallet "$PALLET" \
        --extrinsic "" \
        --template weight.hbs \
        --output "$WEIGHTS_DIR/$OUTPUT_FILE.rs" \
        --steps "$STEPS" \
        --repeat "$REPEAT" 2>&1 | tee benchmark_${PALLET}.log; then
        echo -e "${GREEN}✓ $PALLET benchmarked successfully${NC}"
        RESULTS[$PALLET]="SUCCESS"
    else
        echo -e "${RED}✗ Error benchmarking $PALLET${NC}"
        RESULTS[$PALLET]="FAILED"
    fi
    echo ""
}

# Select which pallets to benchmark based on PALLET_GROUP
declare -A PALLETS_TO_BENCHMARK

case "$PALLET_GROUP" in
    "datahaven")
        echo -e "${GREEN}Benchmarking DataHaven pallets only${NC}"
        for key in "${!DATAHAVEN_PALLETS[@]}"; do 
            PALLETS_TO_BENCHMARK[$key]="${DATAHAVEN_PALLETS[$key]}"
        done
        ;;
    "snowbridge")
        echo -e "${GREEN}Benchmarking Snowbridge pallets only${NC}"
        for key in "${!SNOWBRIDGE_PALLETS[@]}"; do 
            PALLETS_TO_BENCHMARK[$key]="${SNOWBRIDGE_PALLETS[$key]}"
        done
        ;;
    "substrate")
        echo -e "${GREEN}Benchmarking Substrate pallets only${NC}"
        for key in "${!SUBSTRATE_PALLETS[@]}"; do 
            PALLETS_TO_BENCHMARK[$key]="${SUBSTRATE_PALLETS[$key]}"
        done
        ;;
    "all"|*)
        echo -e "${GREEN}Benchmarking all pallets${NC}"
        for key in "${!ALL_PALLETS[@]}"; do 
            PALLETS_TO_BENCHMARK[$key]="${ALL_PALLETS[$key]}"
        done
        ;;
esac

# Benchmark selected pallets
for PALLET in "${!PALLETS_TO_BENCHMARK[@]}"; do
    OUTPUT_FILE="${PALLETS_TO_BENCHMARK[$PALLET]}"
    benchmark_pallet "$PALLET" "$OUTPUT_FILE"
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