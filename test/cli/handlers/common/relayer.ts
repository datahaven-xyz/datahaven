import path from "node:path";
import { logger, parseRelayConfig } from "utils";

export type BeaconConfig = {
  type: "beacon";
  ethHttpEndpoint: string;
  substrateWsEndpoint: string;
};

export type BeefyConfig = {
  type: "beefy";
  ethWsEndpoint: string;
  substrateWsEndpoint: string;
  beefyClientAddress: string;
  gatewayAddress: string;
};

export type ExecutionConfig = {
  type: "execution";
  // TODO: Add execution config
};

export type SolochainConfig = {
  type: "solochain";
  // TODO: Add solochain config
};

export type RelayerConfigType = BeaconConfig | BeefyConfig | ExecutionConfig | SolochainConfig;

export type RelayerSpec = {
  name: string;
  configFilePath: string;
  config: RelayerConfigType;
  pk: { type: "ethereum" | "substrate"; value: string };
};

/**
 * Generates configuration files for relayers.
 *
 * @param relayerSpec - The relayer specification containing name, type, and config path.
 * @param environment - The environment to use for template files (e.g., "local", "stagenet", "testnet", "mainnet").
 * @param configDir - The directory where config files should be written.
 */
export const generateRelayerConfig = async (
  relayerSpec: RelayerSpec,
  environment: string,
  configDir: string
) => {
  const { name, configFilePath, config } = relayerSpec;
  const { type } = config;
  const configFileName = path.basename(configFilePath);

  logger.debug(`Creating config for ${name}`);
  const templateFilePath = `configs/snowbridge/${environment}/${configFileName}`;
  const outputFilePath = path.resolve(configDir, configFileName);
  logger.debug(`Reading config file ${templateFilePath}`);
  const file = Bun.file(templateFilePath);

  if (!(await file.exists())) {
    logger.error(`File ${templateFilePath} does not exist`);
    throw new Error("Error reading snowbridge config file");
  }
  const json = await file.json();

  logger.debug(`Generating ${type} relayer configuration for ${name}`);

  switch (type) {
    case "beacon": {
      const cfg = parseRelayConfig(json, type);
      cfg.source.beacon.endpoint = config.ethHttpEndpoint;
      cfg.source.beacon.stateEndpoint = config.ethHttpEndpoint;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = config.substrateWsEndpoint;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
      break;
    }
    case "beefy": {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = config.substrateWsEndpoint;
      cfg.sink.ethereum.endpoint = config.ethWsEndpoint;
      cfg.sink.contracts.BeefyClient = config.beefyClientAddress;
      cfg.sink.contracts.Gateway = config.gatewayAddress;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
      break;
    }
    case "execution": {
      throw new Error("Execution relayers are not supported yet");
    }
    case "solochain": {
      throw new Error("Solochain relayers are not supported yet");
    }
    default:
      throw new Error(`Unsupported relayer type with config: \n${JSON.stringify(config)}`);
  }
};
