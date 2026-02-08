import { parseDeploymentsFile } from "utils";
import { parseEther } from "viem";
import { parse as parseYaml } from "yaml";

export interface SubmitterConfig {
  ethereumRpcUrl: string;
  datahavenWsUrl: string;
  submitterPrivateKey: `0x${string}`;
  serviceManagerAddress: `0x${string}`;
  networkId: string;
  executionFee: bigint;
  relayerFee: bigint;
  dryRun: boolean;
}

interface CliOverrides {
  dryRun?: boolean;
}

export async function loadConfig(
  configPath: string,
  cli: CliOverrides = {}
): Promise<SubmitterConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const raw = parseYaml(await file.text()) as Record<string, unknown>;

  const ethereumRpcUrl = requireString(raw, "ethereum_rpc_url");
  const datahavenWsUrl = requireString(raw, "datahaven_ws_url");
  const submitterPrivateKey = requireHexString(raw, "submitter_private_key");
  const networkId = optionalString(raw, "network_id") ?? "anvil";

  let serviceManagerAddress = optionalHexString(raw, "service_manager_address");
  if (!serviceManagerAddress) {
    const deployments = await parseDeploymentsFile(networkId);
    serviceManagerAddress = deployments.ServiceManager;
  }

  const executionFee = parseEther(optionalString(raw, "execution_fee") ?? "0.1");
  const relayerFee = parseEther(optionalString(raw, "relayer_fee") ?? "0.2");

  return {
    ethereumRpcUrl,
    datahavenWsUrl,
    submitterPrivateKey,
    serviceManagerAddress,
    networkId,
    executionFee,
    relayerFee,
    dryRun: cli.dryRun ?? false
  };
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const val = raw[key];
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`Missing required config field: ${key}`);
  }
  return val;
}

function requireHexString(raw: Record<string, unknown>, key: string): `0x${string}` {
  const val = requireString(raw, key);
  if (!val.startsWith("0x")) {
    throw new Error(`Config field ${key} must start with 0x`);
  }
  return val as `0x${string}`;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const val = raw[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") return String(val);
  return val;
}

function optionalHexString(raw: Record<string, unknown>, key: string): `0x${string}` | undefined {
  const val = optionalString(raw, key);
  if (!val) return undefined;
  if (!val.startsWith("0x")) {
    throw new Error(`Config field ${key} must start with 0x`);
  }
  return val as `0x${string}`;
}
