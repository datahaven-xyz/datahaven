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

# Optional metrics port (default: 8080)
# metrics_port: 8080
```

### Settings reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `ethereum_rpc_url` | string | Yes | — | Ethereum JSON-RPC endpoint |
| `datahaven_ws_url` | string | Yes | — | DataHaven WebSocket endpoint |
| `submitter_private_key` | hex string | No\* | — | Private key of the authorized submitter account (`0x` + 64 hex chars) |
| `network_id` | string | No | `"anvil"` | Network ID used to locate `contracts/deployments/{network_id}.json` |
| `service_manager_address` | hex address | No\*\* | — | ServiceManager contract address |
| `execution_fee` | string (ETH) | No | `"0.1"` | Snowbridge execution fee sent as `msg.value` |
| `relayer_fee` | string (ETH) | No | `"0.2"` | Snowbridge relayer fee sent as `msg.value` |
| `metrics_port` | integer | No | `8080` | Prometheus metrics server port (1–65535) |

\* Required via one of: `--submitter-private-key` flag, `SUBMITTER_PRIVATE_KEY` env var, or `submitter_private_key` in config.
\*\* Required when running in Docker (deployment files are not included in the image). When omitted, the address is read from `contracts/deployments/{network_id}.json`.

### Private key precedence

The submitter private key is resolved in this order (first wins):

1. `--submitter-private-key` CLI flag
2. `SUBMITTER_PRIVATE_KEY` environment variable
3. `submitter_private_key` in the config YAML file

### Environment variables

| Variable | Description |
|---|---|
| `SUBMITTER_PRIVATE_KEY` | Submitter private key (see precedence above) |
| `METRICS_PORT` | Override metrics port (takes precedence over config file, but CLI flag wins) |
| `LOG_LEVEL` | Log verbosity: `debug`, `info` (default), `warn`, `error` |

### CLI flags

| Flag | Description |
|---|---|
| `--config <path>` | Path to YAML config file (default: `./tools/validator-set-submitter/config.yml`) |
| `--submitter-private-key <key>` | Override submitter private key |
| `--metrics-port <port>` | Override metrics server port |
| `--dry-run` | Log what would be submitted without sending transactions |

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

## Observability

The submitter exposes an HTTP server on `metrics_port` (default `8080`) with three endpoints:

| Endpoint | Purpose | Codes |
|---|---|---|
| `GET /metrics` | Prometheus metrics scrape | `200` |
| `GET /healthz` | Liveness probe | `200` always |
| `GET /readyz` | Readiness probe | `200` when startup checks passed and watcher is running, `503` otherwise |

### Metrics reference

All metrics are prefixed with `validator_set_submitter_`.

#### Counters

| Metric | Labels | Description |
|---|---|---|
| `submissions_total` | `outcome`: `success`, `failed`, `dry_run` | Total submission attempts by result |
| `ticks_total` | `result`: `submitted_success`, `submitted_failed`, `skipped_no_active_era`, `skipped_already_submitted`, `skipped_already_confirmed`, `skipped_not_last_session` | Tick evaluation outcomes |
| `errors_total` | `type`: `tick_error`, `subscription_error` | Non-submission errors |
| `missed_eras_total` | — | Total eras where the submission attempt failed |

#### Gauges

| Metric | Description |
|---|---|
| `active_era` | Current active era on DataHaven |
| `target_era` | Target era for next submission (`active_era + 1`) |
| `external_index` | Latest confirmed era on-chain |
| `current_session` | Current session number |
| `last_submitted_era` | Last era successfully submitted |
| `consecutive_missed_eras` | Consecutive missed eras (resets to 0 on success) |
| `up` | `1` if watcher is running, `0` if stopped |
| `ready` | `1` if startup checks passed and watcher running, `0` otherwise |

#### Histograms

| Metric | Buckets | Description |
|---|---|---|
| `submission_duration_seconds` | 1, 5, 10, 30, 60, 120, 300 | Time from transaction send to receipt |
| `tick_duration_seconds` | 0.1, 0.5, 1, 2, 5, 10, 30 | Time to process one tick |

### Alerting recommendations

Example Prometheus alert rules for common failure modes:

```yaml
groups:
  - name: validator-set-submitter
    rules:
      - alert: SubmitterDown
        expr: validator_set_submitter_up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Validator set submitter is down"

      - alert: ConsecutiveMissedEras
        expr: validator_set_submitter_consecutive_missed_eras > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Submitter has missed {{ $value }} consecutive era(s)"

      - alert: SubmissionErrorsIncreasing
        expr: rate(validator_set_submitter_errors_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Submitter errors increasing (type={{ $labels.type }})"

      - alert: SlowSubmissions
        expr: histogram_quantile(0.95, rate(validator_set_submitter_submission_duration_seconds_bucket[15m])) > 120
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "95th percentile submission duration exceeds 120s"
```

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

## Kubernetes deployment

Only one submitter instance should run per network — do not scale beyond one replica.

### Example manifests

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: submitter-secret
type: Opaque
stringData:
  SUBMITTER_PRIVATE_KEY: "0x..."
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: submitter-config
data:
  config.yml: |
    ethereum_rpc_url: "http://ethereum-rpc:8545"
    datahaven_ws_url: "ws://datahaven-node:9944"
    service_manager_address: "0x..."
    execution_fee: "0.1"
    relayer_fee: "0.2"
    metrics_port: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: validator-set-submitter
spec:
  replicas: 1
  strategy:
    type: Recreate            # prevent two submitters running simultaneously
  selector:
    matchLabels:
      app: validator-set-submitter
  template:
    metadata:
      labels:
        app: validator-set-submitter
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: submitter
          image: datahavenxyz/validator-set-submitter:latest
          ports:
            - name: metrics
              containerPort: 8080
          envFrom:
            - secretRef:
                name: submitter-secret
          volumeMounts:
            - name: config
              mountPath: /config
              readOnly: true
          livenessProbe:
            httpGet:
              path: /healthz
              port: metrics
            initialDelaySeconds: 5
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /readyz
              port: metrics
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
      volumes:
        - name: config
          configMap:
            name: submitter-config
```

Key points:

- **Single replica** with `Recreate` strategy — running two submitters against the same network will cause duplicate submissions.
- **Private key** is stored in a Kubernetes Secret and injected as an environment variable.
- **Config** is stored in a ConfigMap and mounted at `/config/config.yml` (the default path the image expects).
- **Probes** use the built-in `/healthz` and `/readyz` endpoints.
- **Prometheus** scrape annotations let standard Prometheus operator configs auto-discover the pod.

## Startup checks

On launch the submitter verifies:

- Ethereum RPC is reachable (fetches current block number).
- DataHaven WebSocket is reachable (fetches current block header).
- The configured private key matches the on-chain `validatorSetSubmitter` address.

If any check fails, the process exits immediately.

## Shutdown

Send `SIGINT` (Ctrl+C) or `SIGTERM`. The submitter unsubscribes from session changes and tears down connections cleanly.

## Troubleshooting

### Startup exits immediately

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot connect to Ethereum RPC` | Ethereum endpoint unreachable | Verify `ethereum_rpc_url` is correct and the node is running |
| `Cannot connect to DataHaven WS` | DataHaven endpoint unreachable | Verify `datahaven_ws_url` is correct and the node accepts WebSocket connections |
| `Account 0x... is not the authorized submitter` | Private key does not match the on-chain submitter | Call `setValidatorSetSubmitter` on the ServiceManager with the correct address, or fix the private key |
| `Missing submitter private key` | No key provided | Supply via `--submitter-private-key`, `SUBMITTER_PRIVATE_KEY` env var, or `submitter_private_key` in config |
| `Config file not found` | Wrong `--config` path | Check the path and ensure the file exists |

### Missed eras

When the submitter fails to submit for an era, `missed_eras_total` increments and `consecutive_missed_eras` increases. Common causes:

- **Transaction reverted** — the submitter account may have insufficient ETH to cover `execution_fee + relayer_fee`. Fund the account.
- **RPC timeout** — the Ethereum RPC may be overloaded or unreachable. Check RPC health and consider a dedicated endpoint.
- **Snowbridge congestion** — if the bridge queue is full, submissions may fail. Check Snowbridge relayer status.
- **Already confirmed** — if another process submitted the era, the submitter skips it (this is normal, not an error).

Check `LOG_LEVEL=debug` output for detailed tick-by-tick reasoning.

### Enabling debug logs

Set the `LOG_LEVEL` environment variable to `debug` for verbose output:

```bash
LOG_LEVEL=debug bun tools/validator-set-submitter/main.ts run
```

Or in Docker/Kubernetes, add `LOG_LEVEL: "debug"` to the environment. Debug logs include per-tick skip reasons and detailed transaction information.
