import path from "node:path";
import { logger } from "utils";
import type {
  BeaconConfig,
  BeefyConfig,
  ExecutionConfig,
  RelayerSpec,
  SolochainConfig
} from "./types";

export async function generateRelayerConfig(
  relayer: RelayerSpec,
  environment: string,
  outputDir: string
): Promise<void> {
  let config: any;

  switch (relayer.config.type) {
    case "beefy":
      config = createBeefyConfig(relayer);
      break;
    case "beacon":
      config = createBeaconConfig(relayer);
      break;
    case "execution":
      config = createExecutionConfig(relayer);
      break;
    case "solochain":
      config = createSolochainConfig(relayer);
      break;
    default:
      throw new Error(`Unknown relayer type: ${relayer.config.type}`);
  }

  const outputPath = path.join(outputDir, path.basename(relayer.configFilePath));
  await Bun.write(outputPath, JSON.stringify(config, null, 2));
  logger.success(`Updated ${relayer.config.type} config written to ${outputPath}`);
}

function createBeefyConfig(relayer: RelayerSpec): BeefyConfig {
  return {
    ethereum: {
      endpoint: relayer.config.ethElRpcEndpoint
    },
    substrate: {
      endpoint: relayer.config.substrateWsEndpoint
    },
    sink: {
      ethereum: {
        contracts: {
          BeefyClient: relayer.config.beefyClientAddress!,
          Gateway: relayer.config.gatewayAddress!
        },
        "fast-forward-blocks": 100
      }
    }
  };
}

function createBeaconConfig(relayer: RelayerSpec): BeaconConfig {
  return {
    ethereum: {
      endpoint: relayer.config.ethClEndpoint!
    },
    substrate: {
      endpoint: relayer.config.substrateWsEndpoint
    },
    sink: {
      ethereum: {
        contracts: {
          BeefyClient: relayer.config.beefyClientAddress!,
          Gateway: relayer.config.gatewayAddress!
        }
      }
    }
  };
}

function createExecutionConfig(relayer: RelayerSpec): ExecutionConfig {
  return {
    ethereum: {
      endpoint: relayer.config.ethElRpcEndpoint
    },
    substrate: {
      endpoint: relayer.config.substrateWsEndpoint
    },
    sink: {
      substrate: {
        "para-id": 1000
      }
    }
  };
}

function createSolochainConfig(relayer: RelayerSpec): SolochainConfig {
  return {
    ethereum: {
      endpoint: relayer.config.ethElRpcEndpoint
    },
    substrate: {
      endpoint: relayer.config.substrateWsEndpoint
    },
    source: {
      ethereum: {
        contracts: {
          Gateway: relayer.config.gatewayAddress!
        }
      }
    },
    sink: {
      substrate: {
        "para-id": 1000
      }
    }
  };
}
