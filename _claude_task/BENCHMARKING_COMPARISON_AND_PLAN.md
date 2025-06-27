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

## Why Use frame-omni-bencher Directly?

Using frame-omni-bencher directly instead of through the node API provides several advantages:

1. **No Node Required**: Benchmarks run against the runtime WASM directly, no need to start a node
2. **Faster Execution**: Direct WASM execution is more efficient than going through RPC
3. **Better CI/CD Integration**: Easier to run in automated environments without node setup
4. **Consistent Results**: Eliminates network/node overhead from measurements
5. **Simpler Toolchain**: One tool for all benchmarking needs
6. **Industry Standard**: Used by Polkadot, Kusama, and major parachains

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

#### 1.0 Fix Native Pallets Benchmarks
**Priority**: CRITICAL - Must be done before runtime integration
All native DataHaven pallets have compilation errors or implementation issues in their benchmarking code that need to be fixed:
- `pallet_external_validators`: Fix benchmark compilation errors
- `pallet_external_validators_rewards`: Update benchmarks to match current pallet logic
- `pallet_datahaven_native_transfer`: Complete benchmark implementation
- `pallet_ethereum_client`: **Special Case - InvalidSyncCommitteeMerkleProof errors**
  - Root cause: Hardcoded fixtures in `fixtures/src/lib.rs` have invalid merkle proofs
  - Solution: Update fixture generation to use JSON test data from `tests/fixtures/`
  - The JSON files contain valid beacon chain data with correct merkle proofs
  - Need to either:
    1. Regenerate `fixtures/src/lib.rs` from the JSON test data
    2. Modify benchmarks to load JSON fixtures directly
    3. Or temporarily mock the merkle verification for benchmarking purposes
- `pallet_inbound_queue_v2`: Ensure benchmarks cover all extrinsics
- `pallet_outbound_queue_v2`: Fix benchmark parameter ranges
- `pallet_system`: Update benchmarks for v2 API
- `pallet_system_v2`: Complete benchmark coverage

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

#### 1.2 Install frame-omni-bencher
```bash
# Install frame-omni-bencher tool
cargo install frame-omni-bencher

# Download weight template from Polkadot SDK
wget https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/system/src/weights.rs.template -O weight.hbs
```

#### 1.3 Verify Single Pallet First
```bash
# Build runtime WASM with benchmarks feature
cargo build --release --features "runtime-benchmarks" -p datahaven-runtime-testnet

# Test a single pallet using frame-omni-bencher
frame-omni-bencher v1 benchmark pallet \
    --runtime target/release/wbuild/datahaven-runtime-testnet/datahaven_runtime_testnet.compact.compressed.wasm \
    --pallet pallet_external_validators \
    --extrinsic "" \
    --template weight.hbs \
    --output pallets/external-validators/src/weights.rs \
    --steps 50 \
    --repeat 20
```

#### 1.4 Create Basic Automation Script
**File**: `operator/scripts/run-benchmarks.sh`
```bash
#!/bin/bash
set -e

RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}
FEATURES="runtime-benchmarks"

# Ensure frame-omni-bencher is installed
if ! command -v frame-omni-bencher &> /dev/null; then
    echo "Installing frame-omni-bencher..."
    cargo install frame-omni-bencher
fi

# Ensure weight template exists
if [ ! -f "weight.hbs" ]; then
    echo "Downloading weight template..."
    wget https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/system/src/weights.rs.template -O weight.hbs
fi

# Build the runtime WASM
echo "Building runtime $RUNTIME with features: $FEATURES"
cargo build --release --features "$FEATURES" -p datahaven-runtime-$RUNTIME

# Get the WASM path
WASM_PATH="target/release/wbuild/datahaven-runtime-$RUNTIME/datahaven_runtime_${RUNTIME}.compact.compressed.wasm"

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

# Run benchmarks for each pallet using frame-omni-bencher
for PALLET in "${!PALLETS[@]}"; do
    DIR="${PALLETS[$PALLET]}"
    echo "Benchmarking $PALLET..."
    
    frame-omni-bencher v1 benchmark pallet \
        --runtime "$WASM_PATH" \
        --pallet "$PALLET" \
        --extrinsic "" \
        --template weight.hbs \
        --output "pallets/$DIR/src/weights.rs" \
        --steps "$STEPS" \
        --repeat "$REPEAT" || {
            echo "Error benchmarking $PALLET, continuing..."
        }
done

echo "Benchmarking complete!"
```

