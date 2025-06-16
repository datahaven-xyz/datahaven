import { $ } from "bun";
import invariant from "tiny-invariant";
import { getPortFromKurtosis, logger } from "utils";
import { 
  checkKurtosisEnclaveRunning, 
  modifyConfig, 
  runKurtosisEnclave 
} from "../../cli/handlers/common/kurtosis";
import type { LaunchedNetwork } from "../../cli/handlers/common/launchedNetwork";
import type { EthereumLaunchResult, NetworkLaunchOptions } from "../types";

export class EthereumLauncher {
  private options: NetworkLaunchOptions;
  private enclaveName: string;

  constructor(options: NetworkLaunchOptions) {
    this.options = options;
    this.enclaveName = `eth-${options.networkId}`;
  }

  async launch(launchedNetwork: LaunchedNetwork): Promise<EthereumLaunchResult> {
    try {
      logger.info("🚀 Launching Ethereum network via Kurtosis...");

      // Clean up any existing enclave
      await this.cleanup();

      // Pull Docker images if on macOS
      if (process.platform === "darwin") {
        logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
        await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.quiet();
      }

      // Run Kurtosis enclave
      await runKurtosisEnclave(
        {
          kurtosisEnclaveName: this.enclaveName,
          blockscout: this.options.blockscout,
          slotTime: this.options.slotTime,
          kurtosisNetworkArgs: this.options.kurtosisNetworkArgs
        },
        "configs/kurtosis/minimal.yaml"
      );

      // Register services and get endpoints
      const { elRpcUrl, clEndpoint } = await this.registerServices(launchedNetwork);

      logger.success("Ethereum network operations completed successfully.");

      return {
        success: true,
        elRpcUrl,
        clEndpoint,
        cleanup: () => this.cleanup()
      };
    } catch (error) {
      logger.error("Failed to launch Ethereum network", error);
      await this.cleanup();
      return {
        success: false,
        error: error as Error,
        cleanup: () => this.cleanup()
      };
    }
  }

  private async registerServices(launchedNetwork: LaunchedNetwork): Promise<{ elRpcUrl: string; clEndpoint: string }> {
    logger.info("📝 Registering Kurtosis service endpoints...");

    // Configure EL RPC URL
    const rethPublicPort = await getPortFromKurtosis("el-1-reth-lodestar", "rpc", this.enclaveName);
    invariant(rethPublicPort && rethPublicPort > 0, "❌ Could not find EL RPC port");
    
    const elRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
    launchedNetwork.elRpcUrl = elRpcUrl;
    logger.info(`📝 Execution Layer RPC URL configured: ${elRpcUrl}`);

    // Configure CL Endpoint
    const lodestarPublicPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", this.enclaveName);
    const clEndpoint = `http://127.0.0.1:${lodestarPublicPort}`;
    invariant(clEndpoint, "❌ CL Endpoint could not be determined from Kurtosis service");
    
    launchedNetwork.clEndpoint = clEndpoint;
    logger.info(`📝 Consensus Layer Endpoint configured: ${clEndpoint}`);

    return { elRpcUrl, clEndpoint };
  }

  private async cleanup(): Promise<void> {
    logger.info("🧹 Cleaning up Ethereum/Kurtosis environment...");

    // Check if enclave is running
    if (await checkKurtosisEnclaveRunning(this.enclaveName)) {
      await $`kurtosis enclave stop ${this.enclaveName}`.nothrow().quiet();
      logger.debug(`Stopped Kurtosis enclave: ${this.enclaveName}`);
    }

    // Clean Kurtosis artifacts
    await $`kurtosis clean`.nothrow().quiet();

    logger.success("Ethereum/Kurtosis cleanup completed");
  }
}