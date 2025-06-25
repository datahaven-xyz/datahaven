# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataHaven is an EVM-compatible Substrate blockchain secured by EigenLayer. It bridges Ethereum and Substrate ecosystems through:
- EigenLayer AVS integration for security
- Snowbridge for cross-chain communication
- Frontier pallets for EVM compatibility
- External validators with rewards system

## Critical Development Commands

### E2E Testing Environment (from `/test` directory)

```bash
# Setup
bun i                               # Install dependencies
bun cli                            # Interactive CLI for test environment

# Code Quality
bun fmt:fix                        # Fix TypeScript formatting
bun typecheck                      # TypeScript type checking

# Code Generation (run after contract changes)
bun generate:wagmi                 # Generate TypeScript contract bindings
bun generate:types                 # Generate Polkadot-API types from runtime

# Local Development
bun build:docker:operator          # Build local DataHaven Docker image
bun start:e2e:local               # Launch local test network
bun stop:e2e                      # Stop all test services

# Testing
bun test:e2e                      # Run E2E test suite
```

### Rust/Operator Development

```bash
cd operator
cargo build --release --features fast-runtime    # Development build
cargo test                                       # Run tests
```

### Smart Contracts (from `/contracts` directory)

```bash
forge build                        # Build contracts
forge test                         # Run tests
forge fmt                          # Format Solidity code
```

## Architecture Essentials

### Cross-Component Dependencies
- **Contracts → Operator**: DataHaven AVS contracts register operators and manage slashing
- **Operator → Contracts**: Operator reads validator registry from contracts
- **Test → Both**: E2E tests deploy contracts and run operator nodes
- **Snowbridge**: Enables native token transfers and message passing between chains

### Key Design Patterns
1. **Service Manager Pattern**: Contracts use EigenLayer's service manager for operator coordination
2. **Rewards Registry**: Tracks validator performance and distributes rewards
3. **Slashing Mechanisms**: Enforces protocol rules through economic penalties
4. **Runtime Upgrades**: Substrate's forkless upgrade system for protocol evolution

### Testing Strategy
- **Unit Tests**: In each component directory
- **Integration Tests**: E2E tests in `/test` that spin up full networks
- **Kurtosis**: Manages complex multi-container test environments
- **Contract Verification**: Automated on Blockscout in test networks

### Development Workflow
1. Make changes to relevant component
2. Run component-specific tests
3. If changing contracts, regenerate TypeScript bindings
4. Build Docker image if testing operator changes
5. Run E2E tests to verify cross-component interactions

### Common Pitfalls
- Always regenerate types after runtime changes (`bun generate:types`)
- E2E tests require Kurtosis engine running
- Contract changes require regenerating Wagmi bindings
- Snowbridge relayers need proper configuration for cross-chain tests
- Use `fast-runtime` feature for quicker development cycles