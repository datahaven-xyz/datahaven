import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { createPapiConnectors } from "utils/papi";
import { concat, type Hex, toBytes, toHex } from "viem";
import { buildNetworkId } from "../../../configs/contracts/config";

interface UpdateRewardsOriginOptions {
  chain: string;
  environment?: string;
  rpcUrl: string;
  genesisHash?: string;
}

/**
 * Derives an AccountId20 from a PalletId using the same algorithm as Substrate's
 * `into_account_truncating()`.
 *
 * The algorithm (see https://www.shawntabrizi.com/substrate-js-utilities/):
 * 1. Prepends "modl" (4 bytes) to the 8-byte pallet ID
 * 2. For AccountId20 (H160), takes the first 20 bytes: modl(4) + pallet_id(8) + zeros(8)
 *
 * Note: This is a simple truncation, NOT a hash operation.
 *
 * @param palletId - The 8-character pallet ID string (e.g., "dh/evrew")
 * @returns The derived AccountId20 as a hex string
 */
const palletIdToAccountId20 = (palletId: string): Hex => {
  invariant(palletId.length === 8, "Pallet ID must be exactly 8 characters");

  // Build: "modl" (4 bytes) + pallet_id (8 bytes) + zeros (8 bytes) = 20 bytes
  const prefix = toBytes("modl");
  const palletIdBytes = toBytes(palletId);
  const accountId20 = new Uint8Array(20);
  accountId20.set(prefix, 0);
  accountId20.set(palletIdBytes, 4);
  // Remaining 8 bytes are already zeros (padding)

  return toHex(accountId20);
};

/**
 * Computes the Agent ID (H256) for a pallet's sovereign account on the DataHaven chain.
 *
 * The Agent ID is computed following Snowbridge's `AgentIdOf` type, which uses
 * `HashedDescription` with `DescribeGlobalPrefix`. For an AccountKey20 on a chain
 * identified by its genesis hash, the encoding is:
 *
 * blake2_256(SCALE_ENCODE(("GlobalConsensus", ByGenesis(genesis_hash), ("AccountKey20", account_key))))
 *
 * NOTE: This computation follows Snowbridge's pattern but may need verification against
 * the actual on-chain Agent ID. The preferred approach is to set RewardsAgentOrigin on
 * the chain and fetch it via this command.
 *
 * @param genesisHash - The chain's genesis hash (32 bytes, hex string with 0x prefix)
 * @param accountKey20 - The 20-byte account key (hex string with 0x prefix)
 * @returns The computed Agent ID as a hex string
 */
const computeAgentId = async (genesisHash: Hex, accountKey20: Hex): Promise<Hex> => {
  // Import blake2b dynamically (it's an ESM module)
  const { blake2b } = await import("@noble/hashes/blake2b");

  // Validate inputs
  invariant(
    genesisHash.length === 66,
    `Genesis hash must be 32 bytes (66 chars with 0x prefix), got ${genesisHash.length}`
  );
  invariant(
    accountKey20.length === 42,
    `Account key must be 20 bytes (42 chars with 0x prefix), got ${accountKey20.length}`
  );

  // SCALE encoding for the location description follows Snowbridge's pattern:
  // ("GlobalConsensus", ByGenesis(genesis_hash), interior_description)
  //
  // Where interior_description for AccountKey20 is:
  // ("AccountKey20", key)
  //
  // In SCALE for fixed-size arrays (like b"GlobalConsensus"):
  // - Fixed-size byte arrays are encoded as raw bytes without length prefix
  // - Variable-length Vec<u8> gets a compact length prefix
  // - Enums are encoded as variant index + payload

  // "GlobalConsensus" as raw bytes (15 bytes, no length prefix for fixed array)
  const globalConsensusBytes = toBytes("GlobalConsensus");

  // ByGenesis variant (index 0 in NetworkId enum) + genesis hash (32 bytes)
  // NetworkId::ByGenesis is the first variant, so index = 0
  const byGenesisVariant = new Uint8Array([0]);
  const genesisBytes = toBytes(genesisHash);

  // "AccountKey20" as raw bytes (12 bytes, no length prefix for fixed array)
  const accountKey20StrBytes = toBytes("AccountKey20");

  // Account key bytes (20 bytes)
  const accountKeyBytes = toBytes(accountKey20);

  // Build the interior description: ("AccountKey20", key) as raw bytes
  const interiorDescription = concat([accountKey20StrBytes, accountKeyBytes]);

  // Length prefix for interior (SCALE compact encoding: value << 2 for values < 64)
  const interiorLen = interiorDescription.length;
  const interiorLenCompact = new Uint8Array([interiorLen << 2]);

  // Final encoding: GlobalConsensus prefix + ByGenesis(genesis) + compact_len(interior)
  const encoded = concat([
    globalConsensusBytes,
    byGenesisVariant,
    genesisBytes,
    interiorLenCompact,
    interiorDescription
  ]);

  // Hash with blake2b-256 to get the Agent ID (same as Snowbridge's blake2_256)
  const hash = blake2b(new Uint8Array(encoded), { dkLen: 32 });
  return toHex(hash);
};

