# StorageHub Fisherman Node Setup

## Overview

Fisherman nodes monitor and validate storage provider behavior, detecting violations and submitting challenges to ensure network integrity.

## Purpose

- Monitor storage provider behavior and compliance
- Detect storage proof violations
- Validate provider availability
- Submit challenges for non-compliant providers
- Ensure data integrity and provider accountability
- Earn rewards for successful violation detection

## Prerequisites

- DataHaven node binary or Docker image
- Funded account with sufficient balance for challenges
- PostgreSQL 14+ database (can share with Indexer)
- Sufficient storage for chain data
- Stable network connection
- Open network ports (30333, optionally 9944)

## Hardware Requirements

Fisherman nodes have moderate hardware requirements. They rely on a PostgreSQL database (typically shared with an Indexer node) to monitor provider behavior.

### Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 physical cores @ 2.5 GHz |
| **RAM** | 8 GB DDR4 |
| **Storage (Chain Data)** | 200 GB NVMe SSD |
| **Storage (Database)** | Shared with Indexer |
| **Network** | 100 Mbit/s symmetric |

### Important Considerations

- **Database dependency**: Fisherman requires a running Indexer node in `fishing` or `full` mode
- **Shared database**: Can share PostgreSQL with Indexer to reduce resource overhead
- **Network reliability**: Stable connection required for timely challenge submissions
- **Cloud compatible**: Works well on cloud VPS

## Key Requirements

### BCSV Key (ECDSA - 1 Required)

Fishermen require **one BCSV key** for signing challenge submissions.

| Key Type | Scheme | Purpose |
|----------|--------|---------|
| `bcsv` | ecdsa | Fisherman identity and challenge signing |

### Generate BCSV Key

#### Method 1: CLI Key Insertion

```bash
# Generate seed phrase
SEED=$(datahaven-node key generate | grep "Secret phrase" | cut -d'`' -f2)

# Insert BCSV key (ecdsa)
datahaven-node key insert \
  --base-path /data/fisherman \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED//Gustavo"
```

#### Method 2: Docker Entrypoint (Automated)

Set environment variables:

```bash
export NODE_TYPE=fisherman
export NODE_NAME=Gustavo
export SEED="your seed phrase here"
export CHAIN=stagenet-local
```

The entrypoint script automatically injects the BCSV key.

## Wallet Requirements

### Fisherman Account

- **Purpose**: Challenge submission and transaction fees
- **Required Balance**:
  - Transaction fees: ~10 HAVE per challenge
  - **Recommended**: 100+ HAVE for continuous operations
- **Funding**: Must be funded to submit challenges
- **Account Type**: Ethereum-style 20-byte address (AccountId20)

### Generate Fisherman Account

```bash
# Generate new account from seed
SEED="your secure seed phrase here"
echo $SEED | datahaven-node key inspect --output-type json | jq

# Derive Fisherman account (common derivation: //Gustavo)
echo "$SEED//Gustavo" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey'
```

## Database Requirements

### PostgreSQL Setup

Fisherman nodes **require** a PostgreSQL database, which can be shared with an Indexer node.

#### Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14 postgresql-contrib

# macOS
brew install postgresql@14

# Docker
docker run -d \
  --name fisherman-postgres \
  -e POSTGRES_PASSWORD=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_DB=datahaven \
  -p 5432:5432 \
  -v fisherman-db:/var/lib/postgresql/data \
  postgres:14
```

#### Database Connection String

```
postgresql://indexer:indexer@localhost:5432/datahaven
```

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --fisherman \
  --fisherman-database-url <DATABASE_URL>
```

### Core Fisherman Flags

| Flag | Description | Required | Default |
|------|-------------|----------|---------|
| `--fisherman` | Enable fisherman service | Yes | false |
| `--fisherman-database-url <URL>` | PostgreSQL connection URL | Yes* | None |
| `--fisherman-incomplete-sync-max <N>` | Max incomplete sync requests to process | No | 10000 |
| `--fisherman-incomplete-sync-page-size <N>` | Page size for pagination | No | 256 |
| `--fisherman-sync-mode-min-blocks-behind <N>` | Min blocks behind for sync mode | No | 5 |

*Can also use `FISHERMAN_DATABASE_URL` environment variable

### Standard Node Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--chain <SPEC>` | Chain specification | Required |
| `--name <NAME>` | Node name | Required |
| `--base-path <PATH>` | Base directory for chain data | `~/.local/share/datahaven-node` |
| `--port <PORT>` | P2P port | `30333` |
| `--rpc-port <PORT>` | WebSocket RPC port | `9944` |
| `--bootnodes <MULTIADDR>` | Bootstrap nodes | None |

### Optional Flags

| Flag | Description |
|------|-------------|
| `--pruning <MODE>` | State pruning mode |
| `--prometheus-external` | Expose Prometheus metrics |
| `--log <TARGETS>` | Logging verbosity |

## Important Constraints

### Cannot Run with Lite Indexer

**CRITICAL**: Fisherman nodes **cannot** be run alongside an Indexer node in `lite` mode. They require either:
- A separate full Indexer node
- An Indexer in `fishing` mode
- An Indexer in `full` mode

