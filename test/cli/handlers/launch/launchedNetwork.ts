import fs from "node:fs";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger } from "utils";

type PipeOptions = number | "inherit" | "pipe" | "ignore";
type BunProcess = Bun.Subprocess<PipeOptions, PipeOptions, PipeOptions>;

export class LaunchedNetwork {
  protected runId: string;
  protected processes: BunProcess[];
  protected containers: string[];
  protected fileDescriptors: number[];
  protected DHNodes: { id: string; port: number }[];

  constructor() {
    this.runId = crypto.randomUUID();
    this.processes = [];
    this.fileDescriptors = [];
    this.DHNodes = [];
    this.containers = [];
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

  addProcess(process: BunProcess) {
    this.processes.push(process);
  }

  addContainer(containerName: string) {
    this.containers.push(containerName);
  }

  addDHNode(id: string, port: number) {
    this.DHNodes.push({ id, port });
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

    for (const container of this.containers) {
      try {
        await $`docker rm -f ${container}`.quiet();
        logger.debug(`Removed container ${container}`);
      } catch (error) {
        logger.error(`Error removing container ${container}: ${error}`);
      }
    }
  }
}
