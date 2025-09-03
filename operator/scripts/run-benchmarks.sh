#!/bin/bash
# DataHaven Benchmarking Script using frame-omni-bencher
# Automatically discovers and benchmarks all pallets in the runtime

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

# Build the runtime WASM
echo -e "${YELLOW}Building runtime $RUNTIME with features: $FEATURES${NC}"
cargo build --release --features "$FEATURES" -p datahaven-$RUNTIME-runtime

# Get the WASM path
WASM_PATH="target/release/wbuild/datahaven-$RUNTIME-runtime/datahaven_${RUNTIME}_runtime.compact.compressed.wasm"

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
    if benchmark_pallet "$PALLET" "$OUTPUT_FILE"; then
        RESULTS[$PALLET]="SUCCESS"
    else
        RESULTS[$PALLET]="FAILED"
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
