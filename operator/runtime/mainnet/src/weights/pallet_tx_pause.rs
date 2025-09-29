// Placeholder weight mapping for `pallet-tx-pause` until we record chain-specific benchmarks.
//
// We reuse the upstream Substrate weight assumptions which are conservative enough for
// bootstrapping. Once DataHaven-specific paused-call logic is added we should regenerate weights in
// this module via the runtime benchmarking CLI.

pub type WeightInfo<T> = pallet_tx_pause::weights::SubstrateWeight<T>;
