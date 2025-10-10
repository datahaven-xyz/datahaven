# DataHaven AVS Smart Contracts 📜

This directory contains the smart contracts for the DataHaven Actively Validated Service (AVS) built on EigenLayer.

## Overview

DataHaven is an EVM-compatible Substrate blockchain secured by EigenLayer. These contracts implement the AVS Service Manager, middleware, and associated utilities that integrate with EigenLayer's operator registration, slashing, and rewards infrastructure.

## Project Structure

```
contracts/
├── src/                           # Smart contract source code
│   ├── DataHavenServiceManager.sol   # Core AVS service manager
│   ├── RewardsRegistry.sol           # Validator performance & rewards tracking
│   ├── VetoableSlasher.sol          # Slashing with veto period
│   ├── interfaces/                   # Contract interfaces
│   ├── libraries/                    # Utility libraries
│   └── middleware/                   # EigenLayer middleware integration
├── script/                        # Deployment & setup scripts
│   └── deploy/                    # Environment-specific deployment
├── test/                          # Foundry test suites
└── foundry.toml                   # Foundry configuration
```

### Key Contracts

- **DataHavenServiceManager**: Manages operator lifecycle, registration, and deregistration with EigenLayer
- **RewardsRegistry**: Tracks validator performance metrics and handles reward distribution via Snowbridge
- **VetoableSlasher**: Implements slashing mechanism with dispute resolution veto period
- **Middleware**: Integration layer with EigenLayer's core contracts (based on [eigenlayer-middleware](https://github.com/Layr-Labs/eigenlayer-middleware))

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

Run specific test contracts:

```bash
forge test --match-contract RewardsRegistry
```

Run specific test functions:

```bash
forge test --match-test test_newRewardsMessage
```

Exclude specific tests:

```bash
forge test --no-match-test test_newRewardsMessage_OnlyRewardsAgent
```

## Deployment

### Local Deployment

1. In a separate terminal, start a local Anvil instance:

```bash
anvil
```

2. Deploy to local Anvil:

```bash
forge script script/deploy/DeployLocal.s.sol --rpc-url anvil --broadcast
```

### Network Deployment

To deploy to a network configured in `foundry.toml`:

```bash
forge script script/deploy/DeployLocal.s.sol --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Replace `$NETWORK_RPC_URL` with the RPC endpoint and `$PRIVATE_KEY` with your deployer's private key.

Or using a network from `foundry.toml`:

```bash
forge script script/deploy/DeployLocal.s.sol --rpc-url mainnet --private-key $PRIVATE_KEY --broadcast
```

## Configuration

The deployment configuration can be modified in:

- `script/deploy/Config.sol`: Environment-specific configuration
- `script/deploy/DeployParams.s.sol`: Deployment parameters

## Code Generation

After making changes to contracts, regenerate TypeScript bindings for the test framework:

```bash
cd ../test
bun generate:wagmi
```

This generates type-safe contract interfaces used by the E2E test suite.

## Integration with DataHaven

These contracts integrate with the DataHaven Substrate node through:

1. **Operator Registration**: Validators register on-chain via `DataHavenServiceManager`
2. **Performance Tracking**: Node submits validator metrics to `RewardsRegistry`
3. **Cross-chain Rewards**: Rewards distributed from Ethereum to DataHaven via Snowbridge
4. **Slashing**: Misbehavior triggers slashing through `VetoableSlasher` with veto period

For full network integration testing, see the [test directory](../test/README.md).
