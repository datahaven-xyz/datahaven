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

  const dhNodes = launchedNetwork.getDHNodes();
  for (const { id } of dhNodes) {
    servicesToDisplay.push(`datahaven-${id}`);
  }

  const relays = launchedNetwork.getRelays();
  for (const relay of relays) {
    servicesToDisplay.push(relay.id);
  }

  logger.trace("Services to display", servicesToDisplay);

  const displayData: { service: string; ports: Record<string, number>; url: string }[] = [];
  for (const service of servicesToDisplay) {
    logger.debug(`Checking service: ${service}`);

    const serviceInfo =
      service.startsWith("datahaven-") || service.startsWith("relayer-")
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

      case service.startsWith("datahaven-"): {
        const port = launchedNetwork.getDHPort(service.split("datahaven-")[1]);
        displayData.push({
          service,
          ports: { http: port },
          url: `http://127.0.0.1:${port}`
        });
        break;
      }

      case service.startsWith("relayer-"): {
        displayData.push({
          service,
          ports: {},
          url: "N/A"
        });
        break;
      }

      default: {
        logger.error(`Unknown service: ${service}`);
      }
    }
  }

  console.table(displayData);
};
