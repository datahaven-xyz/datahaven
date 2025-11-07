export const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * The name of the Docker network that DataHaven nodes and
 * Snowbridge relayers will be connected to, in a local deployment.
 */

export const DOCKER_NETWORK_NAME = "datahaven-net";

/**
 * The base services that are always launched when Kurtosis is used.
 */
export const KURTOSIS_BASE_SERVICES = [
  "cl-1-lodestar-reth",
  "cl-2-lodestar-reth",
  "el-1-reth-lodestar",
  "el-2-reth-lodestar",
  "dora"
];

export const COMPONENTS = {
  datahaven: {
    imageName: "datahavenxyz/datahaven",
    componentName: "Datahaven Network",
    optionName: "datahaven"
  },
  snowbridge: {
    imageName: "datahavenxyz/snowbridge-relay",
    componentName: "Snowbridge Relayers",
    optionName: "relayer"
  }
} as const;

/**
 * Minimum required Bun version
 */
export const MIN_BUN_VERSION = { major: 1, minor: 2 };
