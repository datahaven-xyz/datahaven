# State-Diff Validation (Current Implementation)

## Overview

This document describes how CI ensures `state-diff.json` stays up-to-date with contract changes **as it is implemented today**.

The original proposal for an auto-generated `state-diff-validation.test.ts` (SHA256 over `state-diff.json`, run in the TS build workflow) was **never implemented**. Instead, the project now uses a lightweight TypeScript script and a separate checksum file.

## Current Test Strategy

The validation is implemented in `test/scripts/check-generated-state.ts` and works as follows:

1. `../contracts/deployments/state-diff.checksum` stores a hash of the Solidity contracts in `../contracts/src`.
2. `check-generated-state.ts` reads that checksum and recomputes the current hash of all contract sources by calling `generateContractsChecksum("../contracts/src")`.
3. If the newly computed hash differs from the stored checksum, the script throws an error telling the developer to regenerate the state-diff and checksum via `generate-contracts.ts`.

Conceptually:

- The checksum represents “the set of contracts for which `state-diff.json` was last generated”.
- Any Solidity change that affects the checksum without regenerating `state-diff.json` will cause CI to fail.

> Note: The checksum is currently computed over the **contract sources**, not over `state-diff.json` itself. The exact hash algorithm is defined in `test/scripts/contracts-checksum.ts` (at the time of writing, this uses a SHA-based hash function).

## CI Workflow Integration

The check runs as part of the end-to-end (E2E) workflow in `.github/workflows/task-e2e.yml`:

```yaml
- name: Check for outdated state-diff.json
  run: bun ./scripts/check-generated-state.ts
```

This step:

- Executes in the `test` working directory.
- Runs **before** spinning up Kurtosis and the rest of the E2E environment.
- Fails fast if the contracts checksum and the stored checksum do not match.

As a result, any PR that modifies contracts without regenerating `state-diff.json` (and its checksum) will cause the E2E job to fail at this early step.

## When the Check Fails

If `check-generated-state.ts` throws an error, it means:

1. One or more Solidity contracts in `../contracts/src` have been modified.
2. `state-diff.json` (and its checksum file) are likely out of date.
3. The developer needs to:
   - Launch a local Kurtosis network with contracts deployed.
   - From the repository root, run `cd test && bun generate:contracts` to:
     - Extract the new state into `../contracts/deployments/state-diff.json`.
     - Compute and store the new checksum in `../contracts/deployments/state-diff.checksum`.
   - Commit the updated `state-diff.json` and `state-diff.checksum`.

## Benefits of the Current Approach

- ✅ Catches contract changes early in CI (before full E2E setup).
- ✅ Prevents stale `state-diff.json` from being used in tests.
- ✅ Clear error message from `check-generated-state.ts` tells developers how to fix it.
- ✅ Simple, script-based mechanism with minimal tooling overhead.

