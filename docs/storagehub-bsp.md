# StorageHub Backup Storage Provider (BSP) Setup

## Overview

Backup Storage Providers (BSPs) provide redundant storage for files in the StorageHub network, receiving files from Main Storage Providers (MSPs) and submitting proofs of storage.

## Purpose

- Store backup copies of files
- Submit proofs of storage periodically
- Charge fees from users for backup storage
- Handle bucket migrations
- Serve file download requests as backup
- Ensure data redundancy and availability

## Prerequisites

- DataHaven node binary or Docker image
- Funded account with sufficient balance for deposits
- Storage capacity (minimum 2 data units, recommended 10+ GiB)
- Stable network connection
- Open network ports (30333, optionally 9944)

## Key Requirements

### BCSV Key (ECDSA - 1 Required)

BSPs require **one BCSV key** for storage provider identity.

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
  --base-path /data/bsp \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED"
```

#### Method 2: Docker Entrypoint (Automated)

Set environment variables:

```bash
export NODE_TYPE=bsp
export NODE_NAME=bsp01
export SEED="your seed phrase here"
export CHAIN=stagenet-local
```

The entrypoint script automatically injects the BCSV key.

## Wallet Requirements

### Provider Account

- **Purpose**: BSP registration, transaction fees, and deposits
- **Required Balance**:
  - Minimum deposit: 100 HAVE (SpMinDeposit)
  - Deposit per data unit: 2 HAVE per unit
  - Transaction fees: ~10 HAVE
  - **Recommended**: 200+ HAVE for initial setup
- **Funding**: Must be funded **before** BSP registration
- **Account Type**: Ethereum-style 20-byte address (AccountId20)

### Generate Provider Account

```bash
# Generate new account from seed
SEED="your secure seed phrase here"
echo $SEED | datahaven-node key inspect --output-type json | jq

# Derive BSP account
echo "$SEED" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey'
```

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --provider \
  --provider-type bsp \
  --max-storage-capacity <BYTES> \
  --jump-capacity <BYTES>
```

### Core Provider Flags

| Flag | Description | Required | Default |
|------|-------------|----------|---------|
| `--provider` | Enable storage provider mode | Yes | false |
| `--provider-type bsp` | Set provider type to BSP | Yes | None |
| `--max-storage-capacity <BYTES>` | Maximum storage capacity | Yes | None |
| `--jump-capacity <BYTES>` | Jump capacity for new storage | Yes | None |
| `--storage-layer <TYPE>` | Storage backend (`rocksdb` or `memory`) | No | `memory` |
| `--storage-path <PATH>` | Storage path (required if rocksdb) | No | None |

**Example Values:**
- `--max-storage-capacity 10737418240` (10 GiB)
- `--jump-capacity 1073741824` (1 GiB)

### BSP-Specific Task Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--bsp-upload-file-task` | Enable file upload from MSP task | false |
| `--bsp-upload-file-max-try-count <N>` | Max retries for file uploads | 5 |
| `--bsp-upload-file-max-tip <AMOUNT>` | Max tip for upload file extrinsics | 0 |
| `--bsp-move-bucket-task` | Enable bucket migration task | false |
| `--bsp-move-bucket-grace-period <SECONDS>` | Grace period after bucket move | 300 |
| `--bsp-charge-fees-task` | Enable automatic fee charging | false |
| `--bsp-charge-fees-min-debt <AMOUNT>` | Minimum debt threshold to charge | 0 |
| `--bsp-submit-proof-task` | Enable proof submission task | false |
| `--bsp-submit-proof-max-attempts <N>` | Max attempts to submit proof | 3 |

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

# Derive BSP account
BSP_ACCOUNT=$(echo "$SEED" | datahaven-node key inspect --output-type json | jq -r '.ss58PublicKey')
echo "BSP Account: $BSP_ACCOUNT"

# Insert BCSV key
datahaven-node key insert \
  --base-path /data/bsp \
  --chain stagenet-local \
  --key-type bcsv \
  --scheme ecdsa \
  --suri "$SEED"
