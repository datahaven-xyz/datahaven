# DataHaven Development Tools

Utility scripts for GitHub automation and release management.

## Overview

This directory contains Node.js/TypeScript tools for automating release workflows and generating standardized release notes for both runtime and client releases.

## Structure

```
tools/
├── github/                        # GitHub automation utilities
│   ├── github-utils.ts           # Common GitHub API utilities
│   ├── generate-release-body.ts  # Client release notes generator
│   └── generate-runtime-body.ts  # Runtime release notes generator
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm (for dependency management)

## Setup

```bash
cd tools
npm install
```

## Available Scripts

### Generate Client Release Notes

Creates formatted release notes for client (node binary) releases:

```bash
npm run print-client-release-issue
```

This script:
- Generates changelog from Git history
- Formats release notes for GitHub
- Includes version information and breaking changes
- Outputs markdown suitable for GitHub releases

### Generate Runtime Release Notes

Creates formatted release notes for runtime (WASM) releases:

```bash
npm run print-runtime-release-issue
```

This script:
- Generates runtime-specific changelog
- Highlights runtime version bumps
- Includes migration information
- Formats for GitHub release pages

## Usage in CI/CD

These tools are typically invoked by GitHub Actions workflows during the release process. They can also be run manually for testing or preparing draft releases.

## GitHub Integration

The tools use the [Octokit](https://github.com/octokit/octokit.js) library to interact with the GitHub API. Authentication is typically handled via `GITHUB_TOKEN` environment variable in CI/CD contexts.

## Development

The tools are written in TypeScript and use:
- `@polkadot/api`: For parsing runtime metadata
- `octokit`: For GitHub API interactions
- `yargs`: For CLI argument parsing
- `ts-node`: For direct TypeScript execution

## Customization

To modify release note formatting or add new automation:

1. Edit the respective generator in `github/`
2. Update `package.json` scripts if adding new commands
3. Test locally with `npm run <script-name>`
4. Update CI workflows in `.github/workflows/` if needed
