# StorageHub Indexer Node Setup

## Overview

Indexer nodes index blockchain data into a PostgreSQL database, enabling efficient querying of storage operations, file metadata, and provider activities.

## Purpose

- Index blockchain data to PostgreSQL database
- Enable efficient querying of storage operations
- Support fisherman node operations
- Provide historical data analysis
- Track file system events and provider activities

## Prerequisites

- DataHaven node binary or Docker image
- PostgreSQL 14+ database server
- Sufficient storage for chain data and database
- Stable network connection
- Open network ports (30333, optionally 9944)

## Hardware Requirements

Indexer nodes have varying requirements depending on the indexing mode. Full mode requires more resources for complete historical data indexing.

### Lite/Fishing Mode Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 physical cores @ 2.5 GHz |
| **RAM** | 16 GB DDR4 |
| **Storage (Chain Data)** | 100 GB NVMe SSD |
| **Storage (Database)** | 100 GB NVMe SSD |
| **Network** | 100 Mbit/s symmetric |

### Full Mode Specifications (Recommended)

| Component | Requirement |
|-----------|-------------|
| **CPU** | 8 physical cores @ 3.0 GHz (Intel Ice Lake+ or AMD Zen3+) |
| **RAM** | 32 GB DDR4 |
| **Storage (Chain Data)** | 300 GB NVMe SSD |
| **Storage (Database)** | 500 GB NVMe SSD |
| **Network** | 500 Mbit/s symmetric |

### Important Considerations

- **Archive mode**: Full indexers should run with `--pruning archive` for complete historical data
- **Database performance**: Use NVMe SSD for PostgreSQL data directory
- **Separate volumes**: Keep chain data and database on separate volumes for better I/O
- **Database growth**: Plan for database growth; full mode can grow significantly over time
- **Cloud compatible**: Indexer nodes work well on cloud VPS with dedicated storage

## Key Requirements

### No Session Keys Required

Indexer nodes do **not** require session keys as they are non-signing nodes that only observe and index blockchain data.

### No BCSV Key Required

Indexer nodes do not participate in storage operations, so no BCSV key is needed.

## Wallet Requirements

### No Wallet Required

Indexer nodes do not submit transactions, so no funded account is needed.

## Database Requirements

### PostgreSQL Setup

#### Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14 postgresql-contrib

# macOS
brew install postgresql@14

# Docker
docker run -d \
  --name indexer-postgres \
  -e POSTGRES_PASSWORD=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_DB=datahaven \
  -p 5432:5432 \
  -v indexer-db:/var/lib/postgresql/data \
  postgres:14
```

#### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE datahaven;
CREATE USER indexer WITH ENCRYPTED PASSWORD 'indexer';
GRANT ALL PRIVILEGES ON DATABASE datahaven TO indexer;
\q
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
  --indexer \
  --indexer-database-url <DATABASE_URL>
```

### Core Indexer Flags

| Flag | Description | Required | Default |
|------|-------------|----------|---------|
| `--indexer` | Enable indexer service | Yes | false |
| `--indexer-database-url <URL>` | PostgreSQL connection URL | Yes* | None |
| `--indexer-mode <MODE>` | Indexer mode (`full`, `lite`, `fishing`) | No | `full` |

*Can also use `INDEXER_DATABASE_URL` environment variable

### Indexer Modes

| Mode | Description | Data Indexed | Use Case |
|------|-------------|--------------|----------|
| `full` | Index all blockchain data | All events, storage, metadata | Complete historical data |
| `lite` | Index essential storage data | Storage operations, files, providers | Storage-focused queries |
| `fishing` | Index data for fisherman | Provider challenges, proofs, violations | Fisherman operations |

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
| `--pruning <MODE>` | State pruning mode (recommend `archive` for indexer) |
| `--blocks-pruning <MODE>` | Block pruning mode (recommend `archive`) |
| `--prometheus-external` | Expose Prometheus metrics |
| `--log <TARGETS>` | Logging verbosity |

## Complete Setup Examples

### 1. Setup Database

```bash
# Start PostgreSQL with Docker
docker run -d \
  --name indexer-postgres \
  -e POSTGRES_PASSWORD=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_DB=datahaven \
  -p 5432:5432 \
  -v indexer-db:/var/lib/postgresql/data \
  postgres:14

# Verify connection
psql postgresql://indexer:indexer@localhost:5432/datahaven -c "SELECT version();"
```

### 2. Start Indexer Node (Full Mode)

