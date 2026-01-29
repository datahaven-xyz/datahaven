import { secp256k1 } from "@noble/curves/secp256k1";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { createPapiConnectors } from "utils/papi";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { buildNetworkId } from "../../../configs/contracts/config";

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
 * Converts a compressed secp256k1 public key to its corresponding Ethereum address.
 *
 * @param compressedPubKey - The compressed public key as a hex string (with or without "0x" prefix)
 * @returns The corresponding Ethereum address (checksummed, with "0x" prefix)
 */
const compressedPubKeyToEthereumAddress = (compressedPubKey: string): string => {
  const compressedKeyHex = compressedPubKey.startsWith("0x")
    ? compressedPubKey.substring(2)
    : compressedPubKey;

  const point = secp256k1.ProjectivePoint.fromHex(compressedKeyHex);
  const uncompressedPubKeyBytes = point.toRawBytes(false);
  const uncompressedPubKeyHex = toHex(uncompressedPubKeyBytes);

  return publicKeyToAddress(uncompressedPubKeyHex);
};

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
 * Uses ceil(n * 2/3) where n is the number of validators.
 *
 * @param validatorCount - The number of validators
 * @returns The minimum number of required signatures
 */
const calculateMinRequiredSignatures = (validatorCount: number): number => {
  // For BFT security, we need > 2/3 of validators to sign
  // Using ceil(n * 2/3) ensures we have more than 2/3 threshold
  return Math.ceil((validatorCount * 2) / 3);
};

/**
 * Fetches BEEFY checkpoint data from a DataHaven chain including both current and next
 * authority sets along with their validator set IDs, the latest finalized block,
 * and calculates the minimum required signatures.
 *
 * @param rpcUrl - WebSocket RPC endpoint of the DataHaven chain
 * @returns BEEFY checkpoint data with validator set IDs, authority hashes, startBlock, and minNumRequiredSignatures
 */
const fetchBeefyCheckpointData = async (rpcUrl: string): Promise<BeefyCheckpointData> => {
  logger.info(`📡 Connecting to DataHaven chain at ${rpcUrl}...`);

  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(rpcUrl);

  try {
    // Fetch the latest finalized block number for startBlock
    logger.info("🔍 Fetching latest finalized block...");
    const finalizedBlock = await papiClient.getFinalizedBlock();
    const startBlock = finalizedBlock.number;
    logger.success(`Latest finalized block: ${startBlock}`);

    // Fetch the current validator set ID
    logger.info("🔍 Fetching BEEFY ValidatorSetId...");
    const validatorSetId = await dhApi.query.Beefy.ValidatorSetId.getValue({
      at: "best"
    });
    invariant(validatorSetId !== undefined, "Failed to fetch BEEFY ValidatorSetId");
    logger.success(`Current ValidatorSetId: ${validatorSetId}`);

    // Fetch current authorities (Authorities)
    logger.info("🔍 Fetching BEEFY Authorities (current set)...");
    const authoritiesRaw = await dhApi.query.Beefy.Authorities.getValue({
      at: "best"
    });
    invariant(
      authoritiesRaw && authoritiesRaw.length > 0,
      "No BEEFY Authorities found on the chain"
    );
    const currentAuthorityKeys = authoritiesRaw.map((key) => key.asHex());
    logger.success(`Found ${currentAuthorityKeys.length} current BEEFY authorities`);

    // Calculate minimum required signatures based on validator count
    const minNumRequiredSignatures = calculateMinRequiredSignatures(currentAuthorityKeys.length);
    logger.info(
      `📊 Minimum required signatures: ${minNumRequiredSignatures} (ceil(${currentAuthorityKeys.length} * 2/3))`
    );

    // Fetch next authorities (NextAuthorities)
    logger.info("🔍 Fetching BEEFY NextAuthorities (next set)...");
    const nextAuthoritiesRaw = await dhApi.query.Beefy.NextAuthorities.getValue({
      at: "best"
    });
    invariant(
      nextAuthoritiesRaw && nextAuthoritiesRaw.length > 0,
      "No BEEFY NextAuthorities found on the chain"
    );
    const nextAuthorityKeys = nextAuthoritiesRaw.map((key) => key.asHex());
    logger.success(`Found ${nextAuthorityKeys.length} next BEEFY authorities`);

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
 */
export const contractsUpdateBeefyCheckpoint = async (
  options: any,
  _command: any
): Promise<void> => {
  // Options are passed from the CLI action which uses optsWithGlobals()
  const chain = options.chain;
  const environment = options.environment;
  const rpcUrl = options.rpcUrl;

  // Validate required options
  if (!chain) {
    logger.error("❌ --chain is required (hoodi, ethereum, anvil)");
    process.exit(1);
  }

  const supportedChains = ["hoodi", "ethereum", "anvil"];
  if (!supportedChains.includes(chain)) {
    logger.error(`❌ Unsupported chain: ${chain}. Supported chains: ${supportedChains.join(", ")}`);
    process.exit(1);
  }

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
