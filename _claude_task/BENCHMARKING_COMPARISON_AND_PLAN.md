# DataHaven vs Moonbeam Benchmarking Comparison & Implementation Plan

## Benchmark Log Analysis Results

Based on analysis of benchmark log files in `/operator/`:

### Successfully Benchmarked Pallets (8/10 custom pallets)
- **Native DataHaven Pallets**: All passed successfully
  - `pallet_external_validators`: 6 benchmarks completed
  - `pallet_external_validators_rewards`: 1 benchmark completed  
  - `pallet_datahaven_native_transfer`: 3 benchmarks completed
- **Snowbridge Pallets**: All passed successfully
  - `snowbridge_pallet_ethereum_client`: 3 benchmarks completed
  - `snowbridge_pallet_inbound_queue_v2`: 1 benchmark completed
  - `snowbridge_pallet_outbound_queue_v2`: 5 benchmarks completed
  - `snowbridge_pallet_system`: 5 benchmarks completed
  - `snowbridge_pallet_system_v2`: 1 benchmark completed

### Failed Benchmarks (2 standard Substrate pallets)
1. **pallet_im_online**: "More than the maximum number of keys provided"
   - Incompatible with DataHaven's external validator architecture
2. **pallet_identity**: "Sr25519 not supported for EthereumSignature"  
   - Ethereum accounts (AccountId20) incompatible with Sr25519 signatures

### Key Findings
- All custom DataHaven pallets benchmark successfully
- Failures only in standard Substrate pallets due to architectural differences
- Benchmarks were run with minimal configuration (steps=2, repeat=2)
- Weight files were successfully generated for all passing benchmarks

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

#### 1.0 Fix Native Pallets Benchmarks
**Priority**: CRITICAL - Must be done before runtime integration

**✅ Successfully Benchmarked Native Pallets:**
- `pallet_external_validators`: All 6 benchmarks passed
- `pallet_external_validators_rewards`: 1 benchmark passed
- `pallet_datahaven_native_transfer`: All 3 benchmarks passed
- `snowbridge_pallet_ethereum_client`: All 3 benchmarks passed
- `snowbridge_pallet_inbound_queue_v2`: 1 benchmark passed
- `snowbridge_pallet_outbound_queue_v2`: All 5 benchmarks passed

**❌ Failed Standard Substrate Pallets:**
- `pallet_im_online::validate_unsigned_and_then_heartbeat`: Error - "More than the maximum number of keys provided"
  - This pallet is for validator heartbeats and may not be compatible with DataHaven's external validator model
  - Consider removing from benchmarks or implementing custom solution
- `pallet_identity::set_username_for`: Error - "Sr25519 not supported for EthereumSignature"
  - Root cause: DataHaven uses Ethereum accounts (AccountId20) which are incompatible with Sr25519 signatures
  - This specific benchmark requires Sr25519 signatures for username authorities
  - Solution: Either skip this benchmark or adapt identity pallet for Ethereum accounts

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

**Note**: Based on the benchmark logs analyzed, the benchmarks were run with minimal configuration (steps=2, repeat=2) which is suitable for testing but not for production weights. Production benchmarks should use steps=50, repeat=20 for accurate measurements.

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
