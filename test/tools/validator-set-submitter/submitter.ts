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

  return async (currentSession: number): Promise<void> => {
    const { dhApi } = clients;

    const activeEra = await getActiveEra(dhApi);
    if (!activeEra) {
      logger.warn("ActiveEra not set yet");
      return;
    }

    const targetEra = computeTargetEra(activeEra.index);
    if (submittedEra === targetEra) return;

    const externalIndex = await getExternalIndex(dhApi);
    if (externalIndex >= targetEra) {
      submittedEra = targetEra;
      return;
    }

    if (!(await isLastSessionOfEra(dhApi))) return;

    logger.info(
      `Session=${currentSession} ActiveEra=${activeEra.index} TargetEra=${targetEra} ExternalIndex=${externalIndex}`
    );

    const succeeded = await submitForEra(clients, config, targetEra, signal);
    if (succeeded) submittedEra = targetEra;
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

  logger.info("Submitter started — watching session changes");

  const sub = dhApi.query.Session.CurrentIndex.watchValue("finalized")
    .pipe(
      exhaustMap((currentSession) => {
        if (signal.aborted) return EMPTY;
        return tick(currentSession).catch((err) => {
          if (!signal.aborted) logger.error(`Tick error: ${err}`);
        });
      })
    )
    .subscribe({
      error: (err) => {
        if (!signal.aborted) logger.error(`Session subscription error: ${err}`);
      }
    });

  const done = new Promise<void>((resolve) => sub.add(() => resolve()));
  await Promise.race([onAbort(signal), done]);
  sub.unsubscribe();

  logger.info("Submitter stopped");
}

/**
 * Submits the validator set for a single target era.
 * Logs success or failure internally.
 */
async function submitForEra(
  clients: SubmitterClients,
  config: SubmitterConfig,
  targetEra: bigint,
  signal: AbortSignal
): Promise<boolean> {
  const { publicClient, walletClient } = clients;

  const totalFee = config.executionFee + config.relayerFee;
  logger.info(
    `Submitting era ${targetEra} (execFee=${config.executionFee} relayerFee=${config.relayerFee})`
  );

  if (config.dryRun) {
    const message = await publicClient.readContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessageForEra",
      args: [targetEra]
    });
    logger.info(`[DRY RUN] Would send message: ${message}`);
    return true;
  }

  try {
    const hash = await walletClient.writeContract({
      address: config.serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "sendNewValidatorSetForEra",
      args: [targetEra, config.executionFee, config.relayerFee],
      value: totalFee,
      chain: null
    });
    logger.info(`Transaction sent: ${hash}`);

    const receipt = await waitForReceiptWithAbort(publicClient, hash, signal);
    if (receipt.status !== "success") {
      logger.error(`Transaction reverted: ${hash}`);
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
      return false;
    }

    logger.info("OutboundMessageAccepted confirmed");
    return true;
  } catch (err: unknown) {
    if (signal.aborted) return false;
    logger.error(`Submission attempt failed: ${err}`);
    return false;
  }
}
