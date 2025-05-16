import fs from "node:fs";
import invariant from "tiny-invariant";
import { type RelayerType, logger } from "utils";

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
  protected _activeRelayers: RelayerType[];
  /** The RPC URL for the Ethereum Execution Layer (EL) client. */
  protected elRpcUrl?: string;
  /** The HTTP endpoint for the Ethereum Consensus Layer (CL) client. */
  protected clEndpoint?: string;

  constructor() {
    this.runId = crypto.randomUUID();
    this.processes = [];
    this.fileDescriptors = [];
    this._containers = [];
    this._activeRelayers = [];
    this.elRpcUrl = undefined;
    this.clEndpoint = undefined;
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
  /**
   * Sets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @param url - The EL RPC URL string.
   */
  setElRpcUrl(url: string) {
    this.elRpcUrl = url;
  }

  /**
   * Gets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @returns The EL RPC URL string.
   * @throws If the EL RPC URL has not been set.
   */
  getElRpcUrl(): string {
    invariant(this.elRpcUrl, "❌ EL RPC URL not set in LaunchedNetwork");
    return this.elRpcUrl;
  }

  /**
   * Sets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @param url - The CL HTTP endpoint string.
   */
  setClEndpoint(url: string) {
    this.clEndpoint = url;
  }

  /**
   * Gets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @returns The CL HTTP endpoint string.
   * @throws If the CL HTTP endpoint has not been set.
   */
  getClEndpoint(): string {
    invariant(this.clEndpoint, "❌ CL HTTP Endpoint not set in LaunchedNetwork");
    return this.clEndpoint;
  }

  async cleanup() {
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

    for (const container of this.containers) {
      logger.debug(`Container is still running: ${container}`);
    }
  }
}
