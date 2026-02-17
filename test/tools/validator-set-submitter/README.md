# Validator Set Submitter

Long-running daemon that automatically submits validator-set updates from Ethereum to DataHaven each era via Snowbridge.

## How it works

The submitter subscribes to finalized `Session.CurrentIndex` changes on DataHaven. On each session change it evaluates:

1. Is `ActiveEra` set?
2. Has `targetEra` (`ActiveEra + 1`) already been processed?
3. Is `ExternalIndex` already at or past `targetEra`?
4. Is the current session the last session of the era?

If all preconditions are met, it calls `sendNewValidatorSetForEra` on the ServiceManager contract. Each era gets a single submission attempt — if it fails, the era is missed and the submitter moves on to the next.

## Prerequisites

- The submitter account must be registered on-chain via `setValidatorSetSubmitter` on the ServiceManager.
- An Ethereum RPC endpoint and a DataHaven WebSocket endpoint must be reachable.
- Dependencies installed: `bun i` from the `test/` directory.

## Configuration

Copy `config.yml` and fill in your values:

```yaml
# Connections
ethereum_rpc_url: "http://127.0.0.1:8545"
datahaven_ws_url: "ws://127.0.0.1:9944"

# Optional if provided via --submitter-private-key or SUBMITTER_PRIVATE_KEY env var
# The private key of the account authorized as validatorSetSubmitter
submitter_private_key: "0x..."

# Optional — falls back to contracts/deployments/{network_id}.json
# service_manager_address: "0x..."
network_id: "anvil"

# Fees (in ETH, sent as msg.value to cover Snowbridge relay costs)
execution_fee: "0.1"
relayer_fee: "0.2"
```

## Usage

From the `test/` directory:

```bash
# Start the submitter
bun tools/validator-set-submitter/main.ts run

# With a custom config path
bun tools/validator-set-submitter/main.ts run --config ./path/to/config.yml

# Provide private key via environment variable
SUBMITTER_PRIVATE_KEY=0x... bun tools/validator-set-submitter/main.ts run

# Provide private key via CLI argument
bun tools/validator-set-submitter/main.ts run --submitter-private-key 0x...

# Dry run — logs what would be submitted without sending transactions
bun tools/validator-set-submitter/main.ts run --dry-run
```

Private key precedence is: `--submitter-private-key` > `SUBMITTER_PRIVATE_KEY` > `submitter_private_key` in config file.

## Docker

Build the image from the repository root:

```bash
docker build -f test/tools/validator-set-submitter/Dockerfile \
  -t datahavenxyz/validator-set-submitter:local .
```

Run the submitter with mounted config and env private key:

```bash
docker run --rm \
  -v "$(pwd)/test/tools/validator-set-submitter/config.yml:/config/config.yml:ro" \
  -e SUBMITTER_PRIVATE_KEY=0x... \
  datahavenxyz/validator-set-submitter:local
```

Dry run:

```bash
docker run --rm \
  -v "$(pwd)/test/tools/validator-set-submitter/config.yml:/config/config.yml:ro" \
  -e SUBMITTER_PRIVATE_KEY=0x... \
  datahavenxyz/validator-set-submitter:local --dry-run
```

The Docker image does not include `contracts/deployments/*.json`. In containerized runs, set `service_manager_address` in your config.

## Startup checks

On launch the submitter verifies:

- Ethereum RPC is reachable (fetches current block number).
- DataHaven WebSocket is reachable (fetches current block header).
- The configured private key matches the on-chain `validatorSetSubmitter` address.

If any check fails, the process exits immediately.

## Shutdown

Send `SIGINT` (Ctrl+C) or `SIGTERM`. The submitter unsubscribes from session changes and tears down connections cleanly.
