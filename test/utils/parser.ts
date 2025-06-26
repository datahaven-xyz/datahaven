import { z } from "zod";

export const KurtosisEnclaveInfoSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  creationTime: z.string().min(1)
});
export type KurtosisEnclaveInfo = z.infer<typeof KurtosisEnclaveInfoSchema>;

export const BeaconRelayConfigSchema = z.object({
  source: z.object({
    beacon: z.object({
      endpoint: z.string(),
      stateEndpoint: z.string(),
      spec: z.object({
        syncCommitteeSize: z.number(),
        slotsInEpoch: z.number(),
        epochsPerSyncCommitteePeriod: z.number(),
        forkVersions: z.object({
          deneb: z.number(),
          electra: z.number()
        })
      }),
      datastore: z.object({
        location: z.string(),
        maxEntries: z.number()
      })
    })
  }),
  sink: z.object({
    parachain: z.object({
      endpoint: z.string(),
      maxWatchedExtrinsics: z.number(),
      headerRedundancy: z.number()
    }),
    updateSlotInterval: z.number()
  })
});
export type BeaconRelayConfig = z.infer<typeof BeaconRelayConfigSchema>;

export const BeefyRelayConfigSchema = z.object({
  source: z.object({
    polkadot: z.object({
      endpoint: z.string()
    })
  }),
  sink: z.object({
    ethereum: z.object({
      endpoint: z.string(),
      "gas-limit": z.string()
    }),
    "descendants-until-final": z.number(),
    contracts: z.object({
      BeefyClient: z.string(),
      Gateway: z.string()
    })
  }),
  "on-demand-sync": z.object({
    "max-tokens": z.number(),
    "refill-amount": z.number(),
    "refill-period": z.number()
  })
});
export type BeefyRelayConfig = z.infer<typeof BeefyRelayConfigSchema>;

export const SolochainRelayConfigSchema = z.object({
  source: z.object({
    ethereum: z.object({
      endpoint: z.string()
    }),
    solochain: z.object({
      endpoint: z.string()
    }),
    contracts: z.object({
      BeefyClient: z.string(),
      Gateway: z.string()
    }),
    beacon: z.object({
      endpoint: z.string(),
      stateEndpoint: z.string(),
      spec: z.object({
        syncCommitteeSize: z.number(),
        slotsInEpoch: z.number(),
        epochsPerSyncCommitteePeriod: z.number(),
        forkVersions: z.object({
          deneb: z.number(),
          electra: z.number()
        })
      }),
      datastore: z.object({
        location: z.string(),
        maxEntries: z.number()
      })
    })
  }),
  sink: z.object({
    contracts: z.object({
      Gateway: z.string()
    }),
    ethereum: z.object({
      endpoint: z.string()
    })
  }),
  schedule: z.object({
    id: z.number(),
    totalRelayerCount: z.number(),
    sleepInterval: z.number()
  }),
  "reward-address": z.string(),
  ofac: z.object({
    enabled: z.boolean(),
    apiKey: z.string()
  })
});
export type SolochainRelayConfig = z.infer<typeof SolochainRelayConfigSchema>;

export const ExecutionRelayConfigSchema = z.object({
  source: z.object({
    ethereum: z.object({
      endpoint: z.string()
    }),
    contracts: z.object({
      Gateway: z.string()
    }),
    beacon: z.object({
      endpoint: z.string(),
      stateEndpoint: z.string(),
      spec: z.object({
        syncCommitteeSize: z.number(),
        slotsInEpoch: z.number(),
        epochsPerSyncCommitteePeriod: z.number(),
        forkVersions: z.object({
          deneb: z.number(),
          electra: z.number()
        })
      }),
      datastore: z.object({
        location: z.string(),
        maxEntries: z.number()
      })
    })
  }),
  sink: z.object({
    parachain: z.object({
      endpoint: z.string(),
      maxWatchedExtrinsics: z.number(),
      headerRedundancy: z.number()
    })
  }),
  instantVerification: z.boolean(),
  schedule: z.object({
    id: z.number().nullable(),
    totalRelayerCount: z.number(),
    sleepInterval: z.number()
  }),
  ofac: z
    .object({
      enabled: z.boolean(),
      apiKey: z.string()
    })
    .optional()
});

export type ExecutionRelayConfig = z.infer<typeof ExecutionRelayConfigSchema>;

export type RelayerType = "beefy" | "beacon" | "solochain" | "execution";

/**
 * Parse beacon relay configuration
 */
function parseBeaconConfig(config: unknown): BeaconRelayConfig {
  const result = BeaconRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as BeaconRelayConfig: ${result.error.message}`);
}

/**
 * Parse beefy relay configuration
 */
function parseBeefyConfig(config: unknown): BeefyRelayConfig {
  const result = BeefyRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as BeefyRelayConfig: ${result.error.message}`);
}

/**
 * Parse solochain relay configuration
 */
function parseSolochainConfig(config: unknown): SolochainRelayConfig {
  const result = SolochainRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as SolochainRelayConfig: ${result.error.message}`);
}

/**
 * Parse execution relay configuration
 */
function parseExecutionConfig(config: unknown): ExecutionRelayConfig {
  const result = ExecutionRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as ExecutionRelayConfig: ${result.error.message}`);
}

export function parseRelayConfig(config: unknown, type: "beacon"): BeaconRelayConfig;
export function parseRelayConfig(config: unknown, type: "beefy"): BeefyRelayConfig;
export function parseRelayConfig(config: unknown, type: "execution"): ExecutionRelayConfig;
export function parseRelayConfig(config: unknown, type: "solochain"): SolochainRelayConfig;
export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | ExecutionRelayConfig | SolochainRelayConfig;

export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | ExecutionRelayConfig | SolochainRelayConfig {
  switch (type) {
    case "beacon":
      return parseBeaconConfig(config);
    case "beefy":
      return parseBeefyConfig(config);
    case "execution":
      return parseExecutionConfig(config);
    case "solochain":
      return parseSolochainConfig(config);
    default:
      throw new Error(`Unsupported relayer type with config: \n${JSON.stringify(config)}`);
  }
}

export type DeployEnvironment = "local" | "stagenet" | "testnet" | "mainnet";
