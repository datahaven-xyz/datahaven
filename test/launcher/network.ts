import { logger } from "utils";
import { createParameterCollection } from "utils/parameters";
import { LaunchedNetwork } from "../cli/handlers/common/launchedNetwork";
import { setParametersFromCollection } from "../cli/handlers/launch/parameters";
import { ContractsLauncher } from "./contracts";
import { DataHavenLauncher } from "./datahaven";
import { EthereumLauncher } from "./ethereum";
import { RelayersLauncher } from "./relayers";
import type { NetworkLaunchOptions } from "./types";
import { ValidatorsLauncher } from "./validators";

export interface NetworkConnectors {
  dhWsUrl: string;
  elRpcUrl: string;
  clEndpoint: string;
  cleanup: () => Promise<void>;
}

export class NetworkLauncher {
  private options: NetworkLaunchOptions;
  private launchedNetwork: LaunchedNetwork;
  private cleanupFunctions: Array<() => Promise<void>> = [];

  constructor(options: NetworkLaunchOptions) {
    this.options = {
      ...options,
      // Set defaults
      environment: options.environment,
      slotTime: options.slotTime || 12,
      datahavenImageTag: options.datahavenImageTag || "moonsonglabs/datahaven:local",
      relayerImageTag: options.relayerImageTag || "moonsonglabs/snowbridge-relay:latest",
      buildDatahaven: options.buildDatahaven ?? false,
      datahavenBuildExtraArgs: options.datahavenBuildExtraArgs || "--features=fast-runtime",
      verified: options.verified ?? false,
      blockscout: options.blockscout ?? false
    };

    this.launchedNetwork = new LaunchedNetwork();
  }

  async launch(): Promise<NetworkConnectors> {
    try {
      logger.info(`🚀 Launching complete network stack with ID: ${this.options.networkId}`);

      const startTime = performance.now();

      // Create parameter collection for use throughout the launch
      const parameterCollection = await createParameterCollection();

      // 1. Launch DataHaven network
      const datahavenLauncher = new DataHavenLauncher(this.options);
      const dhResult = await datahavenLauncher.launch(this.launchedNetwork);

      if (!dhResult.success) {
        throw new Error("Failed to launch DataHaven network");
      }

      if (dhResult.cleanup) {
        this.cleanupFunctions.push(dhResult.cleanup);
      }

      // 2. Launch Ethereum/Kurtosis network
      const ethereumLauncher = new EthereumLauncher(this.options);
      const ethResult = await ethereumLauncher.launch(this.launchedNetwork);

      if (!ethResult.success) {
        throw new Error("Failed to launch Ethereum network");
      }

      if (ethResult.cleanup) {
        this.cleanupFunctions.push(ethResult.cleanup);
      }

      // 3. Deploy contracts
      const contractsLauncher = new ContractsLauncher(this.options);
      let blockscoutBackendUrl: string | undefined;

      if (this.options.blockscout) {
        const { getPortFromKurtosis } = await import("utils");
        const blockscoutPort = await getPortFromKurtosis(
          "blockscout",
          "http",
          `eth-${this.options.networkId}`
        );
        blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPort}`;
      }

      if (!ethResult.elRpcUrl) {
        throw new Error("Ethereum RPC URL not available");
      }

      const contractsResult = await contractsLauncher.deploy(
        ethResult.elRpcUrl,
        parameterCollection,
        blockscoutBackendUrl
      );

      if (!contractsResult.success) {
        throw new Error("Failed to deploy contracts");
      }

      // 4. Setup validators
      const validatorsLauncher = new ValidatorsLauncher(this.options);

      // Fund validators
      const fundResult = await validatorsLauncher.fundValidators(ethResult.elRpcUrl);
      if (!fundResult.success) {
        throw new Error("Failed to fund validators");
      }

      // Setup validators in EigenLayer
      const setupResult = await validatorsLauncher.setupValidators(ethResult.elRpcUrl);
      if (!setupResult.success) {
        throw new Error("Failed to setup validators");
      }

      // 5. Set DataHaven runtime parameters
      await setParametersFromCollection({
        launchedNetwork: this.launchedNetwork,
        collection: parameterCollection,
        setParameters: true
      });

      // 6. Launch relayers
      const relayersLauncher = new RelayersLauncher(this.options);
      const relayersResult = await relayersLauncher.launch(this.launchedNetwork);

      if (!relayersResult.success) {
        throw new Error("Failed to launch relayers");
      }

      if (relayersResult.cleanup) {
        this.cleanupFunctions.push(relayersResult.cleanup);
      }

      // 7. Update validator set
      const updateResult = await validatorsLauncher.updateValidatorSet(ethResult.elRpcUrl);
      if (!updateResult.success) {
        throw new Error("Failed to update validator set");
      }

      const endTime = performance.now();
      const minutes = ((endTime - startTime) / (1000 * 60)).toFixed(1);
      logger.success(`✅ Network launched successfully in ${minutes} minutes`);

      if (!ethResult.clEndpoint) {
        throw new Error("Consensus layer endpoint not available");
      }

      // Return connectors
      return {
        dhWsUrl: `ws://127.0.0.1:${dhResult.wsPort}`,
        elRpcUrl: ethResult.elRpcUrl,
        clEndpoint: ethResult.clEndpoint,
        cleanup: () => this.cleanup()
      };
    } catch (error) {
      logger.error("Failed to launch network", error);
      await this.cleanup();
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    logger.info(`🧹 Cleaning up network with ID: ${this.options.networkId}`);

    // Execute cleanup functions in reverse order
    for (const cleanupFn of this.cleanupFunctions.reverse()) {
      try {
        await cleanupFn();
      } catch (error) {
        logger.error("Error during cleanup", error);
      }
    }

    this.cleanupFunctions = [];
    logger.success("Network cleanup completed");
  }
}
