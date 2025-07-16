#!/usr/bin/env bun
import { Command, InvalidArgumentError } from "@commander-js/extra-typings";
import type { DeployEnvironment } from "utils";
import {
  deploy,
  deployPreActionHook,
  launch,
  launchPreActionHook,
  stop,
  stopPreActionHook
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
    - Storage providers (all envs) (TODO),
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
    "moonsonglabs/datahaven:main"
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
    "moonsonglabs/snowbridge-relay:latest"
  )
  .option("--docker-username <value>", "Docker Hub username")
  .option("--docker-password <value>", "Docker Hub password")
  .option("--docker-email <value>", "Docker Hub email")
  .option("--skip-cleanup", "Skip cleaning up the network", false)
  .option("--skip-kurtosis", "Skip deploying Kurtosis Ethereum private network", false)
  .option("--skip-datahaven-solochain", "Skip deploying DataHaven solochain validators", false)
  .option("--skip-contracts", "Skip deploying smart contracts", false)
  .option("--skip-validator-operations", "Skip performing validator operations", false)
  .option("--skip-set-parameters", "Skip setting DataHaven runtime parameters", false)
  .option("--skip-relayers", "Skip deploying Snowbridge Relayers", false)
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
  - Storage providers (TODO),
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
  .option("--m, --monitoring", "Launch monitoring stack (Loki, Grafana)")
  .option("--nm, --no-monitoring", "Skip monitoring stack")
  .option("--grafana-port <number>", "Set Grafana port", parseIntValue, 3000)
  .option("--b, --blockscout", "Enable Blockscout")
  .option("--slot-time <number>", "Set slot time in seconds", parseIntValue)
  .option("--cn, --clean-network", "Always clean Kurtosis enclave and Docker containers")
  .option(
    "--datahaven-build-extra-args <value>",
    "Extra args for DataHaven node Cargo build (the plain command is `cargo build --release` for linux, `cargo zigbuild --target x86_64-unknown-linux-gnu --release` for mac)",
    "--features=fast-runtime"
  )
  .option(
    "--e --kurtosis-enclave-name <value>",
    "Name of the Kurtosis Enclave",
    "datahaven-ethereum"
  )
  .option("--kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("--verified", "Verify smart contracts with Blockscout")
  .option(
    "--dit, --datahaven-image-tag <value>",
    "Tag of the datahaven image to use",
    "moonsonglabs/datahaven:local"
  )
  .option(
    "--rit, --relayer-image-tag <value>",
    "Tag of the relayer",
    "moonsonglabs/snowbridge-relay:latest"
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
  .option("--m, --monitoring", "Stop monitoring stack")
  .option("--nm, --no-monitoring", "Skip stopping monitoring stack")
  .hook("preAction", stopPreActionHook)
  .action(stop);

// ===== Exec ======
// Disabled until need arises
// program
//   .command("exec <action> [args]")
//   .description("Execute a standalone function against an running running network");

program.parseAsync(Bun.argv);
