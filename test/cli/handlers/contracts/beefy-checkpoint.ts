import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { createPapiConnectors } from "utils/papi";
import { type Hex, keccak256 } from "viem";
import { buildNetworkId } from "../../../configs/contracts/config";
import { compressedPubKeyToEthereumAddress } from "../../../launcher/datahaven";

interface UpdateBeefyCheckpointOptions {
  chain: string;
  environment?: string;
  rpcUrl: string;
}

interface BeefyCheckpointData {
  startBlock: number;
  minNumRequiredSignatures: number;
  initialValidatorSetId: number;
  initialValidatorHashes: string[];
  nextValidatorSetId: number;
  nextValidatorHashes: string[];
}

/**
 * Converts an array of compressed public keys to authority hashes.
 *
 * @param authorityPublicKeys - Array of compressed public keys as hex strings
 * @returns Array of authority hashes (keccak256 of Ethereum addresses)
 */
const computeAuthorityHashes = (authorityPublicKeys: string[]): string[] => {
  const authorityHashes: string[] = [];
  for (const compressedKey of authorityPublicKeys) {
    const ethAddress = compressedPubKeyToEthereumAddress(compressedKey);
    const authorityHash = keccak256(ethAddress as Hex);
    authorityHashes.push(authorityHash);
    logger.debug(
      `  ${compressedKey.slice(0, 20)}... -> ${ethAddress} -> ${authorityHash.slice(0, 20)}...`
    );
  }
  return authorityHashes;
};

/**
 * Calculates the minimum number of required signatures for BFT security.
 * Uses the same formula as Snowbridge's BeefyClient contract to ensure
 * strictly more than 2/3 of validators must sign.
 *
 * Formula: n - floor((n-1)/3)
 *
 * This ensures strictly > 2/3 majority. For example:
 * - n=3: returns 3 (not 2, which would be exactly 2/3)
 * - n=6: returns 5 (not 4, which would be exactly 2/3)
 * - n=100: returns 67 (strictly > 66.67)
 *
 * @see https://github.com/datahaven-xyz/snowbridge/blob/main/contracts/src/BeefyClient.sol
 * @param validatorCount - The number of validators
 * @returns The minimum number of required signatures
 */
const calculateMinRequiredSignatures = (validatorCount: number): number => {
  // For BFT security, we need strictly > 2/3 of validators to sign
  // This matches Snowbridge's computeQuorum function
  if (validatorCount <= 3) {
    return validatorCount;
  }
  return validatorCount - Math.floor((validatorCount - 1) / 3);
};

/**
 * Fetches BEEFY checkpoint data from a DataHaven chain including both current and next
 * authority sets along with their validator set IDs, the latest finalized block,
 * and calculates the minimum required signatures.
 *
 * All queries are performed at the same finalized block to ensure consistency.
 *
 * @param rpcUrl - WebSocket RPC endpoint of the DataHaven chain
 * @returns BEEFY checkpoint data with validator set IDs, authority hashes, startBlock, and minNumRequiredSignatures
 */
