import { writeFileSync } from "node:fs";
import path from "node:path";
import { logger } from "utils";
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

  logger.info(`🔄 Refreshing dependency metadata for chain '${chain}'`);

  try {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const deploymentPath = path.join(repoRoot, "contracts", "deployments", `${chain}.json`);

    const raw = await Bun.file(deploymentPath).text();
    const deploymentsJson = JSON.parse(raw) as {
      deps?: { eigenlayer?: any; snowbridge?: any };
      version?: string;
    };

    const deps = await getDependencyVersions();

    deploymentsJson.deps = {
      ...(deploymentsJson.deps ?? {}),
      eigenlayer: {
        ...(deploymentsJson.deps?.eigenlayer ?? {}),
        ...deps.eigenlayer
      },
      snowbridge: {
        ...(deploymentsJson.deps?.snowbridge ?? {}),
        ...deps.snowbridge
      }
    };

    writeFileSync(deploymentPath, JSON.stringify(deploymentsJson, null, 2));

    logger.info(
      `📝 Updated dependency versions for ${chain}: eigenlayer=${deps.eigenlayer.release ?? deps.eigenlayer.gitCommit}, snowbridge=${deps.snowbridge.release ?? deps.snowbridge.gitCommit}`
    );
  } catch (error) {
    logger.error(`❌ Failed to refresh dependency metadata for ${chain}: ${error}`);
    process.exit(1);
  }
};

main().catch((error) => {
  logger.error(`❌ Dependency metadata refresh failed with unexpected error: ${error}`);
  process.exit(1);
});
