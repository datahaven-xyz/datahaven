import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "bun";
import { logger } from "utils";
import { z } from "zod";

logger.trace("Parsing command line arguments");
const {
  values: {
    outputDir = "tmp/output",
    assetsDir = "configs/snowbridge",
    logsDir = "tmp/logs",
    relayBin = "relay",
    ethEndpointWs = "ws://localhost:8545",
    ethGasLimit = "8000000",
    relaychainEndpoint = "ws://localhost:9944",
    beaconEndpointHttp = "http://localhost:5052",
    ethWriterEndpoint, // default to ethEndpointWs below
    primaryGovernanceChannelId = "0",
    secondaryGovernanceChannelId = "1"
  }
} = parseArgs({
  options: {
    outputDir: { type: "string" },
    assetsDir: { type: "string" },
    logsDir: { type: "string" },
    relayBin: { type: "string" },
    ethEndpointWs: { type: "string" },
    ethGasLimit: { type: "string" },
    relaychainEndpoint: { type: "string" },
    beaconEndpointHttp: { type: "string" },
    ethWriterEndpoint: { type: "string" },
    primaryGovernanceChannelId: { type: "string" },
    secondaryGovernanceChannelId: { type: "string" }
  },
  args: process.argv.slice(2)
});

const resolvedEthWriterEndpoint = ethWriterEndpoint || ethEndpointWs;

const dataStoreDir = join(outputDir, "relayer_data");

logger.debug(
  {
    outputDir,
    assetsDir,
    logsDir,
    relayBin,
    ethEndpointWs,
    ethGasLimit,
    relaychainEndpoint,
    beaconEndpointHttp,
    ethWriterEndpoint,
    resolvedEthWriterEndpoint,
    primaryGovernanceChannelId,
    secondaryGovernanceChannelId,
    dataStoreDir
  },
  "Resolved configuration values"
);

// Helper: Get contract address (stub, replace with actual lookup)
async function getSnowbridgeAddressFor(name: string): Promise<string> {
  // TODO: Implement actual lookup logic or add as CLI arg if required
  return process.env[`SNOWBRIDGE_${name.toUpperCase()}_ADDRESS`] || "";
}

// ---- Zod Schemas for Validation ----
const beefyRelaySchema = z.object({
  sink: z.object({
    contracts: z.object({
      BeefyClient: z.string().optional(),
      Gateway: z.string().optional()
    }),
    ethereum: z.object({
      endpoint: z.string(),
      "gas-limit": z.string()
    })
  }),
  source: z.object({
    polkadot: z.object({
      endpoint: z.string()
    })
  })
});

const beaconRelaySchema = z.object({
  source: z.object({
    beacon: z.object({
      endpoint: z.string(),
      spec: z.object({
        forkVersions: z.object({
          electra: z.number()
        })
      }),
      datastore: z.object({
        location: z.string()
      })
    })
  }),
  sink: z.object({
    parachain: z.object({
      endpoint: z.string()
    })
  })
});

const executionRelaySchema = z.object({
  source: z.object({
    ethereum: z.object({
      endpoint: z.string()
    }),
    contracts: z.object({
      Gateway: z.string()
    }),
    "channel-id": z.string(),
    beacon: z.object({
      datastore: z.object({
        location: z.string()
      })
    })
  }),
  sink: z.object({
    parachain: z.object({
      endpoint: z.string()
    })
  }),
  schedule: z.object({
    id: z.number()
  })
});

const substrateRelaySchema = z.object({
  source: z.object({
    ethereum: z.object({
      endpoint: z.string()
    }),
    polkadot: z.object({
      endpoint: z.string()
    }),
    contracts: z.object({
      BeefyClient: z.string(),
      Gateway: z.string()
    }),
    "channel-id": z.string()
  }),
  sink: z.object({
    contracts: z.object({
      Gateway: z.string()
    }),
    ethereum: z.object({
      endpoint: z.string()
    })
  })
});

// ---- Config Generation ----
async function updateJsonConfig<T>(
  templateName: string,
  outputName: string,
  schema: z.ZodType<T>,
  updateFn: (obj: T) => void | Promise<void>
) {
  const templatePath = join(assetsDir, templateName);
  const outputPath = join(outputDir, outputName);
  const obj = await import(templatePath, { with: { type: "json" } });
  logger.trace({ templatePath, outputPath }, "Read config template");
  logger.trace({ rawConfig: obj.default }, "Attempting to parse config with Zod schema");
  const config = schema.parse(obj.default); // Validate
  logger.debug("Successfully parsed config with Zod schema");
  logger.trace({ config }, "Parsed config template");
  await updateFn(config);
  logger.trace({ config }, "Updated config object");
  await writeFile(outputPath, JSON.stringify(config, null, 2));
  logger.debug(`Wrote configuration to ${outputPath}`);
}

