# StorageHub Main Storage Provider (MSP) Setup

## Overview

Main Storage Providers (MSPs) are primary storage providers in the StorageHub network that manage user data, buckets, and coordinate with Backup Storage Providers (BSPs).

## Purpose

- Store and manage user files and buckets
- Charge storage fees from users
- Distribute files to BSPs for redundancy
- Manage bucket migrations
- Serve file download requests
- Submit proofs of storage

## Prerequisites

- DataHaven node binary or Docker image
- Funded account with sufficient balance for deposits
- Storage capacity (minimum 2 data units, recommended 10+ GiB)
- Stable network connection
- Open network ports (30333, optionally 9944)
- Optional: PostgreSQL database for advanced features

## Key Requirements

### BCSV Key (ECDSA - 1 Required)

MSPs require **one BCSV key** for storage provider identity.

| Key Type | Scheme | Purpose |
|----------|--------|---------|
| `bcsv` | ecdsa | Storage provider identity and signing |

### Generate BCSV Key

#### Method 1: CLI Key Insertion

```bash
# Generate seed phrase
SEED=$(datahaven-node key generate | grep "Secret phrase" | cut -d'`' -f2)

# Insert BCSV key (ecdsa)
datahaven-node key insert \
  --base-path /data/msp \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED"
```

#### Method 2: Docker Entrypoint (Automated)

Set environment variables:

```bash
export NODE_TYPE=msp
export NODE_NAME=msp01
export SEED="your seed phrase here"
export CHAIN=stagenet-local
```

The entrypoint script automatically injects the BCSV key.

## Wallet Requirements

### Provider Account

- **Purpose**: MSP registration, transaction fees, and deposits
- **Required Balance**:
  - Minimum deposit: 100 HAVE (SpMinDeposit)
  - Deposit per data unit: 2 HAVE per unit
  - Transaction fees: ~10 HAVE
  - **Recommended**: 200+ HAVE for initial setup
- **Funding**: Must be funded **before** MSP registration
- **Account Type**: Ethereum-style 20-byte address (AccountId20)

### Generate Provider Account

```bash
# Generate new account from seed
SEED="your secure seed phrase here"
echo $SEED | datahaven-node key inspect --output-type json | jq

# Derive MSP account
echo "$SEED//my_awesome_msp" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey'
```

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --provider \
  --provider-type msp \
  --max-storage-capacity <BYTES> \
  --jump-capacity <BYTES> \
  --msp-charging-period <BLOCKS>
```

### Core Provider Flags

| Flag | Description | Required | Default |
|------|-------------|----------|---------|
| `--provider` | Enable storage provider mode | Yes | false |
| `--provider-type msp` | Set provider type to MSP | Yes | None |
| `--max-storage-capacity <BYTES>` | Maximum storage capacity | Yes | None |
| `--jump-capacity <BYTES>` | Jump capacity for new storage | Yes | None |
| `--msp-charging-period <BLOCKS>` | Fee charging period in blocks | Yes | None |
| `--storage-layer <TYPE>` | Storage backend (`rocksdb` or `memory`) | No | `memory` |
| `--storage-path <PATH>` | Storage path (required if rocksdb) | No | None |

**Example Values:**
- `--max-storage-capacity 10737418240` (10 GiB)
- `--jump-capacity 1073741824` (1 GiB)
- `--msp-charging-period 100` (100 blocks)

### MSP-Specific Task Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--msp-charge-fees-task` | Enable automatic fee charging | false |
| `--msp-charge-fees-min-debt <AMOUNT>` | Minimum debt threshold to charge | 0 |
| `--msp-move-bucket-task` | Enable bucket migration task | false |
| `--msp-move-bucket-max-try-count <N>` | Max retries for bucket moves | 5 |
| `--msp-move-bucket-max-tip <AMOUNT>` | Max tip for move bucket extrinsics | 0 |
| `--msp-distribute-files` | Enable file distribution to BSPs | false |

