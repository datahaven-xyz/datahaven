# Storage Layout Snapshots

This directory contains storage layout snapshots for upgradeable contracts. These snapshots are used to detect unintended storage layout changes that could corrupt state during proxy upgrades.

## How It Works

1. **Snapshot Comparison**: CI compares the current storage layout against committed snapshots
2. **Upgrade Simulation**: Foundry tests verify state preservation across upgrades

## Updating Snapshots

When you intentionally modify the storage layout of a contract (e.g., adding new state variables), you must update the snapshot:

```bash
cd contracts
forge inspect DataHavenServiceManager storage --json > storage-snapshots/DataHavenServiceManager.storage.json
```

## Important Guidelines

- **Never reorder existing variables** - This corrupts existing state
- **Never change types of existing variables** - This corrupts existing state
- **Always add new variables before the `__GAP`** - This preserves upgrade safety
- **Reduce gap size when adding variables** - Keep total slot count constant
- **Review snapshot diffs carefully** - Ensure changes are intentional

## Current Contracts

| Contract | Gap Size | Gap Slot |
|----------|----------|----------|
| DataHavenServiceManager | 46 | 105 |

## Verification Commands

```bash
# Check storage layout (CI script)
./scripts/check-storage-layout.sh

# Negative check (proves detector fails on broken layout)
./scripts/check-storage-layout-negative.sh

# Run upgrade simulation tests
forge test --match-contract StorageLayoutTest -vvv

# View human-readable layout
forge inspect DataHavenServiceManager storage --pretty
```

## How Normalization Works

The snapshot comparison normalizes both files to avoid false positives:

- **Removes `astId`**: Changes with each compiler run
- **Removes `contract`**: Contains full file path
- **Removes `.types` section**: Contains unstable AST IDs that cause false diffs
- **Sorts by slot**: Ensures deterministic comparison

This approach detects:
- Variable reordering or slot changes
- Top-level type changes (primitives, mappings, arrays)
- Gap size modifications

## Note on Struct Storage

If you add struct-typed storage variables in the future, be aware that **internal struct field changes may not be detected** by the snapshot diff. This is because:

1. The `.types` section (which contains struct field definitions) is dropped to avoid unstable AST IDs
2. The storage slot assignment for a struct variable doesn't change when its internal fields change

**However, this does not break upgrades** in the traditional sense. Struct field reordering or type changes within a struct would cause data misinterpretation (reading field A as field B), but the slot-level layout remains stable.

**Mitigation**: If adding struct storage, ensure the upgrade simulation tests (`StorageLayoutTest`) explicitly verify struct field values survive upgrades.

**Current status**: DataHavenServiceManager has no struct-typed storage variables, so this limitation does not apply.
