// Re-export shared constants from launcher
export {
  BASE_SERVICES,
  FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS,
  ZERO_HASH
} from "../../../launcher/utils";

/**
 * The name of the Docker network that DataHaven nodes and
 * Snowbridge relayers will be connected to, in a local deployment.
 */
export const DOCKER_NETWORK_NAME = "datahaven-net";

/**
 * The components (Docker containers) that can be launched and stopped.
 */
export const COMPONENTS = {
  datahaven: {
    imageName: "moonsonglabs/datahaven",
    componentName: "Datahaven Network",
    optionName: "datahaven"
  },
  snowbridge: {
    imageName: "snowbridge-relay",
    componentName: "Snowbridge Relayers",
    optionName: "relayer"
  }
} as const;

/**
 * Minimum required Bun version
 */
export const MIN_BUN_VERSION = { major: 1, minor: 2 };