### Remote File Handling Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--max-file-size <BYTES>` | Maximum file size | 10737418240 (10 GB) |
| `--connection-timeout <SECONDS>` | Connection timeout | 30 |
| `--read-timeout <SECONDS>` | Read timeout | 300 |
| `--follow-redirects <BOOL>` | Follow HTTP redirects | true |
| `--max-redirects <N>` | Maximum redirects | 10 |
| `--user-agent <STRING>` | HTTP user agent | "StorageHub-Client/1.0" |
| `--chunk-size <BYTES>` | Upload/download chunk size | 8192 (8 KB) |
| `--chunks-buffer <N>` | Number of chunks to buffer | 512 |

### Operational Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--extrinsic-retry-timeout <SECONDS>` | Extrinsic retry timeout | 60 |
| `--sync-mode-min-blocks-behind <N>` | Min blocks behind for sync mode | 5 |
| `--check-for-pending-proofs-period <N>` | Period to check pending proofs | 4 |
| `--max-blocks-behind-to-catch-up-root-changes <N>` | Max blocks to process for root changes | 10 |

## Complete Setup Example

### 1. Generate Keys and Account

```bash
# Generate seed phrase
SEED="your secure seed phrase here"

# Derive MSP account
MSP_ACCOUNT=$(echo "$SEED//msp01" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey')
echo "MSP Account: $MSP_ACCOUNT"

# Insert BCSV key
datahaven-node key insert \
  --base-path /data/msp \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED"
```

### 2. Fund Provider Account

```bash
# Transfer funds to MSP account
# Minimum: 200 HAVE (100 deposit + 100 for operations)

# Using Polkadot.js or a funded account, send HAVE tokens to $MSP_ACCOUNT
```

### 3. Start MSP Node

```bash
datahaven-node \
  --chain stagenet-local \
  --name "MSP01" \
  --base-path /data/msp \
  --provider \
  --provider-type msp \
  --max-storage-capacity 10737418240 \
  --jump-capacity 1073741824 \
  --msp-charging-period 100 \
  --storage-layer rocksdb \
  --storage-path /data/msp/storage \
  --msp-charge-fees-task \
  --msp-move-bucket-task \
  --msp-distribute-files \
  --port 30333 \
  --rpc-port 9945 \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW...
```

### 4. Register MSP On-Chain

