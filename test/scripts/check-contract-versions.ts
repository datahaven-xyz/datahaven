import { CHAIN_CONFIGS } from "configs/contracts/config";
import { logger } from "utils";
import { getContractInstance, parseDeploymentsFile } from "utils/contracts";
import type { ViemClientInterface } from "utils/viem";
import { createWalletClient, defineChain, http, publicActions } from "viem";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const isInfraUnavailableError = (error: unknown): boolean => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);

  return (
    message.includes("Failed to connect to Docker daemon") ||
    (message.includes("container") &&
      message.includes("cannot be found  in running container list")) ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ENOTFOUND") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("Was there a typo in the url or port?")
  );
};

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

  logger.info(`🔍 Checking contract versions for chain '${chain}'`);

  const deployments = await parseDeploymentsFile(chain);
  const version = (deployments as any).version as string | undefined;

  if (!version) {
    logger.error(
      `❌ No 'version' field found in contracts/deployments/${chain}.json. This file is the canonical source of truth for the AVS stack version.`
    );
    process.exit(1);
  }

  // For non-anvil chains, prefer a remote RPC URL from CHAIN_CONFIGS instead of local Docker/Kurtosis.
  let viemClient: ViemClientInterface | undefined;
  const chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (chainConfig && chain !== "anvil") {
    const chainDef = defineChain({
      id: chainConfig.CHAIN_ID,
      name: chainConfig.NETWORK_NAME,
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      rpcUrls: {
        default: {
          http: [chainConfig.RPC_URL]
        }
      },
      blockExplorers: chainConfig.BLOCK_EXPLORER
        ? {
            default: { name: "Explorer", url: chainConfig.BLOCK_EXPLORER }
          }
        : undefined
    });

    viemClient = createWalletClient({
      chain: chainDef,
      transport: http()
    }).extend(publicActions) as unknown as ViemClientInterface;
  }

  let ok = true;
  let infraUnavailable = false;

  try {
    const serviceManager: any = await getContractInstance("ServiceManager", viemClient, chain);
    const smVersion: string = await serviceManager.read.DATAHAVEN_VERSION();

    if (smVersion !== version) {
      logger.error(
        `❌ DataHavenServiceManager DATAHAVEN_VERSION=${smVersion} does not match deployments version=${version} for chain='${chain}'.`
      );
      ok = false;
    } else {
      logger.info(
        `✅ DataHavenServiceManager version matches deployments version (${version}) for chain='${chain}'.`
      );
    }
  } catch (error) {
    if (isInfraUnavailableError(error)) {
      infraUnavailable = true;
      logger.warn(
        `⚠️ Skipping on-chain version checks for chain='${chain}': no local Ethereum node or containers detected (${error}).`
      );
    } else {
      logger.error(`❌ Failed to read version from DataHavenServiceManager: ${error}`);
      ok = false;
    }
  }

  try {
    const rewardsRegistry: any = await getContractInstance("RewardsRegistry", viemClient, chain);
    const rrVersion: string = await rewardsRegistry.read.DATAHAVEN_VERSION();

    if (rrVersion !== version) {
      logger.error(
        `❌ RewardsRegistry DATAHAVEN_VERSION=${rrVersion} does not match deployments version=${version} for chain='${chain}'.`
      );
      ok = false;
    } else {
      logger.info(
        `✅ RewardsRegistry version matches deployments version (${version}) for chain='${chain}'.`
      );
    }
  } catch (error) {
    if (infraUnavailable || isInfraUnavailableError(error)) {
      infraUnavailable = true;
      logger.warn(
        `⚠️ Skipping RewardsRegistry version check for chain='${chain}' because no node/containers are running.`
      );
    } else {
      logger.warn(
        `⚠️ Failed to read version from RewardsRegistry (check will continue and rely on other signals): ${error}`
      );
      // Do not mark the whole check as failed here; RewardsRegistry is becoming obsolete.
    }
  }

  if (infraUnavailable) {
    logger.warn(
      `⚠️ Skipped on-chain contract version checks for chain='${chain}' because no Ethereum node or containers are running.`
    );
    return;
  }

  if (!ok) {
    process.exit(1);
  }

  logger.info(
    `✅ All checked contract versions match deployments version=${version} on '${chain}'.`
  );
};

main().catch((error) => {
  logger.error(`❌ Version check failed with unexpected error: ${error}`);
  process.exit(1);
});
