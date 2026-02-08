# Validator Set Submission

**Status:** Draft  
**Owner:** DataHaven Protocol / AVS Integration  
**Last Updated:** 2026-02-07
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
- Operational flow relies on fixed fee constants and has no automated submission pipeline.

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
5. Accept that a failed submission for a given era is permanently missed (single submission window per era).
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

The submitter subscribes to finalized session changes via PAPI's `watchValue("finalized")` on `Session.CurrentIndex`. On each session change it evaluates whether submission is needed, and acts during the last session of the active era. Each era gets a single submission attempt — if it fails, the era is missed and the submitter moves on.

```
┌───────────────────────────────┐      submit (for era)      ┌───────────────────────────────┐
│ Validator-Set-Submitter       │ ──────────────────────────► │ ServiceManager (Ethereum)     │
│ - watches session changes     │                            │ - submitter-gated API         │
│ - computes targetEra          │                            │ - builds payload with target  │
│ - single attempt per era      │                            └───────────────┬───────────────┘
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

**Submission model**

- Submitter subscribes to finalized `Session.CurrentIndex` via PAPI `watchValue("finalized")`.
- On each session change, evaluates preconditions: `ActiveEra` set, `targetEra` not already processed, `ExternalIndex < targetEra`, and current session is the last session of the era.
- One submission attempt per era window. If the attempt fails (revert, missing event, or error), the era is marked as processed and permanently missed.
- Rationale: `validate_target_era` on the Substrate side rejects `targetEra <= activeEraIndex`, so once `ActiveEra` advances past the target, retries are impossible.
- Overlapping session emissions are dropped via RxJS `exhaustMap`.

**Delay/gap behavior (required)**

- If message for era `N` is delayed and arrives after `ActiveEra >= N`, it is rejected.
- If message for era `N` never relays, the system can still proceed by submitting for era `N+1` when `ActiveEra = N`.
- Out-of-order future messages are rejected until they become the next era target.

**Success criteria**

- Transaction receipt status is `success`.
- `OutboundMessageAccepted` event emitted in receipt logs.

**State model**

- Submitter is recoverable from chain state (reads `ActiveEra`, `ExternalIndex`, and session boundaries on each tick).
- In-memory state is limited to `submittedEra` (the last processed target era), held in a closure.

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
  - `bun tools/validator-set-submitter/main.ts run`
  - optional `--dry-run`

---

## Security considerations

- Submitter key compromise risk is reduced by dedicated role separation (vs broad owner use).
- Era-target checks prevent delayed-message replay into later eras.
- Authorized-origin restriction remains required and unchanged.
- Single-attempt model eliminates fee burn loops; a failed era is missed rather than retried.

---

## Observability and operations

Required metrics/log dimensions:

- `targetEra`
- current `ActiveEra` and `ExternalIndex`
- current session index
- outbound tx hash
- fee pair used
- submission outcome (success / revert / missing event / error)

Alert conditions:

- missed submission window (failed attempt logged as "era will be missed")
- repeated era misses across consecutive eras
- subscription errors on `Session.CurrentIndex`

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
- Add a generalized failure-handling strategy for the submitter, including retry behavior for transient issues while preserving safety and idempotency.
- Add generalized resiliency for event watching and connectivity, including recovery after disconnects and missed updates.
- Add production monitoring and operations dashboards (for example Prometheus/Grafana) covering service health, submission outcomes, retries, missed eras, and end-to-end latency.
- Add alerting/SLO definitions for validator-set submission reliability and response runbooks for incidents.
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
