import { logger } from "utils";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";

/**
 * Forwards a port from a Kubernetes service to localhost and returns a cleanup function.
 *
 * @param serviceName - The name of the Kubernetes service to forward from
 * @param localPort - The local port to bind to
 * @param kubePort - The Kubernetes service port to forward from
 * @param launchedNetwork - The launched network instance containing namespace info
 * @param options - Optional configuration
 * @returns Promise<{ cleanup: () => Promise<void> }> - Object containing cleanup function
 */
export const forwardPort = async (
  serviceName: string,
  localPort: number,
  kubePort: number,
  launchedNetwork: LaunchedNetwork
): Promise<{ cleanup: () => Promise<void> }> => {
  logger.info(
    `🔗 Setting up port forward: localhost:${localPort} -> svc/dh-validator-0:${kubePort}`
  );

  // Start kubectl port-forward as a background process using Bun.spawn
  const portForwardProcess = Bun.spawn(
    [
      "kubectl",
      "port-forward",
      `svc/${serviceName}`,
      "-n",
      launchedNetwork.kubeNamespace,
      `${localPort}:${kubePort}`
    ],
    {
      stdout: "pipe",
      stderr: "pipe"
    }
  );

  // Check if the process is still running (didn't exit due to error)
  if (portForwardProcess.exitCode !== null) {
    const stderr = await new Response(portForwardProcess.stderr).text();
    throw new Error(`Port forward failed to start: ${stderr}`);
  }

  logger.success(
    `Port forward established: localhost:${localPort} -> svc/dh-validator-0:${kubePort}`
  );

  // Return cleanup function
  const cleanup = async (): Promise<void> => {
    logger.info(`🧹 Cleaning up port forward for localhost:${localPort}`);

    if (!portForwardProcess.killed) {
      portForwardProcess.kill();

      // Wait for process to actually exit
      try {
        await portForwardProcess.exited;
      } catch (error) {
        // Process was killed, this is expected
        logger.debug(`Port forward process killed: ${error}`);
      }
    }

    logger.success(`Port forward cleanup completed for localhost:${localPort}`);
  };

  // Add a cleanup handler that doesn't interfere with exit codes
  const exitHandler = () => {
    if (!portForwardProcess.killed) {
      portForwardProcess.kill();
    }
  };

  process.on("exit", exitHandler);
  process.on("SIGINT", exitHandler);
  process.on("SIGTERM", exitHandler);

  return { cleanup };
};
