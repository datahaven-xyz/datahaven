import path from "node:path";
import { $ } from "bun";
import {
  confirmWithTimeout,
  logger,
  printDivider,
  printHeader,
  waitForContainerToStart
} from "utils";
import { DOCKER_NETWORK_NAME } from "../common/consts";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { LaunchOptions } from ".";

const MONITORING_DIR = "monitoring";
const COMPOSE_FILE = path.join(MONITORING_DIR, "docker-compose.yml");

/**
 * Launches the monitoring stack (Loki, Grafana Alloy, and Grafana) for log collection.
 *
 * @param options - Configuration options for launching the monitoring stack.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchMonitoring = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting Monitoring Stack");

  let shouldLaunchMonitoring = options.monitoring;

  if (shouldLaunchMonitoring === undefined) {
    shouldLaunchMonitoring = await confirmWithTimeout(
      "Do you want to launch the monitoring stack for log collection?",
      false,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldLaunchMonitoring ? "will launch" : "will not launch"} monitoring stack`
    );
  }

  if (!shouldLaunchMonitoring) {
    logger.info("👍 Skipping monitoring stack launch. Done!");
    printDivider();
    return;
  }

  // Check if DataHaven network exists
  const networkExists = await checkDockerNetworkExists(DOCKER_NETWORK_NAME);
  if (!networkExists) {
    logger.warn(
      `⚠️ Docker network ${DOCKER_NETWORK_NAME} does not exist. Please launch DataHaven first.`
    );
    printDivider();
    return;
  }

  // Check if monitoring is already running
  if (await checkMonitoringRunning()) {
    const shouldRestart = await confirmWithTimeout(
      "Monitoring stack is already running. Do you want to restart it?",
      false,
      10
    );

    if (!shouldRestart) {
      logger.info("👍 Keeping existing monitoring stack.");
      printDivider();
      return;
    }

    // Stop existing monitoring stack
    await stopMonitoring();
  }

  logger.info("🚀 Starting monitoring stack...");

  try {
    // Start the monitoring stack
    if (options.grafanaPort) {
      await $`docker compose -f ${COMPOSE_FILE} up -d`.env({
        GRAFANA_PORT: options.grafanaPort.toString()
      });
    } else {
      await $`docker compose -f ${COMPOSE_FILE} up -d`;
    }

    // Wait for containers to start
    await waitForContainerToStart("datahaven-loki");
    await waitForContainerToStart("datahaven-alloy");
    await waitForContainerToStart("datahaven-grafana");

    // Register monitoring containers in launched network
    launchedNetwork.addContainer("datahaven-loki");
    launchedNetwork.addContainer("datahaven-alloy");
    launchedNetwork.addContainer("datahaven-grafana");

    const grafanaPort = options.grafanaPort || 3000;
    logger.success(
      "Monitoring stack started successfully!\n" +
      `  📊 Grafana: http://localhost:${grafanaPort} (admin/admin)\n` +
      "  📝 Loki API: http://localhost:3100"
    );
  } catch (error) {
    logger.error("❌ Failed to start monitoring stack:", error);
    throw error;
  }

  printDivider();
};

/**
 * Checks if the monitoring stack is already running.
 *
 * @returns True if any monitoring containers are running, false otherwise.
 */
const checkMonitoringRunning = async (): Promise<boolean> => {
  const result =
    await $`docker ps --format "{{.Names}}" --filter "name=^datahaven-(loki|alloy|grafana)$"`.text();
  return result.trim().length > 0;
};

/**
 * Stops the monitoring stack.
 */
const stopMonitoring = async (): Promise<void> => {
  logger.info("🛑 Stopping monitoring stack...");
  await $`docker compose -f ${COMPOSE_FILE} down`.nothrow();
  logger.info("✅ Monitoring stack stopped.");
};

/**
 * Checks if a Docker network exists.
 *
 * @param networkName - The name of the Docker network to check.
 * @returns True if the network exists, false otherwise.
 */
const checkDockerNetworkExists = async (networkName: string): Promise<boolean> => {
  const result =
    await $`docker network ls --filter "name=^${networkName}$" --format "{{.Name}}"`.text();
  return result.trim() === networkName;
};
