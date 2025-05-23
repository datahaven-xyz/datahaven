import { $ } from "bun";
import { type KurtosisEnclaveInfo, KurtosisEnclaveInfoSchema, logger } from "utils";

/**
 * Gets a list of currently running Kurtosis enclaves
 * @returns Promise<KurtosisEnclaveInfo[]> - Array of running enclave information
 */
export const getRunningKurtosisEnclaves = async (): Promise<KurtosisEnclaveInfo[]> => {
  logger.debug("🔎 Checking for running Kurtosis enclaves...");

  const lines = (await Array.fromAsync($`kurtosis enclave ls`.lines())).filter(
    (line) => line.length > 0
  );
  logger.trace(lines);

  // Remove header line
  lines.shift();

  const enclaves: KurtosisEnclaveInfo[] = [];

  if (lines.length === 0) {
    logger.debug("🤷‍ No Kurtosis enclaves found running.");
    return enclaves;
  }

  logger.debug(`🔎 Found ${lines.length} Kurtosis enclave(s) running.`);
  // Updated regex to match the actual format: "uuid name status creationTime"
  const enclaveRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(enclaveRegex);
    if (match) {
      const [, uuid, name, status, creationTime] = match;
      const parseResult = KurtosisEnclaveInfoSchema.safeParse({
        uuid: uuid.trim(),
        name: name.trim(),
        status: status.trim(),
        creationTime: creationTime.trim()
      });

      if (parseResult.success) {
        enclaves.push(parseResult.data);
      } else {
        logger.warn(
          `⚠️ Could not parse enclave line: "${line}". Error: ${parseResult.error.message}`
        );
      }
    } else {
      logger.warn(`⚠️ Could not parse enclave line (regex mismatch): "${line}"`);
    }
  }

  if (lines.length > 0 && enclaves.length === 0) {
    logger.warn("⚠️ Found enclave lines in output, but failed to parse any of them.");
  }

  return enclaves;
};
