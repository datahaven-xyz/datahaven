#!/usr/bin/env bun
import { Command, InvalidArgumentError } from "@commander-js/extra-typings";
import type { DeployEnvironment } from "utils";
import { logger, printHeader } from "utils";
import {
  contractsCheck,
  contractsChecks,
  contractsDeploy,
  contractsPreActionHook,
  contractsUpgrade,
  contractsVerify,
  deploy,
  deployPreActionHook,
  launch,
  launchPreActionHook,
  stop,
  stopPreActionHook,
  updateAVSMetadataURI,
  versioningPostChecks,
  versioningPreChecks
} from "./handlers";

// Function to parse integer
function parseIntValue(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    throw new InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}

// Function to parse and validate DeployEnvironment
function parseDeployEnvironment(value: string): DeployEnvironment {
  if (value === "local" || value === "stagenet" || value === "testnet" || value === "mainnet") {
    return value;
  }
  throw new InvalidArgumentError(
    "Invalid environment. Must be one of 'local', 'stagenet', 'testnet', or 'mainnet'."
  );
}

// =====  Program  =====
const program = new Command()
  .version("0.2.0")
  .name("bun cli")
  .summary("🫎  DataHaven CLI: Network Toolbox")
  .usage("[options]");

// ===== Deploy ======
program
  .command("deploy")
  .addHelpText(
    "before",
    `🫎  DataHaven: Network Deployer CLI for deploying a full DataHaven network stack to a Kubernetes cluster
    It will deploy:
    - DataHaven solochain validators (all envs),
    - StorageHub components: MSP, BSP, Indexer, Fisherman nodes and databases (local & stagenet envs),
    - Kurtosis Ethereum private network (stagenet env),
    - Snowbridge Relayers (all envs)
    `
  )
  .description("Deploy a full DataHaven network stack to a Kubernetes cluster")
  .option("--e, --environment <value>", "Environment to deploy to", parseDeployEnvironment, "local")
  .option(
    "--k, --kube-namespace <value>",
    "Kubernetes namespace to deploy to. In 'stagenet' this parameter is ignored and the Kurtosis namespace is used instead. Default will be `datahaven-<environment>`."
  )
  .option(
    "--ke, --kurtosis-enclave-name <value>",
    "Name of the Kurtosis enclave",
    "datahaven-local"
  )
  .option("--st, --slot-time <number>", "Set slot time in seconds", parseIntValue, 12)
  .option("--kn, --kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("--v, --verified", "Verify smart contracts with Blockscout")
  .option("--b, --blockscout", "Enable Blockscout")
  .option(
    "--dit, --datahaven-image-tag <value>",
    "Tag of the datahaven image to use",
    "datahavenxyz/datahaven:main"
  )
  .option(
    "--el-rpc-url <value>",
    "URL of the Ethereum Execution Layer (EL) RPC endpoint to use. In local & stagenet environments (private networks), the Kurtosis Ethereum network will be used. In testnet and mainnet environments (public networks), this parameter is required."
  )
  .option(
    "--cl-endpoint <value>",
    "URL of the Ethereum Consensus Layer (CL) endpoint to use. In local & stagenet environments (private networks), the Kurtosis Ethereum network will be used. In testnet and mainnet environments (public networks), this parameter is required."
  )
  .option(
    "--rit, --relayer-image-tag <value>",
    "Tag of the relayer image to use",
    "datahavenxyz/snowbridge-relay:latest"
  )
  .option("--docker-username <value>", "Docker Hub username (use DOCKER_USERNAME env var instead)")
  .option("--docker-password <value>", "Docker Hub password (use DOCKER_PASSWORD env var instead)")
  .option("--docker-email <value>", "Docker Hub email (use DOCKER_EMAIL env var instead)")
  .option("--chainspec <value>", "Absolute path to custom chainspec file")
  .option("--skip-cleanup", "Skip cleaning up the network", false)
  .option("--skip-kurtosis", "Skip deploying Kurtosis Ethereum private network", false)
  .option("--skip-datahaven-solochain", "Skip deploying DataHaven solochain validators", false)
  .option("--skip-contracts", "Skip deploying smart contracts", false)
  .option("--skip-validator-operations", "Skip performing validator operations", false)
  .option("--skip-set-parameters", "Skip setting DataHaven runtime parameters", false)
  .option("--skip-relayers", "Skip deploying Snowbridge Relayers", false)
  .option(
    "--skip-storage-hub",
    "Skip deploying StorageHub components (MSP, BSP, Indexer, Fisherman, databases)",
    false
  )
  .hook("preAction", deployPreActionHook)
  .action(deploy);

// ===== Launch ======
program
  .command("launch")
  .addHelpText(
    "before",
    `🫎  DataHaven: Network Launcher CLI for launching a full DataHaven network.
  Complete with:
  - Solo-chain validators,
  - StorageHub components: MSP, BSP, Indexer, Fisherman nodes and databases,
  - Ethereum Private network,
  - Snowbridge Relayers
  `
  )
  .description("Launch a full E2E DataHaven & Ethereum network and more")
  .option("--A, --all", "Launch all components without prompting")
  .option("--d, --datahaven", "(Re)Launch DataHaven network")
  .option("--nd, --no-datahaven", "Skip launching DataHaven network")
  .option("--bd, --build-datahaven", "Build DataHaven node local Docker image")
  .option("--nbd, --no-build-datahaven", "Skip building DataHaven node local Docker image")
  .option("--lk, --launch-kurtosis", "Launch Kurtosis Ethereum network with EL and CL clients")
  .option("--nlk, --no-launch-kurtosis", "Skip launching Kurtosis Ethereum network")
  .option("--dc, --deploy-contracts", "Deploy smart contracts")
  .option("--ndc, --no-deploy-contracts", "Skip deploying smart contracts")
  .option("--fv, --fund-validators", "Fund validators")
  .option("--nfv, --no-fund-validators", "Skip funding validators")
  .option("--sv, --setup-validators", "Setup validators")
  .option("--nsv, --no-setup-validators", "Skip setup validators")
  .option("--uv, --update-validator-set", "Update validator set")
  .option("--nuv, --no-update-validator-set", "Skip update validator set")
  .option("--sp, --set-parameters", "Set DataHaven runtime parameters")
  .option("--nsp, --no-set-parameters", "Skip setting DataHaven runtime parameters")
  .option("--r, --relayer", "Launch Snowbridge Relayers")
  .option("--nr, --no-relayer", "Skip Snowbridge Relayers")
  .option("--sh, --storagehub", "Launch StorageHub components")
  .option("--nsh, --no-storagehub", "Skip launching StorageHub components")
  .option("--b, --blockscout", "Enable Blockscout")
  .option("--slot-time <number>", "Set slot time in seconds", parseIntValue)
  .option("--cn, --clean-network", "Always clean Kurtosis enclave and Docker containers")
  .option(
    "--ic, --inject-contracts",
    "Inject pre-deployed contracts from state-diff.json into Kurtosis network",
    true
  )
  .option(
    "--nic, --no-inject-contracts",
    "Deploy contracts instead of injecting from state-diff.json"
  )
  .option(
    "--datahaven-build-extra-args <value>",
    "Extra args for DataHaven node Cargo build (the plain command is `cargo build --release` for linux, `cargo zigbuild --target x86_64-unknown-linux-gnu --release` for mac)",
    "--features=fast-runtime"
  )
  .option(
    "--ken, --kurtosis-enclave-name <value>",
    "Name of the Kurtosis Enclave",
    "datahaven-ethereum"
  )
  .option("--kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("--verified", "Verify smart contracts with Blockscout")
  .option(
    "--dit, --datahaven-image-tag <value>",
    "Tag of the datahaven image to use",
    "datahavenxyz/datahaven:local"
  )
  .option(
    "--rit, --relayer-image-tag <value>",
    "Tag of the relayer",
    "datahavenxyz/snowbridge-relay:latest"
  )
  .hook("preAction", launchPreActionHook)
  .action(launch);

// ===== Stop ======
program
  .command("stop")
  .description("Stop any launched running network components")
  .option("--A --all", "Stop all components associated with project")
  .option("--d, --datahaven", "Stop DataHaven network")
  .option("--nd, --no-datahaven", "Skip stopping DataHaven network")
  .option("--e, --enclave", "Stop Ethereum Kurtosis enclave")
  .option("--ne, --no-enclave", "Skip stopping Ethereum Kurtosis enclave")
  .option("--kurtosis-engine", "Stop Kurtosis engine", false)
  .option("--r, --relayer", "Stop Snowbridge Relayers")
  .option("--nr, --no-relayer", "Skip stopping Snowbridge Relayers")
  .hook("preAction", stopPreActionHook)
  .action(stop);

// ===== Contracts ======
const contractsCommand = program
  .command("contracts")
  .addHelpText(
    "before",
    `🫎  DataHaven: Contracts Deployment CLI for deploying DataHaven AVS contracts to supported chains
    
    Commands:
    - status: Show deployment plan, configuration, and status (default)
    - deploy: Deploy contracts to specified chain
    - upgrade: Upgrade contracts by deploying new implementations
    - verify: Verify deployed contracts on block explorer
    - update-metadata: Update the metadata URI of an existing AVS contract
    
    Common options:
    --chain: Target chain (required: hoodi, mainnet, anvil)
    --rpc-url: Chain RPC URL (optional, defaults based on chain)
    --private-key: Private key for deployment
    --skip-verification: Skip contract verification

    Versioning:
    - Each deployments/<chain>.json carries a single version field alongside contract addresses.
    - bun cli contracts deploy performs a MINOR bump (X.Y.0) after a successful full deployment.
    - bun cli contracts upgrade performs a PATCH bump (X.Y.Z+1) after a successful upgrade.
    - The meaning of a given version is defined by the current git branch and external docs, not by the CLI.
    `
  )
  .description("Deploy and manage DataHaven AVS contracts on supported chains");

// Contracts Check (default)
contractsCommand
  .command("status")
  .description("Show deployment plan, configuration, and status")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option(
    "--private-key <value>",
    "Private key for deployment",
    process.env.DEPLOYER_PRIVATE_KEY || ""
  )
  .option("--skip-verification", "Skip contract verification", false)
  .hook("preAction", contractsPreActionHook)
  .action(contractsCheck);

// Contracts Deploy
contractsCommand
  .command("deploy")
  .description("Deploy DataHaven AVS contracts to specified chain")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option(
    "--private-key <value>",
    "Private key for deployment",
    process.env.DEPLOYER_PRIVATE_KEY || ""
  )
  .option("--avs-owner-address <value>", "Address to set as AVS owner (required for non-local)")
  .option("--avs-owner-key <value>", "Private key for the AVS owner (hex string)")
  .option(
    "--execute-owner-transactions",
    "Execute AVS owner transactions immediately (tx execution on)"
  )
  .option("--skip-verification", "Skip contract verification", false)
  .hook("preAction", contractsPreActionHook)
  .action(contractsDeploy);

// Contracts Upgrade
contractsCommand
  .command("upgrade")
  .description("Upgrade DataHaven AVS contracts by deploying new implementations")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option("--private-key-file <value>", "Path to file containing private key for deployment")
  .option("--verify", "Verify upgraded contracts on block explorer", false)
  .hook("preAction", contractsPreActionHook)
  .action(async (options: any, command: any) => {
    // Try to get chain from options or command
    let chain = options.chain;
    if (!chain && command.parent) {
      chain = command.parent.getOptionValue("chain");
    }
    if (!chain) {
      chain = command.getOptionValue("chain");
    }

    printHeader(`Upgrading DataHaven Contracts on ${chain}`);

    try {
      await versioningPreChecks({ chain, rpcUrl: options.rpcUrl });

      await contractsUpgrade({
        chain: chain,
        rpcUrl: options.rpcUrl,
        privateKeyFile: options.privateKeyFile,
        verify: options.verify
      });

      await versioningPostChecks({
        chain,
        rpcUrl: options.rpcUrl,
        updateDeps: true
      });
    } catch (error) {
      logger.error(`❌ Upgrade failed: ${error}`);
    }
  });

// Contracts Verify
contractsCommand
  .command("verify")
  .description("Verify deployed contracts on block explorer")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option("--skip-verification", "Skip contract verification", false)
  .hook("preAction", contractsPreActionHook)
  .action(contractsVerify);

// Contracts Checks
contractsCommand
  .command("version-check")
  .description("Run contract version and dependency checks")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .hook("preAction", contractsPreActionHook)
  .action(contractsChecks);

// Contracts Update Metadata
contractsCommand
  .command("update-metadata")
  .description("Update AVS metadata URI for the DataHaven Service Manager")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--uri <value>", "New metadata URI (required)")
  .option("--reset", "Use if you want to reset the metadata URI")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option("--avs-owner-key <value>", "Private key for the AVS owner (hex string)")
  .option("--execute", "Execute transaction immediately instead of emitting calldata", false)
  .action(async (options: any, command: any) => {
    // Try to get chain from options or command
    let chain = options.chain;
    if (!chain && command.parent) {
      chain = command.parent.getOptionValue("chain");
    }
    if (!chain) {
      chain = command.getOptionValue("chain");
    }
    if (!options.uri && !options.reset) {
      throw new Error("--uri parameter is required");
    }
    if (options.reset) {
      options.uri = "";
    }
    if (!chain) {
      throw new Error("--chain parameter is required");
    }
    await updateAVSMetadataURI(chain, options.uri, {
      execute: options.execute,
      avsOwnerKey: options.avsOwnerKey
    });
  });

// Default Contracts command (runs check)
contractsCommand
  .description("Show deployment plan, configuration, and status")
  .option("--chain <value>", "Target chain (hoodi, mainnet, anvil)")
  .option("--rpc-url <value>", "Chain RPC URL (optional, defaults based on chain)")
  .option(
    "--private-key <value>",
    "Private key for deployment",
    process.env.DEPLOYER_PRIVATE_KEY || ""
  )
  .option("--skip-verification", "Skip contract verification", false)
  .hook("preAction", contractsPreActionHook)
  .action(contractsCheck);

// ===== Exec ======
// Disabled until need arises
// program
//   .command("exec <action> [args]")
//   .description("Execute a standalone function against an running running network");

program.parseAsync(Bun.argv);
