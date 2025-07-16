# DataHaven Services Monitoring Plan

## Overview

This document outlines a comprehensive monitoring strategy for all services spawned by the DataHaven CLI launch command, including validators, Ethereum nodes, and relayers.

## Current State Analysis

### Service Monitoring Capabilities

1. **DataHaven Validators**
   - Built-in Prometheus support via `substrate-prometheus-endpoint`
   - Currently disabled with `--no-prometheus` flag
   - Default metrics port: 9615

2. **Ethereum Nodes (Kurtosis)**
   - Reth (EL) has native Prometheus metrics
   - Lodestar (CL) has native Prometheus metrics
   - No monitoring stack configured in current setup

3. **Snowbridge Relayers**
   - No Prometheus metrics endpoint
   - Structured JSON logging only
   - Requires code modifications for metrics

## Proposed Architecture

```
┌─────────────────────┐     ┌──────────────────┐
│  DataHaven Nodes    │────▶│                  │
│  (metrics:9615)     │     │   Prometheus     │
└─────────────────────┘     │   (scraping)     │
                            │                  │
┌─────────────────────┐     │   ┌──────────┐   │     ┌──────────────┐
│  Ethereum Nodes     │────▶│   │ Storage  │   │────▶│   Grafana    │
│  Reth/Lodestar      │     │   └──────────┘   │     │ (dashboards) │
└─────────────────────┘     │                  │     └──────────────┘
                            │                  │
┌─────────────────────┐     │                  │     ┌──────────────┐
│ Snowbridge Relayers │────▶│   Loki          │────▶│   Grafana    │
│  (JSON logs)        │     │ (log ingestion)  │     │ (log viewer) │
└─────────────────────┘     └──────────────────┘     └──────────────┘
```

## Implementation Steps

### 1. Enable Prometheus for DataHaven Nodes

**File**: `test/cli/handlers/launch/datahaven.ts`
- Remove `"--no-prometheus"` from `COMMON_LAUNCH_ARGS`
- Add port mapping for Prometheus: `-p ${9615 + nodeIndex}:9615`
- Configure unique metrics port for each validator

### 2. Add Monitoring Stack to Kurtosis

**File**: `test/configs/kurtosis/minimal.yaml`
```yaml
additional_services:
  - dora
  - prometheus_grafana  # Add monitoring stack
```

### 3. Create Monitoring Docker Compose

**File**: `test/monitoring/docker-compose.yml`
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - datahaven-net

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    networks:
      - datahaven-net

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - datahaven-net

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - datahaven-net

volumes:
  prometheus_data:
  loki_data:
  grafana_data:

networks:
  datahaven-net:
    external: true
```

### 4. Prometheus Configuration

**File**: `test/monitoring/prometheus.yml`
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # DataHaven validators
  - job_name: 'datahaven'
    static_configs:
      - targets: 
          - 'datahaven-alice:9615'
          - 'datahaven-bob:9615'
        labels:
          chain: 'datahaven'

  # Ethereum nodes (via Kurtosis)
  - job_name: 'ethereum'
    static_configs:
      - targets:
          - 'el-1-reth-lodestar:5005'  # Reth metrics
          - 'cl-1-lodestar-reth:5064'  # Lodestar metrics

  # Service discovery for dynamic containers
  - job_name: 'docker'
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: [__meta_docker_container_label_prometheus_job]
        target_label: job
```

### 5. Log Collection Configuration

**File**: `test/monitoring/promtail-config.yml`
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log
    
    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag: attrs.tag
      - regex:
          expression: '(?P<container_name>(?:[^|]*))'
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output
```

### 6. CLI Integration

**File**: `test/cli/handlers/launch/index.ts`

Add monitoring options:
```typescript
export interface LaunchOptions {
  // ... existing options
  monitoring?: boolean;
  monitoringPort?: number;
  persistMonitoring?: boolean;
}
```

### 7. Grafana Dashboards

Create pre-configured dashboards for:

1. **DataHaven Overview**
   - Block production rate
   - Finality lag
   - Peer count
   - Transaction pool status

2. **Ethereum Nodes**
   - Sync status
   - Block height
   - Peer connections
   - Resource usage

3. **Relayer Activity**
   - Log-based metrics
   - Message relay success/failure
   - Processing latency
   - Error rates

4. **Cross-chain Health**
   - Message queue depth
   - Confirmation times
   - Bridge balance tracking

### 8. Alerting Rules

Configure alerts for:
- Node offline or out of sync
- Relayer errors or stalls
- High resource usage (>80% CPU/Memory)
- Bridge message backlog
- Validator missing blocks

## Usage

### Launch with Monitoring
```bash
bun cli launch --monitoring --monitoring-port 3000
```

### Access Points
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- Loki: http://localhost:3100

### Persistent Storage
```bash
bun cli launch --monitoring --persist-monitoring
```

## Future Enhancements

1. **Relayer Metrics**
   - Add Prometheus instrumentation to relayer code
   - Export custom metrics for bridge operations

2. **Automated Alerts**
   - PagerDuty/Slack integration
   - Auto-remediation scripts

3. **Performance Baselines**
   - Historical data analysis
   - Anomaly detection

4. **Multi-cluster Support**
   - Remote write for centralized monitoring
   - Federation for multi-region deployments