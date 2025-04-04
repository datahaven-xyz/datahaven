# DataHaven AVS Smart Contracts 📜

This directory contains the smart contracts for the DataHaven Actively Validated Service (AVS) built on EigenLayer.

## Overview

DataHaven is an AVS that provides secure and decentralised data storage services. The contracts in this repository implement the Service Manager, middleware, and associated utilities required for the DataHaven protocol.

## Project Structure

- `src/`: Smart contract source code
  - `DataHavenServiceManager.sol`: Main service manager contract
  - `interfaces/`: Contract interfaces
  - `libraries/`: Utility libraries
  - `middleware/`: Middleware contracts (similar to EigenLayer's [middleware contracts](https://github.com/Layr-Labs/eigenlayer-middleware))
- `script/`: Deployment scripts
- `test/`: Test cases
- `foundry.toml`: Foundry configuration

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Build

To build the contracts:

```bash
cd contracts
forge build
```

This will compile all contracts and generate artifacts in the `out` directory.

## Test

Run the test suite with:

```bash
forge test
```

For more verbose output including logs:

```bash
forge test -vv
```

For maximum verbosity including stack traces:

```bash
forge test -vvvv
```

Run specific test suites:

```bash
forge test --match-contract RewardsRegistry --no-match-contract SnowbridgeIntegration
```

Run specific tests:

```bash
forge test --match-test test_getRewardstest_newRewardsMessage --no-match-test test_newRewardsMessage_OnlyRewardsAgent
```

## Deployment

### Local Deployment

1. In a separate terminal, start a local Anvil instance:

```bash
anvil
```

2. Deploy to local Anvil:

```bash
forge script script/deploy/Deploy.s.sol --rpc-url anvil --broadcast
```

### Network Deployment

To deploy to a network configured in `foundry.toml`:

```bash
forge script script/deploy/Deploy.s.sol --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Replace `$NETWORK_RPC_URL` with the RPC endpoint and `$PRIVATE_KEY` with your deployer's private key.

Or using a network from `foundry.toml`:

```bash
forge script script/deploy/Deploy.s.sol --rpc-url mainnet --private-key $PRIVATE_KEY --broadcast
```

## Configuration

The deployment configuration can be modified in:

- `script/deploy/Config.sol`: Environment-specific configuration
- `script/deploy/DeployParams.s.sol`: Deployment parameters
