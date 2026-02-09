# Changesets

This directory contains version bump declarations for contract changes.

## How It Works

When you modify contracts in `contracts/src/`, you must declare a version bump by running:

```bash
bun cli contracts bump --type [major|minor|patch]
```

This creates a file like `pr-123.txt` (or `bump-{timestamp}.txt` if not in a PR) containing the bump type.

## On Merge to Main

A GitHub Action automatically:
1. Reads all changeset files
2. Determines the highest bump type (major > minor > patch)
3. Updates the `VERSION` file accordingly
4. Updates `versions-matrix.json`
5. Deletes all changeset files
6. Commits the changes

## Example Workflow

```bash
# 1. Make contract changes
vim contracts/src/DataHavenServiceManager.sol

# 2. Declare version bump
bun cli contracts bump --type minor

# 3. Commit the changeset file
git add contracts/.changesets/
git commit -m "feat: add new feature"

# 4. Push PR - CI validates changeset exists
git push origin feature-branch

# 5. On merge to main, GitHub Action processes changesets automatically
```

## File Format

Each changeset file contains a single line with the bump type:
- `major` - Breaking changes (X.0.0)
- `minor` - New features, backwards compatible (0.X.0)
- `patch` - Bug fixes, backwards compatible (0.0.X)

## Rules

- One changeset file per PR
- CI fails if contracts changed but no changeset exists
- Multiple changesets are consolidated by taking the highest bump type
- Changesets are deleted after processing (clean main branch)
