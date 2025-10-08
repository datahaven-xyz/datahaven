// Placeholder weight mapping for `pallet-safe-mode` until we record chain-specific benchmarks.
//
// We reuse the upstream Substrate weight assumptions which are conservative enough for
// bootstrapping. Once DataHaven-specific safe-mode migrations are added we should regenerate
// weights in this module via the runtime benchmarking CLI.

pub type WeightInfo<T> = pallet_safe_mode::weights::SubstrateWeight<T>;
