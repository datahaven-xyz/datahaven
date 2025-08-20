# Rewards Message Flow Documentation

## Current Implementation Status
- **✅ Steps 1-10 Complete**: Full flow from era tracking through reward claiming
- **⏳ Step 11 TODO**: Double-claim prevention verification
- **Test Coverage**: Era end → Message relay → Merkle root update → Proof generation → Reward claiming → ETH transfer validation

## Overview
This document describes the end-to-end flow of rewards messages from DataHaven (Substrate chain) to Ethereum, including merkle proof generation, claiming, and validation.

## Architecture Components

### DataHaven Side (Substrate)
- **ExternalValidatorsRewards Pallet**: Tracks validator performance and rewards
- **Snowbridge**: Cross-chain messaging protocol
- **Runtime API**: Provides merkle proof generation

### Ethereum Side
- **Gateway Contract**: Receives and executes cross-chain messages
- **RewardsRegistry Contract**: Stores merkle roots and validates claims
- **ServiceManager Contract**: Handles operator registration and reward claims
- **RewardsAgent**: Authorized account that can update merkle roots

## Complete Flow

### Phase 1: Era Management & Reward Calculation
1. DataHaven tracks validator performance during each era
2. Validators earn points for block production
3. At era end, rewards are calculated based on points and inflation

### Phase 2: Cross-Chain Message
1. DataHaven generates merkle root from all validator rewards
2. Sends rewards message via Snowbridge containing:
   - Era index
   - Total points
   - Inflation amount
   - Merkle root

### Phase 3: Ethereum Processing
1. Gateway receives and executes the message
2. RewardsAgent updates RewardsRegistry with new merkle root
3. Merkle root is stored with incremented index

### Phase 4: Reward Claiming
1. Validators generate merkle proofs using DataHaven runtime API
2. Submit proof to ServiceManager contract
3. Contract validates proof against stored merkle root
4. ETH rewards transferred to operator

## Test Implementation Status

### ✅ Implemented Steps (1-10 Complete)

#### Step 1: Track Current Era
- Monitor current era and blocks until era end
- Implementation: `getCurrentEra()`, `getBlocksUntilEraEnd()`

#### Step 2: Wait for Era End
- Wait for era to complete and rewards message to be sent
- Capture `RewardsMessageSent` event from DataHaven
- Implementation: `waitForRewardsMessageSent()`

#### Step 3: Monitor Gateway Execution
- Watch for `MessageExecuted` event on Ethereum Gateway
- Confirms cross-chain message arrival
- Implementation: Uses `waitForEthereumEvent()`

#### Step 4: Verify RewardsRegistry Update
- Confirm `RewardsMerkleRootUpdated` event
- Validate stored merkle root matches sent root
- Implementation: Reads from `merkleRootHistory`

#### Step 5: Infrastructure Verification
- Verify RewardsRegistry deployment
- Check RewardsAgent configuration
- Validate ServiceManager connection
- Implementation: Contract instance checks

#### Step 6: Era Tracking
- Track validator performance points
- Monitor block production
- Implementation: `getEraRewardPoints()`

#### Step 7: Message Validation
- Verify message ID, merkle root, total points
- Ensure inflation amount is positive
- Implementation: Event data validation

#### Step 8: Generate Merkle Proofs ✅
- Use DataHaven runtime API for proof generation
- Map validator accounts to operator addresses
- Implementation: 
  - `generateMerkleProofForValidator()` - Single validator proof
  - `generateMerkleProofsForEra()` - Batch generation for all validators
  - `getValidatorCredentials()` - Gets validator credentials including operator address and private key

#### Step 9: Claim Rewards ✅ (Implemented)
- Submit merkle proof to ServiceManager
- Validate operator is part of operator set
- Current Implementation:
  - Selects first validator from `validatorProofs` Map
  - Records initial ETH balance
  - Calls `claimOperatorRewards()` on ServiceManager with operatorSetId=0
  - Waits for transaction confirmation
  - Captures `RewardsClaimedForIndex` event from RewardsRegistry
  - Verifies event data matches expected values

#### Step 10: Validate Token Transfer ✅ (Implemented)
- Verify ETH balance increase (rewards are paid in native ETH)
- Account for gas costs if operator is sender
- Validate rewards amount matches calculation
- Current Implementation:
  - Checks ETH balance after claim transaction
  - Calculates expected rewards using `calculateExpectedRewards()`
  - Smart gas cost handling:
    - If operator == transaction sender: accounts for gas costs
    - If different account claimed: expects full reward amount
  - Verifies rewards amount from event matches expected calculation
  - Validates actual balance increase matches rewards (minus gas if applicable)

### ⏳ TODO Steps

#### Step 11: Double-Claim Prevention
- Attempt to claim same rewards twice
- Verify transaction reverts with 'RewardsAlreadyClaimed'
- Check `operatorClaimedByIndex` mapping

## Key Functions

### DataHaven Side
```typescript
// Get current era
getCurrentEra(dhApi: DataHavenApi): Promise<number>

// Get era reward points
getEraRewardPoints(dhApi: DataHavenApi, eraIndex: number): Promise<EraRewardPoints>

// Generate merkle proof for validator
generateMerkleProofForValidator(
  dhApi: DataHavenApi,
  validatorAccount: string,
  eraIndex: number
): Promise<{ proof: string[]; leaf: string }>

// Wait for rewards message
waitForRewardsMessageSent(
  dhApi: DataHavenApi,
  expectedEra?: number,
  timeout?: number
): Promise<RewardsMessageSentEvent>
```

