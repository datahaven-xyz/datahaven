import Docker from "dockerode";
import invariant from "tiny-invariant";
import { logger } from "utils";

interface ServiceMapping {
  service: string;
  containerPattern: string;
  internalPort: number;
  protocol: string;
}

interface ServiceInfo {
  service: string;
  port: string;
  url: string;
}

const serviceMappings: ServiceMapping[] = [
  {
    service: "reth-1-rpc",
    containerPattern: "el-1-reth-lighthouse",
    internalPort: 8545,
    protocol: "tcp"
  },
  {
    service: "reth-2-rpc",
    containerPattern: "el-2-reth-lighthouse",
    internalPort: 8545,
    protocol: "tcp"
  },
  {
    service: "blockscout-backend",
    containerPattern: "blockscout--",
    internalPort: 4000,
    protocol: "tcp"
  },
  {
    service: "dora",
    containerPattern: "dora--",
    internalPort: 8080,
    protocol: "tcp"
  }
];

export async function getServicesFromDocker(): Promise<ServiceInfo[]> {
  const docker = new Docker();

  const containers = await docker.listContainers();

  const services: ServiceInfo[] = [];

  for (const mapping of serviceMappings) {
    try {
      const container = containers.find((container) =>
        container.Names.some((name) => name.includes(mapping.containerPattern))
      );

      if (!container) {
        logger.warn(`Container with pattern "${mapping.containerPattern}" not found.`);
        services.push({
          service: mapping.service,
          port: "Not found",
          url: "N/A"
        });
        continue;
      }

      const portMappings = container.Ports.filter(
        (port) => port.PrivatePort === mapping.internalPort && port.Type === mapping.protocol
      );

      let selectedMapping = portMappings.find((port) => port.IP === "0.0.0.0" || port.IP === ":::");

      if (!selectedMapping && portMappings.length > 0) {
        selectedMapping = portMappings[0];
      }

      if (!selectedMapping || !selectedMapping.PublicPort) {
        logger.warn(
          `Port mapping not found for ${mapping.service} (${mapping.internalPort}/${mapping.protocol}).`
        );
        services.push({
          service: mapping.service,
          port: "Not found",
          url: "N/A"
        });
        continue;
      }

      services.push({
        service: mapping.service,
        port: selectedMapping.PublicPort.toString(),
        url: `http://127.0.0.1:${selectedMapping.PublicPort}`
      });
    } catch (error) {
      logger.error(`Error getting info for ${mapping.service}:`, error);
      services.push({
        service: mapping.service,
        port: "Error",
        url: "N/A"
      });
    }
  }

  return services;
}

export const getPublicPort = async (
  containerName: string,
  internalPort: number
): Promise<number> => {
  const docker = new Docker();
  const containers = await docker.listContainers();
  const container = containers.find((container) =>
    container.Names.some((name) => name.includes(containerName))
  );
  invariant(container, `❌ container ${container} cannot be found  in running container list`);

  const portMappings = container.Ports.find(
    (port) => port.PrivatePort === internalPort && port.Type === "tcp"
  );
  logger.debug(`Port mappings for ${containerName}:${internalPort}`, portMappings);
  invariant(portMappings, `❌ port mapping not found for ${containerName}:${internalPort}`);
  return portMappings.PublicPort;
};
