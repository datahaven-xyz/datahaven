# Snowbridge Relay Operating Costs

## Overview

This page provides guidance on funding requirements and operating cost estimates for running Snowbridge relays. These costs apply across all relay types (Beacon, BEEFY, Execution, and Solochain).

## Account Funding Requirements

### Ethereum Account (BEEFY, Solochain Relays)

Relays that submit transactions to Ethereum require funded Ethereum accounts for gas fees.

| Relay Type | Minimum | Recommended | Purpose |
|------------|---------|-------------|---------|
| BEEFY Relay | 0.5 ETH | 2.0 ETH | Submit BEEFY proofs to BeefyClient contract |
| Solochain Relay | 0.5 ETH | 2.0 ETH | Submit messages to Gateway, sync rewards |

### Substrate Account (Beacon, Execution, Solochain Relays)

Relays that submit extrinsics to DataHaven require funded Substrate accounts for transaction fees.

| Relay Type | Minimum | Recommended | Purpose |
|------------|---------|-------------|---------|
| Beacon Relay | 100 HAVE | 500 HAVE | Submit beacon updates to EthereumBeaconClient |
| Execution Relay | 100 HAVE | 500 HAVE | Deliver messages via EthereumInboundQueue |
| Solochain Relay | 100 HAVE | 500 HAVE | DataHaven operations |

## Gas Cost Breakdown (Ethereum)

Relays submitting to Ethereum incur gas costs for various operations:

| Operation | Relay Type | Estimated Gas | Frequency |
|-----------|------------|---------------|-----------|
| BEEFY commitment | BEEFY | 200,000-400,000 | Per commitment |
| Message delivery | Solochain | 150,000-300,000 | Per message |
| Reward sync update | Solochain | 100,000-200,000 | Per epoch/period |

## Annual Operating Cost Forecast

> **Disclaimer**: The cost estimates below are approximate projections based on typical network conditions and are provided for planning purposes only. Actual costs may vary significantly based on network congestion, gas price fluctuations, ETH price volatility, and message volume. **Always conduct your own cost analysis** based on current market conditions before budgeting for relay operations.

### Assumptions

- Average gas price: 30 gwei
- ETH price: $3,000 USD (as of December 2025)
- HAVE transaction fees: negligible compared to ETH costs

### BEEFY Relay Costs

BEEFY proofs are submitted periodically to keep the BeefyClient contract updated with DataHaven finality.

| Scenario | Commitments/Day | Gas/Year (ETH) | Annual Cost (USD) |
|----------|-----------------|----------------|-------------------|
| **Low activity** | 4-6 | 0.4-0.8 ETH | $1,200-$2,400 |
| **Medium activity** | 10-15 | 1.0-1.6 ETH | $3,000-$4,800 |
| **High activity** | 20-30 | 2.0-3.5 ETH | $6,000-$10,500 |

### Solochain Relay Costs

The Solochain Relay handles message delivery and reward synchronization.

| Scenario | Messages/Day | Gas/Year (ETH) | Annual Cost (USD) |
|----------|--------------|----------------|-------------------|
| **Low activity** | 50 | 0.8-1.5 ETH | $2,400-$4,500 |
| **Medium activity** | 100 | 1.5-3.0 ETH | $4,500-$9,000 |
| **High activity** | 200 | 3.0-6.0 ETH | $9,000-$18,000 |

### Beacon & Execution Relay Costs

These relays only incur HAVE transaction fees on DataHaven, which are minimal:

| Relay Type | Annual HAVE Estimate | Notes |
|------------|---------------------|-------|
| Beacon Relay | 50-200 HAVE | Sync committee updates |
| Execution Relay | 100-500 HAVE | Message delivery to DataHaven |

### Cost Calculation Formula

```
Annual ETH Cost = (operations_per_day × avg_gas_per_operation × avg_gas_price × 365) / 1e18
Annual USD Cost = Annual ETH Cost × ETH_price
```

**Example (Solochain Relay, Medium Activity):**
```
= (100 messages × 200,000 gas × 30 gwei × 365 days) / 1e18
= 2.19 ETH/year
= ~$6,570 USD/year at $3,000/ETH
```

## Total Operating Costs (Full Relay Stack)

Running a complete Snowbridge relay infrastructure requires all four relays. Here's a combined cost estimate:

| Scenario | ETH/Year | HAVE/Year | Annual USD (ETH only) |
|----------|----------|-----------|----------------------|
| **Low activity** | 1.2-2.3 ETH | 200-400 HAVE | $3,600-$6,900 |
| **Medium activity** | 2.5-4.6 ETH | 400-800 HAVE | $7,500-$13,800 |
| **High activity** | 5.0-9.5 ETH | 800-1,500 HAVE | $15,000-$28,500 |

> **Note**: These estimates assume a single relay instance per type. Running redundant relays (recommended for production) will multiply costs proportionally.

## Cost Optimization Strategies

### 1. Gas Price Optimization

- **Monitor gas prices**: Use services like [ETH Gas Station](https://ethgasstation.info/) or [Etherscan Gas Tracker](https://etherscan.io/gastracker)
- **Off-peak submissions**: Non-urgent operations can wait for lower gas prices
- **Gas price limits**: Configure maximum gas price thresholds in relay settings

### 2. Batching Operations

- BEEFY relay batches commitments when possible
- Solochain relay batches reward updates
- Reduces per-operation overhead

### 3. Right-Size Your Deployment

| Network Activity | Recommended Setup |
|------------------|-------------------|
| Low volume | Single instance per relay type |
| Medium volume | 2 instances with different providers |
| High volume/Production | 3+ instances across regions |

### 4. Infrastructure Cost Savings

- **Shared RPC endpoints**: Use the same provider subscription across relays
- **Self-hosted nodes**: Higher upfront cost but eliminates per-request fees
- **Cloud cost optimization**: Use reserved instances or spot pricing where appropriate

## Balance Monitoring & Alerts

### Recommended Alert Thresholds

| Account Type | Low Balance Alert | Critical Alert |
|--------------|-------------------|----------------|
| Ethereum | 0.2 ETH | 0.1 ETH |
| Substrate (HAVE) | 50 HAVE | 20 HAVE |

### Monitoring Setup

```bash
# Check Ethereum balance
cast balance $RELAY_ETH_ADDRESS --rpc-url $ETH_RPC_URL

# Check HAVE balance (using subxt or polkadot-js)
# Monitor via your preferred Substrate tooling
```

### Automated Top-Up

Consider implementing automated funding from a treasury account when balances fall below thresholds. This prevents relay downtime due to insufficient funds.

## Cost Variability Factors

### Ethereum Gas Prices

Gas prices can vary dramatically:

| Condition | Typical Gas Price | Impact |
|-----------|-------------------|--------|
| Low congestion | 10-20 gwei | 50% below estimates |
| Normal | 20-40 gwei | Within estimates |
| High congestion | 50-100 gwei | 2-3x estimates |
| Extreme (NFT mints, etc.) | 100-500+ gwei | 5-10x estimates |

### ETH Price Volatility

ETH price directly affects USD costs:

| ETH Price | Annual Cost (Medium Activity) |
|-----------|------------------------------|
| $2,000 | ~$4,400 |
| $3,000 | ~$6,600 |
| $4,000 | ~$8,800 |
| $5,000 | ~$11,000 |

## Related Documentation

- [Beacon Relay](./snowbridge-beacon-relay.md)
- [BEEFY Relay](./snowbridge-beefy-relay.md)
- [Execution Relay](./snowbridge-execution-relay.md)
- [Solochain Relay](./snowbridge-solochain-relay.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
