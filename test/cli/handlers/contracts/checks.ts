import { logger, printDivider, printHeader } from "utils";
import { checkContractVersions, validateVersionFormats } from "utils/contracts/versioning";

type ContractsFlightOptions = {
  chain: string;
  rpcUrl?: string;
};

export const versioningPreChecks = async ({ chain, rpcUrl }: ContractsFlightOptions) => {
  logger.info("🧪 Running contracts version checks...");

  const contractResult = await checkContractVersions(chain, rpcUrl);
  if (contractResult.skipped) {
    logger.warn("⚠️ On-chain contract version checks were skipped due to unavailable infra.");
    return;
  }

  if (!contractResult.ok) {
    throw new Error(`Contract version check failed for chain '${chain}'`);
  }
};

export const versioningPostChecks = async ({ chain, rpcUrl }: ContractsFlightOptions) => {
  logger.info("🧪 Running contracts version checks after changes...");

  const contractResult = await checkContractVersions(chain, rpcUrl);
  if (contractResult.skipped) {
    logger.warn("⚠️ On-chain contract version checks were skipped due to unavailable infra.");
    return;
  }

  if (!contractResult.ok) {
    throw new Error(`Contract version check failed for chain '${chain}'`);
  }
};

export const contractsChecks = async (options: any, command: any) => {
  let chain = options.chain;
  if (!chain && command.parent) {
    chain = command.parent.getOptionValue("chain");
  }
  if (!chain) {
    chain = command.getOptionValue("chain");
  }

  printHeader(`Contracts Checks on ${chain}`);

  try {
    // Validate version formats
    logger.info("🔍 Validating version formats...");
    const formatOk = await validateVersionFormats();
    if (!formatOk) {
      throw new Error("Version format validation failed");
    }

    // Run existing version checks
    await versioningPreChecks({ chain, rpcUrl: options.rpcUrl });
    printDivider();
    logger.success("Contract checks passed");
  } catch (error) {
    logger.error(`❌ Contract checks failed: ${error}`);
    process.exit(1);
  }
};
