# DataHaven E2E Testing

Quick start guide for running DataHaven end-to-end tests. For comprehensive documentation, see [E2E Testing Guide](./docs/E2E_TESTING_GUIDE.md).

## Pre-requisites

- [Kurtosis](https://docs.kurtosis.com/install): For launching test networks
- [Bun](https://bun.sh/) v1.2 or higher: TypeScript runtime and package manager
- [Docker](https://www.docker.com/): For container management

##### MacOS

> [!IMPORTANT]
> If you are running this on a Mac, `zig` is a pre-requisite for crossbuilding the node. Instructions for installation can be found [here](https://ziglang.org/learn/getting-started/).

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

For more information on the E2E testing framework, see the [E2E Testing Framework Overview](./docs/E2E_FRAMEWORK_OVERVIEW.md).

## Other Common Commands

| Command                   | Description                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `bun cli stop`            | Stop all local DataHaven networks (interactive, will ask for confirmation on each component of the network) |
| `bun cli deploy`          | Deploy the DataHaven network to a remote Kubernetes cluster                                                 |
| `bun generate:wagmi`      | Generate contract TypeScript bindings for the contracts in the `contracts` directory                        |
| `bun generate:types`      | Generate Polkadot API types                                                                                 |
| `bun generate:types:fast` | Generate Polkadot API types with the `--fast-runtime` feature enabled                                       |

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

## Further Information

- [Kurtosis](https://docs.kurtosis.com/): Used for launching a full Ethereum network
- [Zombienet](https://paritytech.github.io/zombienet/): Used for launching a Polkadot-SDK based network
- [Bun](https://bun.sh/): TypeScript runtime and ecosystem tooling