const fetchBeefyCheckpointData = async (rpcUrl: string): Promise<BeefyCheckpointData> => {
  logger.info(`📡 Connecting to DataHaven chain at ${rpcUrl}...`);

  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(rpcUrl);

  try {
    // First, get the finalized block hash to use for all subsequent queries
    logger.info("🔍 Fetching latest finalized block...");
    const finalizedBlock = await papiClient.getFinalizedBlock();
    const startBlock = finalizedBlock.number;
    const blockHash = finalizedBlock.hash;
    logger.success(`Latest finalized block: ${startBlock} (${blockHash})`);

    // Fetch all BEEFY data in parallel at the same finalized block
    logger.info("🔍 Fetching BEEFY data (ValidatorSetId, Authorities, NextAuthorities)...");
    const [validatorSetId, authoritiesRaw, nextAuthoritiesRaw] = await Promise.all([
      dhApi.query.Beefy.ValidatorSetId.getValue({ at: blockHash }),
      dhApi.query.Beefy.Authorities.getValue({ at: blockHash }),
      dhApi.query.Beefy.NextAuthorities.getValue({ at: blockHash })
    ]);

    // Validate results
    invariant(validatorSetId !== undefined, "Failed to fetch BEEFY ValidatorSetId");
    logger.success(`Current ValidatorSetId: ${validatorSetId}`);

    invariant(
      authoritiesRaw && authoritiesRaw.length > 0,
      "No BEEFY Authorities found on the chain"
    );
    const currentAuthorityKeys = authoritiesRaw.map((key) => key.asHex());
    logger.success(`Found ${currentAuthorityKeys.length} current BEEFY authorities`);

    invariant(
      nextAuthoritiesRaw && nextAuthoritiesRaw.length > 0,
      "No BEEFY NextAuthorities found on the chain"
    );
    const nextAuthorityKeys = nextAuthoritiesRaw.map((key) => key.asHex());
    logger.success(`Found ${nextAuthorityKeys.length} next BEEFY authorities`);

    // Calculate minimum required signatures based on validator count
    // Uses Snowbridge's formula: n - floor((n-1)/3) for strictly > 2/3 majority
    const minNumRequiredSignatures = calculateMinRequiredSignatures(currentAuthorityKeys.length);
    logger.info(
      `📊 Minimum required signatures: ${minNumRequiredSignatures} (${currentAuthorityKeys.length} - floor((${currentAuthorityKeys.length}-1)/3))`
    );

    // Compute hashes for both sets
    logger.info("🔐 Computing authority hashes for current set...");
    const initialValidatorHashes = computeAuthorityHashes(currentAuthorityKeys);

    logger.info("🔐 Computing authority hashes for next set...");
    const nextValidatorHashes = computeAuthorityHashes(nextAuthorityKeys);

    // Check if the sets are identical
    const setsAreIdentical =
      JSON.stringify(initialValidatorHashes) === JSON.stringify(nextValidatorHashes);
    if (setsAreIdentical) {
      logger.info("ℹ️  Current and next authority sets are identical");
    } else {
      logger.info("ℹ️  Current and next authority sets differ");
    }

    return {
      startBlock,
      minNumRequiredSignatures,
      initialValidatorSetId: Number(validatorSetId),
      initialValidatorHashes,
      nextValidatorSetId: Number(validatorSetId) + 1,
      nextValidatorHashes
    };
  } finally {
    papiClient.destroy();
  }
};

/**
 * Updates the config file with the fetched BEEFY checkpoint data.
 *
 * @param networkId - The network identifier (e.g., "hoodi", "stagenet-hoodi")
 * @param checkpointData - BEEFY checkpoint data including validator set IDs, hashes, startBlock, and minNumRequiredSignatures
 */
const updateConfigFile = async (
  networkId: string,
  checkpointData: BeefyCheckpointData
): Promise<void> => {
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

  // Store the old values for comparison
  const oldStartBlock = configJson.snowbridge.startBlock;
  const oldMinSigs = configJson.snowbridge.minNumRequiredSignatures;
  const oldInitialId = configJson.snowbridge.initialValidatorSetId;
  const oldNextId = configJson.snowbridge.nextValidatorSetId;
  const oldInitial = configJson.snowbridge.initialValidatorHashes || [];
  const oldNext = configJson.snowbridge.nextValidatorHashes || [];

  // Update with new values
  configJson.snowbridge.startBlock = checkpointData.startBlock;
  configJson.snowbridge.minNumRequiredSignatures = checkpointData.minNumRequiredSignatures;
  configJson.snowbridge.initialValidatorSetId = checkpointData.initialValidatorSetId;
  configJson.snowbridge.initialValidatorHashes = checkpointData.initialValidatorHashes;
  configJson.snowbridge.nextValidatorSetId = checkpointData.nextValidatorSetId;
  configJson.snowbridge.nextValidatorHashes = checkpointData.nextValidatorHashes;

  await Bun.write(configFilePath, `${JSON.stringify(configJson, null, 2)}\n`);

  logger.success(`Config file updated: ${configFilePath}`);

  // Show what changed
  if (oldStartBlock !== checkpointData.startBlock) {
    logger.info(`  startBlock: ${oldStartBlock ?? "unset"} -> ${checkpointData.startBlock}`);
  }
  if (oldMinSigs !== checkpointData.minNumRequiredSignatures) {
    logger.info(
      `  minNumRequiredSignatures: ${oldMinSigs ?? "unset"} -> ${checkpointData.minNumRequiredSignatures}`
    );
  }
  if (oldInitialId !== checkpointData.initialValidatorSetId) {
    logger.info(
      `  initialValidatorSetId: ${oldInitialId ?? "unset"} -> ${checkpointData.initialValidatorSetId}`
    );
  }
  if (oldNextId !== checkpointData.nextValidatorSetId) {
    logger.info(
      `  nextValidatorSetId: ${oldNextId ?? "unset"} -> ${checkpointData.nextValidatorSetId}`
    );
  }
  if (JSON.stringify(oldInitial) !== JSON.stringify(checkpointData.initialValidatorHashes)) {
    logger.info(
      `  initialValidatorHashes: ${oldInitial.length} -> ${checkpointData.initialValidatorHashes.length} entries`
    );
  }
  if (JSON.stringify(oldNext) !== JSON.stringify(checkpointData.nextValidatorHashes)) {
    logger.info(
      `  nextValidatorHashes: ${oldNext.length} -> ${checkpointData.nextValidatorHashes.length} entries`
    );
  }
};

