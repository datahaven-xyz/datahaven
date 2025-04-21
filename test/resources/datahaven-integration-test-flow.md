# DataHaven Integration Test Flow

This document provides a detailed explanation of the DataHaven integration test flow, complementing the visual diagram in `datahaven-basic-test-flow.json.excalidraw`.

## 1. Infrastructure Bootstrap (Kurtosis)

The first step involves setting up the testing infrastructure using Kurtosis, a container orchestration platform for test environments.

### Components Launched

- **Ethereum Network**
  - Execution Layer (EL) clients: reth nodes
  - Consensus Layer (CL) clients: lighthouse nodes
  - Block explorer (Blockscout) for monitoring
- **DataHaven Solochain**
  - Multiple validator nodes to form a test network
  - Based on Substrate
  - Genesis configuration with initial placeholder validators
- **Snowbridge Relayer**
  - Bridge component connecting Ethereum and DataHaven
  - Configured with beefy-relay.json and beacon-relay.json

### Key Commands

```bash
# Start the E2E CLI environment with the minimal configuration
bun run scripts/e2e-cli.ts
# Alternative
bun start:e2e:minimal

# Start the E2E CLI environment with Blockscout and verified contracts
bun start:e2e:verified

# Behind the scenes both commands run:
bun run scripts/launch-kurtosis.ts
# And then continue setting up the environment with the next steps.
```

## 2. Ethereum-side Contract Deployment

After the infrastructure is set up, we deploy all the necessary smart contracts to the Ethereum network.

### Contracts Deployed

- **EigenLayer Core Contracts**
  - Strategy Manager, Delegation Manager, Permission Controller, etc.
- **Snowbridge Contracts**
  - BeefyClient: Verifies BEEFY commitments from DataHaven chain
  - Gateway: Processes cross-chain messages
  - AgentExecutor: Executes messages on the destination chain
- **DataHaven Contracts**
  - DataHavenServiceManager: Main contract for managing the DataHaven service
  - RewardsRegistry: Handles validator rewards
  - VetoableSlasher: Manages slashing with veto capabilities

### Initial Configuration

- Initialize contracts with test accounts
- Configure DataHavenServiceManager with initial operator sets
- Configure Gateway with appropriate parameters
- Configure RewardsRegistry with initial values

### Key Commands

```bash
# Build and deploy contracts (this is done automatically by the ``e2e-cli`` script if the `--deploy-contracts` flag is set)
cd contracts
forge build
forge script script/deploy/DeployLocal.s.sol --rpc-url <RPC_URL> --broadcast --verify
```

## 3. Validator Registration & Sync

In this phase, we register validators as operators in EigenLayer and sync the validator set to the DataHaven chain.

### Steps

1. **Register Operators in EigenLayer and as Validators in the DataHaven service**
   - Use SignUpValidator.s.sol script to register validators
     - Deposit stake and register for operator sets
   - Set up the validator set in the Ethereum side

2. **Sync Validator Set to DataHaven**
   - Use the `sendNewValidatorSet` function in the DataHavenServiceManager contract
   - This function fetches the operator set from EigenLayer and sends it through the Snowbridge Gateway to update it in the DataHaven solochain

### Key Commands

```bash
# Register validators
cd contracts
forge script script/transact/SignUpValidator.s.sol --rpc-url <RPC_URL> --broadcast

# Sync validator set to DataHaven
cast send --private-key <ownerPrivateKey> --value <executionFee + relayerFee> <DataHavenServiceManagerAddress> "sendNewValidatorSet(uint128,uint128)" <executionFee> <relayerFee> --rpc-url <RPC_URL>;
```

## Specific integration tests (TODO)

### Rewards Epoch Processing

After validators are registered and synced, we run them for a test epoch to generate rewards.

#### Process

1. **Run DataHaven Validators**
   - Validators produce blocks for a configurable epoch
   - Block production metrics are recorded
   - System measures performance (blocks produced, attestations, etc.)

2. **Generate Rewards Merkle Tree**
   - Calculate rewards based on validator performance
   - Create a merkle tree with validator addresses and their earned points
   - Root of the tree is used for efficient verification

3. **Relay Rewards via Snowbridge**
   - BEEFY message contains the rewards merkle root
   - Message is sent from DataHaven to Ethereum
   - Relayer submits proof to the Ethereum network

#### Testing Aspects

- Short epochs are configured for testing purposes
- Validator performance can be artificially adjusted for testing different scenarios
- Reward distribution algorithms are tested for fairness and accuracy

### Rewards Claiming

After rewards data is relayed to Ethereum, validators can claim their rewards.

#### Claiming Process

1. **Update RewardsRegistry**
   - RewardsRegistry contract receives the merkle root from Snowbridge
   - Only the authorized agent can update the root
   - Event `RewardsMerkleRootUpdated` is emitted

2. **Validators Claim Rewards**
   - Each validator calls `claimOperatorRewards` on ServiceManager
   - Provides merkle proof of their reward amount
   - ServiceManager verifies proof against the stored root

3. **Rewards Distribution Verification**
   - Check that validators received the correct amount
   - Verify balances match expected rewards
   - Test edge cases (zero rewards, maximum rewards)

#### Key Tests

- Verify only valid proofs can claim rewards
- Ensure rewards can't be double-claimed
- Test that rewards distribution is accurate and fair
- Verify wrong agents can't update the rewards merkle root

### Validator Operations Testing

Another testing scenario is testing the operational aspects of the validator set.

#### Key Operations Tested

1. **Adding Validators**
   - Add new validators
   - Verify they appear in the next session
   - Ensure they can produce blocks after activation

2. **Removing Validators**
   - Remove validators and verify they stop producing blocks
   - Test session transitions after removal
   - Verify proper cleanup of validator resources

3. **Slashing Mechanisms**
   - Test slashing for various offenses
   - Verify VetoableSlasher functions correctly
   - Test veto committee mechanisms

4. **Operator Set Modifications**
   - Modify operator sets from Ethereum
   - Verify changes propagate to the DataHaven chain
   - Test stake changes and their effects

## Communication Patterns

The integration tests rely on several communication patterns:

1. **Ethereum to DataHaven**
   - Validator set updates
   - Configuration changes
   - Administrative commands

2. **DataHaven to Ethereum**
   - Rewards information
   - Validator performance metrics
   - Block finality information

3. **Bridge Mechanisms**
   - BEEFY commitments for security
   - Agent execution patterns for message delivery
   - Merkle proofs for data verification
