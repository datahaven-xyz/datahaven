# DataHaven vs Moonbeam Benchmarking Comparison & Implementation Plan

## Current State Analysis

### DataHaven's Current Setup

**✅ What Exists:**
- All custom pallets have `benchmarking.rs` implementations using v2 API
- Weight files exist but are outdated (October 2024, from Tanssi fork)
- Runtime-benchmarks feature properly configured in Cargo.toml
- Node includes benchmarking CLI support

**❌ What's Missing:**
- **No custom pallets in runtime benchmarks** - Only standard Substrate pallets included
- **No automation scripts** - Manual benchmarking required
- **No CI/CD integration** - No scheduled validation or PR checks
- **No weight templates** - Using default formatting
- **No developer tools** - No interactive scripts or helpers

### Moonbeam's Approach

**Key Features:**
1. **Automation**: `run-benches-for-runtime.sh` handles all pallets automatically
2. **CI/CD**: Scheduled validation + PR weight diff reports
3. **Developer Experience**: Interactive scripts with check modes
4. **Tooling**: frame-omni-bencher + subweight integration
5. **Error Recovery**: Scripts continue on failure with logging

## Gap Analysis

| Feature | DataHaven | Moonbeam | Priority |
|---------|-----------|----------|----------|
| Benchmark implementations | ✅ | ✅ | - |
| Weight files | ✅ (outdated) | ✅ | High |
| Runtime integration | ❌ (incomplete) | ✅ | Critical |
| Automation scripts | ❌ | ✅ | High |
| CI/CD workflows | ❌ | ✅ | Medium |
| Weight diff reports | ❌ | ✅ | Medium |
| Developer tools | ❌ | ✅ | Medium |
| Error handling | ❌ | ✅ | Low |

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

#### 1.1 Fix Runtime Benchmark Integration
**File**: `operator/runtime/*/src/benchmarks.rs`
```rust
frame_benchmarking::define_benchmarks!(
    // Existing standard pallets...
    [pallet_external_validators, ExternalValidators]
    [pallet_external_validators_rewards, ExternalValidatorsRewards]
    [pallet_datahaven_native_transfer, DatahavenNativeTransfer]
    [pallet_ethereum_client, EthereumClient]
    [pallet_inbound_queue_v2, InboundQueueV2]
    [pallet_outbound_queue_v2, OutboundQueueV2]
    [pallet_system, System]
    [pallet_system_v2, SystemV2]
);
```

#### 1.2 Verify Single Pallet First
**Quick verification before full automation**:
```bash
# Build with fast-runtime for quicker testing
cargo build --release --features "runtime-benchmarks fast-runtime"

# Test a single pallet to verify integration works
./target/release/datahaven-operator benchmark pallet \
    --chain=testnet \
    --pallet=pallet_external_validators \
    --extrinsic="*" \
    --steps=2 \
    --repeat=1
```

#### 1.3 Create Basic Automation Script
**File**: `operator/scripts/run-benchmarks.sh`
```bash
#!/bin/bash
set -e

RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}
FEATURES=${4:-"runtime-benchmarks"}

# Add fast-runtime for development builds
if [[ "$STEPS" -lt "10" ]]; then
    FEATURES="$FEATURES fast-runtime"
fi

# Build the runtime
echo "Building with features: $FEATURES"
cargo build --release --features "$FEATURES"

# List of custom pallets
PALLETS=(
    "pallet_external_validators"
    "pallet_external_validators_rewards"
    "pallet_datahaven_native_transfer"
    "pallet_ethereum_client"
    "pallet_inbound_queue_v2"
    "pallet_outbound_queue_v2"
    "pallet_system"
    "pallet_system_v2"
)

# Run benchmarks for each pallet
for PALLET in "${PALLETS[@]}"; do
    echo "Benchmarking $PALLET..."
    ./target/release/datahaven-operator benchmark pallet \
        --chain=$RUNTIME \
        --pallet=$PALLET \
        --extrinsic="*" \
        --steps=$STEPS \
        --repeat=$REPEAT \
        --output=pallets/${PALLET#pallet_}/src/weights.rs
done
```

### Phase 1: CI/CD Integration

#### 3.1 Benchmark Validation Workflow
**File**: `.github/workflows/check-benchmarks.yml`
- Weekly scheduled runs
- Manual dispatch option
- All runtime validation
- Integration with existing E2E test infrastructure
- Use fast-runtime for PR checks, full runtime for scheduled runs
Run Weekly, not on each PR

#### 3.2 Weight Diff Reporting
**File**: `.github/workflows/weight-diff.yml`
- Trigger on weight file changes
- Generate comparison reports
- Comment on PRs
- Special attention to cross-chain operation weights (critical for security)

## Quick Start Implementation

### Step 1: Fix Runtime Integration (Immediate)
```bash
# Add custom pallets to benchmarks.rs in all runtimes
cd operator/runtime
# Edit mainnet/src/benchmarks.rs
# Edit stagenet/src/benchmarks.rs  
# Edit testnet/src/benchmarks.rs
```

### Step 2: Verify Single Pallet (Immediate)
```bash
# Quick test with fast-runtime
cd operator
cargo build --release --features "runtime-benchmarks fast-runtime"
./target/release/datahaven-operator benchmark pallet \
    --chain=testnet \
    --pallet=pallet_external_validators \
    --extrinsic="*" \
    --steps=2 \
    --repeat=1
```

### Step 3: Create Minimal Script (Today)
```bash
cd operator
mkdir -p scripts
cat > scripts/benchmark-all.sh << 'EOF'
#!/bin/bash
# Quick mode for development
if [ "$1" == "--quick" ]; then
    FEATURES="runtime-benchmarks fast-runtime"
    STEPS=5
    REPEAT=2
else
    FEATURES="runtime-benchmarks"
    STEPS=50
    REPEAT=20
fi

cargo build --release --features "$FEATURES"
./target/release/datahaven-operator benchmark pallet \
    --chain=testnet \
    --pallet="*" \
    --extrinsic="*" \
    --steps=$STEPS \
    --repeat=$REPEAT
EOF
chmod +x scripts/benchmark-all.sh
```

### Step 4: Generate Fresh Weights
```bash
# Quick test first
./scripts/benchmark-all.sh --quick

# Full benchmark run
./scripts/benchmark-all.sh
```
