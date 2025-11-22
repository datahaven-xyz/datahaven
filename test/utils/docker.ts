import { existsSync } from "node:fs";
import { type Duplex, PassThrough, Transform } from "node:stream";
import Docker from "dockerode";
import invariant from "tiny-invariant";
import { logger } from "./logger";
import { type ServiceInfo, StandardServiceMappings } from "./service-mappings";

function createDockerConnection(): Docker {
  const dockerHost = process.env.DOCKER_HOST;

  if (dockerHost) {
    logger.debug(`Using DOCKER_HOST: ${dockerHost}`);
    if (dockerHost.startsWith("unix://")) {
      return new Docker({ socketPath: dockerHost.replace("unix://", "") });
    }
    if (dockerHost.startsWith("tcp://")) {
      const url = new URL(dockerHost);
      return new Docker({
        host: url.hostname,
        port: Number.parseInt(url.port, 10) || 2375,
        protocol: "http"
      });
    }
  }

  const socketPaths = [
    "/var/run/docker.sock",
    "/run/user/1000/docker.sock",
    `${process.env.HOME}/.docker/run/docker.sock`
  ];

  for (const socketPath of socketPaths) {
    try {
      if (existsSync(socketPath)) {
        logger.debug(`Using Docker socket: ${socketPath}`);
        return new Docker({ socketPath });
      }
    } catch (error) {
      logger.debug(`Failed to access socket ${socketPath}:`, error);
    }
  }

  logger.debug("Falling back to default Docker configuration");
  return new Docker({});
}

const docker = createDockerConnection();

async function testDockerConnection(): Promise<void> {
  try {
    await docker.ping();
    logger.debug("Docker connection successful");
  } catch (error) {
    logger.error("Docker connection failed:", error);
    throw new Error(
      `Failed to connect to Docker daemon: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const getServicesFromDocker = async (): Promise<ServiceInfo[]> => {
  let containers: Docker.ContainerInfo[];
  try {
    containers = await docker.listContainers();
  } catch (error) {
    logger.error("Failed to list containers:", error);
    await testDockerConnection();
    throw error;
  }

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

export const getContainersMatchingImage = async (imageName: string) => {
  const containers = await docker.listContainers({ all: true });
  const matches = containers.filter((container) => container.Image.includes(imageName));
  return matches;
};

export const getContainersByPrefix = async (prefix: string) => {
  const containers = await docker.listContainers({ all: true });
  const matches = containers.filter((container) =>
    container.Names.some((name) => name.startsWith(`/${prefix}`))
  );
  return matches;
};

export const getPublicPort = async (
  containerName: string,
  internalPort: number
): Promise<number> => {
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

export async function waitForLog(opts: {
  search: string | RegExp;
  containerName: string;
  timeoutSeconds?: number;
}): Promise<string> {
  const container = docker.getContainer(opts.containerName);
  await container.inspect();
  const timeoutMs = (opts.timeoutSeconds ?? 10) * 1_000;

  const rawStream = (await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
    since: 0
  })) as Duplex;
  const pass = new PassThrough();
  container.modem.demuxStream(rawStream, pass, pass);

  const { readable } = Transform.toWeb(pass);
  const decoder = new TextDecoder();
  const timer = setTimeout(
    () =>
      pass.destroy(
        new Error(
          `Timed out after ${timeoutMs} ms waiting for "${opts.search}" in ${opts.containerName}`
        )
      ),
    timeoutMs
  );

  try {
    for await (const chunk of readable) {
      const text = decoder.decode(chunk as Uint8Array, { stream: false });

      const hit =
        typeof opts.search === "string" ? text.includes(opts.search) : opts.search.test(text);

      if (hit) return text.trim();
    }

    throw new Error(
      `Log stream ended before "${opts.search}" appeared for container ${opts.containerName}`
    );
  } finally {
    if (timer) {
      clearTimeout(timer);
    }

    if (pass && typeof pass.destroy === "function" && !pass.destroyed) {
      pass.destroy();
    }

    if (rawStream) {
      if (typeof rawStream.destroy === "function" && !rawStream.destroyed) {
        rawStream.destroy();
      }
      const socket = (rawStream as any).socket;
      if (socket && typeof socket.destroy === "function" && !socket.destroyed) {
        socket.destroy();
      }
    }
  }
}

export const waitForContainerToStart = async (
  containerName: string,
  options?: { timeoutSeconds?: number }
) => {
  logger.debug(`Waiting for container ${containerName} to start...`);
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

export const killExistingContainers = async (prefix: string) => {
  logger.debug(`Searching for containers with image ${prefix}...`);
  const containerInfos = await getContainersByPrefix(prefix);

  if (containerInfos.length === 0) {
    logger.debug(`No containers found with name starting with "${prefix}"`);
    return;
  }

  const promises = containerInfos.map(({ Id }) => docker.getContainer(Id).remove({ force: true }));
  await Promise.all(promises);

  logger.debug(`${containerInfos.length} containers with name starting with "${prefix}" killed`);
};