### Cannot Run as Provider Simultaneously

A node **cannot** run as both a fisherman and a storage provider (MSP/BSP) at the same time.

## Complete Setup Examples

### 1. Generate Keys and Account

```bash
# Generate seed phrase
SEED="your secure seed phrase here"

# Derive Fisherman account
FISHERMAN_ACCOUNT=$(echo "$SEED//Gustavo" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey')
echo "Fisherman Account: $FISHERMAN_ACCOUNT"

# Insert BCSV key
datahaven-node key insert \
  --base-path /data/fisherman \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED//Gustavo"
```

### 2. Fund Fisherman Account

```bash
# Transfer funds to Fisherman account
# Minimum: 100 HAVE for continuous operations

# Using Polkadot.js or a funded account, send HAVE tokens to $FISHERMAN_ACCOUNT
```

### 3. Setup Database

```bash
# Start PostgreSQL with Docker
docker run -d \
  --name fisherman-postgres \
  -e POSTGRES_PASSWORD=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_DB=datahaven \
  -p 5432:5432 \
  -v fisherman-db:/var/lib/postgresql/data \
  postgres:14

# Verify connection
psql postgresql://indexer:indexer@localhost:5432/datahaven -c "SELECT version();"
```

### 4. Start Fisherman Node

```bash
datahaven-node \
  --chain stagenet-local \
  --name "Fisherman-Gustavo" \
  --base-path /data/fisherman \
  --fisherman \
  --fisherman-database-url postgresql://indexer:indexer@localhost:5432/datahaven \
  --fisherman-incomplete-sync-max 10000 \
  --fisherman-incomplete-sync-page-size 256 \
  --fisherman-sync-mode-min-blocks-behind 5 \
  --port 30333 \
  --rpc-port 9948 \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW...
```

## Docker Deployment

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: fisherman-postgres
    environment:
      POSTGRES_DB: datahaven
      POSTGRES_USER: indexer
      POSTGRES_PASSWORD: indexer
    ports:
      - "5432:5432"
    volumes:
      - fisherman-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U indexer -d datahaven"]
      interval: 10s
      timeout: 5s
      retries: 5

  indexer:
    image: datahavenxyz/datahaven:latest
    container_name: storagehub-indexer
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      INDEXER_DATABASE_URL: postgresql://indexer:indexer@postgres:5432/datahaven
    ports:
      - "30335:30333"
      - "9947:9947"
    volumes:
      - indexer-data:/data
    command:
      - "--chain=stagenet-local"
      - "--name=Indexer-Fishing"
      - "--base-path=/data"
      - "--indexer"
      - "--indexer-mode=fishing"
      - "--port=30333"
      - "--rpc-port=9947"
    restart: unless-stopped

  fisherman:
    image: datahavenxyz/datahaven:latest
    container_name: storagehub-fisherman
    depends_on:
      postgres:
        condition: service_healthy
      indexer:
        condition: service_started
    environment:
      NODE_TYPE: fisherman
      NODE_NAME: Gustavo
      SEED: "your seed phrase here"
      CHAIN: stagenet-local
      KEYSTORE_PATH: /data/keystore
      FISHERMAN_DATABASE_URL: postgresql://indexer:indexer@postgres:5432/datahaven
    ports:
      - "30336:30333"
      - "9948:9948"
    volumes:
      - fisherman-data:/data
    command:
      - "--chain=stagenet-local"
      - "--name=Fisherman-Gustavo"
      - "--base-path=/data"
      - "--keystore-path=/data/keystore"
      - "--fisherman"
      - "--fisherman-incomplete-sync-max=10000"
      - "--fisherman-incomplete-sync-page-size=256"
      - "--port=30333"
      - "--rpc-port=9948"
    restart: unless-stopped

volumes:
  fisherman-db:
  indexer-data:
  fisherman-data:
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: storagehub-fisherman
spec:
  serviceName: storagehub-fisherman
  replicas: 1
  selector:
    matchLabels:
      app: storagehub-fisherman
  template:
    metadata:
      labels:
        app: storagehub-fisherman
    spec:
      containers:
      - name: fisherman
        image: datahavenxyz/datahaven:latest
        env:
        - name: NODE_TYPE
          value: "fisherman"
        - name: NODE_NAME
          value: "Gustavo"
        - name: SEED
          valueFrom:
            secretKeyRef:
              name: fisherman-seed
              key: seed
        - name: FISHERMAN_DATABASE_URL
          value: postgresql://indexer:indexer@fisherman-postgres:5432/datahaven
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9948
          name: rpc
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "8Gi"
            cpu: "4"
          limits:
            memory: "16Gi"
            cpu: "8"
        args:
          - "--chain=stagenet-local"
          - "--name=Fisherman-Gustavo"
          - "--base-path=/data"
          - "--fisherman"
          - "--fisherman-incomplete-sync-max=10000"
          - "--fisherman-incomplete-sync-page-size=256"
          - "--port=30333"
          - "--rpc-port=9948"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 200Gi
