# Validator Set Submission

**Status:** Draft  
**Owner:** DataHaven Protocol / AVS Integration  
**Last Updated:** 2026-02-06  
**Scope:** Ethereum -> Snowbridge -> DataHaven validator set synchronization

---

## Background

This specification defines an automation-first validator-set synchronization flow.

In this document:
- the validator-set submitter runs once per era window, and
- each message is valid only for the immediate next era.

The primary objective is to run an off-chain validator-set-submitter that automatically calls validator-set submission without manual intervention.

The design is:

1. Validator-set messages are permissioned on Ethereum by a dedicated submitter role.
2. The payload field `external_index` is used as `targetEra` (the era the message is intended for).
3. DataHaven accepts a message only if it targets the next era at receive time.
4. Delayed messages for past eras are rejected and never applied to later eras.

This enforces the invariant: **at most one canonical validator-set apply per target era, and no late-era spillover**.

### Current mechanism (as-is)

- Manual and one-shot submission flow is done via `test/scripts/update-validator-set.ts`.
- `sendNewValidatorSet(uint128 executionFee, uint128 relayerFee)` in `contracts/src/DataHavenServiceManager.sol` is owner-only.
- Message building currently does not carry explicit era intent.
- DataHaven inbound processing applies decoded `external_index` without era-target validation.
- Operational flow relies on fixed fee constants and has no robust confirmation/retry pipeline.

---

## Problems addressed by this spec

- Manual operation for validator-set submission.
- Late relay can cause old messages to arrive after their intended era.
- Ambiguity between "message order" and "era intent".
- Owner-key usage for routine automated submissions.

---

## Goals

1. Run an off-chain component that automatically submits validator-set updates in the required era window.
2. Ensure each message is explicitly bound to a specific target era.
3. Accept a message only when it targets the immediate next era.
4. Reject delayed (past-era), duplicate, and too-far-ahead messages deterministically.
5. Maintain operational reliability under relayer delays with bounded retries.
6. Avoid skipping era advancement even when validator addresses are unchanged.

### Non-goals

- Redesigning Snowbridge protocol internals.
- Replacing the existing owner/governance model outside submitter assignment.
- Building a multi-node HA control plane (single submitter process is acceptable initially).

---

## Terminology

- `ActiveEra`: era currently active on DataHaven.
- `NextEra`: `ActiveEra + 1`.
- `targetEra`: era this validator-set message is intended for.
- `external_index`: payload field; in this design, its value is `targetEra`.
- `ExternalIndex`: latest bridge-received `targetEra` accepted on DataHaven.
- `PendingExternalIndex`: staged external index applied when the next era starts.
- `CurrentExternalIndex`: external index currently applied to the active era.
- `Canonical apply`: the accepted validator-set apply for a specific `targetEra`.

---

## Proposed design

### High-level overview

The solution centers on a long-running off-chain validator-set-submitter under `tools/` that automatically submits validator-set updates.

Contract and runtime changes make the submitter service safe and deterministic:
- only the submitter role can send validator-set messages,
- payloads include explicit era intent (`targetEra`), and
- DataHaven accepts only messages targeting `NextEra`.

The submitter computes `targetEra = ActiveEra + 1`, submits the message, and confirms success only after outbound acceptance and inbound apply confirmation.

