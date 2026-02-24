import type { DataHavenApi } from "utils/papi";
import type { PublicClient } from "viem";
import { dataHavenServiceManagerAbi } from "../../contract-bindings";

/**
 * Reads the current ActiveEra from the ExternalValidators pallet.
 * Returns `{ index, start }` where `index` is the era number.
 */
export async function getActiveEra(dhApi: DataHavenApi) {
  const era = await dhApi.query.ExternalValidators.ActiveEra.getValue();
  return era;
}

/**
 * Reads the ExternalIndex — the latest era that has been confirmed on-chain
 * via an inbound Snowbridge message.
 */
export async function getExternalIndex(dhApi: DataHavenApi): Promise<bigint> {
  const index = await dhApi.query.ExternalValidators.ExternalIndex.getValue();
  return BigInt(index);
}

/**
 * The target era for the next submission is always ActiveEra + 1.
 */
export function computeTargetEra(activeEraIndex: number): bigint {
  return BigInt(activeEraIndex + 1);
}

/**
 * Reads the on-chain `validatorSetSubmitter` address from the ServiceManager contract.
 */
export async function getOnChainSubmitter(
  publicClient: PublicClient,
  serviceManagerAddress: `0x${string}`
): Promise<`0x${string}`> {
  const submitter = await publicClient.readContract({
    address: serviceManagerAddress,
    abi: dataHavenServiceManagerAbi,
    functionName: "validatorSetSubmitter"
  });
  return submitter as `0x${string}`;
}

/**
 * Returns true if the current session is the last session of the active era.
 * Uses the on-chain SessionsPerEra constant and ErasStartSessionIndex storage.
 */
export async function isLastSessionOfEra(dhApi: DataHavenApi): Promise<boolean> {
  const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();
  if (!activeEra) return false;

  const sessionsPerEra = await dhApi.constants.ExternalValidators.SessionsPerEra();
  const eraStartSession = await dhApi.query.ExternalValidators.ErasStartSessionIndex.getValue(
    activeEra.index
  );
  if (eraStartSession === undefined) return false;

  const currentSession = await dhApi.query.Session.CurrentIndex.getValue();
  return currentSession >= eraStartSession + sessionsPerEra - 1;
}
