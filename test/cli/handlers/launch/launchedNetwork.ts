import fs from "node:fs";
import invariant from "tiny-invariant";
import { logger, type RelayerType } from "utils";

type PipeOptions = number | "inherit" | "pipe" | "ignore";
type BunProcess = Bun.Subprocess<PipeOptions, PipeOptions, PipeOptions>;
type ContainerSpec = { name: string; publicPorts: Record<string, number> };

/**
 * Represents the state and associated resources of a launched network environment,
 * including DataHaven nodes, Kurtosis services, and related process/file descriptors.
 */
export class LaunchedNetwork {
  protected runId: string;
  protected processes: BunProcess[];
  protected _containers: ContainerSpec[];
  protected fileDescriptors: number[];
  protected _networkName: string;
  protected _activeRelayers: RelayerType[];
  /** The RPC URL for the Ethereum Execution Layer (EL) client. */
  protected _elRpcUrl?: string;
  /** The HTTP endpoint for the Ethereum Consensus Layer (CL) client. */
  protected _clEndpoint?: string;
  /** The RPC URL for the DataHaven node. */
  protected _dhRpcUrl?: string;

  constructor() {
    this.runId = crypto.randomUUID();
    this.processes = [];
    this.fileDescriptors = [];
    this._containers = [];
    this._activeRelayers = [];
    this._networkName = "";
    this._elRpcUrl = undefined;
    this._clEndpoint = undefined;
    this._dhRpcUrl = undefined;
  }

  public set networkName(name: string) {
    invariant(name.trim().length > 0, "❌ networkName cannot be empty");
    this._networkName = name.trim();
  }

  public get networkName(): string {
    return this._networkName;
  }

  /**
   * Gets the unique ID for this run of the launched network.
   * @returns The run ID string.
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Gets the port for a DataHaven RPC node.
   *
   * In reality, it just looks for the "ws" port of the
   * `datahaven-alice` container, if it was registered.
   * @returns The port number of the container, or -1 if ws port is not found.
   * @throws If the container is not found.
   */
  getContainerPort(id: string): number {
    const container = this._containers.find((x) => x.name === id);
    invariant(container, `❌ Container ${id} not found`);
    return container.publicPorts.ws ?? -1;
  }

  /**
   * Adds a file descriptor to be managed and cleaned up.
   * @param fd - The file descriptor number.
   */
  addFileDescriptor(fd: number) {
    this.fileDescriptors.push(fd);
  }

  /**
   * Adds a running process to be managed and cleaned up.
   * @param process - The Bun subprocess object.
   */
  addProcess(process: BunProcess) {
    this.processes.push(process);
  }

  addContainer(containerName: string, publicPorts: Record<string, number> = {}) {
    this._containers.push({ name: containerName, publicPorts });
  }

  public getPublicWsPort(): number {
    logger.debug("Getting public WebSocket port for LaunchedNetwork");
    logger.debug("Containers:");
    logger.debug(JSON.stringify(this.containers));
    const port = this.containers.map((x) => x.publicPorts.ws).find((x) => x !== -1);
    invariant(port !== undefined, "❌ No public port found in containers");
    return port;
  }

  /**
   * Updates the DataHaven RPC URL based on the current container public port
   * This should be called after DataHaven containers are added to the network
   */
  public updateDhRpcUrl(): void {
    const port = this.getPublicWsPort();
    this._dhRpcUrl = `ws://127.0.0.1:${port}`;
    logger.debug(`DataHaven RPC URL set to ${this._dhRpcUrl}`);
  }

  /**
   * Sets the RPC URL for the DataHaven node.
   * @param url - The DataHaven RPC URL string.
   */
  public set dhRpcUrl(url: string) {
    this._dhRpcUrl = url;
  }

  /**
   * Gets the RPC URL for the DataHaven node.
   * @returns The DataHaven RPC URL string.
   * @throws If the DataHaven RPC URL has not been set.
   */
  public get dhRpcUrl(): string {
    if (!this._dhRpcUrl) {
      // Try to generate the URL if not set
      this.updateDhRpcUrl();
    }
    invariant(this._dhRpcUrl, "❌ DataHaven RPC URL not set in LaunchedNetwork");
    return this._dhRpcUrl;
  }

  /**
   * Sets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @param url - The EL RPC URL string.
   */
  public set elRpcUrl(url: string) {
    this._elRpcUrl = url;
  }

  /**
   * Gets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @returns The EL RPC URL string.
   * @throws If the EL RPC URL has not been set.
   */
  public get elRpcUrl(): string {
    invariant(this._elRpcUrl, "❌ EL RPC URL not set in LaunchedNetwork");
    return this._elRpcUrl;
  }

  /**
   * Sets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @param url - The CL HTTP endpoint string.
   */
  public set clEndpoint(url: string) {
    this._clEndpoint = url;
  }

  /**
   * Gets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @returns The CL HTTP endpoint string.
   * @throws If the CL HTTP endpoint has not been set.
   */
  public get clEndpoint(): string {
    invariant(this._clEndpoint, "❌ CL HTTP Endpoint not set in LaunchedNetwork");
    return this._clEndpoint;
  }

  registerRelayerType(type: RelayerType): void {
    if (!this._activeRelayers.includes(type)) {
      this._activeRelayers.push(type);
    }
  }

  public get containers(): ContainerSpec[] {
    return this._containers;
  }

  public get relayers(): RelayerType[] {
    return [...this._activeRelayers];
  }

  async cleanup() {
    logger.debug("Running cleanup");
    for (const process of this.processes) {
      logger.debug(`Process is still running: ${process.pid}`);
      process.unref();
    }

    for (const fd of this.fileDescriptors) {
      try {
        fs.closeSync(fd);
        this.fileDescriptors = this.fileDescriptors.filter((x) => x !== fd);
        logger.debug(`Closed file descriptor ${fd}`);
      } catch (error) {
        logger.error(`Error closing file descriptor ${fd}: ${error}`);
      }
    }
  }
}
