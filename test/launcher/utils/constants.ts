export const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS = [
  "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1", // Alice ECDSA
  "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27" // Bob ECDSA
];

export const COMPONENTS = {
  DATAHAVEN: "datahaven",
  KURTOSIS: "kurtosis",
  CONTRACTS: "contracts",
  VALIDATORS: "validators",
  RELAYERS: "relayers"
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
