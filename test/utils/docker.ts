import { existsSync } from "node:fs";
import { type Duplex, PassThrough, Transform } from "node:stream";
import Docker from "dockerode";
import invariant from "tiny-invariant";
import { logger, type ServiceInfo, StandardServiceMappings } from "utils";

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
        port: Number.parseInt(url.port) || 2375,
        protocol: "http"
      });
    }
  }

  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
  const socketPaths = [
    "/var/run/docker.sock",
    `/run/user/${uid}/docker.sock`,
    xdgRuntimeDir ? `${xdgRuntimeDir}/podman/podman.sock` : "",
    `/run/user/${uid}/podman/podman.sock`,
    "/run/podman/podman.sock",
    `${process.env.HOME}/.docker/run/docker.sock`
  ].filter(Boolean) as string[];

  for (const socketPath of socketPaths) {
    try {
      if (existsSync(socketPath)) {
        logger.info(`Using container socket: ${socketPath}`);
        return new Docker({ socketPath });
      }
    } catch (error) {
      logger.debug(`Failed to access socket ${socketPath}:`, error);
    }
  }

  if (process.platform === "win32") {
    return new Docker({});
  }

  logger.info("Defaulting to unix socket /var/run/docker.sock");
  return new Docker({ socketPath: "/var/run/docker.sock" }); // use default socket for `linux` and `darwin`
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
          port: "No port mapping",
          url: "N/A"
        });
        continue;
      }

      const url = `${mapping.protocol}://127.0.0.1:${selectedMapping.PublicPort}`;
      services.push({
        service: mapping.service,
        port: selectedMapping.PublicPort.toString(),
        url
      });
    } catch (error) {
      logger.error(`Error processing service mapping for ${mapping.service}:`, error);
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
  try {
    const containers = await docker.listContainers({ all: true });
    const matches = containers.filter((container) => container.Image.includes(imageName));
    return matches;
  } catch (error) {
    logger.warn("Docker client library failed, trying shell fallback:", error);

    // Fallback to shell command if Docker client library fails
    try {
      const { $ } = await import("bun");
      const output =
        await $`docker ps -a --filter "ancestor=${imageName}" --format "{{.ID}}\t{{.Image}}\t{{.Names}}"`.text();

      if (!output.trim()) {
        return [];
      }

      // Parse the output and create mock container objects
      const lines = output.trim().split("\n");
      return lines.map((line) => {
        const [id, image, ...names] = line.split("\t");
        return {
          Id: id,
          Image: image,
          Names: names.map((name) => `/${name}`),
          // Add other required properties with default values
          State: "unknown",
          Status: "unknown",
          Created: 0,
          Ports: [],
          Labels: {},
          NetworkSettings: { Networks: {} }
        };
      });
    } catch (shellError) {
      logger.error("Both Docker client library and shell fallback failed:", {
        clientError: error,
        shellError
      });
      throw error; // Re-throw the original error
    }
  }
};

export const getContainersByPrefix = async (prefix: string) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const matches = containers.filter((container) =>
      container.Names.some((name) => name.startsWith(`/${prefix}`))
    );
    return matches;
  } catch (error) {
    logger.warn("Docker client library failed, trying shell fallback:", error);

    // Fallback to shell command if Docker client library fails
    try {
      const { $ } = await import("bun");
      const output =
        await $`docker ps -a --filter "name=^${prefix}" --format "{{.ID}}\t{{.Image}}\t{{.Names}}"`.text();

      if (!output.trim()) {
        return [];
      }

      // Parse the output and create mock container objects
      const lines = output.trim().split("\n");
      return lines.map((line) => {
        const [id, image, ...names] = line.split("\t");
        return {
          Id: id,
          Image: image,
          Names: names.map((name) => `/${name}`),
          // Add other required properties with default values
          State: "unknown",
          Status: "unknown",
          Created: 0,
          Ports: [],
          Labels: {},
          NetworkSettings: { Networks: {} }
        };
      });
    } catch (shellError) {
      logger.error("Both Docker client library and shell fallback failed:", {
        clientError: error,
        shellError
      });
      throw error; // Re-throw the original error
    }
  }
};

export const getPublicPort = async (
  containerName: string,
  internalPort: number
): Promise<number> => {
  try {
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
  } catch (error) {
    logger.warn("Docker client library failed, trying shell fallback:", error);

    // Fallback to shell command if Docker client library fails
    try {
      const { $ } = await import("bun");
      const output = await $`docker port ${containerName} ${internalPort}/tcp`.text();

      if (!output.trim()) {
        throw new Error(`Port mapping not found for ${containerName}:${internalPort}`);
      }

      // Parse the output to extract the public port
      // Output format: "0.0.0.0:12345" or ":::12345"
      const match = output.trim().match(/:(\d+)$/);
      if (!match) {
        throw new Error(`Could not parse port from output: ${output}`);
      }

      return Number.parseInt(match[1], 10);
    } catch (shellError) {
      logger.error("Both Docker client library and shell fallback failed:", {
        clientError: error,
        shellError
      });
      throw error; // Re-throw the original error
    }
  }
};

export async function waitForLog(opts: {
  search: string | RegExp;
  containerName: string;
  timeoutSeconds?: number;
}): Promise<string> {
  try {
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
  } catch (error) {
    logger.warn("Docker client library failed, trying shell fallback:", error);

    // Fallback to shell command if Docker client library fails
    try {
      const { $ } = await import("bun");
      const timeoutMs = (opts.timeoutSeconds ?? 10) * 1_000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        try {
          const output = await $`docker logs ${opts.containerName} --tail 100`.text();

          if (typeof opts.search === "string") {
            if (output.includes(opts.search)) {
              return output.trim();
            }
          } else {
            if (opts.search.test(output)) {
              return output.trim();
            }
          }

          // Wait a bit before checking again
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
          // Container might not be running yet, continue waiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      throw new Error(
        `Timed out after ${timeoutMs} ms waiting for "${opts.search}" in ${opts.containerName}`
      );
    } catch (shellError) {
      logger.error("Both Docker client library and shell fallback failed:", {
        clientError: error,
        shellError
      });
      throw error; // Re-throw the original error
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
