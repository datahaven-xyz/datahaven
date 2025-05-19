#!/usr/bin/env bun
import { Command, InvalidArgumentError } from "@commander-js/extra-typings";
import { launch, launchPreActionHook } from "./handlers";

// Function to parse integer
function parseIntValue(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    throw new InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}

// =====  Program  =====
const program = new Command()
  .version("0.2.0")
  .name("bun cli")
  .summary("🫎  DataHaven CLI: Network Toolbox")
  .usage("[options]");

// ===== Launch ======
program
  .command("launch")
  .description("Launch a full E2E DataHaven & Ethereum network and more")
  .addHelpText(
    "beforeAll",
    `🫎  DataHaven: Network Launcher CLI for launching a full DataHaven network.
  Complete with:
  - Solo-chain validators,
  - Storage providers,
  - Snowbridge Relayers
  - Ethereum Private network`
  )
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
  .option("--r, --relayer", "Launch Snowbridge Relayers")
  .option("--nr, --no-relayer", "Skip Snowbridge Relayers")
  .option("--b, --blockscout", "Enable Blockscout")
  .option("--slot-time <number>", "Set slot time in seconds", parseIntValue)
  .option(
    "--datahaven-build-extra-args <value>",
    "Extra args for DataHaven node Cargo build (the plain command is `cargo build --release` for linux, `cargo zigbuild --target x86_64-unknown-linux-gnu --release` for mac)",
    "--features=fast-runtime"
  )
  .option("--kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("--verified", "Verify smart contracts with Blockscout")
  .option("--always-clean", "Always clean Kurtosis", false)
  .option("--skip-cleaning", "Skip cleaning Kurtosis")
  .option(
    "-i, --datahaven-image-tag <value>",
    "Tag of the datahaven image to use",
    "moonsonglabs/datahaven:local"
  )
  .option(
    "-p, --relayer-image-tag <value>",
    "Tag of the relayer",
    "moonsonglabs/snowbridge-relayer:latest"
  )
  //TODO:
  // add option for specifying enclave name
  .hook("preAction", launchPreActionHook)
  .action(launch);

// ===== Stop ======
// add option for retain bd
// add option for retain relayers
// add option to kill engine too
program.command("stop").description("Stop any launched running network components");

// ===== Exec ======
// template literal union of commands to run
program
  .command("exec <action> [args]")
  .description("Execute a standalone function against an running running network");

program.parseAsync(Bun.argv);
