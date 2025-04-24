#!/usr/bin/env bun
import { Command } from "@commander-js/extra-typings";
import { launch, launchPreActionHook } from "./handlers";

// So far we only have the launch command
// we can expand this to more commands in the future
const program = new Command()
  .option("-l, --launch-kurtosis", "Launch Kurtosis", true)
  .option("-d, --deploy-contracts", "Deploy smart contracts", false)
  .option("-f, --fund-validators", "Fund validators", true)
  .option("-s, --setup-validators", "Setup validators", true)
  .option("-u, --update-validator-set", "Update validator set", true)
  .option("-b, --blockscout", "Enable Blockscout", false)
  .option("-v, --verified", "Verify smart contracts with Blockscout", false)
  .option("-r, --relayer", "Enable Relayer", false)
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
