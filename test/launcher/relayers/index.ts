import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  getPortFromKurtosis,
  killExistingContainers,
  logger,
  parseDeploymentsFile,
  runShellCommandWithLogger,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForContainerToStart
} from "utils";
import { waitFor } from "utils/waits";
import { ZERO_HASH } from "../../cli/handlers/common/consts";
import { generateRelayerConfig, initEthClientPallet, type RelayerSpec } from "../../cli/handlers/common/relayer";
import type { LaunchedNetwork } from "../../cli/handlers/common/launchedNetwork";
import type { NetworkLaunchOptions, RelayersLaunchResult } from "../types";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";

const RELAYER_CONFIG_DIR = "tmp/configs";

export class RelayersLauncher {
  private options: NetworkLaunchOptions;
  private configPaths: Record<string, string>;
  private containerPrefix: string;

  constructor(options: NetworkLaunchOptions) {
    this.options = options;
    this.containerPrefix = `snowbridge-${options.networkId}`;
    
    // Create unique config paths for this network
    const configDir = path.join(RELAYER_CONFIG_DIR, options.networkId);
    this.configPaths = {
      BEACON: path.join(configDir, "beacon-relay.json"),
      BEEFY: path.join(configDir, "beefy-relay.json"),
      EXECUTION: path.join(configDir, "execution-relay.json"),
      SOLOCHAIN: path.join(configDir, "solochain-relay.json")
    };
  }

  async launch(launchedNetwork: LaunchedNetwork): Promise<RelayersLaunchResult> {
    try {
      logger.info("🚀 Launching Snowbridge relayers...");

      // Get DataHaven node port
      const dhNodes = launchedNetwork.containers.filter((container) =>
        container.name.includes("datahaven")
      );
      
      let substrateWsPort: number;
      let substrateNodeId: string;

      if (dhNodes.length === 0) {
        logger.warn("⚠️ No DataHaven nodes found. Assuming default port 9944.");
        substrateWsPort = 9944;
        substrateNodeId = "default";
      } else {
        const firstDhNode = dhNodes[0];
        substrateWsPort = firstDhNode.publicPorts.ws;
        substrateNodeId = firstDhNode.name;
      }

      invariant(this.options.relayerImageTag, "❌ relayerImageTag is required");
      
      // Clean up existing containers
      await this.cleanup();

      // Check if BEEFY is ready
      await this.waitBeefyReady(launchedNetwork, 2000, 60000);

      // Get contract addresses
      const anvilDeployments = await parseDeploymentsFile();
      const beefyClientAddress = anvilDeployments.BeefyClient;
      const gatewayAddress = anvilDeployments.Gateway;
      invariant(beefyClientAddress, "❌ BeefyClient address not found");
      invariant(gatewayAddress, "❌ Gateway address not found");

      // Create config directory
      const configDir = path.join(RELAYER_CONFIG_DIR, this.options.networkId);
      await $`mkdir -p ${configDir}`.quiet();

      // Create datastore directory
      const datastorePath = path.join("tmp/datastore", this.options.networkId);
      await $`mkdir -p ${datastorePath}`.quiet();

      // Get Ethereum endpoints
      const enclaveName = `eth-${this.options.networkId}`;
      const ethWsPort = await getPortFromKurtosis("el-1-reth-lodestar", "ws", enclaveName);
      const ethHttpPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", enclaveName);

      const ethElRpcEndpoint = `ws://host.docker.internal:${ethWsPort}`;
      const ethClEndpoint = `http://host.docker.internal:${ethHttpPort}`;
      const substrateWsEndpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

      // Define relayers
      const relayers = this.defineRelayers(
        ethElRpcEndpoint,
        ethClEndpoint,
        substrateWsEndpoint,
        beefyClientAddress,
        gatewayAddress
      );

      // Generate configs
      for (const relayer of relayers) {
        await generateRelayerConfig(relayer, "local", configDir);
      }

      // Initialize EthClient pallet
      await initEthClientPallet(
        path.resolve(this.configPaths.BEACON),
        this.options.relayerImageTag,
        datastorePath,
        launchedNetwork
      );

      // Launch relayers
      const activeRelayers = await this.launchRelayerContainers(relayers, datastorePath, launchedNetwork);

      logger.success("Snowbridge relayers launched successfully");

      return {
        success: true,
        activeRelayers: activeRelayers.map(r => r.config.type),
        cleanup: () => this.cleanup()
      };
    } catch (error) {
      logger.error("Failed to launch relayers", error);
      await this.cleanup();
      return {
        success: false,
        error: error as Error,
        cleanup: () => this.cleanup()
      };
    }
  }

