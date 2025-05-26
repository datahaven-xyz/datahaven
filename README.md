# DataHaven 🫎

An EVM compatible Substrate chain, powered by StorageHub and secured by EigenLayer.

## Repo Structure

```bash
datahaven/
├── .github/ # GitHub Actions workflows.
├── contracts/ # Implementation of the DataHaven AVS (Autonomous Verifiable Service) smart contracts to interact with EigenLayer.
├── operator/ # DataHaven node based on Substrate. The "Operator" in EigenLayer terms.
├── test/ # Integration tests for the AVS and Operator.
├── resources/ # Miscellaneous resources for the DataHaven project.
└── README.md
```

## E2E CLI

This repo comes with a CLI for launching a local DataHaven network, packaged with:

1. A full Ethereum network with:
   - 2 x Execution Layer clients (e.g., reth)
   - 2 x Consensus Layer clients (e.g., lighthouse)
   - Blockscout Explorer services for EL (if enabled with --blockscout)
   - Dora Explorer service for CL
   - Contracts deployed and configured for the DataHaven network.
2. A DataHaven solochain.
3. Snowbridge relayers for cross-chain communication.

To launch the network, follow the instructions in the [test README](./test/README.md).

## Docker

This repo publishes images to [DockerHub](https://hub.docker.com/r/moonsonglabs/datahaven).

> [!TIP]
>
> If you cannot see this repo you must be added to the permission list for the private repo.

To aid with speed it employs the following:

- [sccache](https://github.com/mozilla/sccache/tree/main): De-facto caching tool to speed up rust builds.
- [cargo chef](https://lpalmieri.com/posts/fast-rust-docker-builds/): A method of caching building the dependencies as a docker layer to cut down compilation times.
- [buildx cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts): Using buildx's new feature to mount an externally restored cache into a container.
- [cache dance](https://github.com/reproducible-containers/buildkit-cache-dance): Weird workaround (endorsed by docker themselves) to inject caches into containers and return the result back to the CI.

To run a docker image locally (`moonsonglabs/datahaven:local`), from the `/test` folder run:

```sh
bun build:docker:operator
```

## Working with IDEs

### VS Code (and its forks)

IDE configurations are ignored from this repo's version control, to allow for personalisation. However, there are a few key configurations that we suggest for a better experience. Here are the key suggested configurations to add to your `.vscode/settings.json` file:

#### Rust

```json
{
  "rust-analyzer.linkedProjects": ["./operator/Cargo.toml"],
  "rust-analyzer.cargo.allTargets": true,
  "rust-analyzer.procMacro.enable": false,
  "rust-analyzer.server.extraEnv": {
    "CARGO_TARGET_DIR": "target/.rust-analyzer",
    "SKIP_WASM_BUILD": 1
  },
  "rust-analyzer.diagnostics.disabled": ["unresolved-macro-call"],
  "rust-analyzer.cargo.buildScripts.enable": false
}
```

These settings optimise Rust Analyzer for the DataHaven codebase:

- Marks the `operator/` folder as a linked project for analysis. The root of this repo is a workspace, and this is the rust project that should be analysed by `rust-analyzer`.
- Disables proc macros and build scripts to improve performance. Otherwise, Substrate's proc macros will make iterative checks from `rust-analyzer` unbearably slow.
- Sets a dedicated target directory for Rust Analyzer to avoid conflicts with other build targets like `release` builds.
- Disables WASM builds during analysis for faster feedback.

#### Solidity

For [Juan Blanco's Solidity Extension](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity), add the following to your `.vscode/settings.json` file:

```json
{
  "solidity.formatter": "forge",
  "solidity.compileUsingRemoteVersion": "v0.8.28+commit.7893614a",
  "[solidity]": {
    "editor.defaultFormatter": "JuanBlanco.solidity"
  }
}
```

These settings configure Solidity support:

- Uses Forge as the formatter for consistency with the project's tooling.
- Sets a specific Solidity version for compilation. This one should match the version used in [foundry.toml](./contracts/foundry.toml).
- Sets the Solidity extension as the default formatter.

#### Typescript

This repo uses [Biome](https://github.com/biomejs/biome) for TypeScript linting and formatting. To make the extension work nicely with this repo, add the following to your `.vscode/settings.json` file:

```json
{
  "biome.lspBin": "/{path-to-datahaven}/test/node_modules/.bin/biome",
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome",
    "editor.codeActionsOnSave": {
      "source.organizeImports.biome": "always"
    }
  }
}
```

- Sets the Biome binary to the one in the `test/` folder.
- Sets Biome as the default formatter for TypeScript.
- Sets Biome to always organise imports on save.

## CI

Using the [act](https://github.com/nektos/act) binary, you can run GitHub Actions locally.

For example, to run the entire `e2e` workflow:

```bash
act -W .github/workflows/e2e.yml -s GITHUB_TOKEN="$(gh auth token)"
```

Which results in:

```bash
INFO[0000] Using docker host 'unix:///var/run/docker.sock', and daemon socket 'unix:///var/run/docker.sock'
INFO[0000] Start server on http://192.168.1.97:34567
[E2E - Kurtosis Deploy and Verify/kurtosis] ⭐ Run Set up job
[E2E - Kurtosis Deploy and Verify/kurtosis] 🚀  Start image=catthehacker/ubuntu:rust-24.04
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker pull image=catthehacker/ubuntu:rust-24.04 platform= username= forcePull=true
[E2E - Kurtosis Deploy and Verify/kurtosis] using DockerAuthConfig authentication for docker pull
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker create image=catthehacker/ubuntu:rust-24.04 platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker run image=catthehacker/ubuntu:rust-24.04 platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Set up job
[E2E - Kurtosis Deploy and Verify/kurtosis]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
...
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Post Install Foundry [212.864597ms]
[E2E - Kurtosis Deploy and Verify/kurtosis] ⭐ Run Complete job
[E2E - Kurtosis Deploy and Verify/kurtosis] Cleaning up container for job kurtosis
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Complete job
[E2E - Kurtosis Deploy and Verify/kurtosis] 🏁  Job succeeded
```
