import fs from "node:fs";
import invariant from "tiny-invariant";
import { logger } from "utils";

/**
 * Represents the state and associated resources of a launched network environment,
 * including DataHaven nodes, Kurtosis services, and related process/file descriptors.
 */
export class LaunchedNetwork {
  protected runId: string;
  protected processes: Bun.Subprocess<"inherit" | "pipe" | "ignore", number, number>[];
  protected fileDescriptors: number[];
  protected DHNodes: { id: string; port: number }[];
  /** The RPC URL for the Ethereum Execution Layer (EL) client. */
  protected elRpcUrl?: string;

  constructor() {
    this.runId = crypto.randomUUID();
    this.processes = [];
    this.fileDescriptors = [];
    this.DHNodes = [];
    this.elRpcUrl = undefined;
  }

  /**
   * Gets the unique ID for this run of the launched network.
   * @returns The run ID string.
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Gets the list of launched DataHaven (DH) nodes.
   * @returns An array of DH node objects, each with an id and port.
   */
  getDHNodes(): { id: string; port: number }[] {
    return [...this.DHNodes];
  }

  /**
   * Gets the port for a specific DataHaven (DH) node by its ID.
   * @param id - The ID of the DH node.
   * @returns The port number of the DH node.
   * @throws If the node with the given ID is not found.
   */
  getDHPort(id: string): number {
    const node = this.DHNodes.find((x) => x.id === id);
    invariant(node, `❌ Datahaven node ${id} not found`);
    return node.port;
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
  addProcess(process: Bun.Subprocess<"inherit" | "pipe" | "ignore", number, number>) {
    this.processes.push(process);
  }

  /**
   * Adds a DataHaven (DH) node to the list of launched nodes.
   * @param id - The ID of the DH node.
   * @param port - The port number the DH node is running on.
   */
  addDHNode(id: string, port: number) {
    this.DHNodes.push({ id, port });
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

  async cleanup() {
    for (const process of this.processes) {
      logger.debug(`Process is still running: ${process.pid}`);
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