  private defineRelayers(
    ethElRpcEndpoint: string,
    ethClEndpoint: string,
    substrateWsEndpoint: string,
    beefyClientAddress: string,
    gatewayAddress: string
  ): RelayerSpec[] {
    return [
      {
        name: `${this.containerPrefix}-🥩`,
        configFilePath: this.configPaths.BEEFY,
        config: {
          type: "beefy",
          ethElRpcEndpoint,
          substrateWsEndpoint,
          beefyClientAddress,
          gatewayAddress
        },
        pk: {
          ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey
        }
      },
      {
        name: `${this.containerPrefix}-🥓`,
        configFilePath: this.configPaths.BEACON,
        config: {
          type: "beacon",
          ethClEndpoint,
          substrateWsEndpoint
        },
        pk: {
          substrate: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.privateKey
        }
      },
      {
        name: `${this.containerPrefix}-⛓️`,
        configFilePath: this.configPaths.SOLOCHAIN,
        config: {
          type: "solochain",
          ethElRpcEndpoint,
          substrateWsEndpoint,
          beefyClientAddress,
          gatewayAddress,
          ethClEndpoint
        },
        pk: {
          ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey,
          substrate: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.privateKey
        }
      },
      {
        name: `${this.containerPrefix}-⚙️`,
        configFilePath: this.configPaths.EXECUTION,
        config: {
          type: "execution",
          ethElRpcEndpoint,
          ethClEndpoint,
          substrateWsEndpoint,
          gatewayAddress
        },
        pk: {
          substrate: SUBSTRATE_FUNDED_ACCOUNTS.DOROTHY.privateKey
        }
      }
    ];
  }

  private async launchRelayerContainers(
    relayers: RelayerSpec[],
    datastorePath: string,
    launchedNetwork: LaunchedNetwork
  ): Promise<RelayerSpec[]> {
    const isLocal = this.options.relayerImageTag!.endsWith(":local");
    
    for (const relayer of relayers) {
      const containerName = `${this.containerPrefix}-${relayer.config.type}-relay`;
      
      if (!isLocal) {
        await $`docker pull ${this.options.relayerImageTag}`.quiet();
      }

      const configAbsPath = path.resolve(relayer.configFilePath);
      const command = [
        "docker", "run", "-d",
        "--name", containerName,
        "--network", launchedNetwork.networkName,
        "--add-host", "host.docker.internal:host-gateway",
        "-v", `${configAbsPath}:/config/config.json`,
        "-v", `${path.resolve(datastorePath)}:/data/`,
        this.options.relayerImageTag!,
        "run", "--", "--config", "/config/config.json"
      ];

      if (relayer.pk?.ethereum) {
        command.push("--ethereum.private-key", relayer.pk.ethereum);
      }
      if (relayer.pk?.substrate) {
        command.push("--substrate.private-key", relayer.pk.substrate);
      }

      await runShellCommandWithLogger(command.join(" "));
      await waitForContainerToStart(containerName);
    }

    return relayers;
  }

  private async waitBeefyReady(launchedNetwork: LaunchedNetwork, intervalMs: number, timeoutMs: number): Promise<void> {
    logger.info("⏳ Waiting for BEEFY to be ready...");
    
    const dhWsPort = launchedNetwork.getPublicWsPort();
    const client: PolkadotClient = createClient(
      withPolkadotSdkCompat(getWsProvider(`ws://127.0.0.1:${dhWsPort}`))
    );

    await waitFor({
      lambda: async () => {
        const latestBeefyBlockHash = await client.runtimeCall("BeefyApi", "validator_set");
        return latestBeefyBlockHash !== ZERO_HASH;
      },
      iterations: Math.floor(timeoutMs / intervalMs),
      delay: intervalMs,
      errorMessage: "BEEFY not ready"
    });

    client.destroy();
    logger.success("BEEFY is ready");
  }

  private async cleanup(): Promise<void> {
    logger.info("🧹 Cleaning up relayer containers...");

    // Stop and remove containers
    const containerIds = await $`docker ps -aq --filter "name=^${this.containerPrefix}-"`.text();
    if (containerIds.trim()) {
      await $`docker rm -f ${containerIds.trim().split('\n').join(' ')}`.quiet();
    }

    logger.success("Relayers cleanup completed");
  }
}