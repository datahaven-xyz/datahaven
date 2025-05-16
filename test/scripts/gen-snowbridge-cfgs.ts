import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "bun";
import { logger } from "utils";
import { z } from "zod";

// ---- Zod Schemas for Validation ----
const beefyRelaySchema = z
  .object({
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
  })
  .describe("Beefy Relay Configuration");

const beaconRelaySchema = z
  .object({
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
  })
  .describe("Beacon Relay Configuration");

const executionRelaySchema = z
  .object({
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
  })
  .describe("Execution Layer Relay Configuration");

const substrateRelaySchema = z
  .object({
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
    "reward-address": z.string()
  })
  .describe("Substrate Relay Configuration");

const beaconFinalitySchema = z
  .object({
    execution_optimistic: z.boolean(),
    finalized: z.boolean(),
    data: z.object({
      previous_justified: z.object({
        epoch: z.string(),
        root: z.string()
      }),
      current_justified: z.object({
        epoch: z.string(),
        root: z.string()
      }),
      finalized: z.object({
        epoch: z.string(),
        root: z.string()
      })
    })
  })
  .describe("Beacon Finality Configuration");

// ---- Configuration Options ----
interface SnowbridgeConfigOptions {
  outputDir: string;
  assetsDir: string;
  logsDir: string;
  relayBin: string;
  ethEndpointWs: string;
  ethGasLimit: string;
  relaychainEndpoint: string;
  beaconEndpointHttp: string;
  ethWriterEndpoint: string;
  primaryGovernanceChannelId: string;
  secondaryGovernanceChannelId: string;
  dataStoreDir: string;
  beaconWaitTimeoutSeconds: number;
  beaconElectraForkVersion: number;
  executionScheduleId: number;
}

const DEFAULT_OPTIONS = {
  outputDir: "tmp/output",
  assetsDir: "configs/snowbridge",
  logsDir: "tmp/logs",
  relayBin: "relay",
  ethEndpointWs: "ws://localhost:8545",
  ethGasLimit: "8000000",
  relaychainEndpoint: "ws://localhost:9944",
  beaconEndpointHttp: "http://localhost:5052",
  ethWriterEndpoint: "",
  primaryGovernanceChannelId: "0",
  secondaryGovernanceChannelId: "1",
  beaconWaitTimeoutSeconds: 300,
  beaconElectraForkVersion: 0,
  executionScheduleId: 0
};

/**
 * Retrieves a Snowbridge contract address from environment variables.
 */
async function getSnowbridgeAddressFromEnv(name: string): Promise<string> {
  const envVarName = `SNOWBRIDGE_${name.toUpperCase()}_ADDRESS`;
  const address = process.env[envVarName];
  if (!address) {
    logger.warn(`Environment variable ${envVarName} not set. Using empty string.`);
  }
  return address || "";
}

/**
 * Reads, validates, updates, and writes a JSON configuration file.
 */
