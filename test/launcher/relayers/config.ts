import path from "node:path";
import { logger } from "utils";
import type {
  BeaconConfig,
  BeefyConfig,
  ExecutionConfig,
  RelayerSpec,
  SolochainConfig
} from "./types";

export const generateRelayerConfig = async (
  relayer: RelayerSpec,
  _environment: string,
  outputDir: string
): Promise<void> => {
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

const createBeefyConfig = (relayer: RelayerSpec): BeefyConfig => {
  if (!relayer.config.beefyClientAddress || !relayer.config.gatewayAddress) {
    throw new Error("BeefyClient and Gateway addresses are required for beefy relayer");
  }
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
          BeefyClient: relayer.config.beefyClientAddress,
          Gateway: relayer.config.gatewayAddress
        },
        "fast-forward-blocks": 100
      }
    }
  };
}

const createBeaconConfig = (relayer: RelayerSpec): BeaconConfig => {
  if (
    !relayer.config.ethClEndpoint ||
    !relayer.config.beefyClientAddress ||
    !relayer.config.gatewayAddress
  ) {
    throw new Error(
      "ethClEndpoint, BeefyClient and Gateway addresses are required for beacon relayer"
    );
  }
  return {
    ethereum: {
      endpoint: relayer.config.ethClEndpoint
    },
    substrate: {
      endpoint: relayer.config.substrateWsEndpoint
    },
    sink: {
      ethereum: {
        contracts: {
          BeefyClient: relayer.config.beefyClientAddress,
          Gateway: relayer.config.gatewayAddress
        }
      }
    }
  };
}

const createExecutionConfig = (relayer: RelayerSpec): ExecutionConfig => {
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

const createSolochainConfig = (relayer: RelayerSpec): SolochainConfig => {
  if (!relayer.config.gatewayAddress) {
    throw new Error("Gateway address is required for solochain relayer");
  }
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
          Gateway: relayer.config.gatewayAddress
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
