import { Command } from "@commander-js/extra-typings";
import { logger } from "utils";

const program = new Command()
  .option("-v, --verified", "Verify smart contracts with Blockscout", false)
  .option("-l, --launch-kurtosis", "Launch Kurtosis", true)
  .option("-d, --deploy-contracts", "Deploy smart contracts", false)
  // TODO: Make some of these options depedent on others e.g. blockscout and validators
  .option("-f, --fund-validators", "Fund validators", true)
  .option("-s, --setup-validators", "Setup validators", true)
  .option("-u, --update-validator-set", "Update validator set", true)
  .option("-b, --blockscout", "Enable Blockscout", false)
  .option("-r, --relayer", "Enable Relayer", true);

async function main() {
  const options = program.parse(Bun.argv);

  logger.debug("Running with options:");
  logger.debug(options);
}

interface ScriptOptions {
  verified?: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  blockscout?: boolean;
  relayer?: boolean;
  help?: boolean;
}

main();
