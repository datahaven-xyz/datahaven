import { getServiceFromKurtosis, logger, printHeader } from "utils";
import { BASE_SERVICES, type LaunchOptions } from "..";

export const performSummaryOperations = async (options: LaunchOptions) => {
  logger.trace("Display service information in a clean table");
  printHeader("Service Endpoints");

  logger.trace("Filter services to display based on blockscout option");
  const servicesToDisplay = BASE_SERVICES;

  if (options.blockscout === true) {
    servicesToDisplay.push(...["blockscout", "blockscout-frontend"]);
  }

  const displayData: { service: string; ports: Record<string, number>; url: string }[] = [];
  for (const service of servicesToDisplay) {
    logger.debug(`Checking service: ${service}`);

    const serviceInfo = await getServiceFromKurtosis(service);
    logger.debug("Service info", serviceInfo);
    switch (true) {
      case service.startsWith("cl-"): {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service.startsWith("el-"): {
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
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout": {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout-frontend": {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
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
