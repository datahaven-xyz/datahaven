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

// So far we only have the launch command
// we can expand this to more commands in the future
const program = new Command()
  .option("--d, --datahaven", "(Re)Launch Datahaven network")
  .option("--nd, --no-datahaven", "Skip launching Datahaven network")
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
  .option("--kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("--verified", "Verify smart contracts with Blockscout")
  .option("--always-clean", "Always clean Kurtosis", false)
  .option("--skip-cleaning", "Skip cleaning Kurtosis")
  .option(
    "--datahaven-bin-path <value>",
    "Path to the datahaven binary",
    "../operator/target/release/datahaven-node"
  )
  .option("--relayer-bin-path <value>", "Path to the relayer binary", "tmp/bin/snowbridge-relay")
  .hook("preAction", launchPreActionHook)
  .action(launch);

// =====  Program  =====
program
  .version("0.1.0")
  .name("bun cli")
  .summary("🫎  Datahaven: Network Launcher CLI")
  .usage("[options]")
  .description(`🫎  Datahaven: Network Launcher CLI for launching a full Datahaven network.
    Complete with:
    - Solo-chain validators,
    - Storage providers,
    - Snowbridge Relayers
    - Ethereum Private network`);

program.parseAsync(Bun.argv);
