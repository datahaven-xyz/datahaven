# DataHaven E2E Testing

End-to-end testing framework for DataHaven, providing automated network deployment, contract interaction, and cross-chain scenario testing. This directory contains all tools needed to launch a complete local DataHaven network with Ethereum, Snowbridge relayers, and run comprehensive integration tests.

For comprehensive documentation, see [E2E Testing Guide](./docs/E2E_TESTING_GUIDE.md).

## Pre-requisites

- [Kurtosis](https://docs.kurtosis.com/install): For launching test networks
- [Bun](https://bun.sh/) v1.3.2 or higher: TypeScript runtime and package manager
- [Docker](https://www.docker.com/): For container management
- [Foundry](https://getfoundry.sh/introduction/installation/): To deploy contracts
- [Helm](https://helm.sh/docs/intro/install/): The Kubernetes Package Manager 

#### MacOS
If you are running this on a Mac, `zig` is a pre-requisite for crossbuilding the node. Instructions for installation can be found [here](https://ziglang.org/learn/getting-started/).
You may also need to install `libpq` for PostgreSQL connectivity and set the appropriate Rust flags.

```bash
# Install libpq using Homebrew
brew install zig

# Install libpq using Homebrew
brew install libpq

# Set environment variables for Rust compilation
export PKG_CONFIG_PATH="/opt/homebrew/opt/libpq/lib/pkgconfig"
export CPPFLAGS="-I$(brew --prefix libpq)/include"
export LDFLAGS="-L$(brew --prefix libpq)/lib"
export PKG_CONFIG_PATH="$(brew --prefix libpq)/lib/pkgconfig"

# Add to your shell profile (~/.zshrc or ~/.bash_profile) to persist
echo 'export PKG_CONFIG_PATH="/opt/homebrew/opt/libpq/lib/pkgconfig"' >> ~/.zshrc
echo 'export CPPFLAGS="-I$(brew --prefix libpq)/include"' >> ~/.zshrc
echo 'export LDFLAGS="-L$(brew --prefix libpq)/lib"' >> ~/.zshrc
echo 'export PKG_CONFIG_PATH="$(brew --prefix libpq)/lib/pkgconfig"' >> ~/.zshrc
```

## Quick Start

```bash
# Install dependencies
bun i

# Interactive CLI to launch a full local DataHaven network
bun cli launch

# Run all the e2e tests
bun test:e2e

# Run all the e2e tests with limited concurrency
bun test:e2e:parallel

# Run a specific test suite
bun test suites/some-test.test.ts
```

## What Gets Launched

The `bun cli launch` command deploys a complete local environment:

1. **Ethereum Network** (via Kurtosis):
   - 2x Execution Layer clients (reth)
   - 2x Consensus Layer clients (lodestar)
   - Blockscout Explorer (optional: `--blockscout`)
   - Dora Consensus Explorer

2. **DataHaven Network**:
   - Single validator solochain
   - EVM compatibility via Frontier
   - Fast block times (3s with `--fast-runtime`)

3. **Smart Contracts**:
   - EigenLayer AVS contracts deployed to Ethereum
   - Optional Blockscout verification (`--verified`)

4. **Snowbridge Relayers**:
   - Beacon relay (Ethereum → DataHaven)
   - BEEFY relay (DataHaven → Ethereum)
   - Execution relay (Ethereum → DataHaven)
   - Solochain relay (DataHaven → Ethereum)

5. **Network Configuration**:
   - Validator registration and funding
   - Parameter initialization
   - Validator set updates

For more information on the E2E testing framework, see the [E2E Testing Framework Overview](./docs/E2E_FRAMEWORK_OVERVIEW.md).

## Common Commands

| Command                   | Description                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Network Management**    |                                                                                                    |
| `bun cli`                 | Interactive CLI menu for all operations                                                            |
| `bun cli launch`          | Launch full local network (interactive options)                                                    |
| `bun start:e2e:local`     | Launch local network (non-interactive)                                                             |
| `bun start:e2e:verified`  | Launch with Blockscout and contract verification                                                   |
| `bun start:e2e:ci`        | CI-optimized network launch                                                                        |
| `bun cli stop`            | Stop all services (interactive)                                                                    |
| `bun stop:dh`             | Stop DataHaven only                                                                                |
| `bun stop:sb`             | Stop Snowbridge relayers only                                                                      |
| `bun stop:eth`            | Stop Ethereum network only                                                                         |
| **Testing**               |                                                                                                    |
| `bun test:e2e`            | Run all E2E test suites                                                                            |
| `bun test:e2e:parallel`   | Run tests with limited concurrency                                                                 |
| `bun test <file>`         | Run specific test file                                                                             |
| **Code Generation**       |                                                                                                    |
| `bun generate:wagmi`      | Generate TypeScript contract bindings (after contract changes)                                     |
| `bun generate:types`      | Generate Polkadot-API types from runtime                                                           |
| `bun generate:types:fast` | Generate types with fast-runtime feature                                                           |
| **Code Quality**          |                                                                                                    |
| `bun fmt:fix`             | Fix TypeScript formatting with Biome                                                               |
| `bun typecheck`           | TypeScript type checking                                                                           |
| **Deployment**            |                                                                                                    |
| `bun cli deploy`          | Deploy to Kubernetes cluster (interactive)                                                         |
| `bun build:docker:operator` | Build local Docker image (`datahavenxyz/datahaven:local`)                                        |

## Local Network Deployment

Follow these steps to set up and interact with your local network:

1. **Deploy a minimal test environment**

   ```bash
   bun cli launch
   ```

   This script will:

   1. Check for required dependencies.
   2. Launch a DataHaven solochain.
   3. Start a Kurtosis network which includes:
      - 2 Ethereum Execution Layer clients (reth)
      - 2 Ethereum Consensus Layer clients (lodestar)
      - Blockscout Explorer services for EL (if enabled with --blockscout)
      - Dora Explorer service for CL
   4. Deploy DataHaven smart contracts to the Ethereum network. This can optionally include verification on Blockscout if the `--verified` flag is used (requires Blockscout to be enabled).
   5. Perform validator setup and funding operations.
   6. Set parameters in the DataHaven chain.
   7. Launch Snowbridge relayers.
   8. Perform validator set update.

   > [!NOTE]
   >
   > If you want to also have the contracts verified on Blockscout, you can pass the `--verified` flag to the `bun cli launch` command, along with the `--blockscout` flag. This will do all the previous, but also verify the contracts on Blockscout. However, note that this takes some time to complete.

2. **Explore the network**

   - Block Explorer: [http://127.0.0.1:3000](http://127.0.0.1:3000).
   - Kurtosis Dashboard: Run `kurtosis web` to access. From it you can see all the services running in the network, as well as their ports, status and logs.

## Troubleshooting

### E2E Network Launch doesn't work

#### Script halts unexpectedly

When running `bun cli launch` the script appears to halt after the following:

```shell
## Setting up 1 EVM.

==========================

Chain 3151908

Estimated gas price: 2.75 gwei

Estimated total gas used for script: 71556274

Estimated amount required: 0.1967797535 ETH

==========================
```

This is due to how forge streams output to stdout, but is infact still deploying contracts to the chain.
You should be able to see in blockscout the deploy script is indeed still working.

#### Errors with deploying forge scripts on kurtosis network

Try running `forge clean` to clear any spurious build artefacts, and running forge build again. Also try deploying manually to the still running kurtosis network.

#### Blockscout is empty

If you look at the browser console, if you see the following:

```browser
Content-Security-Policy: The page's settings blocked the loading of a resource (connect-src) at http://127.0.0.1:3000/node-api/proxy/api/v2/stats because it violates the following directive: "connect-src ' ...
```

this is a result of CORS and CSP errors due to running this as a local docker network.

Make sure you are connected directly to `http://127.0.0.1:3000` (not `localhost`).

Alternatively, you can try installing a browser addon such as [anti-CORS / anti-CSP](https://chromewebstore.google.com/detail/anti-cors-anti-csp/fcbmpcbjjphnaohicmhefjihollidgkp) to circumvent this problem.

#### Weird forge Errors

In the `/contracts` directory, you can try to run `forge clean` and `forge build` to see if it fixes the issue.

#### Linux: See if disabling ipV6 helps

I have found that ipV6 on Arch Linux does not play very nicely with Kurtosis networks. Disabling it completely fixed the issue for me.

#### macOS: Verify Docker networking settings

![Docker Network Settings](../resources/mac_docker.png)

If using Docker Desktop, make sure settings have permissive networking enabled.

### Polkadot-API types don't match expected runtime types

If you've made changes to the runtime types, you need to re-generate the TS types for the Polkadot-API. Don't worry, this is fully automated.

From the `./test` directory run the following command:

```bash
bun generate:types
```

This script will:

1. Compile the runtime using `cargo build --release` in the `../operator` directory.
2. Re-generate the Polkadot-API types using the newly built WASM binary.

> [!NOTE]
>
> The script uses the `--release` flag by default, meaning it uses the WASM binary from `./operator/target/release`. If you need to use a different build target, you may need to adjust the script or run the steps manually.

## Project Structure

```
test/
├── suites/                              # E2E test suites
│   ├── contracts.test.ts               # Contract deployment & configuration
│   ├── cross-chain.test.ts             # Cross-chain message passing
│   ├── datahaven-substrate.test.ts     # Block production & finality
│   ├── ethereum-basic.test.ts          # Ethereum network validation
│   ├── native-token-transfer.test.ts   # Cross-chain token transfers
│   ├── rewards-message.test.ts         # Validator rewards distribution
│   └── validator-set-update.test.ts    # Dynamic validator set updates
├── framework/                           # Test utilities & helpers
│   ├── connectors.ts                   # Network connectors
│   ├── manager.ts                      # Test environment manager
│   ├── suite.ts                        # Test suite utilities
│   └── index.ts                        # Framework exports
├── launcher/                            # Network deployment tools
│   ├── kurtosis/                       # Ethereum network launcher
│   ├── snowbridge/                     # Relayer management
│   └── datahaven/                      # DataHaven node management
├── generated/                           # Generated types
│   ├── wagmi/                          # Contract bindings
│   └── polkadot-api/                   # Runtime types
└── docs/                                # Testing documentation
    ├── E2E_TESTING_GUIDE.md
    └── E2E_FRAMEWORK_OVERVIEW.md
```

## Test Suites

- **contracts.test.ts**: Contract deployment and configuration validation
- **cross-chain.test.ts**: Cross-chain message passing between Ethereum and DataHaven
- **datahaven-substrate.test.ts**: Block production, finalization, and consensus
- **ethereum-basic.test.ts**: Ethereum network health and basic functionality
- **native-token-transfer.test.ts**: Cross-chain token transfers via Snowbridge
- **rewards-message.test.ts**: Validator reward distribution from Ethereum to DataHaven
- **validator-set-update.test.ts**: Dynamic validator registration/deregistration via EigenLayer

Run individual suites:
```bash
bun test suites/rewards-message.test.ts
bun test suites/native-token-transfer.test.ts
bun test suites/validator-set-update.test.ts
```

## Further Information

- [Kurtosis](https://docs.kurtosis.com/): Ethereum network orchestration
- [Zombienet](https://paritytech.github.io/zombienet/): Polkadot-SDK network testing
- [Bun](https://bun.sh/): TypeScript runtime and tooling
- [Foundry](https://book.getfoundry.sh/): Solidity development framework
- [Polkadot-API](https://papi.how/): Type-safe Substrate interactions
