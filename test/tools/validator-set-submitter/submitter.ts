import { EMPTY, exhaustMap } from "rxjs";
import { logger } from "utils/logger";
import { createPapiConnectors, type DataHavenApi } from "utils/papi";
import {
  type Account,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type PublicClient,
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dataHavenServiceManagerAbi, gatewayAbi } from "../../contract-bindings";
import { computeTargetEra, getActiveEra, getExternalIndex, isLastSessionOfEra } from "./chain";
import type { SubmitterConfig } from "./config";
import * as metrics from "./metrics";

interface SubmitterClients {
  publicClient: PublicClient;
  walletClient: WalletClient<ReturnType<typeof http>, undefined, Account>;
  dhApi: DataHavenApi;
  papiClient: ReturnType<typeof createPapiConnectors>["client"];
}

const RECEIPT_TIMEOUT_MS = 120_000;

export function createClients(config: SubmitterConfig): SubmitterClients {
  const account = privateKeyToAccount(config.submitterPrivateKey);
  const transport = http(config.ethereumRpcUrl);

  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ account, transport });
  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(config.datahavenWsUrl);

  return { publicClient, walletClient, dhApi, papiClient };
}

/**
 * Returns a promise that resolves when the signal is aborted.
 */
function onAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) =>
    signal.addEventListener("abort", () => resolve(), { once: true })
  );
}

/**
 * Waits for a transaction receipt with a hard timeout, and exits early on abort.
 */
async function waitForReceiptWithAbort(
  publicClient: PublicClient,
  hash: `0x${string}`,
  signal: AbortSignal
) {
  return Promise.race([
    publicClient.waitForTransactionReceipt({
      hash,
      timeout: RECEIPT_TIMEOUT_MS
    }),
    onAbort(signal).then(() => {
      throw signal.reason ?? new Error("Aborted while waiting for transaction receipt");
    })
  ]);
}

/**
 * Creates a tick handler that closes over submission state.
 * Each call evaluates a session change and submits if eligible.
 */
function createTicker(clients: SubmitterClients, config: SubmitterConfig, signal: AbortSignal) {
  let submittedEra: bigint | undefined;

  return async (currentSessionValue: number): Promise<void> => {
    const endTimer = metrics.tickDuration.startTimer();
    try {
      const { dhApi } = clients;

      metrics.currentSession.set(currentSessionValue);

      const activeEra = await getActiveEra(dhApi);
      if (!activeEra) {
        logger.warn("ActiveEra not set yet");
        metrics.ticksTotal.inc({ result: "skipped_no_active_era" });
        return;
      }

      metrics.activeEra.set(activeEra.index);

      const targetEraValue = computeTargetEra(activeEra.index);
      metrics.targetEra.set(Number(targetEraValue));

      if (submittedEra === targetEraValue) {
        logger.debug(`Tick skipped: era ${targetEraValue} already submitted locally`);
        metrics.ticksTotal.inc({ result: "skipped_already_submitted" });
        return;
      }

      const externalIndexValue = await getExternalIndex(dhApi);
      metrics.externalIndex.set(Number(externalIndexValue));

      if (externalIndexValue >= targetEraValue) {
        logger.debug(
          `Tick skipped: ExternalIndex=${externalIndexValue} >= TargetEra=${targetEraValue}, already confirmed`
        );
        submittedEra = targetEraValue;
        metrics.ticksTotal.inc({ result: "skipped_already_confirmed" });
        return;
      }

      if (!(await isLastSessionOfEra(dhApi))) {
        logger.debug("Tick skipped: not last session of era");
        metrics.ticksTotal.inc({ result: "skipped_not_last_session" });
        return;
      }

      logger.info(
        `Session=${currentSessionValue} ActiveEra=${activeEra.index} TargetEra=${targetEraValue} ExternalIndex=${externalIndexValue}`
      );

      const succeeded = await submitForEra(clients, config, targetEraValue, signal);
      if (succeeded) {
        submittedEra = targetEraValue;
        metrics.consecutiveMissedEras.set(0);
        metrics.lastSubmittedEra.set(Number(targetEraValue));
        metrics.ticksTotal.inc({ result: "submitted_success" });
      } else {
        if (!signal.aborted) {
          logger.warn(`Submission failed for target era ${targetEraValue}; era will be missed`);
        }
        metrics.missedErasTotal.inc();
        metrics.consecutiveMissedEras.inc();
        metrics.ticksTotal.inc({ result: "submitted_failed" });
      }
    } finally {
      endTimer();
    }
  };
}

