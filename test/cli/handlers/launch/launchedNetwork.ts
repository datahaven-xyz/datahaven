import fs from "node:fs";
import invariant from "tiny-invariant";
import { logger } from "utils";

export class LaunchedNetwork {
  protected runId: string;
  protected processes: Bun.Subprocess<"inherit" | "pipe" | "ignore", number, number>[];
  protected fileDescriptors: number[];
  protected DHNodes: { id: string; port: number }[];

  constructor() {
    this.runId = crypto.randomUUID();
    this.processes = [];
    this.fileDescriptors = [];
    this.DHNodes = [];
  }

  getRunId(): string {
    return this.runId;
  }

  getDHNodes(): { id: string; port: number }[] {
    return [...this.DHNodes];
  }

  getDHPort(id: string): number {
    const node = this.DHNodes.find((x) => x.id === id);
    invariant(node, `❌ Datahaven node ${id} not found`);
    return node.port;
  }

  addFileDescriptor(fd: number) {
    this.fileDescriptors.push(fd);
  }

  addProcess(process: Bun.Subprocess<"inherit" | "pipe" | "ignore", number, number>) {
    this.processes.push(process);
  }

  addDHNode(id: string, port: number) {
    this.DHNodes.push({ id, port });
  }

  async cleanup() {
    for (const process of this.processes) {
      logger.info(`Process is still running: ${process.pid}`);
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
