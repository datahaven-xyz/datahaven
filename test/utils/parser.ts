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

export const SubstrateRelayConfigSchema = z
  .object({
    source: z.object({
      ethereum: z.object({
        endpoint: z.string()
      }),
      polkadot: z.object({
        endpoint: z.string()
      }),
      parachain: z.object({
        endpoint: z.string()
      }),
      contracts: z.object({
        BeefyClient: z.string(),
        Gateway: z.string()
      }),
    }),
    sink: z.object({
      contracts: z.object({
        Gateway: z.string()
      }),
      ethereum: z.object({
        endpoint: z.string(),
        "gas-limit": z.string()
      })
    }),
    schedule: z.object({
      id: z.number(),
      totalRelayerCount: z.number(),
      sleepInterval: z.number()
    }),
    "reward-address": z.string(),
  });
export type SubstrateRelayConfig = z.infer<typeof SubstrateRelayConfigSchema>;

export type RelayerType = "beefy" | "beacon" | "substrate";

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
 * Parse substrate relay configuration
 */
function parseSubstrateConfig(config: unknown): SubstrateRelayConfig {
  const result = SubstrateRelayConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Failed to parse config as SubstrateRelayConfig: ${result.error.message}`);
}

/**
 * Type Guard to check if a config object is a BeaconRelayConfig
 */
export function isBeaconConfig(
  config: BeaconRelayConfig | BeefyRelayConfig
): config is BeaconRelayConfig {
  return "beacon" in config.source;
}

export function parseRelayConfig(config: unknown, type: "beacon"): BeaconRelayConfig;
export function parseRelayConfig(config: unknown, type: "beefy"): BeefyRelayConfig;
export function parseRelayConfig(config: unknown, type: "substrate"): SubstrateRelayConfig;
export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | SubstrateRelayConfig;
export function parseRelayConfig(
  config: unknown,
  type: RelayerType
): BeaconRelayConfig | BeefyRelayConfig | SubstrateRelayConfig {
  return type === "beacon" ? parseBeaconConfig(config) : type === "beefy" ? parseBeefyConfig(config) : parseSubstrateConfig(config);
}
