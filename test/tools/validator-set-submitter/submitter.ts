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
} from "./chain";

interface SubmitterClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  dhApi: DataHavenApi;
  papiClient: ReturnType<typeof createPapiConnectors>["client"];
}

type SubmitResult =
  | { kind: "accepted"; txHash: `0x${string}` }
  | { kind: "already_confirmed" }
  | { kind: "failed" };

interface PendingSubmission {
  targetEra: bigint;
  txHash: `0x${string}`;
  submittedAtMs: number;
}

const DRY_RUN_TX_HASH = `0x${"0".repeat(64)}` as `0x${string}`;

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
  let pending: PendingSubmission | undefined;

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

      if (pending) {
        if (externalIndex >= pending.targetEra) {
          const latencyMs = Date.now() - pending.submittedAtMs;
          logger.info(
            `Pending era ${pending.targetEra} confirmed via ExternalIndex; clearing pending (latencyMs=${latencyMs})`,
          );
          pending = undefined;
        } else if (activeEra.index >= Number(pending.targetEra)) {
          const ageMs = Date.now() - pending.submittedAtMs;
          logger.error(
            `Pending era ${pending.targetEra} expired (activeEra=${activeEra.index}) without confirmation; clearing pending (tx=${pending.txHash} ageMs=${ageMs})`,
          );
          pending = undefined;
        } else {
          logger.debug(
            `Waiting for pending era ${pending.targetEra} relay confirmation (tx=${pending.txHash})`,
          );
        }
        await sleep(config.pollIntervalMs, signal);
        continue;
      }

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

      const result = await submitForEra(clients, config, targetEra, signal);
      if (result.kind === "accepted") {
        pending = {
          targetEra,
          txHash: result.txHash,
          submittedAtMs: Date.now(),
        };
        logger.info(
          `Outbound accepted for era ${targetEra}; entering pending relay state (tx=${result.txHash})`,
        );
      } else if (result.kind === "already_confirmed") {
        logger.info(`Era ${targetEra} already confirmed before submission attempt`);
      } else {
        logger.error(`Era ${targetEra} submission attempt failed; will retry next poll`);
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
 * Attempts to submit the validator set for a single target era.
 *
 * This performs a single outbound attempt per call. Confirmation is handled
 * by the outer polling loop via ExternalIndex checks.
 */
async function submitForEra(
  clients: SubmitterClients,
  config: SubmitterConfig,
  targetEra: bigint,
  signal: AbortSignal,
): Promise<SubmitResult> {
  const { publicClient, walletClient, dhApi } = clients;
  if (signal.aborted) return { kind: "failed" };

  const activeEra = await getActiveEra(dhApi);
  if (activeEra && activeEra.index >= Number(targetEra)) {
    logger.info(`ActiveEra advanced past target ${targetEra}, abandoning`);
    return { kind: "failed" };
  }

  const externalIndex = await getExternalIndex(dhApi);
  if (externalIndex >= targetEra) {
    logger.info(`ExternalIndex reached ${targetEra} (confirmed by another path)`);
    return { kind: "already_confirmed" };
  }

  const totalFee = config.executionFee + config.relayerFee;
  logger.info(
    `Submitting era ${targetEra} (execFee=${config.executionFee} relayerFee=${config.relayerFee})`,
  );

  if (config.dryRun) {
    const message = await publicClient.readContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessageForEra",
      args: [targetEra],
    });
    logger.info(`[DRY RUN] Would send message: ${message}`);
    return { kind: "accepted", txHash: DRY_RUN_TX_HASH };
  }

  try {
    const hash = await walletClient.writeContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "sendNewValidatorSetForEra",
      args: [targetEra, config.executionFee, config.relayerFee],
      value: totalFee,
      chain: null,
    });
    logger.info(`Transaction sent: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      logger.error(`Transaction reverted: ${hash}`);
      return { kind: "failed" };
    }

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
      return { kind: "failed" };
    }

    logger.info("OutboundMessageAccepted confirmed");
    return { kind: "accepted", txHash: hash };
  } catch (err: unknown) {
    if (signal.aborted) return { kind: "failed" };
    logger.error(`Submission attempt failed: ${err}`);
    return { kind: "failed" };
  }
}