```
┌───────────────────────────────┐      submit (for era)      ┌───────────────────────────────┐
│ Validator-Set-Submitter       │ ──────────────────────────► │ ServiceManager (Ethereum)     │
│ - reads ActiveEra             │                            │ - submitter-gated API         │
│ - computes targetEra          │                            │ - builds payload with target  │
│ - retries boundedly           │                            └───────────────┬───────────────┘
└───────────────────────────────┘                                            │
                                                                             │ Snowbridge message
                                                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DataHaven inbound (`operator/primitives/bridge`) + external validators pallet                │
│ - authorized origin check                                                                     │
│ - era gate: targetEra == ActiveEra + 1                                                        │
│ - duplicate/stale gate: targetEra > ExternalIndex                                             │
│ - delayed messages for past eras are rejected                                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### A) Ethereum contract changes

**Target contract**

- `contracts/src/DataHavenServiceManager.sol`

**Permissioned submitter role**

- Add state:
  - `address public validatorSetSubmitter`
- Add admin API:
  - `setValidatorSetSubmitter(address newSubmitter) external onlyOwner`
  - `newSubmitter` MUST be non-zero
  - emit `ValidatorSetSubmitterUpdated(oldSubmitter, newSubmitter)`
- Add modifier:
  - `onlyValidatorSetSubmitter` (revert unless `msg.sender == validatorSetSubmitter`)

**Era-targeted submission**

- Add submission API:
  - `sendNewValidatorSetForEra(uint64 targetEra, uint128 executionFee, uint128 relayerFee) external payable onlyValidatorSetSubmitter`
  - builds validator payload with `targetEra`
  - calls gateway `v2_sendMessage`
  - emits `ValidatorSetMessageSubmitted`
- Add builder API:
  - `buildNewValidatorSetMessageForEra(uint64 targetEra) public view returns (bytes memory)`
  - encodes `targetEra` as `external_index`

**Legacy submission path**

- Legacy `sendNewValidatorSet(uint128,uint128)` must be removed from the production contract.

**Contract-side trust scope (this release)**

- No additional `lastSubmittedTargetEra` contract guard is required in this release.
- Rationale: submission is permissioned and runtime is the source of truth for era correctness (`targetEra == ActiveEra + 1`).

**Events**

- `event ValidatorSetSubmitterUpdated(address indexed oldSubmitter, address indexed newSubmitter);`
- `event ValidatorSetMessageSubmitted(uint64 indexed targetEra, bytes32 payloadHash, address indexed submitter);`

### B) Runtime changes (DataHaven)

**Target processor**

- `operator/primitives/bridge/src/lib.rs` in `EigenLayerMessageProcessor::process_message`

**Era-target validation rule**

Before `set_external_validators_inner`, validate `targetEra`:

1. Must satisfy `targetEra == ActiveEra + 1`
2. Must satisfy `targetEra > ExternalIndex` (dedupe/stale guard)

Reject cases:
- `targetEra <= ActiveEra`: delayed/past-era message.
- `targetEra > ActiveEra + 1`: too-far-ahead message.
- `targetEra <= ExternalIndex`: stale/duplicate message.

This ensures a delayed message cannot be applied to a later era.

**Error semantics**

Return deterministic dispatch errors, for example:
- `TargetEraTooOld`
- `TargetEraTooNew`
- `DuplicateOrStaleTargetEra`

**Authorization**

- Keep existing authorized-origin checks unchanged.

### C) Validator-set-submitter service (`tools/`)

**Location and runtime model**

- New component at `tools/validator-set-submitter/`
- Long-running daemon
- TypeScript + Bun

**Authoritative inputs**

- DataHaven:
  - `ActiveEra`
  - `ExternalIndex`
  - `CurrentExternalIndex`
  - `SessionsPerEra` and era-window session boundaries
- Ethereum:
  - current validator set view from ServiceManager message-builder inputs

**Target era computation**

- `targetEra = ActiveEra + 1`

**Submission and retry model**

- Submitter acts in a configurable pre-boundary window.
- One normal submission attempt per era window; retries only when unconfirmed.
- Retries for the same era reuse the same `targetEra`.
- Fee bump strategy with configured cap.
- Retries stop immediately after inbound confirmation.

**Delay/gap behavior (required)**

- If message for era `N` is delayed and arrives after `ActiveEra >= N`, it is rejected.
- If message for era `N` never relays, the system can still proceed by submitting for era `N+1` when `ActiveEra = N`.
- Out-of-order future messages are rejected until they become the next era target.

**Success criteria**

- Outbound accepted on Ethereum.
- Inbound `ExternalValidatorsSet` observed on DataHaven with expected `targetEra`.

**State model**

- Submitter is recoverable from chain state.
- Ephemeral in-memory retry state is allowed during a submission cycle.

---

## API / interface changes

### Ethereum interface

- Add era-targeted submit function.
- Add submitter admin function + getter.
- Add era-targeted builder function.

### DataHaven runtime behavior

- Add next-era-only acceptance in inbound bridge path.
- Add explicit delayed/too-early/duplicate rejection paths.

### Tooling

- New daemon CLI entrypoint:
  - `bun tools/validator-set-submitter/src/main.ts run`
  - optional `--dry-run`

---

## Security considerations

- Submitter key compromise risk is reduced by dedicated role separation (vs broad owner use).
- Era-target checks prevent delayed-message replay into later eras.
- Authorized-origin restriction remains required and unchanged.
- Bounded retries prevent infinite fee burn loops.

---

## Observability and operations

Required metrics/log dimensions:

- `targetEra`
- current `ActiveEra`
- outbound tx hash and nonce
- retry count
- fee pair used
- outbound acceptance latency
- inbound apply latency
- rejection reason category (`too_old` / `too_new` / `duplicate_or_stale` / `unauthorized` / `decode_failure`)

Alert conditions:

- missed submission window
- max retries exceeded
- outbound accepted but inbound not confirmed before cutoff
- repeated era-target rejections across eras

---

## Testing

### Solidity tests

- submitter-only enforcement
- submitter rotation by owner
- payload encodes caller `targetEra`
- event fields emitted correctly
- zero-address submitter rejected
- legacy `sendNewValidatorSet` path is removed (no callable legacy submit path)

### Runtime tests

- accepts only `targetEra == ActiveEra + 1`
- rejects `targetEra <= ActiveEra` (late)
- rejects `targetEra > ActiveEra + 1` (too early)
- rejects `targetEra <= ExternalIndex` (duplicate/stale)
- origin authorization behavior unchanged

### Integration tests

- one canonical apply per target era
- delayed message for old era is rejected after era advances
- missing relay for era `N` does not block acceptance for era `N+1` when it becomes next
- boundary race: arrival at era transition behaves correctly (`N` stale, `N+1` accepted)

---

## Rollout

1. Implement and test contract + runtime changes.
2. Deploy to stagenet.
3. Run submitter service in dry-run mode and validate era-target decisions.
4. Enable active mode.
5. Monitor across multiple era cycles.
6. Promote to mainnet after stability criteria are met.

---

## Dependencies

- Existing manual script `test/scripts/update-validator-set.ts` may remain for emergency/manual use, but must be marked non-canonical.
- Legacy unscoped submit path `sendNewValidatorSet` must be removed in production.

---

## Possible improvements (future)

- Keep this release simple: `external_index` carries `targetEra`, and runtime enforces next-era-only acceptance.
- Alternative direction: remove era dependency from payload and use an Ethereum-stamped freshness model:
  - `ServiceManager` assigns message metadata on-chain (e.g., `issuedAt` timestamp and monotonic message nonce/ID).
  - DataHaven accepts only fresh messages within a configured max relay delay and rejects expired ones.
  - This reduces trust in submitter-provided era values while preserving deterministic stale/duplicate rejection.

---

## Acceptance criteria

This spec is accepted when:

- an off-chain validator-set-submitter runs unattended and automatically submits validator-set updates
- dedicated submitter role exists and is enforced
- era-targeted submission API is live
- runtime applies messages only when they target the next era
- delayed messages for past eras are rejected and not applied to later eras
- end-to-end tests pass for delayed/missing/out-of-order scenarios
