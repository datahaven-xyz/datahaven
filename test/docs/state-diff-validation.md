# CI Test Proposal: State-Diff Validation

## Overview

This document proposes a CI test to ensure `state-diff.json` stays up-to-date with contract changes.

## Test Strategy

The validation is done through an auto-generated test file (`state-diff-validation.test.ts`) that:
1. Checks if `state-diff.json` exists
2. Computes SHA256 checksum of the current file
3. Compares it against the expected checksum (embedded in the test)
4. Fails with a clear error message if checksums don't match

## CI Workflow Integration

### Option 1: Add to existing TS Build workflow

Add a new job to `.github/workflows/task-ts-build.yml`:

```yaml
jobs:
  # ... existing generate-wagmi job ...
  
  validate-state-diff:
    runs-on: ubuntu-latest
    name: Validate State Diff
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: test/.bun-version
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - name: Install dependencies
        working-directory: test
        run: bun install
      - name: Run state-diff validation test
        working-directory: test
        run: bun test state-diff-validation.test.ts
      - name: Verify test file exists
        run: |
          if [ ! -f "test/state-diff-validation.test.ts" ]; then
            echo "❌ state-diff-validation.test.ts not found. Run 'bun generate:contracts' to generate it."
            exit 1
          fi
      - name: Verify state-diff.json exists
        run: |
          if [ ! -f "contracts/deployments/state-diff.json" ]; then
            echo "❌ state-diff.json not found. Run 'bun generate:contracts' to generate it."
            exit 1
          fi
```

### Option 2: Standalone workflow

Create `.github/workflows/task-state-diff-validation.yml`:

```yaml
name: State Diff Validation

on:
  workflow_dispatch:
  workflow_call:
  pull_request:
    paths:
      - 'contracts/**/*.sol'
      - 'contracts/deployments/state-diff.json'
      - 'test/state-diff-validation.test.ts'

jobs:
  validate:
    runs-on: ubuntu-latest
    name: Validate State Diff
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: test/.bun-version
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - name: Install dependencies
        working-directory: test
        run: bun install
      - name: Run state-diff validation test
        working-directory: test
        run: bun test state-diff-validation.test.ts
```

## When the Test Fails

If the test fails, it means:
1. Contracts have been modified
2. `state-diff.json` is out of date
3. Developer needs to:
   - Launch a local Kurtosis network
   - Deploy contracts to it
   - Run `bun generate:contracts`
   - Commit the updated `state-diff.json` and `state-diff-validation.test.ts`

## Benefits

- ✅ Catches contract changes early in CI
- ✅ Prevents stale state-diff.json from being merged
- ✅ Clear error messages guide developers
- ✅ No manual checksum comparison needed
- ✅ Test is auto-generated, reducing maintenance

## Recommended Approach

**Option 1** (add to existing workflow) is recommended because:
- Keeps related checks together
- Reuses existing setup steps
- Simpler workflow structure

The test should run:
- On every PR (to catch contract changes)
- As part of the TS Build workflow (alongside wagmi generation)

