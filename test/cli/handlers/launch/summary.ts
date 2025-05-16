import invariant from "tiny-invariant";
import { getServiceFromKurtosis, logger, printHeader } from "utils";
import { BASE_SERVICES, type LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

export const performSummaryOperations = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Service Endpoints");

  const servicesToDisplay = BASE_SERVICES;

  if (options.blockscout === true) {
    servicesToDisplay.push(...["blockscout", "blockscout-frontend"]);
  }

  if (launchedNetwork.containers.find((c) => c.name === "datahaven-alice")) {
    servicesToDisplay.push("datahaven-alice");
  }

  const activeRelayers = launchedNetwork.relayers;
  for (const relayer of activeRelayers) {
    servicesToDisplay.push(`${relayer}-relayer`);
  }

  logger.trace("Services to display", servicesToDisplay);

  const displayData: { service: string; ports: Record<string, number>; url: string }[] = [];
  for (const service of servicesToDisplay) {
    logger.debug(`Checking service: ${service}`);

    const serviceInfo = service.startsWith("datahaven-")
      ? undefined
      : await getServiceFromKurtosis(service);
    logger.trace("Service info", serviceInfo);
    switch (true) {
      case service.startsWith("cl-"): {
        invariant(serviceInfo, `❌ Service info for ${service} is not available`);
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service.startsWith("el-"): {
        invariant(serviceInfo, `❌ Service info for ${service} is not available`);
        const rpcPort = serviceInfo.public_ports.rpc.number;
        const wsPort = serviceInfo.public_ports.ws.number;
        displayData.push({
          service,
          ports: { rpc: rpcPort, ws: wsPort },
          url: `http://127.0.0.1:${rpcPort}`
        });
        break;
      }

      case service.startsWith("dora"): {
        invariant(serviceInfo, `❌ Service info for ${service} is not available`);
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout": {
        invariant(serviceInfo, `❌ Service info for ${service} is not available`);
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout-frontend": {
        invariant(serviceInfo, `❌ Service info for ${service} is not available`);
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "datahaven-alice": {
        const port = launchedNetwork.getDHPort();
        displayData.push({
          service,
          ports: { ws: port },
          url: `http://127.0.0.1:${port}`
        });
        break;
      }

      case service === "beefy-relayer": {
        displayData.push({
          service,
          ports: {},
          url: "Background process (connects to other services)"
        });
        break;
      }

      case service === "beacon-relayer": {
        displayData.push({
          service,
          ports: {},
          url: "Background process (connects to other services)"
        });
        break;
      }

      default: {
        logger.error(`Unknown service: ${service}`);
      }
    }
  }

  const containers = launchedNetwork.containers.filter((c) => !c.name.startsWith("datahaven-"));
  for (const { name, publicPorts } of containers) {
    const url = "ws" in publicPorts ? `ws://127.0.0.1:${publicPorts.ws}` : "un-exposed";
    displayData.push({ service: name, ports: publicPorts, url });
  }

  console.table(displayData);
};
