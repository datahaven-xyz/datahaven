import { logger } from "utils";
import { parseDeploymentsFile } from "utils/contracts";
import { getDependencyVersions } from "utils/dependencyVersions";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const main = async () => {
  const argv = await yargs(hideBin(process.argv))
    .option("chain", {
      type: "string",
      description: "Target chain (hoodi, mainnet, anvil)",
      default: "anvil"
    })
    .strict(false)
    .parse();

  const chain = (argv.chain as string) || "anvil";

  logger.info(`🔍 Checking dependency versions for chain '${chain}'`);

  const deployments = await parseDeploymentsFile(chain);
  const deps = (deployments as any).deps as {
    eigenlayer?: { release?: string; gitCommit?: string };
    snowbridge?: { release?: string; gitCommit?: string };
  };

  if (!deps?.eigenlayer || !deps?.snowbridge) {
    logger.error(
      `❌ Missing 'deps.eigenlayer' or 'deps.snowbridge' in contracts/deployments/${chain}.json`
    );
    process.exit(1);
  }

  const current = await getDependencyVersions();

  let ok = true;

  if (!deps.eigenlayer.gitConfirm || deps.eigenlayer.gitCommit !== current.eigenlayer.gitCommit) {
    logger.error(
      `❌ eigenlayer gitCommit mismatch for '${chain}': deployments=${deps.eigenlayer.gitCommit ?? "(missing)"} current=${current.eigenlayer.gitCommit}`
    );
    ok = false;
  }

  if (!deps.snowbridge.gitCommit || deps.snowbridge.gitCommit !== current.snowbridge.gitCommit) {
    logger.error(
      `❌ snowbridge gitCommit mismatch for '${chain}': deployments=${deps.snowbridge.gitCommit ?? "(missing)"} current=${current.snowbridge.gitCommit}`
    );
    ok = false;
  }

  if (!ok) {
    process.exit(1);
  }

  logger.info(
    `✅ Dependency versions match for '${chain}': eigenlayer=${current.eigenlayer.release ?? current.eigenlayer.gitCommit}, snowbridge=${current.snowbridge.release ?? current.snowbridge.gitCommit}`
  );
};

main().catch((error) => {
  logger.error(`❌ Dependency version check failed with unexpected error: ${error}`);
  process.exit(1);
});


