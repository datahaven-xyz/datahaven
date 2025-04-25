#!/usr/bin/env bun
import { Command } from "@commander-js/extra-typings";
import { launch, launchPreActionHook } from "./handlers";

// So far we only have the launch command
// we can expand this to more commands in the future
const program = new Command()
  .option("-l, --launch-kurtosis", "Launch Kurtosis")
  .option("-d, --deploy-contracts", "Deploy smart contracts")
  .option("-f, --fund-validators", "Fund validators")
  .option("-s, --setup-validators", "Setup validators")
  .option("-u, --update-validator-set", "Update validator set")
  .option("-b, --blockscout", "Enable Blockscout")
  .option("-v, --verified", "Verify smart contracts with Blockscout")
  .option("-r, --relayer", "Enable Relayer")
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