async function updateJsonConfig<T>(
  templateName: string,
  outputName: string,
  schema: z.ZodType<T>,
  updateFn: (obj: T) => void | Promise<void>,
  options: { assetsDir: string; outputDir: string }
): Promise<void> {
  const templatePath = join(options.assetsDir, templateName);
  const outputPath = join(options.outputDir, outputName);

  try {
    logger.trace({ templatePath, outputPath }, "Read config template");
    const obj = await import(templatePath, { with: { type: "json" } });
    logger.trace(
      { rawConfig: obj.default },
      `Attempting to parse ${templateName} config with Zod schema`
    );
    const config = schema.parse(obj.default);
    logger.debug(`Successfully parsed ${schema.description} `);

    await updateFn(config);
    logger.trace({ config }, "Updated config object");

    await writeFile(outputPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote configuration to ${outputPath}`);
  } catch (error) {
    logger.error(
      { err: error, templatePath, outputPath },
      `Failed to update/write config ${outputName}`
    );
    throw error;
  }
}

/**
 * Configures all relayer components
 */
async function configRelayer(options: SnowbridgeConfigOptions): Promise<void> {
  logger.info("Starting configuration generation...");

  // Ensure all required directories exist
  logger.debug("Ensuring all required directories exist");
  for (const dir of [options.outputDir, options.assetsDir, options.logsDir, options.dataStoreDir]) {
    await mkdir(dir, { recursive: true });
    logger.debug(`Ensured directory exists: ${dir}`);
  }

  const commonOptions = {
    assetsDir: options.assetsDir,
    outputDir: options.outputDir
  };

  // Beefy relay
  logger.debug("Configuring Beefy relay...");
  await updateJsonConfig(
    "beefy-relay.json",
    "beefy-relay.json",
    beefyRelaySchema,
    async (obj) => {
      obj.sink.contracts.BeefyClient = await getSnowbridgeAddressFromEnv("BeefyClient");
      obj.sink.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.sink.ethereum.endpoint = options.ethEndpointWs;
      obj.sink.ethereum["gas-limit"] = options.ethGasLimit;
      obj.source.polkadot.endpoint = options.relaychainEndpoint;
    },
    commonOptions
  );

  // Beacon relay
  logger.debug("Configuring Beacon relay...");
  await updateJsonConfig(
    "beacon-relay.json",
    "beacon-relay.json",
    beaconRelaySchema,
    (obj) => {
      obj.source.beacon.endpoint = options.beaconEndpointHttp;
      obj.source.beacon.spec.forkVersions.electra = options.beaconElectraForkVersion;
      obj.source.beacon.datastore.location = options.dataStoreDir;
      obj.sink.parachain.endpoint = options.relaychainEndpoint;
    },
    commonOptions
  );

  // Execution relay
  logger.debug("Configuring Execution relay...");
  await updateJsonConfig(
    "execution-relay.json",
    "execution-relay.json",
    executionRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = options.ethEndpointWs;
      obj.source.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.source["channel-id"] = options.primaryGovernanceChannelId;
      obj.source.beacon.datastore.location = options.dataStoreDir;
      obj.sink.parachain.endpoint = options.relaychainEndpoint;
      obj.schedule.id = options.executionScheduleId;
    },
    commonOptions
  );

  // Substrate relay - primary
  logger.debug("Configuring Primary Substrate relay...");
  await updateJsonConfig(
    "substrate-relay.json",
    "substrate-relay-primary.json",
    substrateRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = options.ethEndpointWs;
      obj.source.polkadot.endpoint = options.relaychainEndpoint;
      obj.source.contracts.BeefyClient = await getSnowbridgeAddressFromEnv("BeefyClient");
      obj.source.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.sink.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.sink.ethereum.endpoint = options.ethWriterEndpoint;
      obj.sink.ethereum["gas-limit"] = options.ethGasLimit;
    },
    commonOptions
  );

  // Substrate relay - secondary
  logger.debug("Configuring Secondary Substrate relay...");
  await updateJsonConfig(
    "substrate-relay.json",
    "substrate-relay-secondary.json",
    substrateRelaySchema,
    async (obj) => {
      obj.source.ethereum.endpoint = options.ethEndpointWs;
      obj.source.polkadot.endpoint = options.relaychainEndpoint;
      obj.source.contracts.BeefyClient = await getSnowbridgeAddressFromEnv("BeefyClient");
      obj.source.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.sink.contracts.Gateway = await getSnowbridgeAddressFromEnv("GatewayProxy");
      obj.sink.ethereum.endpoint = options.ethWriterEndpoint;
      obj.sink.ethereum["gas-limit"] = options.ethGasLimit;
    },
    commonOptions
  );

  logger.info("Finished configuration generation.");
}

/**
 * Waits for the Beacon chain to reach finality before proceeding
 */
async function waitBeaconChainReady(options: SnowbridgeConfigOptions): Promise<void> {
  logger.info("Waiting for Beacon chain finality...");
  let initialBeaconBlock = "";
  const maxAttempts = options.beaconWaitTimeoutSeconds;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(
        `${options.beaconEndpointHttp}/eth/v1/beacon/states/head/finality_checkpoints`
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
    } catch (_error) {
      logger.trace({ attempt: i + 1 }, "Beacon finality check failed or not ready, retrying...");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `❌ Beacon chain not ready after ${options.beaconWaitTimeoutSeconds} seconds timeout`
  );
}

/**
 * Generates a beacon checkpoint using the relay binary
 */
async function writeBeaconCheckpoint(options: SnowbridgeConfigOptions): Promise<void> {
  logger.info("Generating beacon checkpoint...");
  const cmdArgs = [
    options.relayBin,
    "generate-beacon-checkpoint",
    "--config",
    join(options.outputDir, "beacon-relay.json"),
    "--export-json"
  ];

  logger.debug({ command: cmdArgs.join(" ") }, "Spawning process to generate beacon checkpoint");

  const proc = spawn({
    cmd: cmdArgs,
    cwd: options.outputDir,
    stdout: "pipe",
    stderr: "pipe"
  });

  await proc.exited;
  logger.info("Beacon checkpoint generated.");
}

/**
 * Main function to generate Snowbridge configurations
 */
export async function generateSnowbridgeConfigs(
  customOptions: Partial<Omit<SnowbridgeConfigOptions, "dataStoreDir">> = {}
): Promise<void> {
  // Merge default options with custom options
  const mergedOptions = { ...DEFAULT_OPTIONS, ...customOptions };

  // Add derived options
  const options: SnowbridgeConfigOptions = {
    ...mergedOptions,
    ethWriterEndpoint: mergedOptions.ethWriterEndpoint || mergedOptions.ethEndpointWs,
    dataStoreDir: join(mergedOptions.outputDir, "relayer_data")
  };

  logger.debug({ options }, "Resolved configuration values");

  logger.info("Starting Snowbridge config generation script...");

  try {
    await configRelayer(options);
    await waitBeaconChainReady(options);
    await writeBeaconCheckpoint(options);
    logger.info("Snowbridge config generation script finished successfully.");
  } catch (error) {
    logger.error({ err: error }, "Snowbridge config generation script failed");
    throw error;
  }
}

// Check if we're running this file directly
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.trace("Parsing command line arguments");

  const { values } = parseArgs({
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

  // Convert string arguments to appropriate types
  const options: Partial<Omit<SnowbridgeConfigOptions, "dataStoreDir">> = {};

  // Only add properties that were actually provided
  if (values.outputDir) options.outputDir = values.outputDir;
  if (values.assetsDir) options.assetsDir = values.assetsDir;
  if (values.logsDir) options.logsDir = values.logsDir;
  if (values.relayBin) options.relayBin = values.relayBin;
  if (values.ethEndpointWs) options.ethEndpointWs = values.ethEndpointWs;
  if (values.ethGasLimit) options.ethGasLimit = values.ethGasLimit;
  if (values.relaychainEndpoint) options.relaychainEndpoint = values.relaychainEndpoint;
  if (values.beaconEndpointHttp) options.beaconEndpointHttp = values.beaconEndpointHttp;
  if (values.ethWriterEndpoint) options.ethWriterEndpoint = values.ethWriterEndpoint;
  if (values.primaryGovernanceChannelId)
    options.primaryGovernanceChannelId = values.primaryGovernanceChannelId;
  if (values.secondaryGovernanceChannelId)
    options.secondaryGovernanceChannelId = values.secondaryGovernanceChannelId;

  generateSnowbridgeConfigs(options).catch((error) => {
    console.error("Failed to generate Snowbridge configs:", error);
    process.exit(1);
  });
}
