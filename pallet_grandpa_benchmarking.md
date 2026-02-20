# pallet_grandpa benchmarking (custom crate)

This doc sketches a standalone `pallet_grandpa_benchmarking` crate that lets you
benchmark GRANDPA extrinsics without forking upstream `pallet_grandpa`. It mirrors
the pattern used by `pallet_session_benchmarking`.

## Why this crate

Upstream `pallet_grandpa` only exposes:

- `note_stalled` (extrinsic benchmark)
- `check_equivocation_proof` (helper benchmark, not an extrinsic)

To get proper weights for `report_equivocation` and
`report_equivocation_unsigned`, you need a separate benchmarking crate that:

- depends on upstream `pallet_grandpa`
- constructs a valid `EquivocationProof` and `KeyOwnerProof`
- calls the pallet extrinsics in benchmarks

## Crate layout

```
pallet-grandpa-benchmarking/
  Cargo.toml
  src/
    lib.rs
    inner.rs
    mock.rs (optional)
    helpers.rs (optional)
```

### Cargo.toml (key dependencies)

- `pallet-grandpa`
- `frame-benchmarking`
- `frame-system`
- `sp-consensus-grandpa`
- `sp-session`
- `pallet-session` + `pallet-session-historical` (for membership proofs)
- `pallet-staking` + `pallet-offences` (if your report system uses them)

Add any runtime-specific crates needed for proof construction and staking setup.

## Benchmarking crate skeleton

### src/lib.rs

```rust
#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(feature = "runtime-benchmarks")]
pub mod inner;

#[cfg(feature = "runtime-benchmarks")]
pub use inner::*;
```

### src/inner.rs (structure)

```rust
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;

pub struct Pallet<T: Config>(pallet_grandpa::Pallet<T>);

pub trait Config:
    pallet_grandpa::Config
    + pallet_session::Config
    + pallet_session::historical::Config
    + pallet_staking::Config
{
}

#[benchmarks]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn report_equivocation() {
        let (proof, key_owner_proof, reporter) = setup_equivocation::<T>();
        #[extrinsic_call]
        _(RawOrigin::Signed(reporter), proof, key_owner_proof);
    }

    #[benchmark]
    fn report_equivocation_unsigned() {
        let (proof, key_owner_proof, _) = setup_equivocation::<T>();
        #[extrinsic_call]
        _(RawOrigin::None, proof, key_owner_proof);
    }

    #[benchmark]
    fn note_stalled() {
        let delay = 1000u32.into();
        let best_finalized_block_number = 1u32.into();
        #[extrinsic_call]
        _(RawOrigin::Root, delay, best_finalized_block_number);
    }
}
```

## KeyOwnerProof and EquivocationReportSystem

The two critical associated types in `pallet_grandpa::Config` are:

```rust
type KeyOwnerProof: Parameter + GetSessionNumber + GetValidatorCount;
type EquivocationReportSystem: OffenceReportSystem<
    Option<Self::AccountId>,
    (EquivocationProof<Self::Hash, BlockNumberFor<Self>>, Self::KeyOwnerProof),
>;
```

Your benchmarking crate must be able to construct both:

1) A valid `EquivocationProof`
2) A valid `KeyOwnerProof` compatible with your runtime setup

### Recommended runtime wiring (typical for staking + session)

If your runtime uses session + staking, wire GRANDPA like this:

```rust
type KeyOwnerProofSystem = Historical;
type KeyOwnerProof =
    <Self::KeyOwnerProofSystem as KeyOwnerProofSystem<(KeyTypeId, ValidatorId)>>::Proof;

type EquivocationReportSystem =
    pallet_grandpa::EquivocationReportSystem<Self, Offences, Historical, ReportLongevity>;
```

This is the same pattern used in the Polkadot runtimes.

### Benchmark setup strategy

To generate a valid `KeyOwnerProof`, you need to:

1. Create validators and set their session keys.
2. Rotate sessions until those validators are in the active set.
3. Ask the `Historical` pallet to produce a proof for a GRANDPA key.

To generate a valid `EquivocationProof`, you need to:

1. Build two conflicting GRANDPA votes (same round, different targets).
2. Sign them with the same GRANDPA authority key.
3. Wrap them into `sp_consensus_grandpa::EquivocationProof`.

### Example helper skeleton (pseudo-code)

```rust
fn setup_equivocation<T: Config>() -> (
    Box<sp_consensus_grandpa::EquivocationProof<T::Hash, BlockNumberFor<T>>>,
    T::KeyOwnerProof,
    T::AccountId,
) {
    // 1) Create validators and set GRANDPA session keys
    let (reporter, grandpa_key) = setup_validators_and_keys::<T>();

    // 2) Rotate session so keys are active and historical proof is available
    pallet_session::Pallet::<T>::rotate_session();

    // 3) Construct KeyOwnerProof using historical membership proofs
    let key_owner_proof = pallet_session::historical::Pallet::<T>::prove(
        (sp_consensus_grandpa::KEY_TYPE, grandpa_key.as_ref()),
    ).expect("proof exists");

    // 4) Create two conflicting votes signed by the same GRANDPA key
    let equivocation_proof = build_equivocation_proof::<T>(&grandpa_key);

    (Box::new(equivocation_proof), key_owner_proof, reporter)
}
```

### Notes on KeyOwnerProof

- If your runtime uses `sp_core::Void`, you can mock the proof, but that only
  matches runtimes that do not enable equivocation handling.
- For realistic benchmarking, use `Historical` proofs and real session keys.
- The `KeyOwnerProof` type must satisfy `GetSessionNumber` and `GetValidatorCount`
  because `report_equivocation` uses `key_owner_proof.validator_count()` for weight.

### Notes on EquivocationReportSystem

Options:

- `()` implements `OffenceReportSystem` as a no-op. This keeps benchmarks simple
  but underestimates weight if your chain actually reports offences.
- `pallet_grandpa::EquivocationReportSystem<...>` integrates with offences and
  staking and is closer to production behavior, but needs more setup in the benchmark.

If your chain uses offences + staking for GRANDPA, benchmark with the real
`EquivocationReportSystem` so the weight includes offence reporting costs.

## Runtime integration

In your runtime benchmark API, include the custom bench pallet:

```rust
use pallet_grandpa_benchmarking::Pallet as GrandpaBench;

impl pallet_grandpa_benchmarking::Config for Runtime {}

// add_benchmarks!(params, batches);
```

In your benchmark script, use the custom benchmark crate for GRANDPA, similar to:

```
[pallet_grandpa_benchmarking::Pallet::<Runtime>, GrandpaBench]
```

Then wire generated weights into your runtime:

```
type WeightInfo = weights::pallet_grandpa::WeightInfo<Runtime>;
```