See [On-Chain Registration](#on-chain-registration) section below.

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  msp:
    image: datahavenxyz/datahaven:latest
    container_name: storagehub-msp
    environment:
      NODE_TYPE: msp
      NODE_NAME: msp01
      SEED: "your seed phrase here"
      CHAIN: stagenet-local
      KEYSTORE_PATH: /data/keystore
    ports:
      - "30333:30333"
      - "9945:9945"
    volumes:
      - msp-data:/data
      - msp-storage:/data/storage
    command:
      - "--chain=stagenet-local"
      - "--name=MSP01"
      - "--base-path=/data"
      - "--keystore-path=/data/keystore"
      - "--provider"
      - "--provider-type=msp"
      - "--max-storage-capacity=10737418240"
      - "--jump-capacity=1073741824"
      - "--msp-charging-period=100"
      - "--storage-layer=rocksdb"
      - "--storage-path=/data/storage"
      - "--msp-charge-fees-task"
      - "--msp-move-bucket-task"
      - "--msp-distribute-files"
      - "--port=30333"
      - "--rpc-port=9945"
    restart: unless-stopped

volumes:
  msp-data:
  msp-storage:
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: storagehub-msp
spec:
  serviceName: storagehub-msp
  replicas: 1
  selector:
    matchLabels:
      app: storagehub-msp
  template:
    metadata:
      labels:
        app: storagehub-msp
    spec:
      containers:
      - name: msp
        image: datahavenxyz/datahaven:latest
        env:
        - name: NODE_TYPE
          value: "msp"
        - name: NODE_NAME
          value: "MSP01"
        - name: SEED
          valueFrom:
            secretKeyRef:
              name: msp-seed
              key: seed
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9945
          name: rpc
        volumeMounts:
        - name: data
          mountPath: /data
        - name: storage
          mountPath: /data/storage
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        args:
          - "--chain=stagenet-local"
          - "--provider"
          - "--provider-type=msp"
          - "--max-storage-capacity=10737418240"
          - "--jump-capacity=1073741824"
          - "--msp-charging-period=100"
          - "--storage-layer=rocksdb"
          - "--storage-path=/data/storage"
          - "--msp-charge-fees-task"
          - "--msp-move-bucket-task"
          - "--msp-distribute-files"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
  - metadata:
      name: storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 500Gi
```

## On-Chain Registration

### MSP Registration Process

MSPs must be registered on-chain via the `Providers` pallet using a **2-step process**:

1. **Step 1**: Call `request_msp_sign_up` - Initiates registration and reserves deposit
2. **Step 2**: Call `confirm_sign_up` - Completes registration after randomness verification

This two-step mechanism ensures security and prevents manipulation of provider IDs through randomness.

### Step 1: Request MSP Sign Up

```typescript
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { datahaven } from '@polkadot-api/descriptors';
import { Binary } from 'polkadot-api';

// Connect to DataHaven node
const client = createClient(
  withPolkadotSdkCompat(getWsProvider('ws://localhost:9944'))
);
const typedApi = client.getTypedApi(datahaven);

// MSP signer (using your BCSV key account)
const mspSigner = /* your polkadot-api signer */;

// MSP configuration
const capacity = BigInt(10_737_418_240); // 10 GiB in bytes
const multiaddresses = [
  '/ip4/127.0.0.1/tcp/30333',
  '/dns/msp01.example.com/tcp/30333'
].map(addr => Binary.fromText(addr));

// Step 1: Request MSP sign up
const requestTx = typedApi.tx.Providers.request_msp_sign_up({
  capacity: capacity,
  multiaddresses: multiaddresses,
  value_prop_price_per_giga_unit_of_data_per_block: BigInt(18_520_000_000),
  commitment: Binary.fromText('msp01'),
  value_prop_max_data_limit: BigInt(1_073_741_824),
  payment_account: mspSigner.publicKey  // Account receiving payments
});

// Sign and submit the request
const requestResult = await requestTx.signAndSubmit(mspSigner);
console.log('MSP sign-up requested. Waiting for finalization...');

await requestResult.finalized();
console.log('Request finalized! Deposit has been reserved.');
```

**What Happens in Step 1:**
- Validates multiaddresses format
- Calculates required deposit based on capacity (`SpMinDeposit + capacity * DepositPerData`)
- Verifies account has sufficient balance
- **Holds (reserves) the deposit** from your account
- Creates a pending sign-up request
- Emits `MspRequestSignUpSuccess` event

### Step 2: Confirm Sign Up

After requesting, you must wait for sufficient randomness to be available (controlled by `MaxBlocksForRandomness` parameter, typically 2 hours on mainnet).

```typescript
// Step 2: Confirm the sign-up (after waiting for randomness)
const confirmTx = typedApi.tx.Providers.confirm_sign_up({
  provider_account: undefined  // Optional: omit to use signer's account
});

// Sign and submit confirmation
const confirmResult = await confirmTx.signAndSubmit(mspSigner);
console.log('Confirming MSP registration...');

await confirmResult.finalized();
console.log('MSP registration confirmed and active!');
```

**What Happens in Step 2:**
- Verifies randomness is sufficiently fresh
- Checks request hasn't expired
- Generates Provider ID using randomness
- Registers MSP in the system
- Emits `MspSignUpSuccess` event
- Deposit remains held for duration of MSP operation

### Timing Requirements

| Parameter | Testnet | Mainnet | Description |
|-----------|---------|---------|-------------|
| Min wait time | ~2 minutes | ~2 hours | Wait after `request_msp_sign_up` for randomness |
| Max wait time | Set by `MaxBlocksForRandomness` | Typically 2 hours | Request expires if not confirmed in time |

### Verify Registration

```typescript
// Check MSP registration status
const mspAccount = mspSigner.publicKey;

const registeredMspId = await typedApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
  mspAccount
);