/**
 * Main handler for the update-beefy-checkpoint command.
 * Fetches BEEFY authorities from a live DataHaven chain and updates the config file.
 */
export const updateBeefyCheckpoint = async (
  options: UpdateBeefyCheckpointOptions
): Promise<void> => {
  const networkId = buildNetworkId(options.chain, options.environment);

  printHeader(`Updating BEEFY Checkpoint for ${networkId}`);

  logger.info("📋 Configuration:");
  logger.info(`   Chain: ${options.chain}`);
  if (options.environment) {
    logger.info(`   Environment: ${options.environment}`);
  }
  logger.info(`   RPC URL: ${options.rpcUrl}`);
  logger.info(`   Config file: contracts/config/${networkId}.json`);

  printDivider();

  try {
    // Fetch checkpoint data from the live chain
    const checkpointData = await fetchBeefyCheckpointData(options.rpcUrl);

    printDivider();

    // Display the checkpoint data
    logger.info("📝 BEEFY Checkpoint Data:");
    logger.info(`   Start Block: ${checkpointData.startBlock}`);
    logger.info(`   Min Required Signatures: ${checkpointData.minNumRequiredSignatures}`);
    logger.info(`   Initial Validator Set ID: ${checkpointData.initialValidatorSetId}`);
    logger.info(`   Initial Validators (${checkpointData.initialValidatorHashes.length} total):`);
    for (let i = 0; i < checkpointData.initialValidatorHashes.length; i++) {
      logger.info(`     [${i}] ${checkpointData.initialValidatorHashes[i]}`);
    }

    logger.info(`   Next Validator Set ID: ${checkpointData.nextValidatorSetId}`);
    logger.info(`   Next Validators (${checkpointData.nextValidatorHashes.length} total):`);
    for (let i = 0; i < checkpointData.nextValidatorHashes.length; i++) {
      logger.info(`     [${i}] ${checkpointData.nextValidatorHashes[i]}`);
    }

    printDivider();

    // Update the config file
    await updateConfigFile(networkId, checkpointData);

    printDivider();
    logger.success(`BEEFY checkpoint updated successfully for ${networkId}`);
  } catch (error) {
    logger.error(`Failed to update BEEFY checkpoint: ${error}`);
    throw error;
  }
};

/**
 * CLI action handler for the update-beefy-checkpoint command.
 * Note: Chain and environment validation is handled by contractsPreActionHook.
 */
export const contractsUpdateBeefyCheckpoint = async (
  options: any,
  _command: any
): Promise<void> => {
  const { chain, environment, rpcUrl } = options;

  // Validate rpc-url (specific to this command, not validated by preAction hook)
  if (!rpcUrl) {
    logger.error("❌ --rpc-url is required (WebSocket URL to the DataHaven chain)");
    process.exit(1);
  }

  await updateBeefyCheckpoint({
    chain,
    environment,
    rpcUrl
  });
};
