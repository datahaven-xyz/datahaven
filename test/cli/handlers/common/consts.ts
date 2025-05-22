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
    imageName: "snowbridge-relayer",
    componentName: "Snowbridge Relayers",
    optionName: "relayer"
  }
} as const;

/**
 * The base services that are always launched when Kurtosis is used.
 */
export const BASE_SERVICES = [
  "cl-1-lighthouse-reth",
  "cl-2-lighthouse-reth",
  "el-1-reth-lighthouse",
  "el-2-reth-lighthouse",
  "dora"
];
