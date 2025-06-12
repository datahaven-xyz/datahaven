export interface HarnessComponent extends AsyncDisposable {
  launch: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => Promise<boolean>;
  getStatus: () => Promise<string>;
  getLogs: () => Promise<string[]>;
  getConfig: () => Promise<Record<string, any>>;
}

// Containers methods to spin up parts of a network and connect up providers which connect to them

import { $ } from "bun";
import { type StopOptions, stopAllEnclaves, stopDockerComponents } from "cli/handlers";
import { LaunchedNetwork } from "cli/handlers/common/launchedNetwork";
import { launchDataHavenSolochain } from "cli/handlers/launch/datahaven";
import { launchKurtosis } from "cli/handlers/launch/kurtosis";
import { launchRelayers } from "cli/handlers/launch/relayer";
import type { LaunchOptions } from "cli-launch";
import invariant from "tiny-invariant";
import { getContainersMatchingImage, logger } from "utils";

/**
 * DataHaven network component wrapper
 */
class DatahavenComponent implements HarnessComponent {
  private options: Partial<LaunchOptions>;
  private launchedNetwork: LaunchedNetwork;

  constructor(launchedNetwork: LaunchedNetwork, options: Partial<LaunchOptions> = {}) {
    this.options = {
      datahaven: true,
      buildDatahaven: true,
      datahavenImageTag: "moonsonglabs/datahaven:local",
      datahavenBuildExtraArgs: "--features=fast-runtime",
      cleanNetwork: false,
      setParameters: true,
      ...options
    };
    this.launchedNetwork = launchedNetwork;
  }

  async launch(): Promise<void> {
    logger.info("🚀 Launching DataHaven network...");
    await launchDataHavenSolochain(this.options as LaunchOptions, this.launchedNetwork);
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping DataHaven network...");
    const stopOptions: StopOptions = { datahaven: true, kurtosisEngine: false };
    await stopDockerComponents("datahaven", stopOptions);
  }

  async isRunning(): Promise<boolean> {
    const containers = await getContainersMatchingImage("moonsonglabs/datahaven");
    return containers.length > 0;
  }

  async getStatus(): Promise<string> {
    if (await this.isRunning()) {
      try {
        const port = this.launchedNetwork.getPublicWsPort();
        return `DataHaven running on ws://127.0.0.1:${port}`;
      } catch {
        return "DataHaven containers running (port not available)";
      }
    }
    return "DataHaven not running";
  }

  async getLogs(): Promise<string[]> {
    const containers = await getContainersMatchingImage("moonsonglabs/datahaven");
    const logs: string[] = [];

    for (const container of containers) {
      try {
        const output = await $`docker logs ${container.Id} --tail 50`.text();
        logs.push(`[${container.Names[0]}] ${output}`);
      } catch (error) {
        logs.push(`[${container.Names[0]}] Error getting logs: ${error}`);
      }
    }

    return logs;
  }

  async getConfig(): Promise<Record<string, any>> {
    return {
      ...this.options,
      rpcUrl: this.launchedNetwork.dhRpcUrl,
      containers: this.launchedNetwork.containers.filter((c) => c.name.includes("datahaven"))
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.stop();
  }
}

/**
 * Ethereum network component wrapper (via Kurtosis)
 */
class EthereumComponent implements HarnessComponent {
  private options: Partial<LaunchOptions>;
  private launchedNetwork: LaunchedNetwork;

  constructor(launchedNetwork: LaunchedNetwork, options: Partial<LaunchOptions> = {}) {
    this.options = {
      launchKurtosis: true,
      kurtosisEnclaveName: "datahaven-ethereum",
      deployContracts: true,
      fundValidators: true,
      setupValidators: true,
      updateValidatorSet: true,
      blockscout: false,
      verified: false,
      cleanNetwork: false,
      ...options
    };
    this.launchedNetwork = launchedNetwork;
  }

  async launch(): Promise<void> {
    logger.info("🚀 Launching Ethereum network via Kurtosis...");
    await launchKurtosis(this.options as LaunchOptions, this.launchedNetwork);
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping Ethereum network...");
    const stopOptions: StopOptions = { enclave: true, kurtosisEngine: false };
    await stopAllEnclaves(stopOptions);
  }