```

## On-Chain Registration

### Not Required

Fisherman nodes do not require on-chain registration. They operate autonomously by monitoring blockchain data and submitting challenges as needed.

## Fisherman Operations

### Challenge Submission Flow

1. **Monitor**: Fisherman monitors blockchain data via database
2. **Detect**: Identifies storage provider violations:
   - Missing proofs
   - Invalid proofs
   - Storage capacity violations
   - Availability issues
3. **Verify**: Validates violation independently
4. **Challenge**: Submits challenge extrinsic to ProofsDealer pallet
5. **Reward**: Receives reward if challenge is validated

### Types of Violations Detected

| Violation Type | Description | Extrinsic |
|----------------|-------------|-----------|
| Missing Proof | Provider failed to submit proof | `proofsDealer.challengeMissingProof` |
| Invalid Proof | Submitted proof is invalid | `proofsDealer.challengeInvalidProof` |
| Over Capacity | Provider exceeds declared capacity | `providers.challengeCapacity` |
| Unavailable | Provider is unreachable | `providers.challengeAvailability` |

### Reward System

- Successful challenges earn rewards from slashed provider deposits
- Failed challenges may result in fisherman penalties
- Reward amount depends on violation severity

## Monitoring

### Health Checks

```bash
# Check node health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9948 | jq

# Check fisherman status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "fisherman_getStatus"}' \
  http://localhost:9948 | jq
```

### Database Queries

```sql
-- Get recent challenges submitted
SELECT * FROM challenges
WHERE fisherman_account = '0x...'
ORDER BY block_number DESC
LIMIT 10;

-- Get successful challenges
SELECT * FROM challenges
WHERE fisherman_account = '0x...'
  AND status = 'validated'
ORDER BY block_number DESC;

-- Get violation statistics
SELECT violation_type, COUNT(*) as count
FROM challenges
WHERE fisherman_account = '0x...'
GROUP BY violation_type;
```

### Key Metrics

- Number of challenges submitted
- Challenge success rate
- Rewards earned
- Violations detected by type
- Account balance (for fees)

### Logs

```bash
# View Fisherman logs
docker logs -f storagehub-fisherman

# Filter for challenge events
docker logs storagehub-fisherman 2>&1 | grep -i "challenge\|violation"

# Monitor successful challenges
docker logs storagehub-fisherman 2>&1 | grep -i "challenge.*success"
```

## Troubleshooting

### Issue: Database Connection Failed

**Check:**
1. PostgreSQL is running: `docker ps | grep postgres`
2. Connection string is correct
3. Database is accessible from fisherman node
4. Indexer has populated database

### Issue: Not Detecting Violations

**Check:**
1. Indexer node is running and synced
2. Indexer mode is `fishing` or `full` (not `lite`)
3. Database has recent data
4. Fisherman account has sufficient balance
5. BCSV key is correctly inserted

### Issue: Challenge Submission Failing

**Check:**
1. Account has sufficient balance for fees
2. BCSV key is valid and inserted
3. Node is fully synced
4. Violation is still valid (not already challenged)
5. Check logs for specific error messages

### Issue: No Rewards Received

**Check:**
1. Challenges were validated successfully
2. Reward distribution period has passed
3. Check on-chain events for reward distribution
4. Verify fisherman account address

## Security Considerations

1. **Key Management**: Store seed phrase securely offline
2. **Account Security**: Monitor balance for unexpected drops
3. **Database Security**: Secure database access
4. **Network Security**: Use firewall to restrict access
5. **False Positives**: Ensure validation logic is accurate

## Best Practices

1. Run alongside a dedicated Indexer node
2. Monitor account balance and set up auto-refill
3. Set reasonable `incomplete-sync-max` to avoid overload
4. Keep node software updated
5. Implement monitoring and alerting
6. Document operational procedures
7. Test challenge submission in development environment
8. Monitor provider behavior patterns

## Performance Considerations

### Tuning Parameters

```bash
# For high-volume monitoring
--fisherman-incomplete-sync-max 20000 \
--fisherman-incomplete-sync-page-size 512 \
--fisherman-sync-mode-min-blocks-behind 3
```

## Economic Considerations

### Operational Costs

- **Transaction Fees**: ~10 HAVE per challenge
- **False Challenge Penalty**: Varies by violation type
- **Monitoring Costs**: Infrastructure costs

### Revenue Potential

- **Successful Challenges**: Rewards from slashed deposits
- **Volume**: Depends on network size and provider behavior
- **Competition**: Multiple fishermen may detect same violations

### Break-Even Analysis

```
Monthly Revenue = (Successful Challenges × Reward per Challenge)
Monthly Costs = (Infrastructure Costs + Transaction Fees)
Net Profit = Monthly Revenue - Monthly Costs
```

## Related Documentation

- [MSP Setup](./storagehub-msp.md)
- [BSP Setup](./storagehub-bsp.md)
- [Indexer Setup](./storagehub-indexer.md)
- [StorageHub Pallets](https://github.com/Moonsong-Labs/storage-hub)
- [Proofs Dealer Pallet](https://github.com/Moonsong-Labs/storage-hub/tree/main/pallets/proofs-dealer)
- [Docker Compose Guide](../operator/DOCKER-COMPOSE.md)
