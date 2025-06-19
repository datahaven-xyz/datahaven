import { logger } from "utils";
import { ParameterCollection } from "utils/parameters";
import { deployContracts } from "../contracts";
import { launchDataHaven } from "../datahaven";
import { launchEthereum } from "../ethereum";
import { launchRelayers } from "../relayers";
import type { NetworkConnectors, NetworkLaunchOptions } from "../types";
import { LaunchedNetwork } from "../types/launchedNetwork";
import { launchValidators } from "../validators";

// Store cleanup functions
const cleanupFunctions: Array<() => Promise<void>> = [];

export async function launchNetwork(options: NetworkLaunchOptions): Promise<NetworkConnectors> {
  const networkId = options.networkId;
  const launchedNetwork = new LaunchedNetwork();
  launchedNetwork.networkName = networkId;

  try {
    logger.info(`🚀 Launching complete network stack with ID: ${networkId}`);
    const startTime = performance.now();

    // Create parameter collection for use throughout the launch
    const parameterCollection = new ParameterCollection();

    // 1. Launch DataHaven network
    const dhResult = await launchDataHaven(
      {
        networkId,
        datahavenImageTag: options.datahavenImageTag || "moonsonglabs/datahaven:local",
        buildDatahaven: options.buildDatahaven ?? false,
        datahavenBuildExtraArgs: options.datahavenBuildExtraArgs || "--features=fast-runtime",
        slotTime: options.slotTime || 1
      },
      launchedNetwork
    );

    if (!dhResult.success) {
      throw new Error("Failed to launch DataHaven network");
    }

    if (dhResult.cleanup) {
      cleanupFunctions.push(dhResult.cleanup);
    }

    // 2. Launch Ethereum/Kurtosis network
    const ethResult = await launchEthereum(
      {
        networkId,
        blockscout: options.blockscout,
        slotTime: options.slotTime || 1,
        kurtosisNetworkArgs: options.kurtosisNetworkArgs
      },
      launchedNetwork
    );

    if (!ethResult.success) {
      throw new Error("Failed to launch Ethereum network");
    }

    if (ethResult.cleanup) {
      cleanupFunctions.push(ethResult.cleanup);
    }

    // 3. Deploy contracts
    let blockscoutBackendUrl: string | undefined;
    if (options.blockscout) {
      blockscoutBackendUrl = await getBlockscoutUrl(networkId);
    }

    if (!launchedNetwork.elRpcUrl) {
      throw new Error("Ethereum RPC URL not available");
    }

    const contractsResult = await deployContracts({
      rpcUrl: launchedNetwork.elRpcUrl,
      verified: options.verified,
      blockscoutBackendUrl,
      parameterCollection
    });

    if (!contractsResult.success) {
      throw new Error("Failed to deploy contracts");
    }

    // 4. Setup validators
    const validatorsResult = await launchValidators({
      rpcUrl: launchedNetwork.elRpcUrl
    });

    if (!validatorsResult.success) {
      throw new Error("Failed to setup validators");
    }

    // 5. Set DataHaven runtime parameters (if needed)
    // This would be done via the CLI handler if required

    // 6. Launch relayers
    if (!options.relayerImageTag) {
      throw new Error("Relayer image tag not specified");
    }

    const relayersResult = await launchRelayers(
      {
        networkId,
        relayerImageTag: options.relayerImageTag
      },
      launchedNetwork
    );

    if (!relayersResult.success) {
      throw new Error("Failed to launch relayers");
    }

    if (relayersResult.cleanup) {
      cleanupFunctions.push(relayersResult.cleanup);
    }

    // Log success
    const endTime = performance.now();
    const minutes = ((endTime - startTime) / (1000 * 60)).toFixed(1);
    logger.success(`✅ Network launched successfully in ${minutes} minutes`);

    if (!launchedNetwork.clEndpoint) {
      throw new Error("Consensus layer endpoint not available");
    }

    // Return connectors
    const wsPort = launchedNetwork.getPublicWsPort();
    return {
      launchedNetwork,
      dataHavenWsUrl: `ws://127.0.0.1:${wsPort}`,
      dataHavenRpcUrl: `http://127.0.0.1:${wsPort}`,
      ethereumWsUrl: launchedNetwork.elRpcUrl || "",
      ethereumRpcUrl: launchedNetwork.elRpcUrl || ""
    };
  } catch (error) {
    logger.error("Failed to launch network", error);
    await cleanupNetwork();
    throw error;
  }
}

async function cleanupNetwork(): Promise<void> {
  logger.info("🧹 Cleaning up network...");

  // Execute cleanup functions in reverse order
  for (const cleanupFn of [...cleanupFunctions].reverse()) {
    try {
      await cleanupFn();
    } catch (error) {
      logger.warn("Cleanup function failed", error);
    }
  }

  // Clear the array
  cleanupFunctions.length = 0;

  logger.success("Network cleanup completed");
}

async function getBlockscoutUrl(networkId: string): Promise<string> {
  // This would fetch the Blockscout URL from Kurtosis
  // For now, returning a placeholder
  const { getPortFromKurtosis } = await import("utils");
  const blockscoutPort = await getPortFromKurtosis("blockscout", "http", `eth-${networkId}`);
  return `http://127.0.0.1:${blockscoutPort}`;
}
