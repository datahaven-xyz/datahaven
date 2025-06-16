import { $ } from "bun";
import invariant from "tiny-invariant";
import { killExistingContainers, logger, waitForContainerToStart } from "utils";
import { waitFor } from "utils/waits";
import { isNetworkReady, setupDataHavenValidatorConfig } from "../../cli/handlers/common/datahaven";
import type { LaunchedNetwork } from "../../cli/handlers/common/launchedNetwork";
import type { DataHavenLaunchResult, NetworkLaunchOptions } from "../types";

const LOG_LEVEL = Bun.env.LOG_LEVEL || "info";

const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--validator",
  "--discover-local",
  "--no-prometheus",
  "--unsafe-rpc-external",
  "--rpc-cors=all",
  "--force-authoring",
  "--no-telemetry",
  "--enable-offchain-indexing=true"
];

const DEFAULT_PUBLIC_WS_PORT = 9944;
const CLI_AUTHORITY_IDS = ["alice", "bob"] as const;

export class DataHavenLauncher {
  private options: NetworkLaunchOptions;
  private dockerNetworkName: string;
  private containerPrefix: string;

  constructor(options: NetworkLaunchOptions) {
    this.options = options;
    this.dockerNetworkName = `datahaven-net-${options.networkId}`;
    this.containerPrefix = `datahaven-${options.networkId}`;
  }

  async launch(launchedNetwork: LaunchedNetwork): Promise<DataHavenLaunchResult> {
    try {
      logger.info("🚀 Launching DataHaven network...");

      // Clean up any existing containers
      await this.cleanup();

      // Create Docker network
      logger.info(`⛓️‍💥 Creating Docker network: ${this.dockerNetworkName}`);
      await $`docker network create ${this.dockerNetworkName}`.quiet();

      invariant(this.options.datahavenImageTag, "❌ DataHaven image tag not defined");

      // Build local image if requested
      if (this.options.buildDatahaven) {
        await this.buildLocalImage();
      }

      // Check if image exists
      await this.checkTagExists(this.options.datahavenImageTag);

      // Launch nodes
      const wsPort = await this.getAvailablePort();
      await this.launchNodes(wsPort);

      // Wait for network to be ready
      await this.waitForNetworkReady(wsPort);

      // Register nodes in LaunchedNetwork
      await this.registerNodes(launchedNetwork, wsPort);

      // Setup validator config
      await setupDataHavenValidatorConfig(launchedNetwork, `${this.containerPrefix}-`);

      logger.success(`DataHaven network started, primary node accessible on port ${wsPort}`);

      return {
        success: true,
        wsPort,
        cleanup: () => this.cleanup()
      };
    } catch (error) {
      logger.error("Failed to launch DataHaven network", error);
      await this.cleanup();
      return {
        success: false,
        error: error as Error,
        cleanup: () => this.cleanup()
      };
    }
  }

  private async launchNodes(wsPort: number): Promise<void> {
    for (const id of CLI_AUTHORITY_IDS) {
      logger.info(`🚀 Starting ${id}...`);
      const containerName = `${this.containerPrefix}-${id}`;

      const command: string[] = [
        "docker",
        "run",
        "-d",
        "--name",
        containerName,
        "--network",
        this.dockerNetworkName,
        ...(id === "alice" ? ["-p", `${wsPort}:9944`] : []),
        this.options.datahavenImageTag!,
        `--${id}`,
        ...COMMON_LAUNCH_ARGS
      ];

      if (this.options.slotTime) {
        command.push("--slot-duration", (this.options.slotTime * 1000).toString());
      }

      await $`sh -c "${command.join(" ")}"`.quiet();
      await waitForContainerToStart(containerName);
    }
  }

  private async waitForNetworkReady(wsPort: number): Promise<void> {
    logger.info("⌛️ Waiting for DataHaven to start...");
    const timeoutMs = 2000;
    
    await waitFor({
      lambda: async () => {
        const isReady = await isNetworkReady(wsPort, timeoutMs);
        if (!isReady) {
          logger.debug("Node not ready, waiting...");
        }
        return isReady;
      },
      iterations: 30,
      delay: timeoutMs,
      errorMessage: "DataHaven network not ready"
    });
  }

  private async registerNodes(launchedNetwork: LaunchedNetwork, wsPort: number): Promise<void> {
    launchedNetwork.networkName = this.dockerNetworkName;
    
    const targetContainerName = `${this.containerPrefix}-alice`;
    launchedNetwork.addContainer(targetContainerName, { ws: wsPort });
    
    logger.info(`📝 Node ${targetContainerName} successfully registered in launchedNetwork.`);
  }

  private async buildLocalImage(): Promise<void> {
    logger.info("🐳 Building DataHaven node local Docker image...");
    
    // Import here to avoid circular dependencies
    const { cargoCrossbuild } = await import("scripts/cargo-crossbuild");
    
    await cargoCrossbuild({
      datahavenBuildExtraArgs: this.options.datahavenBuildExtraArgs
    });

    if (LOG_LEVEL === "trace") {
      await $`bun build:docker:operator`;
    } else {
      await $`bun build:docker:operator`.quiet();
    }
    
    logger.success("DataHaven node local Docker image build completed successfully");
  }

  private async checkTagExists(tag: string): Promise<void> {
    const cleaned = tag.trim();
    logger.debug(`Checking if image ${cleaned} is available locally`);
    
    const { exitCode: localExists } = await $`docker image inspect ${cleaned}`.nothrow().quiet();

    if (localExists !== 0) {
      logger.debug(`Checking if image ${cleaned} is available on docker hub`);
      const result = await $`docker manifest inspect ${cleaned}`.nothrow().quiet();
      invariant(
        result.exitCode === 0,
        `❌ Image ${tag} not found. Does this image exist? Are you logged in and have access to the repository?`
      );
    }

    logger.success(`Image ${tag} found`);
  }

  private async cleanup(): Promise<void> {
    logger.info("🧹 Cleaning up DataHaven containers and network...");

    // Stop and remove containers
    const containerIds = await $`docker ps -aq --filter "name=^${this.containerPrefix}-"`.text();
    if (containerIds.trim()) {
      await $`docker rm -f ${containerIds.trim().split('\n').join(' ')}`.quiet();
    }

    // Remove network
    await $`docker network rm -f ${this.dockerNetworkName}`.quiet().nothrow();

    logger.success("DataHaven cleanup completed");
  }

  private async getAvailablePort(): Promise<number> {
    // For test isolation, we need to find an available port dynamically
    // Start from a base port and increment until we find an available one
    const basePort = 9944;
    let port = basePort;
    
    while (port < basePort + 100) {
      const result = await $`lsof -i :${port}`.quiet().nothrow();
      if (result.exitCode !== 0) {
        // Port is available
        return port;
      }
      port++;
    }
    
    throw new Error("No available ports found in range 9944-10044");
  }
}