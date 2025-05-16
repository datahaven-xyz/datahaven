import { type Duplex, PassThrough } from "node:stream";
import Docker from "dockerode";
import invariant from "tiny-invariant";
import { type ServiceInfo, StandardServiceMappings, logger } from "utils";

export const getServicesFromDocker = async (): Promise<ServiceInfo[]> => {
  const docker = new Docker();

  const containers = await docker.listContainers();

  const services: ServiceInfo[] = [];

  for (const mapping of StandardServiceMappings) {
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
};

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

export const waitForLog = async (options: {
  search: string | RegExp;
  containerName: string;
  timeoutSeconds?: number;
}): Promise<string> => {
  logger.debug(`Waiting for log ${options.search} in container ${options.containerName}...`);
  const docker = new Docker();
  const container = docker.getContainer(options.containerName);
  invariant(
    await container.inspect(),
    `❌ container ${options.containerName} cannot be found  in running container list`
  );

  const timeoutMs = (options.timeoutSeconds ?? 10) * 1000;
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<string>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${timeoutMs} ms waiting for “${options.search}” in logs of ${options.containerName}`
        )
      );
    }, timeoutMs);
  });

  const logStream = (await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
    since: 0
  })) as Duplex;

  const passthrough = new PassThrough();

  container.modem.demuxStream(logStream, passthrough, passthrough);

  const foundPromise = new Promise<string>((resolve, reject) => {
    passthrough.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (
        (typeof options.search === "string" && text.includes(options.search)) ||
        (options.search instanceof RegExp && options.search.test(text))
      ) {
        cleanup();
        resolve(text);
      }
    });

    passthrough.on("error", (err) => {
      cleanup();
      reject(err);
    });

    passthrough.on("end", () => {
      cleanup();
      reject(
        new Error(
          `Log stream ended before “${options.search}” appeared for container ${options.containerName}`
        )
      );
    });

    function cleanup() {
      clearTimeout(timer);
      passthrough.destroy();
      logStream.destroy();
    }
  });

  return Promise.race([foundPromise, timeoutPromise]);
};

export const waitForContainerToStart = async (
  containerName: string,
  options?: { timeoutSeconds?: number }
) => {
  logger.debug(`Waiting for container ${containerName} to start...`);
  const docker = new Docker();
  const seconds = options?.timeoutSeconds ?? 30;

  for (let i = 0; i < seconds; i++) {
    const containers = await docker.listContainers();
    const container = containers.find((container) =>
      container.Names.some((name) => name.includes(containerName))
    );
    if (container) {
      logger.debug(`Container ${containerName} started after ${i} seconds`);
      return;
    }
    await Bun.sleep(1000);
  }
  invariant(
    false,
    `❌ container ${containerName} cannot be found  in running container list after ${seconds} seconds`
  );
};
