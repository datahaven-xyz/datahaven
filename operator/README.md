# DataHaven 🫎

Based on [polkadot-sdk-solochain-template](https://github.com/paritytech/polkadot-sdk-solochain-template)

## Benchmarking

DataHaven uses runtime benchmarking to generate accurate weight calculations for all pallets. The benchmarking process is automated using `frame-omni-bencher`.

### Requirements

- `frame-omni-bencher` - Install with: `cargo install frame-omni-bencher --profile=production`

### Running Benchmarks

Execute the benchmarking script from the project root:

```bash
# Benchmark all pallets for testnet runtime (default)
./scripts/run-benchmarks.sh

# Benchmark specific runtime
./scripts/run-benchmarks.sh mainnet

# Custom steps and repetitions
./scripts/run-benchmarks.sh testnet 100 50
```

The script will:
1. Automatically discover all available pallets
2. Build the runtime WASM with `runtime-benchmarks` feature
3. Generate weight files in `runtime/{runtime}/src/weights/`
4. Provide a summary of successful and failed benchmarks

### Script Parameters

- `runtime`: Runtime to benchmark (testnet, stagenet, mainnet). Default: testnet
- `steps`: Number of steps for benchmarking. Default: 50  
- `repeat`: Number of repetitions. Default: 20

## Zombienet testing

First, install [zombienet](https://github.com/paritytech/zombienet).

To spawn a local solo chain with four validators and BABE finality, run:

```bash
zombienet -p native spawn test/config/zombie-datahaven-local.toml
```