```bash
datahaven-node \
  --chain stagenet-local \
  --name "Indexer-Full" \
  --base-path /data/indexer \
  --indexer \
  --indexer-mode full \
  --indexer-database-url postgresql://indexer:indexer@localhost:5432/datahaven \
  --pruning archive \
  --blocks-pruning archive \
  --port 30333 \
  --rpc-port 9947 \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW...
```

### 3. Start Indexer Node (Lite Mode)

```bash
datahaven-node \
  --chain stagenet-local \
  --name "Indexer-Lite" \
  --base-path /data/indexer-lite \
  --indexer \
  --indexer-mode lite \
  --indexer-database-url postgresql://indexer:indexer@localhost:5432/datahaven \
  --port 30333 \
  --rpc-port 9947
```

### 4. Start Indexer Node (Fishing Mode)

```bash
datahaven-node \
  --chain stagenet-local \
  --name "Indexer-Fishing" \
  --base-path /data/indexer-fishing \
  --indexer \
  --indexer-mode fishing \
  --indexer-database-url postgresql://indexer:indexer@localhost:5432/datahaven \
  --port 30333 \
  --rpc-port 9947
```

## Docker Deployment

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: indexer-postgres
    environment:
      POSTGRES_DB: datahaven
      POSTGRES_USER: indexer
      POSTGRES_PASSWORD: indexer
    ports:
      - "5432:5432"
    volumes:
      - indexer-db:/var/lib/postgresql/data
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
      - "--name=Indexer-Full"
      - "--base-path=/data"
      - "--indexer"
      - "--indexer-mode=full"
      - "--pruning=archive"
      - "--blocks-pruning=archive"
      - "--port=30333"
      - "--rpc-port=9947"
      - "--rpc-external"
    restart: unless-stopped

volumes:
  indexer-db:
  indexer-data:
```

### Docker Run

```bash
# Start PostgreSQL
docker run -d \
  --name indexer-postgres \
  -e POSTGRES_PASSWORD=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_DB=datahaven \
  -p 5432:5432 \
  postgres:14

# Wait for PostgreSQL to be ready
sleep 5

# Start Indexer
docker run -d \
  --name storagehub-indexer \
  --link indexer-postgres:postgres \
  -e INDEXER_DATABASE_URL=postgresql://indexer:indexer@postgres:5432/datahaven \
  -p 30333:30333 \
  -p 9947:9947 \
  -v $(pwd)/indexer-data:/data \
  datahavenxyz/datahaven:latest \
  --chain stagenet-local \
  --name "Indexer-Full" \
  --base-path /data \
  --indexer \
  --indexer-mode full \
  --port 30333 \
  --rpc-port 9947
```

## Kubernetes Deployment

```yaml
apiVersion: v1
kind: Service
metadata:
  name: indexer-postgres
spec:
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: indexer-postgres

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: indexer-postgres
spec:
  serviceName: indexer-postgres
  replicas: 1
  selector:
    matchLabels:
      app: indexer-postgres
  template:
    metadata:
      labels:
        app: indexer-postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        env:
        - name: POSTGRES_DB
          value: datahaven
        - name: POSTGRES_USER
          value: indexer
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: indexer-db-secret
              key: password
        ports:
        - containerPort: 5432
          name: postgres
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 200Gi

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: storagehub-indexer
spec:
  serviceName: storagehub-indexer
  replicas: 1
  selector:
    matchLabels:
      app: storagehub-indexer
  template:
    metadata:
      labels:
        app: storagehub-indexer
    spec:
      containers:
      - name: indexer
        image: datahavenxyz/datahaven:latest
        env:
        - name: INDEXER_DATABASE_URL
          value: postgresql://indexer:indexer@indexer-postgres:5432/datahaven
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9947
          name: rpc
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "16Gi"
            cpu: "4"
          limits:
            memory: "32Gi"
            cpu: "8"
        args:
          - "--chain=stagenet-local"
          - "--name=Indexer-Full"
          - "--base-path=/data"
          - "--indexer"
          - "--indexer-mode=full"
          - "--pruning=archive"
          - "--blocks-pruning=archive"
          - "--port=30333"
          - "--rpc-port=9947"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 500Gi
```

**Note**: Database storage (200Gi in PostgreSQL StatefulSet) should be increased to 500Gi for full mode in production.

## On-Chain Registration

### Not Required

Indexer nodes do not require any on-chain registration or extrinsics.

## Database Schema

### Key Tables (Generated Automatically)

The indexer automatically creates and manages database tables:

- **blocks**: Block headers and metadata
- **extrinsics**: Extrinsic data per block
- **events**: Blockchain events
- **storage_providers**: MSP/BSP registration data
- **files**: File metadata and storage information
- **buckets**: Bucket ownership and configuration
- **proofs**: Proof submissions and challenges
- **payment_streams**: Payment stream data

### Query Examples

```sql
-- Get all MSPs
SELECT * FROM storage_providers WHERE provider_type = 'msp';

