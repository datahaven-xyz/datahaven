# Validator Set Selection Specification
## Top-32 by Weighted Stake (Continuation of PR #433)

- Status: Draft
- Owners: DataHaven Team
- Last Updated: February 12, 2026
- Depends on: PR #433 (`feat: automated validator set submission with era targeting`)

## 1. Summary

PR #433 introduced era-targeted validator-set submission with a dedicated submitter role and runtime era validation. This spec is a continuation of that work.

This document adds deterministic weighted-stake selection so the outbound validator set is ranked before it is bridged:

1. Ethereum computes weighted stake per operator.
2. Ethereum deterministically sorts operators and selects top candidates.
3. DataHaven enforces a final total active authority cap of 32 after combining whitelisted and external validators.

The era-targeting model from PR #433 remains unchanged.

## 2. Baseline From PR #433

This spec assumes the following behavior already exists:

1. `DataHavenServiceManager.sendNewValidatorSetForEra(uint64 targetEra, ...)` is used for submission.
2. Submission is restricted to `validatorSetSubmitter` (`onlyValidatorSetSubmitter`).
3. `external_index` in the Snowbridge payload is the `targetEra`.
4. DataHaven runtime enforces era validity (`targetEra` old/too-new/duplicate checks).

## 3. Goals

1. Select external validators by weighted stake instead of raw member ordering.
2. Keep selection deterministic (`same chain state -> same selected set`).
3. Preserve PR #433 era-targeting invariants and submitter authorization flow.
4. Enforce total active authority cap = 32 (`whitelisted + external`).
5. Keep payload shape stable unless there is a hard requirement to version it.

## 4. Non-Goals

1. Replacing PR #433 submitter-role model.
2. Changing PR #433 era-target validation semantics.
3. Redesigning Snowbridge transport internals.
4. Changing reward formulas in this spec.

## 5. Current Behavior (Post-PR #433)

### 5.1 Ethereum

`buildNewValidatorSetMessageForEra(targetEra)` gathers all operator-set members with a mapped solochain address and forwards them in that order. There is no stake-based ranking.

### 5.2 Payload

Current payload carries:

1. `validators`
2. `external_index` (interpreted as `targetEra`)

### 5.3 DataHaven Runtime

`set_external_validators_inner()` stores incoming validators and `ExternalIndex`, then era application and validator composition logic consume them.

### 5.4 Limitation

Without stake-aware ordering, high-stake operators may be displaced by lower-stake operators when list size pressure or downstream caps apply.

## 6. Design Decisions

### D1. Do ranking on Ethereum

EigenLayer membership/allocation context is available on Ethereum, so weighted ranking is computed there.

### D2. Keep PR #433 era semantics unchanged

`external_index` must continue to encode `targetEra`. This spec does not repurpose it (no nonce/block-number substitution).

### D3. Deterministic tie-break

For equal weighted stake, lower Ethereum operator address wins.

### D4. Cap applies to total active authorities

Final active validator set must satisfy:

`final_active = take_32(dedupe(whitelisted ++ external_sorted_limited))`

### D5. Strategy multipliers are explicit and mandatory

No default multiplier is used. Every strategy in the validators operator set must have an explicit multiplier in `strategiesAndMultipliers`.

### D6. Keep strategy list and multipliers in sync

Multiplier lifecycle is tied to strategy lifecycle:

1. Add strategy -> add multiplier in the same call.
2. Remove strategy -> delete multiplier in the same call.

### D7. `strategiesAndMultipliers` list form must be sorted

Whenever `strategiesAndMultipliers` is represented as an array (for config APIs or EigenLayer-facing payloads), entries must be:

1. Strictly ascending by strategy address.
2. Duplicate-free.

## 7. Weighted Stake Model

For each operator `o`:

`weightedStake(o) = sum_i( allocatedStake(o, strategy_i) * weightBps(strategy_i) / 10_000 )`

Where:

1. `allocatedStake` comes from EigenLayer allocation data.
2. `weightBps` is a per-strategy multiplier in basis points.

### 7.1 Strategy Weight Semantics

1. Every supported strategy must have an explicit multiplier entry.
2. Missing multiplier entry is invalid configuration and must fail fast.
3. Multiplier values are managed explicitly by owner/governance.
4. Any list representation must be strictly ascending by strategy address and duplicate-free.

### 7.2 Unit Assumption

Stake inputs must be unit-consistent across strategies. If they are not, normalize before summing.

## 8. Ethereum Contract Changes (On Top of PR #433)

File: `contracts/src/DataHavenServiceManager.sol`

### 8.1 New State

```solidity
uint32 public constant MAX_ACTIVE_VALIDATORS = 32;
mapping(IStrategy => uint16) public strategiesAndMultipliers;
```

### 8.2 New/Updated Admin APIs

```solidity
function setStrategiesAndMultipliers(IStrategy[] calldata strategies, uint16[] calldata multipliersBps) external onlyOwner;
function addStrategiesToValidatorsSupportedStrategies(IStrategy[] calldata strategies, uint16[] calldata multipliersBps) external onlyOwner;
function removeStrategiesFromValidatorsSupportedStrategies(IStrategy[] calldata strategies) external onlyOwner;
function getStrategiesAndMultipliers() external view returns (IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory);
```