### Phase 1: CI/CD Integration

#### 3.1 Benchmark Validation Workflow
**File**: `.github/workflows/check-benchmarks.yml`
- Weekly scheduled runs
- Manual dispatch option
- All runtime validation
- Integration with existing E2E test infrastructure
- Run benchmarks on scheduled basis
Run Weekly, not on each PR

#### 3.2 Weight Diff Reporting
**File**: `.github/workflows/weight-diff.yml`
- Trigger on weight file changes
- Generate comparison reports
- Comment on PRs
- Special attention to cross-chain operation weights (critical for security)

## Quick Start Implementation

### Step 0: Fix Native Pallets Benchmarks (Immediate - PREREQUISITE)
```bash
# Fix benchmark compilation and implementation issues in all native pallets
cd operator/pallets
# Fix each pallet's benchmarking.rs file to ensure:
# - Compilation without errors
# - Coverage of all dispatchable functions
# - Proper setup and verification
# - Realistic parameter ranges
```

### Step 1: Fix Runtime Integration (After Step 0)
```bash
# Add custom pallets to benchmarks.rs in all runtimes
cd operator/runtime
# Edit mainnet/src/benchmarks.rs
# Edit stagenet/src/benchmarks.rs  
# Edit testnet/src/benchmarks.rs
```

### Step 2: Setup frame-omni-bencher (Immediate)
```bash
cd operator
# Install frame-omni-bencher
cargo install frame-omni-bencher

# Download weight template
wget https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/system/src/weights.rs.template -O weight.hbs

# Build runtime WASM
cargo build --release --features "runtime-benchmarks" -p datahaven-runtime-testnet
```

### Step 3: Verify Single Pallet (Immediate)
```bash
# Run benchmark for a single pallet
frame-omni-bencher v1 benchmark pallet \
    --runtime target/release/wbuild/datahaven-runtime-testnet/datahaven_runtime_testnet.compact.compressed.wasm \
    --pallet pallet_external_validators \
    --extrinsic "" \
    --template weight.hbs \
    --output pallets/external-validators/src/weights.rs \
    --steps 50 \
    --repeat 20
```

### Step 4: Create Minimal Script (Today)
```bash
cd operator
mkdir -p scripts
cat > scripts/benchmark-all.sh << 'EOF'
#!/bin/bash
RUNTIME=${1:-testnet}
STEPS=${2:-50}
REPEAT=${3:-20}

# Install frame-omni-bencher if needed
command -v frame-omni-bencher >/dev/null || cargo install frame-omni-bencher

# Get weight template if needed
[ -f weight.hbs ] || wget https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/system/src/weights.rs.template -O weight.hbs

# Build runtime WASM
cargo build --release --features "runtime-benchmarks" -p datahaven-runtime-$RUNTIME

# Run benchmarks for all pallets
frame-omni-bencher v1 benchmark pallet \
    --runtime target/release/wbuild/datahaven-runtime-$RUNTIME/datahaven_runtime_${RUNTIME}.compact.compressed.wasm \
    --pallet "*" \
    --extrinsic "" \
    --template weight.hbs \
    --steps $STEPS \
    --repeat $REPEAT
EOF
chmod +x scripts/benchmark-all.sh
```

### Step 5: Generate Fresh Weights
```bash
# Run benchmarks for all pallets in testnet runtime
./scripts/run-benchmarks.sh testnet 50 20

# Run benchmarks for specific pallet groups
./scripts/run-benchmarks.sh testnet 50 20 datahaven    # Only DataHaven pallets
./scripts/run-benchmarks.sh testnet 50 20 substrate    # Only Substrate pallets
./scripts/run-benchmarks.sh testnet 50 20 cumulus      # Only Cumulus pallets
./scripts/run-benchmarks.sh testnet 50 20 xcm          # Only XCM pallets

# Run benchmark for a single pallet
./scripts/benchmark-single.sh pallet_external_validators testnet 50 20
```

### Step 6: Update Runtime to Use Centralized Weights
After generating weights, update your runtime configuration to use the centralized weights from `runtime/*/src/weights/`:

```rust
// In runtime/testnet/src/lib.rs
mod weights;

// In pallet configurations
impl pallet_external_validators::Config for Runtime {
    type WeightInfo = weights::pallet_external_validators::DataHavenWeight<Runtime>;
    // ... other config
}
```

**Note**: Weights are now stored in `runtime/{runtime_name}/src/weights/` following the Moonbeam pattern, making them easier to manage and update.
