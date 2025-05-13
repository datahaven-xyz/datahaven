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
  .option("--datahaven", "Enable Datahaven network to be launched")
  .option("-l, --launch-kurtosis", "Launch Kurtosis")
  .option("-d, --deploy-contracts", "Deploy smart contracts")
  .option("-f, --fund-validators", "Fund validators")
  .option("-n, --no-fund-validators", "Skip funding validators")
  .option("-s, --setup-validators", "Setup validators")
  .option("--no-setup-validators", "Skip setup validators")
  .option("-u, --update-validator-set", "Update validator set")
  .option("--no-update-validator-set", "Skip update validator set")
  .option("-b, --blockscout", "Enable Blockscout")
  .option("--slot-time <number>", "Set slot time in seconds", parseIntValue)
  .option("--kurtosis-network-args <value>", "CustomKurtosis network args")
  .option("-v, --verified", "Verify smart contracts with Blockscout")
  .option("--always-clean", "Always clean Kurtosis", false)
  .option("-q, --skip-cleaning", "Skip cleaning Kurtosis")
  .option("-r, --relayer", "Enable Relayer")
  .option(
    "-i, --datahaven-image-tag <value>",
    "Tag of the datahaven image to use",
    "moonsonglabs/datahaven:local"
  )
  .option(
    "-p, --relayer-bin-path <value>",
    "Path to the relayer binary",
    "tmp/bin/snowbridge-relay"
  )
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