Validation requirements:

1. `strategies.length == multipliersBps.length` where applicable.
2. Input strategy lists must be strictly ascending by address.
3. Input strategy lists must not contain duplicates.

### 8.3 Updated Selection Flow

`buildNewValidatorSetMessageForEra(uint64 targetEra)` should:

1. Read validator operator set members.
2. Compute weighted stake per operator.
3. Filter out operators with no solochain mapping.
4. Resolve multiplier from `strategiesAndMultipliers` for each strategy used.
5. Revert if any strategy is missing a multiplier entry.
6. Filter out operators with zero weighted stake.
7. Select top candidates by weighted stake desc + address asc tie-break.
8. Encode using existing payload shape with `externalIndex = targetEra`.

For any EigenLayer call that consumes `StrategyAndMultiplier[]`, materialize the list in ascending strategy-address order.

`sendNewValidatorSetForEra(...)` and `onlyValidatorSetSubmitter` remain unchanged from PR #433.

## 9. Bridge Message Format

No payload version bump in this spec.

Continue using existing `ReceiveValidators` message shape:

```text
[EL_MESSAGE_ID]
[MessageVersion]
[ReceiveValidators]
[validator_count]
[validators (N * 20B)]
[external_index (u64 targetEra)]
```

If stake vectors are required in the future, that should be a separate versioned command proposal.

## 10. DataHaven Runtime Changes

File: `operator/pallets/external-validators/src/lib.rs`

### 10.1 Keep PR #433 era validation

Retain existing target-era gates and error semantics (`TargetEraTooOld`, `TargetEraTooNew`, `DuplicateOrStaleTargetEra`).

### 10.2 Enforce final total cap = 32

At validator composition time:

1. `w = whitelisted.len()`
2. `external_budget = 32.saturating_sub(w)`
3. Use at most `external_budget` external validators from the ranked list.
4. Build final set as `take_32(dedupe(whitelisted ++ external_limited))`.

### 10.3 Runtime constants

`MaxExternalValidators` can remain a defensive bound, but final active enforcement must guarantee max 32 authorities.

## 11. Rollout Plan

1. Merge/deploy PR #433 baseline first (submitter role + era-target checks).
2. Deploy ServiceManager upgrade with weighted ranking logic.
3. Backfill/confirm `strategiesAndMultipliers` for all currently supported strategies.
4. Deploy runtime changes for final total-cap enforcement.
5. Re-run submitter daemon unchanged (it still submits `targetEra = ActiveEra + 1`).
6. Monitor across multiple era cycles before production rollout.

## 12. Testing Plan

### 12.1 Solidity

1. Weighted stake computation across multiple strategies.
2. Deterministic tie-break behavior.
3. Top-32 selection when candidate count exceeds 32.
4. Behavior when candidate count is below 32.
5. Zero-stake filtering.
6. Revert when a supported strategy has no multiplier entry.
7. `addStrategies...` sets multipliers atomically and rejects length mismatch.
8. `removeStrategies...` removes multiplier entries for removed strategies.
9. `set/add/remove` reject non-ascending or duplicate strategy inputs.
10. `getStrategiesAndMultipliers()` returns an ascending, duplicate-free list.
11. Integration with `buildNewValidatorSetMessageForEra(targetEra)` and correct target era encoding.

### 12.2 Runtime

1. Existing PR #433 era-validation tests continue to pass unchanged.
2. Final active authority cap remains <= 32 with mixed whitelisted/external sets.
3. Composition logic preserves whitelisted priority while enforcing cap.

### 12.3 Integration / E2E

1. End-to-end submission through `sendNewValidatorSetForEra` with ranked validator output.
2. Delayed relay still fails with PR #433 semantics (no regressions).
3. Ranked selection outcome is deterministic across repeated runs at fixed state.

## 13. Security Considerations

1. Owner-managed strategy weights are governance-sensitive and should remain multisig/governance controlled.
2. Deterministic ordering prevents non-deterministic set drift.
3. Preserve PR #433 stale/duplicate/too-early rejection invariants.
4. Apply overflow checks in weighted arithmetic and any integer downcasts.

## 14. File Change Summary

1. `contracts/src/DataHavenServiceManager.sol`
   - weighted stake computation and deterministic top selection in `buildNewValidatorSetMessageForEra`.
2. `contracts/src/interfaces/IDataHavenServiceManager.sol`
   - `strategiesAndMultipliers` naming and add/remove strategy API signature updates with multipliers.
3. `operator/pallets/external-validators/src/lib.rs`
   - final authority cap enforcement at composition time (while keeping PR #433 era validation behavior).
4. `contracts/test/*`, `operator/pallets/external-validators/src/tests.rs`, `test/e2e/suites/validator-set-update.test.ts`
   - unit/runtime/e2e coverage for weighted selection + strategy/multiplier sync + cap behavior + non-regression on era-targeted flow.
