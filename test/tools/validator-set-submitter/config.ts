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
  submitterPrivateKey?: string;
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
  const submitterPrivateKey = resolveSubmitterPrivateKey(raw, cli.submitterPrivateKey);
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

function resolveSubmitterPrivateKey(
  raw: Record<string, unknown>,
  cliPrivateKey?: string
): `0x${string}` {
  const submitterPrivateKey =
    cliPrivateKey ??
    process.env.SUBMITTER_PRIVATE_KEY ??
    optionalString(raw, "submitter_private_key");

  if (!submitterPrivateKey || submitterPrivateKey.length === 0) {
    throw new Error(
      "Missing submitter private key. Provide --submitter-private-key, SUBMITTER_PRIVATE_KEY, or submitter_private_key in config."
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(submitterPrivateKey)) {
    throw new Error("Submitter private key must be a 66-character hex string (0x + 64 hex chars)");
  }

  return submitterPrivateKey as `0x${string}`;
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const val = raw[key];
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`Missing required config field: ${key}`);
  }
  return val;
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
