import path from "node:path";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  logger,
  parseDeploymentsFile,
  printDivider,
  printHeader,
  SUBSTRATE_FUNDED_ACCOUNTS
} from "utils";
import { waitFor } from "utils/waits";
import { ZERO_HASH } from "../common/consts";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import { generateRelayerConfig, initEthClientPallet, type RelayerSpec } from "../common/relayer";
import type { DeployOptions } from ".";

// Standard ports for the Ethereum network
const ETH_EL_RPC_PORT = 8546;
const ETH_CL_HTTP_PORT = 4000;

const RELAYER_CONFIG_DIR = "../deployment/charts/bridges-common-relay/configs";
const RELAYER_CONFIG_PATHS = {
  BEACON: path.join(RELAYER_CONFIG_DIR, "beacon-relay.json"),
  BEEFY: path.join(RELAYER_CONFIG_DIR, "beefy-relay.json"),
  SOLOCHAIN: path.join(RELAYER_CONFIG_DIR, "solochain-relay.json")
};

/**
 * Deploys Snowbridge relayers for the DataHaven network in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the relayers.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const deployRelayers = async (options: DeployOptions, launchedNetwork: LaunchedNetwork) => {
  printHeader("Starting Snowbridge Relayers");

  if (options.skipRelayers) {
    logger.info("🏳️ Skipping relayer deployment");
    printDivider();
    return;
  }

  // Get DataHaven node port
  const dhNodes = launchedNetwork.containers.filter((container) =>
    container.name.includes("dh-validator")
  );

  invariant(dhNodes.length > 0, "❌ No DataHaven nodes found in launchedNetwork");
  const firstDhNode = dhNodes[0];
  const substrateWsPort = firstDhNode.publicPorts.ws;
  const substrateNodeId = firstDhNode.name;
  logger.info(
    `🔌 Using DataHaven node ${substrateNodeId} on port ${substrateWsPort} for relayers and BEEFY check.`
  );

  invariant(options.relayerImageTag, "❌ relayerImageTag is required");

  // Check if BEEFY is ready before proceeding
  await waitBeefyReady(launchedNetwork, 2000, 60000);

  const anvilDeployments = await parseDeploymentsFile();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

  logger.debug(`Ensuring output directory exists: ${RELAYER_CONFIG_DIR}`);
  await $`mkdir -p ${RELAYER_CONFIG_DIR}`.quiet();

  const ethElRpcEndpoint = `ws://el-1-reth-lighthouse:${ETH_EL_RPC_PORT}`;
  const ethClEndpoint = `http://cl-1-lighthouse-reth:${ETH_CL_HTTP_PORT}`;
  const substrateWsEndpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

  const relayersToStart: RelayerSpec[] = [
    {
      name: "relayer-🥩",
      configFilePath: RELAYER_CONFIG_PATHS.BEEFY,
      config: {
        type: "beefy",
        ethElRpcEndpoint,
        substrateWsEndpoint,
        beefyClientAddress,
        gatewayAddress
      },
      pk: {
        ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: "relayer-🥓",
      configFilePath: RELAYER_CONFIG_PATHS.BEACON,
      config: {
        type: "beacon",
        ethClEndpoint,
        substrateWsEndpoint
      },
      pk: {
        substrate: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.privateKey
      }
    },
    {
      name: "relayer-⛓️",
      configFilePath: RELAYER_CONFIG_PATHS.SOLOCHAIN,
      config: {
        type: "solochain",
        ethElRpcEndpoint,
        substrateWsEndpoint,
        beefyClientAddress,
        gatewayAddress,
        ethClEndpoint
      },
      pk: {
        ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey,
        substrate: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.privateKey
      }
    }
  ];

  for (const relayerSpec of relayersToStart) {
    await generateRelayerConfig(relayerSpec, options.environment, RELAYER_CONFIG_DIR);
  }

  invariant(options.relayerImageTag, "❌ Relayer image tag not defined");

  // Generating the relayer config file for running the beacon relayer locally, to generate the first checkpoint
  const localBeaconConfigDir = "tmp/configs";
  const localBeaconConfigFilePath = path.join(localBeaconConfigDir, "beacon-relay-checkpoint.json");
  const localBeaconConfig: RelayerSpec = {
    name: "relayer-🥓-local",
    configFilePath: localBeaconConfigFilePath,
    templateFilePath: "configs/snowbridge/local/beacon-relay.json",
    config: {
      type: "beacon",
      ethClEndpoint: launchedNetwork.clEndpoint.replace("127.0.0.1", "host.docker.internal"),
      substrateWsEndpoint: `ws://${substrateNodeId}:${substrateWsPort}`
    },
    pk: {
      substrate: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.privateKey
    }
  };
  await generateRelayerConfig(localBeaconConfig, options.environment, localBeaconConfigDir);

  await initEthClientPallet(
    path.resolve(localBeaconConfigFilePath),
    options.relayerImageTag,
    launchedNetwork
  );

  for (const { name, config, pk } of relayersToStart) {
    try {
      const containerName = `dh-${config.type}-relay`;
      logger.info(`🚀 Starting relayer ${containerName} ...`);

      // Adding secret key as Kubernetes secret
      invariant(pk.substrate, "❌ Substrate private key is required for relayer");
      const secretName = `dh-${config.type}-relay-substrate-key`;
      logger.debug(
        await $`kubectl create secret generic ${secretName} \
        --from-literal=pvk="${pk.substrate}" \
        -n ${launchedNetwork.kubeNamespace}`.text()
      );
      logger.success("Secret key added to Kubernetes");

      // Deploying relayer with helm chart
      const relayerTimeout = "2m"; // 2 minutes
      logger.debug(
        await $`helm upgrade --install ${containerName} . -f ./snowbridge/${containerName}.yaml \
        -n ${launchedNetwork.kubeNamespace} \
        --wait \
        --timeout ${relayerTimeout}`
          .cwd(path.join(process.cwd(), "../deployment/charts/bridges-common-relay"))
          .text()
      );

      logger.success(`Started relayer ${name}`);
    } catch (e) {
      logger.error(`Error starting relayer ${name}`);
      logger.error(e);
    }
  }

  logger.success("Snowbridge relayers started");
  printDivider();
};

/**
 * Waits for the BEEFY protocol to be ready by polling its finalized head.
 *
 * @param launchedNetwork - An instance of LaunchedNetwork to get the node endpoint.
 * @param pollIntervalMs - The interval in milliseconds to poll the BEEFY endpoint.
 * @param timeoutMs - The total time in milliseconds to wait before timing out.
 * @throws Error if BEEFY is not ready within the timeout.
 */
