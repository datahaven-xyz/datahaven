import { $ } from "bun";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { logger } from "utils";

/**
 * Checks if a DataHaven network is ready by attempting to connect and query the chain.
 * @param wsPort The WebSocket port to connect to
 * @returns True if the network is ready, false otherwise
 */
export async function isNetworkReady(wsPort: number): Promise<boolean> {
  try {
    const wsUrl = `ws://127.0.0.1:${wsPort}`;
    const client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    // Try to get chain info
    const chain = await Promise.race([
      client.getChainSpecData().then((data) => data.name),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("RPC call timeout")), 2000)
      )
    ]);

    client.destroy();

    if (chain) {
      logger.debug(`isNetworkReady PAPI check successful for port ${wsPort}, chain: ${chain}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${wsPort}: ${error}`);
    return false;
  }
}

/**
 * Waits for a Docker container to be in running state
 * @param containerName The name of the container to wait for
 * @param maxWaitSeconds Maximum time to wait in seconds
 */
export async function waitForContainerToStart(
  containerName: string,
  maxWaitSeconds = 30
): Promise<void> {
  logger.debug(`Waiting for container ${containerName} to start...`);

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const result = await $`docker inspect -f '{{.State.Running}}' ${containerName}`
      .quiet()
      .nothrow();

    if (result.exitCode === 0 && result.stdout.toString().trim() === "true") {
      logger.debug(
        `Container ${containerName} started after ${Math.floor((Date.now() - startTime) / 1000)} seconds`
      );
      return;
    }

    await Bun.sleep(1000);
  }

  throw new Error(`Container ${containerName} failed to start within ${maxWaitSeconds} seconds`);
}

/**
 * Finds an available port starting from the given port
 * @param startPort The port to start searching from
 * @param maxAttempts Maximum number of ports to try
 * @returns The first available port found
 */
export async function findAvailablePort(startPort: number, maxAttempts = 100): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const result = await $`lsof -i :${port}`.quiet().nothrow();

    if (result.exitCode !== 0) {
      return port;
    }
  }

  throw new Error(
    `No available ports found after checking ${maxAttempts} ports starting from ${startPort}`
  );
}
