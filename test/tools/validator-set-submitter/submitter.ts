import { logger } from "utils/logger";
import { createPapiConnectors, type DataHavenApi } from "utils/papi";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dataHavenServiceManagerAbi, gatewayAbi } from "../../contract-bindings";
import type { SubmitterConfig } from "./config";
import {
  computeTargetEra,
  getActiveEra,
  getExternalIndex,
  isLastSessionOfEra,
  waitForInboundConfirmation,
} from "./chain";
import { bumpRetryState, createRetryState, type RetryState } from "./retry";

interface SubmitterClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  dhApi: DataHavenApi;
  papiClient: ReturnType<typeof createPapiConnectors>["client"];
}

export function createClients(config: SubmitterConfig): SubmitterClients {
  const account = privateKeyToAccount(config.submitterPrivateKey);
  const transport = http(config.ethereumRpcUrl);

  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ account, transport });
  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(config.datahavenWsUrl);

  return { publicClient, walletClient, dhApi, papiClient };
}

/**
 * Sleeps for `ms` milliseconds, respecting an AbortSignal for graceful shutdown.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Main polling loop. Runs until the signal is aborted.
 */
export async function startSubmitter(
  clients: SubmitterClients,
  config: SubmitterConfig,
  signal: AbortSignal,
): Promise<void> {
  const { dhApi } = clients;

  logger.info("Submitter loop started — polling for era changes");

  while (!signal.aborted) {
    try {
      const activeEra = await getActiveEra(dhApi);
      if (!activeEra) {
        logger.warn("ActiveEra not set yet, waiting...");
        await sleep(config.pollIntervalMs, signal);
        continue;
      }

      const targetEra = computeTargetEra(activeEra.index);
      const externalIndex = await getExternalIndex(dhApi);

      logger.info(
        `ActiveEra=${activeEra.index} ExternalIndex=${externalIndex} TargetEra=${targetEra}`,
      );

      if (externalIndex >= targetEra) {
        logger.debug(`Era ${targetEra} already confirmed (ExternalIndex=${externalIndex}), skipping`);
        await sleep(config.pollIntervalMs, signal);
        continue;
      }

      if (!(await isLastSessionOfEra(dhApi))) {
        logger.debug(`Era ${targetEra} needs submission but not in last session yet, waiting`);
        await sleep(config.pollIntervalMs, signal);
        continue;
      }

      const submitted = await submitForEra(clients, config, targetEra, signal);
      if (submitted) {
        logger.info(`Era ${targetEra} submission confirmed on DataHaven`);
      } else {
        logger.error(`Era ${targetEra} submission failed after ${config.maxRetries} retries`);
      }
    } catch (err: unknown) {
      if (signal.aborted) break;
      logger.error(`Polling error: ${err}`);
    }

    if (!signal.aborted) {
      await sleep(config.pollIntervalMs, signal).catch(() => {});
    }
  }

  logger.info("Submitter loop stopped");
}

/**
 * Attempts to submit the validator set for a single target era, with retry and fee bumping.
 * Returns true if confirmed on DataHaven, false if all retries exhausted.
 */
async function submitForEra(
  clients: SubmitterClients,
  config: SubmitterConfig,
  targetEra: bigint,
  signal: AbortSignal,
): Promise<boolean> {
  const { publicClient, walletClient, dhApi } = clients;

  let retry: RetryState = createRetryState(targetEra, config.executionFee, config.relayerFee);

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (signal.aborted) return false;

    // Re-check chain state — era may have advanced or another submitter confirmed
    const activeEra = await getActiveEra(dhApi);
    if (activeEra && activeEra.index >= Number(targetEra)) {
      logger.info(`ActiveEra advanced past target ${targetEra}, abandoning submission`);
      return false;
    }

    const externalIndex = await getExternalIndex(dhApi);
    if (externalIndex >= targetEra) {
      logger.info(`ExternalIndex reached ${targetEra} (confirmed by another path)`);
      return true;
    }

    const totalFee = retry.executionFee + retry.relayerFee;
    logger.info(
      `Submitting era ${targetEra} attempt ${attempt + 1}/${config.maxRetries + 1} ` +
      `(execFee=${retry.executionFee} relayerFee=${retry.relayerFee})`,
    );

    if (config.dryRun) {
      const message = await publicClient.readContract({
        address: config.serviceManagerAddress,
        abi: dataHavenServiceManagerAbi,
        functionName: "buildNewValidatorSetMessageForEra",
        args: [targetEra],
      });
      logger.info(`[DRY RUN] Would send message: ${message}`);
      return true;
    }

    try {
      const hash = await walletClient.writeContract({
        address: config.serviceManagerAddress,
        abi: dataHavenServiceManagerAbi,
        functionName: "sendNewValidatorSetForEra",
        args: [targetEra, retry.executionFee, retry.relayerFee],
        value: totalFee,
        chain: null,
      });
      retry.lastTxHash = hash;
      logger.info(`Transaction sent: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        logger.error(`Transaction reverted: ${hash}`);
        retry = bumpRetryState(
          retry,
          config.executionFee,
          config.relayerFee,
          config.feeBumpPercent,
          config.feeCapMultiplier,
        );
        continue;
      }

      // Verify OutboundMessageAccepted in the receipt logs
      const hasOutbound = receipt.logs.some((log) => {
        try {
          const decoded = decodeEventLog({ abi: gatewayAbi, data: log.data, topics: log.topics });
          return decoded.eventName === "OutboundMessageAccepted";
        } catch {
          return false;
        }
      });

      if (!hasOutbound) {
        logger.warn("Transaction succeeded but no OutboundMessageAccepted event found");
      } else {
        logger.info("OutboundMessageAccepted confirmed — waiting for DataHaven inbound...");
      }

      // Wait for inbound confirmation on DataHaven
      await waitForInboundConfirmation(dhApi, targetEra, config.inboundTimeoutMs);
      return true;
    } catch (err: unknown) {
      if (signal.aborted) return false;
      logger.error(`Attempt ${attempt + 1} failed: ${err}`);
      retry = bumpRetryState(
        retry,
        config.executionFee,
        config.relayerFee,
        config.feeBumpPercent,
        config.feeCapMultiplier,
      );
    }
  }

  return false;
}
