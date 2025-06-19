# End-to-End Test Environment

## Contents

```sh
.
├── README.md
├── configs                 # Configurations for test networks
├── scripts                 # Helper scripts for interacting with the network
├── launcher                # Shared network launching infrastructure
├── framework               # E2E testing framework core
├── suites                  # E2E test suites
└── docs                    # Documentation
    ├── E2E_TESTING.md                  # Testing framework overview
    ├── E2E_FRAMEWORK_ARCHITECTURE.md   # Detailed architecture guide
    ├── E2E_SETUP_GUIDE.md             # Setup and troubleshooting
    └── E2E_QUICK_REFERENCE.md         # Quick reference guide
```

## E2E Testing Framework

This project includes a comprehensive E2E testing framework that allows running isolated test suites with complete network stacks. For details, see:

- **[E2E Testing Overview](./E2E_TESTING.md)** - Introduction to the testing framework
- **[Setup Guide](./docs/E2E_SETUP_GUIDE.md)** - Detailed setup instructions
- **[Architecture](./docs/E2E_FRAMEWORK_ARCHITECTURE.md)** - Framework design and implementation
- **[Quick Reference](./docs/E2E_QUICK_REFERENCE.md)** - Common patterns and commands

## Pre-requisites

- [Kurtosis](https://docs.kurtosis.com/install): For launching test networks
- [Bun](https://bun.sh/) v1.2 or higher: TypeScript runtime and package manager
- [Docker](https://www.docker.com/): For container management

##### MacOS

> [!IMPORTANT]
> If you are running this on a Mac, `zig` is a pre-requisite for crossbuilding the node. Instructions for installation can be found [here](https://ziglang.org/learn/getting-started/).

## QuickStart

Run:

```bash
bun i
bun cli
```

## Manual Deployment

Follow these steps to set up and interact with your test environment:

1. **Deploy a minimal test environment**

   ```bash
   bun cli
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
   6. Launch Snowbridge relayers.

   > [!NOTE]
   >
   > If you want to also have the contracts verified on blockscout, you can run `bun start:e2e:verified` instead. This will do all the previous steps, but also verify the contracts on blockscout. However, note that this takes some time to complete.

2. **Explore the network**

   - Block Explorer: [http://127.0.0.1:3000](http://127.0.0.1:3000).
   - Kurtosis Dashboard: Run `kurtosis web` to access. From it you can see all the services running in the network, as well as their ports, status and logs.

## Network Management

- **Stop the test environment**

  ```bash
  bun stop:e2e
  ```

- **Stop the Kurtosis engine completely**

  ```bash
  bun stop:kurtosis-engine
  ```

## Blockscout

Can be accessed at: [http://127.0.0.1:3000](http://127.0.0.1:3000).

You can also access the backend via REST API, documented here: [http://127.0.0.1:3000/api-docs](http://127.0.0.1:3000/api-docs)

![API DOCS](../resources/swagger.png)

## Testing

### E2E Tests

The test suite in the `suites` folder includes both unit tests and full E2E integration tests.

**Run all tests:**

```bash
bun test:e2e  # Runs all tests with 15-minute timeout
```

**Run specific test:**

```bash
bun test suites/ethereum-basic.test.ts --timeout 900000
```

> [!NOTE]
>
> - E2E tests launch their own isolated network stacks including:
>   - DataHaven nodes (Alice and Bob validators)
>   - Ethereum network via Kurtosis
>   - Smart contract deployments
>   - Validator setup in EigenLayer
>   - Cross-chain relayers (if needed)
> - First run may take 10-15 minutes due to full network setup
> - Each test suite gets its own isolated network to ensure test independence
> - You can increase the logging level by setting `LOG_LEVEL=debug`
> - No need to run `bun cli` first - tests manage their own networks

### Wagmi Bindings Generation

To ensure contract bindings are up-to-date, run the following command after modifying smart contracts or updating ABIs:

```bash
bun generate:wagmi
```

This command generates TypeScript bindings for interacting with the deployed smart contracts using Wagmi.

## Troubleshooting

### E2E Network Launch doesn't work

#### Script halts unexpectedly

When running `bun cli` the script appears to halt after the following:

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

## Further Information

- [Kurtosis](https://docs.kurtosis.com/): Used for launching a full Ethereum network
- [Zombienet](https://paritytech.github.io/zombienet/): Used for launching a Polkadot-SDK based network
- [Bun](https://bun.sh/): TypeScript runtime and ecosystem tooling