  async isRunning(): Promise<boolean> {
    try {
      const lines = (await Array.fromAsync($`kurtosis enclave ls`.lines())).filter(
        (line) => line.length > 0 && !line.includes("UUID")
      );
      return lines.length > 0;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<string> {
    if (await this.isRunning()) {
      try {
        return `Ethereum network running - EL: ${this.launchedNetwork.elRpcUrl}, CL: ${this.launchedNetwork.clEndpoint}`;
      } catch {
        return "Ethereum network running (endpoints not available)";
      }
    }
    return "Ethereum network not running";
  }

  async getLogs(): Promise<string[]> {
    try {
      const output = await $`kurtosis enclave inspect ${this.options.kurtosisEnclaveName}`.text();
      return [output];
    } catch (error) {
      return [`Error getting Kurtosis logs: ${error}`];
    }
  }

  async getConfig(): Promise<Record<string, any>> {
    return {
      ...this.options,
      elRpcUrl: this.launchedNetwork.elRpcUrl,
      clEndpoint: this.launchedNetwork.clEndpoint,
      enclaveName: this.options.kurtosisEnclaveName
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.stop();
  }
}

/**
 * Relayer network component wrapper
 */
class RelayersComponent implements HarnessComponent {
  private options: Partial<LaunchOptions>;
  private launchedNetwork: LaunchedNetwork;

  constructor(launchedNetwork: LaunchedNetwork, options: Partial<LaunchOptions> = {}) {
    this.options = {
      relayer: true,
      relayerImageTag: "moonsonglabs/snowbridge-relayer:latest",
      ...options
    };
    this.launchedNetwork = launchedNetwork;
  }

  async launch(): Promise<void> {
    logger.info("🚀 Launching Snowbridge relayers...");
    await launchRelayers(this.options as LaunchOptions, this.launchedNetwork);
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping Snowbridge relayers...");
    const stopOptions: StopOptions = { relayer: true, kurtosisEngine: false };
    await stopDockerComponents("snowbridge", stopOptions);
  }

  async isRunning(): Promise<boolean> {
    const containers = await getContainersMatchingImage("moonsonglabs/snowbridge-relayer");
    return containers.length > 0;
  }

  async getStatus(): Promise<string> {
    const containers = await getContainersMatchingImage("moonsonglabs/snowbridge-relayer");
    const activeRelayers = this.launchedNetwork.relayers;
    return containers.length > 0
      ? `${containers.length} relayer(s) running: ${activeRelayers.join(", ")}`
      : "No relayers running";
  }

  async getLogs(): Promise<string[]> {
    const containers = await getContainersMatchingImage("moonsonglabs/snowbridge-relayer");
    const logs: string[] = [];

    for (const container of containers) {
      try {
        const output = await $`docker logs ${container.Id} --tail 50`.text();
        logs.push(`[${container.Names[0]}] ${output}`);
      } catch (error) {
        logs.push(`[${container.Names[0]}] Error getting logs: ${error}`);
      }
    }

    return logs;
  }

  async getConfig(): Promise<Record<string, any>> {
    return {
      ...this.options,
      activeRelayers: this.launchedNetwork.relayers,
      dhRpcUrl: this.launchedNetwork.dhRpcUrl,
      elRpcUrl: this.launchedNetwork.elRpcUrl
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.stop();
  }
}

export class TestHarness {
  private datahaven?: DatahavenComponent;
  private relayers?: RelayersComponent;
  private ethereum?: EthereumComponent;
  private launchedNetwork: LaunchedNetwork;

  constructor(options?: {
    datahaven?: boolean;
    ethereum?: boolean;
    relayers?: boolean;
  }) {
    const runId = crypto.randomUUID();
    this.launchedNetwork = new LaunchedNetwork(runId);
    this.datahaven = new DatahavenComponent(this.launchedNetwork, {
      datahaven: options?.datahaven ?? false,
      kurtosisEnclaveName: runId
    });
    this.ethereum = new EthereumComponent(this.launchedNetwork, {
      launchKurtosis: options?.ethereum ?? false,
      kurtosisEnclaveName: runId
    });
    this.relayers = new RelayersComponent(this.launchedNetwork, {
      relayer: options?.relayers ?? false,
      kurtosisEnclaveName: runId
    });
  }

  /**
   * Get the DataHaven component for launching/managing DataHaven solo-chain
   */
  getDatahaven(): HarnessComponent {
    invariant(this.datahaven, "❌ No datahaven found, has this been launched correctly?");
    return this.datahaven;
  }

  /**
   * Get the Relayers component for launching/managing Snowbridge relayers
   */
  getRelayers(): HarnessComponent {
    invariant(this.relayers, "❌ No relayers found, has this been launched correctly?");
    return this.relayers;
  }

  /**
   * Get the Ethereum component for launching/managing Ethereum network via Kurtosis
   */
  getEthereum(): HarnessComponent {
    invariant(this.ethereum, "❌ No ethereum found, has this been launched correctly?");
    return this.ethereum;
  }

  /**
   * Launch the entire network stack (DataHaven + Ethereum + Relayers)
   */
  async launchFullStack(): Promise<void> {
    logger.info("🚀 Launching full DataHaven network stack...");

    await this.datahaven?.launch();
    await this.ethereum?.launch();
    await this.relayers?.launch();

    logger.success("✅ Full network stack launched successfully");
  }

  /**
   * Stop the entire network stack
   */
  async stopFullStack(): Promise<void> {
    logger.info("🛑 Stopping full DataHaven network stack...");

    // Stop in reverse order: Relayers -> Ethereum -> DataHaven
    await this.relayers?.stop();
    await this.ethereum?.stop();
    await this.datahaven?.stop();

    // Clean up the launched network
    await this.launchedNetwork.cleanup();

    logger.success("✅ Full network stack stopped successfully");
  }

  /**
   * Get the overall status of all components
   */
  async getOverallStatus(): Promise<Record<string, string>> {
    return {
      datahaven: (await this.datahaven?.getStatus()) ?? "DataHaven not initialized",
      ethereum: (await this.ethereum?.getStatus()) ?? "Ethereum not initialized",
      relayers: (await this.relayers?.getStatus()) ?? "Relayers not initialized"
    };
  }

  /**
   * Check if all components are running
   */
  async isFullStackRunning(): Promise<boolean> {
    const [datahavenRunning, ethereumRunning, relayersRunning] = await Promise.all([
      this.datahaven ? this.datahaven.isRunning() : true,
      this.ethereum ? this.ethereum.isRunning() : true,
      this.relayers ? this.relayers.isRunning() : true
    ]);

    return datahavenRunning && ethereumRunning && relayersRunning;
  }

  /**
   * Get the launched network instance for advanced operations
   */
  getLaunchedNetwork(): LaunchedNetwork {
    return this.launchedNetwork;
  }

  /**
   * Get connection endpoints for providers
   */
  getConnectionEndpoints(): {
    datahavenWs: string;
    ethereumRpc: string;
    consensusLayerHttp: string;
  } {
    return {
      datahavenWs: this.launchedNetwork.dhRpcUrl,
      ethereumRpc: this.launchedNetwork.elRpcUrl,
      consensusLayerHttp: this.launchedNetwork.clEndpoint
    };
  }
}