if (registeredMspId) {
  console.log('Registered MSP ID:', registeredMspId);

  // Get full MSP details
  const mspInfo = await typedApi.query.Providers.MainStorageProviders.getValue(
    registeredMspId
  );
  console.log('MSP Info:', mspInfo);
} else {
  console.log('MSP not yet registered or confirmation pending');
}
```

### Cancel Pending Request

If you change your mind before confirming:

```typescript
const cancelTx = typedApi.tx.Providers.cancel_sign_up();
await cancelTx.signAndSubmit(mspSigner);
console.log('Sign-up request cancelled, deposit returned');
```

### Development/Testing: Force Sign Up (Requires Sudo)

For development and testing environments with sudo access, you can bypass the 2-step process:

```typescript
// Single-step registration for testing (requires sudo)
const sudoSigner = /* sudo account signer */;

const mspCall = typedApi.tx.Providers.force_msp_sign_up({
  who: mspAccount,
  msp_id: /* pre-generated provider ID */,
  capacity: BigInt(10_737_418_240),
  value_prop_price_per_giga_unit_of_data_per_block: BigInt(18_520_000_000),
  multiaddresses: multiaddresses,
  commitment: Binary.fromText('msp01'),
  value_prop_max_data_limit: BigInt(1_073_741_824),
  payment_account: mspAccount
});

const sudoTx = typedApi.tx.Sudo.sudo({ call: mspCall.decodedCall });
await sudoTx.signAndSubmit(sudoSigner);
```

### Registration Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `capacity` | StorageDataUnit | Storage capacity in bytes | `10737418240` (10 GiB) |
| `multiaddresses` | Vec<Bytes> | P2P network addresses | `[Binary.fromText("/ip4/...")]` |
| `value_prop_price_per_giga_unit_of_data_per_block` | Balance | Price per GiB per block | `18520000000` |
| `commitment` | Bytes | Service commitment identifier | `Binary.fromText("msp01")` |
| `value_prop_max_data_limit` | StorageDataUnit | Max data per value prop | `1073741824` (1 GiB) |
| `payment_account` | AccountId | Account receiving payments | `0x...` (20-byte) |

### Deposit Requirements

- **Base Deposit**: 100 HAVE (`SpMinDeposit`)
- **Per Data Unit**: 2 HAVE per unit (`DepositPerData`)
- **Total for 10 GiB**: ~100 HAVE + (10 GiB in units × 2 HAVE)

The deposit is **held (reserved)** from your account when you call `request_msp_sign_up` and remains held while you operate as an MSP.

## Monitoring

### Health Checks

```bash
# Check node health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9945 | jq

# Check provider status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "storageprovider_getStatus"}' \
  http://localhost:9945 | jq
```

### Key Metrics to Monitor

- Storage capacity usage
- Number of stored files
- Fee collection status
- Proof submission success rate
- Bucket migration status
- BSP distribution success rate

### Logs

```bash
# View MSP logs
docker logs -f storagehub-msp

# Filter for storage events
docker logs storagehub-msp 2>&1 | grep -i "storage\|bucket\|file"
```

## Troubleshooting

### Issue: Registration Failed

**Check:**
1. Account has sufficient balance (200+ HAVE)
2. BCSV key is correctly inserted
3. Capacity meets minimum (2 data units)
4. Provider ID is correctly calculated

### Issue: Not Accepting Files

**Check:**
1. MSP is registered on-chain
2. Storage capacity not exceeded
3. Node is fully synced
4. RPC endpoint is accessible

### Issue: Fee Charging Not Working

**Check:**
1. `--msp-charge-fees-task` flag is enabled
2. `--msp-charging-period` matches on-chain value
3. Users have sufficient debt to charge

## Security Considerations

1. **Key Management**: Store seed phrase securely offline
2. **Storage Security**: Encrypt storage at rest
3. **Network Security**: Use firewall to restrict access
4. **Access Control**: Limit RPC access to trusted sources
5. **Backup Strategy**: Regular backups of stored data

## Best Practices

1. Use production-grade storage (NVMe SSD recommended)
2. Monitor storage capacity proactively
3. Enable all MSP tasks for full functionality
4. Set reasonable `msp-charging-period` (100-1000 blocks)
5. Keep node software updated
6. Implement monitoring and alerting
7. Document operational procedures

## Related Documentation

- [BSP Setup](./storagehub-bsp.md)
- [Indexer Setup](./storagehub-indexer.md)
- [Fisherman Setup](./storagehub-fisherman.md)
- [StorageHub Pallets](https://github.com/Moonsong-Labs/storage-hub)