### Ethereum Side
```typescript
// Claim operator rewards
claimOperatorRewards(
  operatorSetId: uint32,
  rootIndex: uint256,
  operatorPoints: uint256,
  proof: bytes32[]
)

// Calculate expected rewards
calculateExpectedRewards(
  points: bigint,
  totalPoints: bigint,
  inflation: bigint
): bigint
```

## Test Configuration

### Validator Mapping
The test uses predefined validator mappings from `test/configs/validator-set.json`:
- Maps DataHaven substrate addresses to EigenLayer operator addresses
- Uses first 5 ANVIL_FUNDED_ACCOUNTS as operators
- Ensures test accounts have private keys for signing

### Timing Considerations
- Era length: Configured in runtime (typically 10 blocks for testing)
- Cross-chain message delay: ~30-60 seconds
- Event monitoring timeouts: 120-180 seconds

## Common Issues & Solutions

### Issue: "unknown account" error when claiming
**Cause**: Trying to send transaction from account without private key
**Solution**: Ensure operator address is in ANVIL_FUNDED_ACCOUNTS with known private key

### Issue: Merkle proof validation fails
**Cause**: Mismatch between proof generation and verification
**Solution**: Ensure same era index and validator account used for proof generation

### Issue: No rewards message sent
**Cause**: Era didn't complete or no validators earned points
**Solution**: Wait for full era completion and ensure validators are producing blocks

## Security Considerations

1. **Merkle Root Authority**: Only RewardsAgent can update merkle roots
2. **Double-Claim Prevention**: Contract tracks claimed rewards by operator and root index
3. **Operator Validation**: Only registered operators in the set can claim
4. **Proof Verification**: Merkle proof must validate against stored root

## Future Improvements

1. **Batch Claims**: Support claiming multiple eras in one transaction
2. **Delegation**: Allow operators to delegate claim authority
3. **Gas Optimization**: Optimize proof verification for lower gas costs
4. **Monitoring**: Add comprehensive event monitoring and alerting

## E2E Test Scenarios

### Scenario 1: Basic Rewards Flow
**Objective**: Verify end-to-end rewards message delivery and claiming
**Steps**:
1. Setup validators and wait for era to start
2. Have validators produce blocks to earn backing points
3. Wait for era to end and rewards message to be sent
4. Verify `RewardsMessageSent` event on DataHaven
5. Wait for relayers to process the message
6. Verify `RewardsMerkleRootUpdated` event on Ethereum
7. Generate Merkle proof for a validator
8. Claim rewards through Service Manager
9. Verify reward transfer to operator

### Scenario 2: Multiple Validators
**Objective**: Test rewards distribution across multiple validators
**Steps**:
1. Register multiple validators (5-10)
2. Have validators earn different amounts of points
3. Wait for era end and message transmission
4. Generate proofs for all validators
5. Claim rewards for each validator
6. Verify proportional reward distribution

### Scenario 3: Batch Claiming
**Objective**: Test claiming rewards from multiple eras
**Steps**:
1. Let multiple eras pass with validators earning points
2. Verify multiple Merkle roots stored in RewardsRegistry
3. Generate proofs for multiple eras for same operator
4. Use `claimRewardsBatch` to claim all at once
5. Verify total rewards match sum of individual eras

### Scenario 4: Invalid Proof Rejection
**Objective**: Verify security against invalid claims
**Steps**:
1. Complete normal rewards flow
2. Attempt to claim with:
   - Wrong Merkle proof
   - Proof from different validator
   - Modified reward amount
3. Verify all invalid claims are rejected
4. Verify valid claim still works

### Scenario 5: Double Claim Prevention
**Objective**: Ensure operators cannot claim same rewards twice
**Steps**:
1. Complete normal rewards flow and claim
2. Attempt to claim same rewards again
3. Verify transaction reverts with `RewardsAlreadyClaimedForIndex`
4. Verify operator can still claim from new era

### Scenario 6: Whitelisted Validator Exclusion
**Objective**: Verify whitelisted validators don't receive rewards
**Steps**:
1. Add validator to whitelist in runtime config
2. Have both whitelisted and regular validators produce blocks
3. Wait for era end
4. Verify only non-whitelisted validators in Merkle tree
5. Verify whitelisted validator cannot claim

### Scenario 7: Zero Points Era
**Objective**: Test behavior when no validators earn points
**Steps**:
1. Start era with validators
2. Ensure no blocks are produced (validators offline)
3. Wait for era end
4. Verify no rewards message is sent
5. Verify no new Merkle root on Ethereum

### Scenario 8: Gas Estimation
**Objective**: Measure gas costs for operations
**Steps**:
1. Complete normal rewards flow
2. Measure gas for:
   - Merkle root update by Gateway
   - Single reward claim
   - Batch reward claim (5 eras)
3. Verify gas costs are within acceptable limits

### Scenario 9: Message Ordering
**Objective**: Verify messages arrive in correct order
**Steps**:
1. Complete multiple eras quickly
2. Verify Merkle roots arrive in chronological order
3. Verify root indices increment sequentially
4. Test claiming from non-latest root

### Scenario 10: Relayer Failure Recovery
**Objective**: Test system resilience to relayer issues
**Steps**:
1. Send rewards message
2. Stop relayers before message processing
3. Accumulate multiple messages
4. Restart relayers
5. Verify all messages eventually processed
6. Verify claims work for all eras