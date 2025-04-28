#!/usr/bin/env bun
import { Command } from "@commander-js/extra-typings";
import { launch, launchPreActionHook } from "./handlers";

// So far we only have the launch command
// we can expand this to more commands in the future
const program = new Command()
  .option("-l, --launch-kurtosis", "Launch Kurtosis")
  .option("-d, --deploy-contracts", "Deploy smart contracts")
  .option("-f, --fund-validators", "Fund validators")
  .option("-n, --no-fund-validators", "Skip funding validators")
  .option("-s, --setup-validators", "Setup validators")
  .option("--no-setup-validators", "Skip setup validators")
  .option("-u, --update-validator-set", "Update validator set")
  .option("--no-update-validator-set", "Skip update validator set")
  .option("-b, --blockscout", "Enable Blockscout")
  // TODO: Add datahaven network launch options
  .option("-v, --verified", "Verify smart contracts with Blockscout")
  .option("-q, --skip-cleaning", "Skip cleaning Kurtosis")
  .option("-r, --relayer", "Enable Relayer")
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
