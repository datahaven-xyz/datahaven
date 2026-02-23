/**
 * E2E test helper for managing the validator-set-submitter Docker container.
 *
 * The submitter daemon automates `sendNewValidatorSetForEra` calls on the
 * ServiceManager contract. This module builds the image, launches the
 * container on the shared Docker network, and tears it down after the test.
 */

import path from "node:path";
import { $ } from "bun";
import { ANVIL_FUNDED_ACCOUNTS, logger, waitForContainerToStart } from "utils";
import { RELAYER_CONFIG_DIR } from "../../launcher/relayers";

const SUBMITTER_IMAGE = "datahavenxyz/validator-set-submitter:local";

/**
 * Builds the validator-set-submitter Docker image from the repo root.
 */
export async function buildSubmitterImage(): Promise<void> {
  logger.debug("Building validator-set-submitter Docker image...");
  const repoRoot = path.resolve(import.meta.dir, "../../..");
  await $`docker build -f test/tools/validator-set-submitter/Dockerfile -t ${SUBMITTER_IMAGE} .`
    .cwd(repoRoot)
    .quiet();
  logger.debug("Validator-set-submitter image built successfully");
}

export interface LaunchSubmitterOptions {
  /** Docker network name (from launchedNetwork.networkName) */
  networkName: string;
  /** Network ID for container naming */
  networkId: string;
  /** Host-facing Ethereum RPC URL (e.g. http://127.0.0.1:32000) */
  ethereumRpcUrl: string;
  /** DataHaven container name for inter-container networking */
  datahavenContainerName: string;
  /** ServiceManager contract address from deployments */
  serviceManagerAddress: string;
}

/**
 * Launches the validator-set-submitter as a Docker container.
 *
 * Generates a YAML config, mounts it into the container, and connects
 * it to the same Docker network as the DH nodes and relayers.
 */
export async function launchSubmitter(options: LaunchSubmitterOptions): Promise<{
  containerName: string;
  cleanup: () => Promise<void>;
}> {
  const { networkName, networkId, ethereumRpcUrl, datahavenContainerName, serviceManagerAddress } =
    options;

  const containerName = `submitter-${networkId}`;

  // Extract port from host-facing URL and rewrite for Docker inter-container access
  const ethUrl = new URL(ethereumRpcUrl);
  const dockerEthRpcUrl = `http://host.docker.internal:${ethUrl.port}`;
  const dockerDhWsUrl = `ws://${datahavenContainerName}:9944`;

  // Generate YAML config
  const configContent = [
    `ethereum_rpc_url: "${dockerEthRpcUrl}"`,
    `datahaven_ws_url: "${dockerDhWsUrl}"`,
    `service_manager_address: "${serviceManagerAddress}"`,
    `network_id: "anvil"`,
    `execution_fee: "0.1"`,
    `relayer_fee: "0.2"`
  ].join("\n");

  const configFileName = `submitter-config-${networkId}.yml`;
  await $`mkdir -p ${RELAYER_CONFIG_DIR}`.quiet();
  const hostConfigPath = path.resolve(path.join(RELAYER_CONFIG_DIR, configFileName));
  await Bun.write(hostConfigPath, configContent);
  logger.debug(`Submitter config written to ${hostConfigPath}`);

  // Remove any existing container with the same name
  await $`docker rm -f ${containerName}`.quiet().nothrow();

  // Launch the container
  const args = [
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    networkName,
    "--add-host",
    "host.docker.internal:host-gateway",
    "-v",
    `${hostConfigPath}:/config/config.yml:ro`,
    "-e",
    `SUBMITTER_PRIVATE_KEY=${ANVIL_FUNDED_ACCOUNTS[6].privateKey}`,
    SUBMITTER_IMAGE
  ];

  await $`docker ${args}`.quiet();
  await waitForContainerToStart(containerName);

  logger.debug(`Submitter container ${containerName} started`);

  const cleanup = async () => {
    await stopSubmitter(containerName);
  };

  return { containerName, cleanup };
}

/**
 * Stops and removes the submitter container.
 */
export async function stopSubmitter(containerName: string): Promise<void> {
  logger.debug(`Stopping submitter container ${containerName}...`);
  await $`docker rm -f ${containerName}`.quiet().nothrow();
  logger.debug(`Submitter container ${containerName} removed`);
}