```

### 2. Fund Provider Account

```bash
# Transfer funds to BSP account
# Minimum: 200 HAVE (100 deposit + 100 for operations)

# Using Polkadot.js or a funded account, send HAVE tokens to $BSP_ACCOUNT
```

### 3. Start BSP Node

```bash
datahaven-node \
  --chain stagenet-local \
  --name "BSP01" \
  --base-path /data/bsp \
  --provider \
  --provider-type bsp \
  --max-storage-capacity 10737418240 \
  --jump-capacity 1073741824 \
  --storage-layer rocksdb \
  --storage-path /data/bsp/storage \
  --bsp-upload-file-task \
  --bsp-move-bucket-task \
  --bsp-charge-fees-task \
  --bsp-submit-proof-task \
  --port 30333 \
  --rpc-port 9946 \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW...
```

### 4. Register BSP On-Chain

See [On-Chain Registration](#on-chain-registration) section below.

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  bsp:
    image: datahavenxyz/datahaven:latest
    container_name: storagehub-bsp
    environment:
      NODE_TYPE: bsp
      NODE_NAME: bsp01
      SEED: "your seed phrase here"
      CHAIN: stagenet-local
      KEYSTORE_PATH: /data/keystore
    ports:
      - "30334:30333"
      - "9946:9946"
    volumes:
      - bsp-data:/data
      - bsp-storage:/data/storage
    command:
      - "--chain=stagenet-local"
      - "--name=BSP01"
      - "--base-path=/data"
      - "--keystore-path=/data/keystore"
      - "--provider"
      - "--provider-type=bsp"
      - "--max-storage-capacity=10737418240"
      - "--jump-capacity=1073741824"
      - "--storage-layer=rocksdb"
      - "--storage-path=/data/storage"
      - "--bsp-upload-file-task"
      - "--bsp-move-bucket-task"
      - "--bsp-charge-fees-task"
      - "--bsp-submit-proof-task"
      - "--port=30333"
      - "--rpc-port=9946"
    restart: unless-stopped

volumes:
  bsp-data:
  bsp-storage:
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: storagehub-bsp
spec:
  serviceName: storagehub-bsp
  replicas: 1
  selector:
    matchLabels:
      app: storagehub-bsp
  template:
    metadata:
      labels:
        app: storagehub-bsp
    spec:
      containers:
      - name: bsp
        image: datahavenxyz/datahaven:latest
        env:
        - name: NODE_TYPE
          value: "bsp"
        - name: NODE_NAME
          value: "bsp01"
        - name: SEED
          valueFrom:
            secretKeyRef:
              name: bsp-seed
              key: seed
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9946
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
          - "--provider-type=bsp"
          - "--max-storage-capacity=10737418240"
          - "--jump-capacity=1073741824"
          - "--storage-layer=rocksdb"
          - "--storage-path=/data/storage"
          - "--bsp-upload-file-task"
          - "--bsp-move-bucket-task"
          - "--bsp-charge-fees-task"
          - "--bsp-submit-proof-task"
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

### BSP Registration Process

BSPs must be registered on-chain via the `Providers` pallet using a **2-step process**:

1. **Step 1**: Call `request_bsp_sign_up` - Initiates registration and reserves deposit
2. **Step 2**: Call `confirm_sign_up` - Completes registration after randomness verification

This two-step mechanism ensures security and prevents manipulation of provider IDs through randomness.

### Step 1: Request BSP Sign Up

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

// BSP signer (using your BCSV key account)
const bspSigner = /* your polkadot-api signer */;

// BSP configuration
const capacity = BigInt(10_737_418_240); // 10 GiB in bytes
const multiaddresses = [
  '/ip4/127.0.0.1/tcp/30333',
  '/dns/bsp01.example.com/tcp/30333'
].map(addr => Binary.fromText(addr));

// Step 1: Request BSP sign up
const requestTx = typedApi.tx.Providers.request_bsp_sign_up({
  capacity: capacity,
  multiaddresses: multiaddresses,
  payment_account: bspSigner.publicKey  // Account receiving payments
});

// Sign and submit the request
const requestResult = await requestTx.signAndSubmit(bspSigner);
console.log('BSP sign-up requested. Waiting for finalization...');

await requestResult.finalized();
console.log('Request finalized! Deposit has been reserved.');
```

