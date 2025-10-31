# EigenLayer Contracts

## DataHaven Configuration

- **Version**: `v1.8.0-testnet-final` (commit: `7ecc83c7`)
- **Location**: `contracts/lib/eigenlayer-contracts/`
- **Type**: Git submodule

## Network Deployments

| Network | Version | Notes |
|---------|---------|-------|
| **Mainnet** | v1.8.1 | Production |
| **Holesky** | v1.8.1 | Deprecating Q3 2025 |
| **Hoodi** | v1.8.0 | Holesky replacement |
| **Sepolia** | v1.8.1 | |

## Core Contracts

- `DelegationManager`
- `StrategyManager`
- `EigenPodManager`
- `AVSDirectory`
- `RewardsCoordinator`
- `AllocationManager`
- `PermissionController`

## Staking Mechanism

### Token Flow
1. Users deposit ERC20 tokens into `Strategy` contracts via `StrategyManager.depositIntoStrategy()`
2. Users receive strategy shares (initially 1:1, adjusted by slashing)
3. Users delegate shares to operators via `DelegationManager.delegateTo()`
4. Operators allocate stake proportions to AVS operator sets via `AllocationManager.modifyAllocations()`

### Supported Tokens
- Any ERC20 with whitelisted Strategy contract
- Common: LSTs (stETH, rETH, cbETH), LRTs
- Each Strategy has deposit limits configured
- Native ETH via EigenPods (separate mechanism)

### Magnitude System
- Operators allocate percentage (0-100%) of delegated stake to operator sets
- `maxMagnitude` starts at 1e18 (100%), reduced by slashing
- Enables multi-AVS participation

## DataHaven Configuration

### Strategy Selection
DataHaven configures accepted tokens via `IStrategy[]` arrays:
- `validatorsStrategies` - Tokens validators can stake
- Configured at deployment in `DataHavenServiceManager.initialise()`
- Modified via `addStrategiesToValidatorsSupportedStrategies()` / `removeStrategiesFromValidatorsSupportedStrategies()`

### Current Status
- **Holesky**: `validatorsStrategies: []` (empty)
- **Hoodi**: `validatorsStrategies: []` (empty)
- **Local/Anvil**: Test token strategy (1M tokens, ERC20PresetFixedSupply)

### Configuration Required
Empty strategy arrays prevent validator registration. Must populate with specific EigenLayer Strategy addresses from target network.