-- Get files stored by a specific MSP
SELECT * FROM files WHERE msp_id = '0x...';

-- Get recent proof submissions
SELECT * FROM proofs ORDER BY block_number DESC LIMIT 10;

-- Get total storage capacity by provider type
SELECT provider_type, SUM(capacity) as total_capacity
FROM storage_providers
GROUP BY provider_type;
```

## Monitoring

### Health Checks

```bash
# Check node health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9947 | jq

# Check sync status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_syncState"}' \
  http://localhost:9947 | jq
```

### Database Health

```bash
# Check database connection
psql postgresql://indexer:indexer@localhost:5432/datahaven -c "SELECT COUNT(*) FROM blocks;"

# Check database size
psql postgresql://indexer:indexer@localhost:5432/datahaven -c "SELECT pg_size_pretty(pg_database_size('datahaven'));"

# Check table sizes
psql postgresql://indexer:indexer@localhost:5432/datahaven -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Key Metrics

- Indexing lag (blocks behind chain tip)
- Database size and growth rate
- Query performance
- Connection pool usage
- Disk I/O performance

## Troubleshooting

### Issue: Database Connection Failed

**Check:**
1. PostgreSQL is running: `docker ps | grep postgres`
2. Connection string is correct
3. Database credentials are valid
4. Network connectivity between node and database
5. PostgreSQL logs: `docker logs indexer-postgres`

### Issue: Slow Indexing

**Solutions:**
1. Optimize PostgreSQL configuration:
   ```sql
   ALTER SYSTEM SET shared_buffers = '4GB';
   ALTER SYSTEM SET effective_cache_size = '12GB';
   ALTER SYSTEM SET maintenance_work_mem = '1GB';
   ALTER SYSTEM SET checkpoint_completion_target = 0.9;
   ALTER SYSTEM SET wal_buffers = '16MB';
   ALTER SYSTEM SET default_statistics_target = 100;
   ```
2. Add indexes to frequently queried columns
3. Use faster storage (NVMe SSD)
4. Increase database connection pool size

### Issue: Database Running Out of Space

**Solutions:**
1. Enable PostgreSQL auto-vacuum: `ALTER TABLE <table> SET (autovacuum_enabled = true);`
2. Manual vacuum: `VACUUM FULL;`
3. Archive old data
4. Increase disk space

### Issue: Indexer Not Catching Up

**Check:**
1. Node is fully synced: Check `system_syncState`
2. Database has sufficient resources
3. No errors in indexer logs
4. PostgreSQL is not overloaded

## Performance Tuning

### PostgreSQL Configuration

Edit `postgresql.conf`:

```ini
# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 256MB

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_wal_size = 4GB

# Connections
max_connections = 200

# Query Performance
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200

# Statistics
default_statistics_target = 100
```

### Indexer Node Configuration

```bash
datahaven-node \
  --indexer \
  --pruning archive \
  --blocks-pruning archive \
  --state-cache-size 268435456 \  # 256 MB
  --max-runtime-instances 8
```

## Security Considerations

1. **Database Security**: Use strong passwords, restrict network access
2. **Connection Encryption**: Use SSL for PostgreSQL connections
3. **Access Control**: Limit database access to indexer node only
4. **Backup Strategy**: Regular database backups
5. **Monitoring**: Set up alerts for connection failures

## Best Practices

1. Use dedicated PostgreSQL server for production
2. Enable regular database backups (daily recommended)
3. Monitor database size and plan for growth
4. Use archive mode for complete historical data
5. Implement connection pooling (e.g., PgBouncer)
6. Regular database maintenance (VACUUM, ANALYZE)
7. Set up monitoring and alerting
8. Document backup/restore procedures

## Backup and Restore

### Backup Database

```bash
# Full backup
pg_dump -U indexer -h localhost datahaven > datahaven-backup-$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U indexer -h localhost datahaven | gzip > datahaven-backup-$(date +%Y%m%d).sql.gz
```

### Restore Database

```bash
# Restore from backup
psql -U indexer -h localhost datahaven < datahaven-backup-20250124.sql

# Restore from compressed backup
gunzip -c datahaven-backup-20250124.sql.gz | psql -U indexer -h localhost datahaven
```

## Related Documentation

- [MSP Setup](./storagehub-msp.md)
- [BSP Setup](./storagehub-bsp.md)
- [Fisherman Setup](./storagehub-fisherman.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/14/)
- [Docker Compose Guide](../operator/DOCKER-COMPOSE.md)