**What Happens in Step 1:**
- Validates multiaddresses format
- Calculates required deposit based on capacity (`SpMinDeposit + capacity * DepositPerData`)
- Verifies account has sufficient balance
- **Holds (reserves) the deposit** from your account
- Creates a pending sign-up request
- Emits `BspRequestSignUpSuccess` event

### Step 2: Confirm Sign Up

After requesting, you must wait for sufficient randomness to be available (controlled by `MaxBlocksForRandomness` parameter, typically 2 hours on mainnet).

```typescript
// Step 2: Confirm the sign-up (after waiting for randomness)
const confirmTx = typedApi.tx.Providers.confirm_sign_up({
  provider_account: undefined  // Optional: omit to use signer's account
});

// Sign and submit confirmation
const confirmResult = await confirmTx.signAndSubmit(bspSigner);
console.log('Confirming BSP registration...');

await confirmResult.finalized();
console.log('BSP registration confirmed and active!');
```

**What Happens in Step 2:**
- Verifies randomness is sufficiently fresh
- Checks request hasn't expired
- Generates Provider ID using randomness
- Registers BSP in the system
- Applies sign-up lock period (90 days on testnet/mainnet via `BspSignUpLockPeriod`)
- Emits `BspSignUpSuccess` event
- Deposit remains held for duration of BSP operation

### Timing Requirements

| Parameter | Testnet | Mainnet | Description |
|-----------|---------|---------|-------------|
| Min wait time | ~2 minutes | ~2 hours | Wait after `request_bsp_sign_up` for randomness |
| Max wait time | Set by `MaxBlocksForRandomness` | Typically 2 hours | Request expires if not confirmed in time |
| Sign-up lock | 90 days | 90 days | Period before BSP can sign off after registration |

### Verify Registration

```typescript
// Check BSP registration status
const bspAccount = bspSigner.publicKey;

const registeredBspId = await typedApi.query.Providers.AccountIdToBackupStorageProviderId.getValue(
  bspAccount
);

if (registeredBspId) {
  console.log('Registered BSP ID:', registeredBspId);

  // Get full BSP details
  const bspInfo = await typedApi.query.Providers.BackupStorageProviders.getValue(
    registeredBspId
  );
  console.log('BSP Info:', bspInfo);
} else {
  console.log('BSP not yet registered or confirmation pending');
}
```

### Cancel Pending Request

If you change your mind before confirming:

```typescript
const cancelTx = typedApi.tx.Providers.cancel_sign_up();
await cancelTx.signAndSubmit(bspSigner);
console.log('Sign-up request cancelled, deposit returned');
```

### Development/Testing: Force Sign Up (Requires Sudo)

For development and testing environments with sudo access, you can bypass the 2-step process:

```typescript
// Single-step registration for testing (requires sudo)
const sudoSigner = /* sudo account signer */;

const bspCall = typedApi.tx.Providers.force_bsp_sign_up({
  who: bspAccount,
  bsp_id: /* pre-generated provider ID */,
  capacity: BigInt(10_737_418_240),
  multiaddresses: multiaddresses,
  payment_account: bspAccount,
  weight: undefined  // Optional weight parameter
});

const sudoTx = typedApi.tx.Sudo.sudo({ call: bspCall.decodedCall });
await sudoTx.signAndSubmit(sudoSigner);
```

### Registration Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `capacity` | StorageDataUnit | Storage capacity in bytes | `10737418240` (10 GiB) |
| `multiaddresses` | Vec<Bytes> | P2P network addresses | `[Binary.fromText("/ip4/...")]` |
| `payment_account` | AccountId | Account receiving payments | `0x...` (20-byte) |

### Deposit Requirements

- **Base Deposit**: 100 HAVE (`SpMinDeposit`)
- **Per Data Unit**: 2 HAVE per unit (`DepositPerData`)
- **Total for 10 GiB**: ~100 HAVE + (10 GiB in units × 2 HAVE)

