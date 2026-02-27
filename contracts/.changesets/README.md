# Changesets

This directory contains version bump declarations for contract changes.

## How It Works

When you modify contracts in `contracts/src/`, you must declare a version bump by running:

```bash
bun cli contracts bump --type [major|minor|patch] --description "Optional description"
```

This creates a file like `pr-123.txt` (or `bump-{timestamp}.txt` if not in a PR) containing:
- First line: The bump type
- Subsequent lines: Optional description of the changes

## Release Workflow

1. **Development**: Developers create changesets for their contract changes
2. **Before Release**: Manually trigger the "Contracts Versioning" GitHub Action
3. **PR Creation**: The action creates a PR with:
   - Updated `VERSION` file
   - Updated `versions-matrix.json`
   - All changeset descriptions in PR body
   - Deleted changeset files
4. **Contract Upgrade**: Checkout the PR branch and run `bun cli contracts upgrade`
5. **Merge**: Merge the PR to main after upgrade completes

## Example Workflow

```bash
# 1. Make contract changes
vim contracts/src/DataHavenServiceManager.sol

# 2. Declare version bump with description
bun cli contracts bump --type minor --description "Add support for custom validator rewards"

# 3. Commit the changeset file
git add contracts/.changesets/
git commit -m "feat: add custom validator rewards"

# 4. Push PR - CI validates changeset exists
git push origin feature-branch

# 5. On merge to main, changesets accumulate

# 6. Before release, manually run GitHub Action "Contracts Versioning"

# 7. Action creates PR with version bump

# 8. Checkout PR and upgrade contracts
git checkout release/version-X.Y.Z
bun cli contracts upgrade --chain hoodi

# 9. Merge PR to main
```

## File Format

Each changeset file contains:
- **Line 1**: Bump type (`major`, `minor`, or `patch`)
- **Lines 2+**: Optional description of changes

Example `pr-123.txt`:
```
minor
Add support for custom validator rewards distribution.
This allows operators to configure reward multipliers per validator.
```

## Version Bump Rules

- `major` - Breaking changes (X.0.0)
- `minor` - New features, backwards compatible (0.X.0)
- `patch` - Bug fixes, backwards compatible (0.0.X)

## Aggregation Rules

- One or more changeset files per PR
- CI fails if contracts changed but no changeset exists
- Multiple changesets are consolidated by taking the highest bump type
- **Multiple major bumps are aggregated into a single major version bump**
- Changesets are deleted after processing (clean main branch)