/**
 * Fetches the RewardsAgentOrigin from the runtime parameters.
 *
 * @param rpcUrl - WebSocket RPC endpoint of the DataHaven chain
 * @returns The RewardsAgentOrigin as a hex string, or null if not set or zero
 */
const fetchRewardsAgentOrigin = async (rpcUrl: string): Promise<Hex | null> => {
  logger.info(`📡 Connecting to DataHaven chain at ${rpcUrl}...`);

  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(rpcUrl);

  try {
    logger.info("🔍 Fetching RewardsAgentOrigin from runtime parameters...");

    // Query the Parameters pallet for RewardsAgentOrigin
    const parameter = await dhApi.query.Parameters.Parameters.getValue(
      {
        type: "RuntimeConfig",
        value: { type: "RewardsAgentOrigin", value: undefined }
      },
      { at: "best" }
    );

    if (!parameter) {
      logger.info("ℹ️  RewardsAgentOrigin parameter not found (using default)");
      return null;
    }

    // Extract the value from the parameter result
    // The parameter is wrapped in the RuntimeConfig enum variant
    if (parameter.type === "RuntimeConfig" && parameter.value.type === "RewardsAgentOrigin") {
      const origin = parameter.value.value;
      if (origin) {
        const originHex = origin.asHex();
        // Check if it's the zero hash
        const zeroHash =
          "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
        if (originHex === zeroHash) {
          logger.info("ℹ️  RewardsAgentOrigin is set to zero (placeholder)");
          return null;
        }
        logger.success(`Found RewardsAgentOrigin: ${originHex}`);
        return originHex as Hex;
      }
    }

    logger.info("ℹ️  RewardsAgentOrigin value not available");
    return null;
  } finally {
    papiClient.destroy();
  }
};

/**
 * Fetches the genesis hash from the chain.
 *
 * @param rpcUrl - WebSocket RPC endpoint of the DataHaven chain
 * @returns The genesis hash as a hex string
 */
const fetchGenesisHash = async (rpcUrl: string): Promise<Hex> => {
  logger.info("🔍 Fetching genesis hash from chain...");

  const { client: papiClient } = createPapiConnectors(rpcUrl);

  try {
    // Use _request to call chain_getBlockHash RPC method with block number 0
    const genesisHash = await papiClient._request<string>("chain_getBlockHash", [0]);
    logger.success(`Genesis hash: ${genesisHash}`);
    return genesisHash as Hex;
  } finally {
    papiClient.destroy();
  }
};

/**
 * Updates the config file with the rewards message origin.
 *
 * @param networkId - The network identifier (e.g., "hoodi", "stagenet-hoodi")
 * @param rewardsMessageOrigin - The rewards message origin (Agent ID)
 */
