# Motivation
Demonstrate that
[FastAggregateVerify](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-bls-signature-04#section-3.3.4) is the most
expensive call in ethereum beacon light client, though in [#13031](https://github.com/paritytech/substrate/pull/13031)
Parity team has wrapped some low level host functions for `bls-12381` but adding a high level host function specific
for it is super helpful.

# Benchmark
We add several benchmarks
[here](https://github.com/Snowfork/snowbridge/blob/8891ca3cdcf2e04d8118c206588c956541ae4710/parachain/pallets/ethereum-client/src/benchmarking/mod.rs#L98-L124)
as following to demonstrate
[bls_fast_aggregate_verify](https://github.com/Snowfork/snowbridge/blob/8891ca3cdcf2e04d8118c206588c956541ae4710/parachain/pallets/ethereum-client/src/lib.rs#L764)
is the main bottleneck. Test data
[here](https://github.com/Snowfork/snowbridge/blob/8891ca3cdcf2e04d8118c206588c956541ae4710/parachain/pallets/ethereum-client/src/benchmarking/data_mainnet.rs#L553-L1120)
is real from goerli network which contains 512 public keys from sync committee.

## sync_committee_period_update
Base line benchmark for extrinsic [sync_committee_period_update](https://github.com/Snowfork/snowbridge/blob/8891ca3cdcf2e04d8118c206588c956541ae4710/parachain/pallets/ethereum-client/src/lib.rs#L233)

## bls_fast_aggregate_verify
Subfunction of extrinsic `sync_committee_period_update` which does what
[FastAggregateVerify](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-bls-signature-04#section-3.3.4) requires.

## bls_aggregate_pubkey
Subfunction of `bls_fast_aggregate_verify` which decompress and instantiate G1 pubkeys only.

## bls_verify_message
Subfunction of `bls_fast_aggregate_verify` which verify the prepared signature only.


# Result

## hardware spec
Run benchmark in a EC2 instance
```
cargo run --release --bin polkadot-parachain --features runtime-benchmarks -- benchmark machine --base-path /mnt/scratch/benchmark

+----------+----------------+-------------+-------------+-------------------+
| Category | Function       | Score       | Minimum     | Result            |
+===========================================================================+
| CPU      | BLAKE2-256     | 1.08 GiBs   | 1.00 GiBs   | ✅ Pass (107.5 %) |
|----------+----------------+-------------+-------------+-------------------|
| CPU      | SR25519-Verify | 568.87 KiBs | 666.00 KiBs | ❌ Fail ( 85.4 %) |
|----------+----------------+-------------+-------------+-------------------|
| Memory   | Copy           | 13.67 GiBs  | 14.32 GiBs  | ✅ Pass ( 95.4 %) |
|----------+----------------+-------------+-------------+-------------------|
| Disk     | Seq Write      | 334.35 MiBs | 450.00 MiBs | ❌ Fail ( 74.3 %) |
|----------+----------------+-------------+-------------+-------------------|
| Disk     | Rnd Write      | 143.59 MiBs | 200.00 MiBs | ❌ Fail ( 71.8 %) |
+----------+----------------+-------------+-------------+-------------------+
```

## benchmark

```
cargo run --release --bin polkadot-parachain \
--features runtime-benchmarks \
-- \
benchmark pallet \
--base-path /mnt/scratch/benchmark \
--chain=bridge-hub-rococo-dev \
--pallet=snowbridge_pallet_ethereum_client \
--extrinsic="*" \
--execution=wasm --wasm-execution=compiled \
--steps 50 --repeat 20 \
--output ./parachains/runtimes/bridge-hubs/bridge-hub-rococo/src/weights/snowbridge_pallet_ethereum_client.rs
```

### [Weights](https://github.com/Snowfork/cumulus/blob/ron/benchmark-beacon-bridge/parachains/runtimes/bridge-hubs/bridge-hub-rococo/src/weights/snowbridge_pallet_ethereum_client.rs)

|extrinsic       | minimum execution time benchmarked(us) |
| --------------------------------------- |----------------------------------------|
|sync_committee_period_update | 123_126                                |
|bls_fast_aggregate_verify| 121_083                                |
|bls_aggregate_pubkey | 90_306                                  |
|bls_verify_message | 28_000                                  |

- [bls_fast_aggregate_verify](#bls_fast_aggregate_verify) consumes 98% execution time of [sync_committee_period_update](#sync_committee_period_update)

- [bls_aggregate_pubkey](#bls_aggregate_pubkey) consumes 75% execution time of [bls_fast_aggregate_verify](#bls_fast_aggregate_verify)

- [bls_verify_message](#bls_verify_message) consumes 23% execution time of [bls_fast_aggregate_verify](#bls_fast_aggregate_verify)

# Conclusion

A high level host function specific for
[bls_fast_aggregate_verify](https://github.com/Snowfork/snowbridge/blob/8891ca3cdcf2e04d8118c206588c956541ae4710/parachain/pallets/ethereum-client/src/lib.rs#L764)
is super helpful.
