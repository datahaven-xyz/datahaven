export const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * The name of the Docker network that DataHaven nodes and
 * Snowbridge relayers will be connected to, in a local deployment.
 */
export const DOCKER_NETWORK_NAME = "datahaven-net";

/**
 * 33-byte compressed public keys for DataHaven next validator set
 * These correspond to Alice & Bob
 * These are the fallback keys if we can't fetch the next authorities directly from the network
 */
export const FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS: Record<string, string> = {
  alice: "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1",
  bob: "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27"
} as const;

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
 * The base services that are always launched when Kurtosis is used.
 */
export const BASE_SERVICES = [
  "cl-1-lodestar-reth",
  "cl-2-lodestar-reth",
  "el-1-reth-lodestar",
  "el-2-reth-lodestar",
  "dora"
];

/**
 * Minimum required Bun version
 */
export const MIN_BUN_VERSION = { major: 1, minor: 2 };