The deposit is **held (reserved)** from your account when you call `request_bsp_sign_up` and remains held while you operate as a BSP.

## Monitoring

### Health Checks

```bash
# Check node health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9946 | jq

# Check provider status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "storageprovider_getStatus"}' \
  http://localhost:9946 | jq
```

### Key Metrics to Monitor

- Storage capacity usage
- Number of stored files
- Proof submission success rate
- File upload success rate from MSPs
- Fee collection status
- Bucket migration status

### Logs

```bash
# View BSP logs
docker logs -f storagehub-bsp

# Filter for storage events
docker logs storagehub-bsp 2>&1 | grep -i "storage\|proof\|file"

# Monitor proof submissions
docker logs storagehub-bsp 2>&1 | grep -i "proof"
```

## Proof Submission

### Automatic Proof Submission

BSPs automatically submit proofs when `--bsp-submit-proof-task` is enabled.

### Proof Submission Flow

1. **Challenge Received**: BSP receives storage proof challenge from ProofsDealer pallet
2. **Proof Generation**: BSP generates Merkle proof for challenged data
3. **Proof Submission**: BSP submits proof via `proofsDealer.submitProof` extrinsic
4. **Verification**: ProofsDealer pallet verifies proof on-chain
5. **Reward/Penalty**: BSP receives reward for valid proof or penalty for invalid/missing proof

### Monitor Proof Submission

```bash
# Check pending proofs
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "storageprovider_getPendingProofs"}' \
  http://localhost:9946 | jq
```

## Troubleshooting

### Issue: Registration Failed

**Check:**
1. Account has sufficient balance (200+ HAVE)
2. BCSV key is correctly inserted
3. Capacity meets minimum (2 data units)
4. Provider ID is correctly calculated

### Issue: Not Receiving Files from MSP

**Check:**
1. BSP is registered on-chain
2. `--bsp-upload-file-task` flag is enabled
3. Storage capacity not exceeded
4. Node is fully synced
5. Network connectivity to MSPs

### Issue: Proof Submission Failing

**Check:**
1. `--bsp-submit-proof-task` flag is enabled
2. Node is fully synced
3. Sufficient balance for transaction fees
4. Files are correctly stored and accessible
5. Check logs for specific errors

### Issue: Fee Charging Not Working

**Check:**
1. `--bsp-charge-fees-task` flag is enabled
2. Users have sufficient debt to charge
3. Node is synced and connected

## Security Considerations

1. **Key Management**: Store seed phrase securely offline
2. **Storage Security**: Encrypt storage at rest
3. **Network Security**: Use firewall to restrict access
4. **Proof Integrity**: Ensure storage backend reliability
5. **Backup Strategy**: Regular backups of stored data

## Best Practices

1. Use production-grade storage (NVMe SSD recommended)
2. Monitor storage capacity proactively
3. Enable all BSP tasks for full functionality
4. Keep node software updated
5. Implement monitoring and alerting for proof submissions
6. Set reasonable `bsp-submit-proof-max-attempts` (3-5)
7. Document operational procedures
8. Monitor network connectivity to MSPs

## Performance Considerations

### Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage (Chain Data) | 100 GB | 200 GB |
| Storage (Files) | 10 GB | 500+ GB |
| Network | 100 Mbps | 1 Gbps |

### Storage Backend Comparison

| Backend | Pros | Cons | Use Case |
|---------|------|------|----------|
| `memory` | Fast, simple | Not persistent | Testing only |
| `rocksdb` | Persistent, production-ready | Slower than memory | Production |

## Related Documentation

- [MSP Setup](./storagehub-msp.md)
- [Indexer Setup](./storagehub-indexer.md)
- [Fisherman Setup](./storagehub-fisherman.md)
- [StorageHub Pallets](https://github.com/Moonsong-Labs/storage-hub)
- [Proofs Dealer Pallet](https://github.com/Moonsong-Labs/storage-hub/tree/main/pallets/proofs-dealer)