/**
 * Watches finalized session changes and submits validator sets when eligible.
 * Runs until the signal is aborted.
 */
export async function startSubmitter(
  clients: SubmitterClients,
  config: SubmitterConfig,
  signal: AbortSignal
): Promise<void> {
  const { dhApi } = clients;
  const tick = createTicker(clients, config, signal);

  metrics.up.set(1);
  metrics.ready.set(1);
  logger.info("Submitter started — watching session changes");

  const sub = dhApi.query.Session.CurrentIndex.watchValue("finalized")
    .pipe(
      exhaustMap((currentSessionValue) => {
        if (signal.aborted) return EMPTY;
        return tick(currentSessionValue).catch((err) => {
          if (!signal.aborted) {
            logger.error(`Tick error: ${err}`);
            metrics.errorsTotal.inc({ type: "tick_error" });
          }
        });
      })
    )
    .subscribe({
      error: (err) => {
        if (!signal.aborted) {
          logger.error(`Session subscription error: ${err}`);
          metrics.errorsTotal.inc({ type: "subscription_error" });
        }
      }
    });

  const done = new Promise<void>((resolve) => sub.add(() => resolve()));
  await Promise.race([onAbort(signal), done]);
  sub.unsubscribe();

  metrics.up.set(0);
  metrics.ready.set(0);
  logger.info("Submitter stopped");
}

/**
 * Submits the validator set for a single target era.
 * Logs success or failure internally.
 */
async function submitForEra(
  clients: SubmitterClients,
  config: SubmitterConfig,
  targetEraValue: bigint,
  signal: AbortSignal
): Promise<boolean> {
  const { publicClient, walletClient } = clients;

  const totalFee = config.executionFee + config.relayerFee;
  logger.info(
    `Submitting era ${targetEraValue} (execFee=${config.executionFee} relayerFee=${config.relayerFee})`
  );

  if (config.dryRun) {
    const message = await publicClient.readContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessageForEra",
      args: [targetEraValue]
    });
    logger.info(`[DRY RUN] Would send message: ${message}`);
    metrics.submissionsTotal.inc({ outcome: "dry_run" });
    return true;
  }

  const endTimer = metrics.submissionDuration.startTimer();
  try {
    const hash = await walletClient.writeContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "sendNewValidatorSetForEra",
      args: [targetEraValue, config.executionFee, config.relayerFee],
      value: totalFee,
      chain: null
    });
    logger.info(`Transaction sent: ${hash}`);

    const receipt = await waitForReceiptWithAbort(publicClient, hash, signal);
    if (receipt.status !== "success") {
      logger.error(`Transaction reverted: ${hash}`);
      metrics.submissionsTotal.inc({ outcome: "failed" });
      return false;
    }

    const hasOutbound = receipt.logs.some((log) => {
      try {
        const decoded = decodeEventLog({
          abi: gatewayAbi,
          data: log.data,
          topics: log.topics
        });
        return decoded.eventName === "OutboundMessageAccepted";
      } catch {
        return false;
      }
    });

    if (!hasOutbound) {
      logger.warn("Transaction succeeded but no OutboundMessageAccepted event found");
      metrics.submissionsTotal.inc({ outcome: "failed" });
      return false;
    }

    logger.info("OutboundMessageAccepted confirmed");
    metrics.submissionsTotal.inc({ outcome: "success" });
    return true;
  } catch (err: unknown) {
    if (signal.aborted) return false;
    logger.error(`Submission attempt failed: ${err}`);
    metrics.submissionsTotal.inc({ outcome: "failed" });
    return false;
  } finally {
    endTimer();
  }
}
