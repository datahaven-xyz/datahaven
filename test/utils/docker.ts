import { PassThrough, type Readable } from "node:stream";
import Docker from "dockerode";
import invariant from "tiny-invariant";
import { type ServiceInfo, type ServiceMapping, StandardServiceMappings, logger } from "utils";

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
  searchString: string;
  containerName: string;
  timeoutSeconds?: number;
  tail?: number;
}): Promise<string> => {
  return new Promise((resolve, reject) => {
    logger.debug(
      `Waiting for log ${options.searchString} in container ${options.containerName}...`
    );
    const docker = new Docker();
    const container = docker.getContainer(options.containerName);

    container.logs(
      { follow: true, stdout: true, stderr: true, tail: options.tail, timestamps: false }, // set tail default to 10 to get the 10 last lines of logs printed
      (err, stream) => {
        if (err) {
          return reject(err);
        }

        if (stream === undefined) {
          return reject(new Error("No stream returned."));
        }

        const stdout = new PassThrough();
        const stderr = new PassThrough();

        docker.modem.demuxStream(stream, stdout, stderr);

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          (stream as Readable).destroy();
          stdout.destroy();
          stderr.destroy();
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        };

        const onData = (chunk: Buffer) => {
          const log = chunk.toString("utf8");
          if (log.includes(options.searchString)) {
            cleanup();
            resolve(log);
          }
        };

        stdout.on("data", onData);
        stderr.on("data", onData);

        stream.on("error", (err) => {
          cleanup();
          reject(err);
        });

        if (options.timeoutSeconds) {
          timeoutHandle = setTimeout(() => {
            cleanup();
            reject(
              new Error(
                `Timeout of ${options.timeoutSeconds}s exceeded while waiting for log ${options.searchString}`
              )
            );
          }, options.timeoutSeconds * 1000);
        }
      }
    );
  });
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