async function configRelayer() {
  logger.info("Starting configuration generation...");

  // Ensure all required directories exist
  logger.debug("Ensuring all required directories exist");
  for (const dir of [outputDir, assetsDir, logsDir, dataStoreDir]) {
    await mkdir(dir, { recursive: true });
    logger.debug(`Ensured directory exists: ${dir}`);
  }

  // Beefy relay
  logger.debug("Configuring Beefy relay...");
  await updateJsonConfig("beefy-relay.json", "beefy-relay.json", beefyRelaySchema, async (obj) => {
    obj.sink.contracts.BeefyClient = await getSnowbridgeAddressFor("BeefyClient");
    obj.sink.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
    obj.sink.ethereum.endpoint = ethEndpointWs;
    obj.sink.ethereum["gas-limit"] = ethGasLimit;
    obj.source.polkadot.endpoint = relaychainEndpoint;
  });

  // Beacon relay
  logger.debug("Configuring Beacon relay...");
  await updateJsonConfig("beacon-relay.json", "beacon-relay.json", beaconRelaySchema, (obj) => {
    obj.source.beacon.endpoint = beaconEndpointHttp;
    obj.source.beacon.spec.forkVersions.electra = 0;
    obj.sink.parachain.endpoint = relaychainEndpoint;
    obj.source.beacon.datastore.location = dataStoreDir;
  });

  // Execution relay
  logger.debug("Configuring Execution relay...");
  await updateJsonConfig(
    "execution-relay.json",
    "execution-relay.json",
    executionRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = ethEndpointWs;
      obj.source.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
      obj.source["channel-id"] = primaryGovernanceChannelId;
      obj.source.beacon.datastore.location = dataStoreDir;
      obj.sink.parachain.endpoint = relaychainEndpoint;
      obj.schedule.id = 0;
    }
  );

  // Substrate relay - primary
  logger.debug("Configuring Primary Substrate relay...");
  await updateJsonConfig(
    "substrate-relay.json",
    "substrate-relay-primary.json",
    substrateRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = ethEndpointWs;
      obj.source.polkadot.endpoint = relaychainEndpoint;
      obj.source.contracts.BeefyClient = await getSnowbridgeAddressFor("BeefyClient");
      obj.source.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
      obj.source["channel-id"] = primaryGovernanceChannelId;
      obj.sink.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
      obj.sink.ethereum.endpoint = resolvedEthWriterEndpoint;
    }
  );

  // Substrate relay - secondary
  logger.debug("Configuring Secondary Substrate relay...");
  await updateJsonConfig(
    "substrate-relay.json",
    "substrate-relay-secondary.json",
    substrateRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = ethEndpointWs;
      obj.source.polkadot.endpoint = relaychainEndpoint;
      obj.source.contracts.BeefyClient = await getSnowbridgeAddressFor("BeefyClient");
      obj.source.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
      obj.source["channel-id"] = secondaryGovernanceChannelId;
      obj.sink.contracts.Gateway = await getSnowbridgeAddressFor("GatewayProxy");
      obj.sink.ethereum.endpoint = resolvedEthWriterEndpoint;
    }
  );
  logger.info("Finished configuration generation.");
}

const beaconFinalitySchema = z
  .object({
    execution_optimistic: z.boolean().describe("Whether the response is from an optimistic node"),
    finalized: z.boolean().describe("Whether the chain has been finalized"),
    data: z
      .object({
        previous_justified: z
          .object({
            epoch: z.string().describe("The epoch number of the previous justified checkpoint"),
            root: z.string().describe("The block root hash of the previous justified checkpoint")
          })
          .describe("Previous justified checkpoint information"),
        current_justified: z
          .object({
            epoch: z.string().describe("The epoch number of the current justified checkpoint"),
            root: z.string().describe("The block root hash of the current justified checkpoint")
          })
          .describe("Current justified checkpoint information"),
        finalized: z
          .object({
            epoch: z.string().describe("The epoch number of the latest finalized checkpoint"),
            root: z.string().describe("The block root hash of the latest finalized checkpoint")
          })
          .describe("Latest finalized checkpoint information")
      })
      .describe("Checkpoint data containing justified and finalized states")
  })
  .describe("Beacon chain finality checkpoints response schema");

async function waitBeaconChainReady() {
  logger.info("Waiting for Beacon chain finality...");
  let initialBeaconBlock = "";
  const maxAttempts = 300; // 5 minutes = 300 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(
        `${beaconEndpointHttp}/eth/v1/beacon/states/head/finality_checkpoints`
      );
      const json = await res.json();
      const parsed = beaconFinalitySchema.parse(json);
      initialBeaconBlock = parsed.data.finalized.root || "";

      logger.trace({ attempt: i + 1, initialBeaconBlock }, "Checked beacon finality");

      if (
        initialBeaconBlock &&
        initialBeaconBlock !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        logger.info(`Beacon chain finalized. Finalized root: ${initialBeaconBlock}`);
        return;
      }
    } catch {
      logger.trace({ attempt: i + 1 }, "Beacon finality check failed or not ready, retrying...");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("❌ Beacon chain not ready after 5 minutes timeout");
}

async function writeBeaconCheckpoint() {
  logger.info("Generating beacon checkpoint...");
  const cmdArgs = [
    relayBin,
    "generate-beacon-checkpoint",
    "--config",
    join(outputDir, "beacon-relay.json"),
    "--export-json"
  ];
  logger.debug({ command: cmdArgs.join(" ") }, "Spawning process to generate beacon checkpoint");
  const proc = spawn({
    cmd: cmdArgs,
    cwd: outputDir,
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  logger.info("Beacon checkpoint generated.");
}

export const generateSnowbridgeConfigs = async () => {
  logger.info("Starting Snowbridge config generation script...");
  await configRelayer();
  await waitBeaconChainReady();
  await writeBeaconCheckpoint();
  logger.info("Snowbridge config generation script finished successfully.");
};
