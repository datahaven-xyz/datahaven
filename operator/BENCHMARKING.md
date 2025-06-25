# Substrate Benchmarking Guide

## Overview

Substrate benchmarking is a critical component for blockchain runtime development that measures computational effort and resource usage of extrinsics. It serves to prevent DoS attacks, calculate accurate transaction fees, and ensure predictable resource consumption across the network.

## Core Concepts

### Weight
- Two-dimensional resource measurement:
  - **Reference Time**: Measured in picoseconds
  - **Proof Size**: Storage verification overhead
- Represents upper bound of resource consumption
- Used to calculate transaction fees

### Benchmarking Philosophy
- **Static Analysis**: Determine resource bounds at compile time
- **Worst-Case Scenarios**: Always measure maximum possible resource usage
- **Empirical Measurement**: Based on actual execution, not theoretical analysis

## Implementation Process

### 1. Setup Dependencies
Add to `Cargo.toml`:
```toml
[dependencies]
frame-benchmarking = { optional = true }

[features]
runtime-benchmarks = [
    "frame-benchmarking/runtime-benchmarks",
]
```

### 2. Write Benchmarks
Create `benchmarking.rs` in your pallet using v2 API:

```rust
#![cfg(feature = "runtime-benchmarks")]

use super::*;
use frame_benchmarking::v2::*;

#[benchmarks]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn benchmark_name(
        x: Linear<1, 1000>,  // Parameter with range
    ) -> Result<(), BenchmarkError> {
        // Setup phase
        let caller: T::AccountId = whitelisted_caller();
        
        // Execute the extrinsic
        #[extrinsic_call]
        pallet_function(RawOrigin::Signed(caller), x);
        
        // Verify the result
        assert_eq!(Storage::<T>::get(), expected_value);
        
        Ok(())
    }
}
```

### 3. Key Attributes
- `#[benchmark]`: Marks a benchmark function
- `#[extrinsic_call]`: Identifies the actual call being benchmarked
- `#[block]`: Alternative to `extrinsic_call` for block execution
- `#[extra]`: Benchmark only runs with special CLI flag
- `#[skip_meta]`: Skips storage key analysis

### 4. Run Benchmarks
Use `frame-omni-bencher` to execute benchmarks:

```bash
frame-omni-bencher v1 benchmark pallet \
    --runtime target/release/wbuild/runtime/runtime.wasm \
    --pallet pallet_name \
    --extrinsic "*" \
    --template .maintain/frame-weight-template.hbs \
    --output pallets/pallet-name/src/weights.rs
```

### 5. Integrate Weights
Update pallet configuration:

```rust
// In pallet's lib.rs
pub mod weights;
pub use weights::WeightInfo;

#[pallet::config]
pub trait Config: frame_system::Config {
    type WeightInfo: WeightInfo;
}

// In dispatchable functions
#[pallet::call_index(0)]
#[pallet::weight(T::WeightInfo::function_name())]
pub fn function_name(origin: OriginFor<T>) -> DispatchResult {
    // Implementation
}
```

### 6. Runtime Integration
Add benchmarks to runtime's `benchmarks.rs`:

```rust
#[frame_support::runtime]
mod runtime {
    #[runtime::benchmarks(where T: frame_system::Config)]
    mod benches {
        use super::*;
        use frame_benchmarking::define_benchmarks;

        define_benchmarks!(
            [pallet_name, PalletName]
        );
    }
}
```

## Best Practices

1. **Comprehensive Coverage**: Benchmark all dispatchable functions
2. **Worst-Case Testing**: Always test maximum computational paths
3. **Parameter Ranges**: Use realistic bounds for Linear parameters
4. **Whitelisted Accounts**: Use `whitelisted_caller()` for test accounts
5. **Verification**: Always verify state changes after extrinsic execution
6. **Regular Updates**: Re-run benchmarks when logic changes

## Common Patterns

### Storage Operations
```rust
#[benchmark]
fn insert_items(n: Linear<1, 1000>) {
    let items: Vec<_> = (0..n).map(|i| generate_item(i)).collect();
    
    #[extrinsic_call]
    add_items(RawOrigin::Root, items);
    
    assert_eq!(ItemCount::<T>::get(), n);
}
```

### Complex Setup
```rust
#[benchmark]
fn complex_operation() -> Result<(), BenchmarkError> {
    // Setup initial state
    initialize_system::<T>()?;
    fund_accounts::<T>(10)?;
    
    let caller = prepare_caller::<T>()?;
    
    #[extrinsic_call]
    perform_operation(RawOrigin::Signed(caller), params);
    
    // Verify multiple conditions
    verify_state::<T>()?;
    Ok(())
}
```

## Troubleshooting

- **Feature Flags**: Ensure `runtime-benchmarks` is enabled
- **WASM Build**: Use release builds for accurate measurements
- **Template Path**: Verify weight template file exists
- **Output Path**: Ensure output directory exists

## Future Considerations

With the upcoming PolkaVM, native metering capabilities may transform how benchmarking works, potentially providing more accurate real-time measurements instead of static analysis.