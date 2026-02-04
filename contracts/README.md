# DataHaven AVS Smart Contracts

Implements the Actively Validated Service (AVS) logic for DataHaven, secured by EigenLayer. These contracts manage operator registration, handle cross-chain rewards via Snowbridge, and enforce slashing with a veto period.

## Project Structure

```
contracts/
├── src/
│   ├── DataHavenServiceManager.sol   # Core AVS service manager
│   ├── middleware/                   # RewardsRegistry, Snowbridge helpers
│   ├── interfaces/                   # Contract interfaces
│   └── libraries/                    # Utility libraries
├── script/                           # Deployment & setup scripts
├── lib/                              # External dependencies (EigenLayer, Snowbridge, OpenZeppelin)
└── test/                             # Foundry test suites
```

## Key Components

- **DataHavenServiceManager** (`src/DataHavenServiceManager.sol`): Core contract for operator lifecycle; inherits `ServiceManagerBase`.
- **RewardsRegistry** (`src/middleware/RewardsRegistry.sol`): Tracks validator performance and distributes rewards via Snowbridge.

## Development

Requires [Foundry](https://book.getfoundry.sh).

```bash
# Build and Test
forge build
forge test

# Regenerate TS bindings (after contract changes)
cd ../test && bun generate:wagmi
```

## Configuration

Deployment parameters (EigenLayer addresses, initial validators, owners) are defined in `contracts/config/<network>.json`.
- **Do not edit** `Config.sol` or `DeployParams.s.sol` directly; they only load the JSON.
- Ensure `contracts/config/hoodi.json` matches your target environment before deploying.

## Deployment

Two deployment paths exist: **Local** (Anvil) and **Testnet** (Hoodi). Both install the **DataHaven AVS contracts** (ServiceManager, RewardsRegistry) and **Snowbridge** (BeefyClient, Gateway, Agent). They differ in EigenLayer setup:

### Local (Anvil)
**`DeployLocal.s.sol`** bootstraps a full EigenLayer core deployment (DelegationManager, StrategyManager, AVSDirectory, etc.) alongside DataHaven AVS and Snowbridge.
```bash
anvil
forge script script/deploy/DeployLocal.s.sol --rpc-url anvil --broadcast
```

### Testnet (Hoodi)
**`DeployTestnet.s.sol`** references existing EigenLayer contracts (addresses from `contracts/config/<network>.json`) and only deploys DataHaven AVS + Snowbridge.
```bash
NETWORK=hoodi forge script script/deploy/DeployTestnet.s.sol \
  --rpc-url hoodi \
  --private-key $PRIVATE_KEY \
  --broadcast
```
Supported networks: `hoodi` (no mainnet config yet). Artifacts → `contracts/deployments/<network>.json`.

### Contract versioning (version)

DataHaven uses automated version synchronization with flexible per-deployment versioning:

- Each `contracts/deployments/<network>.json` stores a `version` field (semantic versioning: `X.Y.Z`).
- Version is **passed as a parameter** during contract deployment (not hardcoded by chain ID).
- Version management is **fully automated**:
  - `bun cli contracts deploy` performs a **MINOR** bump (`X.Y.0 → X.(Y+1).0`) and sets initial version
  - `bun cli contracts upgrade` performs a **PATCH** bump (`X.Y.Z → X.Y.(Z+1)`) and automatically calls `updateVersion()` on-chain
  - No manual steps required!
- Multiple environments can share the same deployment file:
  - `stagenet-hoodi` and `testnet-hoodi` both write to `hoodi.json` (chainId: 560048)
  - Separate contract instances can have different versions on the same chain
- MAJOR version bumps must be done manually by editing the deployment file for breaking changes.
- `bun generate:version` creates a reference file (`Version.sol`) for testing/tooling (not used by contracts).
- CI validates version consistency automatically via `.github/workflows/task-check-versions.yml`.
- From the `test/` directory, run `bun cli contracts checks --chain <chain>` to validate versions.

## How It Works
1. **Registration**: Validators register with EigenLayer via `DataHavenServiceManager`.
2. **Performance Tracking**: DataHaven computes reward points and sends a Merkle root to `RewardsRegistry` on Ethereum via Snowbridge.
3. **Rewards Claims**: Validators claim rewards on Ethereum from `RewardsRegistry` using Merkle proofs.
4. **Slashing**: Misbehavior triggers slashing (subject to veto period).

See `test/README.md` for full network integration tests.
