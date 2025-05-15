import { z } from "zod";

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

export const ExecutionRelayConfigSchema = z.object({
  source: z.object({
    ethereum: z.object({
        endpoint: z.string(),
    }),
    contracts: z.object({
        Gateway: z.string(),
    }),
    "channel-id": z.string(),
    beacon: z.object({
      endpoint: z.string(),
      stateEndpoint: z.string(),
      spec: z.object({
        syncCommitteeSize: z.number(),
        slotsInEpoch: z.number(),
        epochsPerSyncCommitteePeriod: z.number(),
        forkVersions: z.object({
          deneb: z.number(),
          electra: z.number(),
        }),
      }),
      datastore: z.object({
        location: z.string(),
        maxEntries: z.number(),
      }),
    }),
  }),
  sink: z.object({
    parachain: z.object({
      endpoint: z.string(),
      maxWatchedExtrinsics: z.number(),
      headerRedundancy: z.number(),
    }),
  }),
  instantVerification: z.boolean(),
  schedule: z.object({
    id: z.number(),
    totalRelayerCount: z.number(),
    sleepInterval: z.number(),
  }),
});
export type ExecutionRelayConfig = z.infer<typeof ExecutionRelayConfigSchema>;

export type RelayerType = "beefy" | "beacon" | "execution";

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
 * Parse execution relay configuration
 */
function parseExecutionConfig(config: unknown): ExecutionRelayConfig {
  const result = ExecutionRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as ExecutionRelayConfig: ${result.error.message}`);
}

/**
 * Type Guard to check if a config object is a BeaconRelayConfig
 */
export function isBeaconConfig(
  config: BeaconRelayConfig | BeefyRelayConfig | ExecutionRelayConfig
): config is BeaconRelayConfig {
  return "beacon" in config.source;
}

export function parseRelayConfig(config: unknown, type: "beacon"): BeaconRelayConfig;
export function parseRelayConfig(config: unknown, type: "beefy"): BeefyRelayConfig;
export function parseRelayConfig(config: unknown, type: "execution"): ExecutionRelayConfig;
export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | ExecutionRelayConfig;
export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | ExecutionRelayConfig {
  if (type === "beacon") {
    return parseBeaconConfig(config);
  } else if (type === "beefy") {
    return parseBeefyConfig(config);
  } else {
    return parseExecutionConfig(config);
  }
}