const waitBeefyReady = async (
  launchedNetwork: LaunchedNetwork,
  pollIntervalMs: number,
  timeoutMs: number
): Promise<void> => {
  const port = launchedNetwork.getPublicWsPort();
  const wsUrl = `ws://127.0.0.1:${port}`;
  const iterations = Math.floor(timeoutMs / pollIntervalMs);

  logger.info(`⌛️ Waiting for BEEFY to be ready on port ${port}...`);

  let client: PolkadotClient | undefined;
  const clientTimeoutMs = pollIntervalMs / 2;
  const delayMs = pollIntervalMs / 2;
  try {
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    await waitFor({
      lambda: async () => {
        try {
          logger.debug("Attempting to to check beefy_getFinalizedHead");

          // Add timeout to the RPC call to prevent hanging.
          const finalisedHeadPromise = client?._request<string>("beefy_getFinalizedHead", []);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("RPC call timeout")), clientTimeoutMs);
          });

          const finalisedHeadHex = await Promise.race([finalisedHeadPromise, timeoutPromise]);

          if (finalisedHeadHex && finalisedHeadHex !== ZERO_HASH) {
            logger.info(`🥩 BEEFY is ready. Finalised head: ${finalisedHeadHex}.`);
            return true;
          }

          logger.debug(
            `BEEFY not ready or finalised head is zero. Retrying in ${delayMs / 1000}s...`
          );
          return false;
        } catch (rpcError) {
          logger.warn(`RPC error checking BEEFY status: ${rpcError}. Retrying...`);
          return false;
        }
      },
      iterations,
      delay: delayMs,
      errorMessage: "BEEFY protocol not ready. Relayers cannot be launched."
    });
  } catch (error) {
    logger.error(`❌ Failed to connect to DataHaven node for BEEFY check: ${error}`);
    throw new Error("BEEFY protocol not ready. Relayers cannot be launched.");
  } finally {
    if (client) {
      client.destroy();
    }
  }
};
