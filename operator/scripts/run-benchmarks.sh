#!/bin/bash
# DataHaven Benchmarking Script
# Uses frame-omni-bencher for most pallets.
# Pallets listed in NODE_PALLETS are benchmarked via the native node binary instead,
# because frame-omni-bencher's WASM host lacks the crypto primitives they require
# (e.g. pallet_grandpa needs a real ed25519 verifier for report_equivocation).

set -e

# Configuration
RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}
FEATURES="runtime-benchmarks"

# Pallets that must be benchmarked via the native node binary instead of frame-omni-bencher.
# Add pallet names here (space-separated) when their benchmarks require crypto or host
# functions that the WASM execution environment cannot provide.
NODE_PALLETS=("pallet_grandpa")

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Display usage if help is requested
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Usage: $0 [runtime] [steps] [repeat]"
    echo ""
    echo "Arguments:"
    echo "  runtime  - Runtime to benchmark (testnet, stagenet, mainnet). Default: testnet"
    echo "  steps    - Number of steps for benchmarking. Default: 50"
    echo "  repeat   - Number of repetitions. Default: 20"
    echo ""
    echo "Examples:"
    echo "  $0                        # Benchmark all pallets for testnet"
    echo "  $0 mainnet                # Benchmark all pallets for mainnet"
    echo "  $0 testnet 100 50         # Custom steps and repeat"
    exit 0
fi

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
TEMPLATE_PATH="benchmarking/frame-weight-template.hbs"
if [ ! -f "$TEMPLATE_PATH" ]; then
    echo -e "${RED}Error: Weight template file not found at $TEMPLATE_PATH${NC}"
    echo "Please ensure the template exists in the benchmarking directory"
    exit 1
fi

# Build the runtime WASM and the node binary
echo -e "${YELLOW}Building runtime $RUNTIME and node (production profile) with features: $FEATURES${NC}"
cargo build --profile production --features "$FEATURES" \
    -p datahaven-$RUNTIME-runtime \
    -p datahaven-node

NODE_BIN="target/production/datahaven-node"
if [ ! -f "$NODE_BIN" ]; then
    echo -e "${RED}Error: Node binary not found at $NODE_BIN${NC}"
    exit 1
fi

# Get the WASM path
WASM_PATH="target/production/wbuild/datahaven-$RUNTIME-runtime/datahaven_${RUNTIME}_runtime.compact.compressed.wasm"

if [ ! -f "$WASM_PATH" ]; then
    echo -e "${RED}Error: WASM runtime not found at $WASM_PATH${NC}"
    exit 1
fi

# Discover pallets automatically using frame-omni-bencher
echo -e "${YELLOW}Discovering available pallets...${NC}"
PALLETS=($(
  frame-omni-bencher v1 benchmark pallet \
    --runtime "$WASM_PATH" \
    --list 2>/dev/null | \
  tail -n+2 | \
  cut -d',' -f1 | \
  sort | \
  uniq
))

if [ ${#PALLETS[@]} -eq 0 ]; then
    echo -e "${RED}Error: No pallets found to benchmark${NC}"
    exit 1
fi

echo -e "${GREEN}Found ${#PALLETS[@]} pallets to benchmark:${NC}"
for pallet in "${PALLETS[@]}"; do
    echo "  - $pallet"
done
echo ""

# Track success/failure
declare -a RESULTS

# Create runtime weights directory if it doesn't exist
WEIGHTS_DIR="runtime/$RUNTIME/src/weights"
mkdir -p "$WEIGHTS_DIR"

# Run benchmarks for each pallet using frame-omni-bencher
echo -e "${GREEN}Starting benchmarks...${NC}\n"

# Returns 0 if the given pallet should be benchmarked via the node binary, 1 otherwise.
requires_node_benchmark() {
    local PALLET=$1
    for node_pallet in "${NODE_PALLETS[@]}"; do
        if [ "$node_pallet" == "$PALLET" ]; then
            return 0
        fi
    done
    return 1
}

# Benchmark a pallet via the native node binary.
# Used for pallets whose benchmarks require host functions unavailable in WASM
# (e.g. real ed25519 verification for pallet_grandpa::report_equivocation).
benchmark_pallet_via_node() {
    local PALLET=$1
    local OUTPUT_FILE=$2

    echo -e "${YELLOW}Benchmarking $PALLET (via node binary)...${NC}"

    "$NODE_BIN" benchmark pallet \
        --runtime "$WASM_PATH" \
        --genesis-builder runtime \
        --pallet "$PALLET" \
        --extrinsic "*" \
        --header ../file_header.txt \
        --template "$TEMPLATE_PATH" \
        --output "$WEIGHTS_DIR/$OUTPUT_FILE.rs" \
        --steps "$STEPS" \
        --repeat "$REPEAT" 2>&1 | tee "benchmark_${PALLET}.log"

    local exit_code=${PIPESTATUS[0]}

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $PALLET benchmarked successfully (node)${NC}"
        return 0
    else
        echo -e "${RED}✗ Error benchmarking $PALLET (node)${NC}"
        return 1
    fi
}

# Function to run benchmark for a pallet
benchmark_pallet() {
    local PALLET=$1
    local OUTPUT_FILE=$2
    
    echo -e "${YELLOW}Benchmarking $PALLET...${NC}"
    
    # Run the benchmark with tee to show output and save to log, using PIPESTATUS to get exit code
    frame-omni-bencher v1 benchmark pallet \
        --runtime "$WASM_PATH" \
        --pallet "$PALLET" \
        --extrinsic "" \
        --header ../file_header.txt \
        --template "$TEMPLATE_PATH" \
        --output "$WEIGHTS_DIR/$OUTPUT_FILE.rs" \
        --steps "$STEPS" \
        --repeat "$REPEAT" 2>&1 | tee "benchmark_${PALLET}.log"
    
    # Check the exit code from the benchmark command (first command in the pipeline)
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $PALLET benchmarked successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ Error benchmarking $PALLET${NC}"
        return 1
    fi
}

# Benchmark all discovered pallets
for PALLET in "${PALLETS[@]}"; do
    # Use the pallet name directly as the output file name
    OUTPUT_FILE="$PALLET"
    if requires_node_benchmark "$PALLET"; then
        if benchmark_pallet_via_node "$PALLET" "$OUTPUT_FILE"; then
            RESULTS[$PALLET]="SUCCESS"
        else
            RESULTS[$PALLET]="FAILED"
        fi
    else
        if benchmark_pallet "$PALLET" "$OUTPUT_FILE"; then
            RESULTS[$PALLET]="SUCCESS"
        else
            RESULTS[$PALLET]="FAILED"
        fi
    fi
    echo ""
done

# Summary
echo -e "\n${GREEN}Benchmarking Summary:${NC}"
echo "========================"
SUCCESS_COUNT=0
FAILED_COUNT=0
for PALLET in "${!RESULTS[@]}"; do
    if [ "${RESULTS[$PALLET]}" == "SUCCESS" ]; then
        echo -e "${GREEN}✓${NC} $PALLET"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $PALLET"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "Total: ${#PALLETS[@]} pallets"
echo "Success: $SUCCESS_COUNT"
echo "Failed: $FAILED_COUNT"

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}All benchmarks completed successfully!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}$FAILED_COUNT benchmark(s) failed. Check the logs for details.${NC}"
    exit 1
fi