const updateConfigFile = async (networkId: string, rewardsMessageOrigin: Hex): Promise<void> => {
  const configFilePath = `../contracts/config/${networkId}.json`;
  const configFile = Bun.file(configFilePath);

  if (!(await configFile.exists())) {
    throw new Error(`Configuration file not found: ${configFilePath}`);
  }

  const configContent = await configFile.text();
  const configJson = JSON.parse(configContent);

  if (!configJson.snowbridge) {
    logger.warn(`"snowbridge" section not found in config, creating it.`);
    configJson.snowbridge = {};
  }

  const oldOrigin = configJson.snowbridge.rewardsMessageOrigin;
  configJson.snowbridge.rewardsMessageOrigin = rewardsMessageOrigin;

  await Bun.write(configFilePath, `${JSON.stringify(configJson, null, 2)}\n`);

  logger.success(`Config file updated: ${configFilePath}`);

  if (oldOrigin !== rewardsMessageOrigin) {
    logger.info(`  rewardsMessageOrigin: ${oldOrigin ?? "unset"} -> ${rewardsMessageOrigin}`);
  }
};

/**
 * Main handler for the update-rewards-origin command.
 * Fetches or computes the RewardsAgentOrigin and updates the config file.
 */
export const updateRewardsOrigin = async (options: UpdateRewardsOriginOptions): Promise<void> => {
  const networkId = buildNetworkId(options.chain, options.environment);

  printHeader(`Updating Rewards Message Origin for ${networkId}`);

  logger.info("📋 Configuration:");
  logger.info(`   Chain: ${options.chain}`);
  if (options.environment) {
    logger.info(`   Environment: ${options.environment}`);
  }
  logger.info(`   RPC URL: ${options.rpcUrl}`);
  if (options.genesisHash) {
    logger.info(`   Genesis hash (provided): ${options.genesisHash}`);
  }
  logger.info(`   Config file: contracts/config/${networkId}.json`);

  printDivider();

  try {
    // Step 1: Try to fetch RewardsAgentOrigin from the chain
    let rewardsMessageOrigin = await fetchRewardsAgentOrigin(options.rpcUrl);

    printDivider();

    if (rewardsMessageOrigin) {
      // Use the value from the chain
      logger.info("✅ Using RewardsAgentOrigin from chain runtime parameters");
    } else {
      // Compute the Agent ID from genesis hash and pallet account
      logger.info("🔧 Computing RewardsAgentOrigin from genesis hash and pallet account...");

      // Get genesis hash (from option or fetch from chain)
      const genesisHash = options.genesisHash
        ? (options.genesisHash as Hex)
        : await fetchGenesisHash(options.rpcUrl);

      // Derive the ExternalValidatorRewardsAccount from the pallet ID "dh/evrew"
      const palletId = "dh/evrew";
      logger.info(`🔐 Deriving account from pallet ID: "${palletId}"`);
      const rewardsAccount = palletIdToAccountId20(palletId);
      logger.info(`   Rewards pallet account: ${rewardsAccount}`);

      // Compute the Agent ID
      logger.info("🔐 Computing Agent ID...");
      logger.warn(
        "⚠️  Note: Computed Agent ID may need verification. Prefer setting RewardsAgentOrigin on-chain."
      );
      rewardsMessageOrigin = await computeAgentId(genesisHash, rewardsAccount);
      logger.info(`   Agent ID: ${rewardsMessageOrigin}`);
    }

    printDivider();

    // Display the final value
    logger.info("📝 Rewards Message Origin:");
    logger.info(`   ${rewardsMessageOrigin}`);

    printDivider();

    // Update the config file
    await updateConfigFile(networkId, rewardsMessageOrigin);

    printDivider();
    logger.success(`Rewards message origin updated successfully for ${networkId}`);
  } catch (error) {
    logger.error(`Failed to update rewards message origin: ${error}`);
    throw error;
  }
};

/**
 * CLI action handler for the update-rewards-origin command.
 * Note: Chain and environment validation is handled by contractsPreActionHook.
 */
export const contractsUpdateRewardsOrigin = async (options: any, _command: any): Promise<void> => {
  const { chain, environment, rpcUrl, genesisHash } = options;

  // Validate rpc-url (specific to this command, not validated by preAction hook)
  if (!rpcUrl) {
    logger.error("❌ --rpc-url is required (WebSocket URL to the DataHaven chain)");
    process.exit(1);
  }

  // Validate genesis hash format if provided
  if (genesisHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(genesisHash)) {
      logger.error("❌ --genesis-hash must be a 32-byte hex string (0x + 64 hex chars)");
      process.exit(1);
    }
  }

  await updateRewardsOrigin({
    chain,
    environment,
    rpcUrl,
    genesisHash
  });
};
