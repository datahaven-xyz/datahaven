export interface RetryState {
  targetEra: bigint;
  attempt: number;
  executionFee: bigint;
  relayerFee: bigint;
  lastTxHash?: `0x${string}`;
}

export function createRetryState(
  targetEra: bigint,
  baseExecutionFee: bigint,
  baseRelayerFee: bigint,
): RetryState {
  return {
    targetEra,
    attempt: 0,
    executionFee: baseExecutionFee,
    relayerFee: baseRelayerFee,
  };
}

export function bumpRetryState(
  state: RetryState,
  baseExecutionFee: bigint,
  baseRelayerFee: bigint,
  feeBumpPercent: number,
  feeCapMultiplier: number,
): RetryState {
  const nextAttempt = state.attempt + 1;
  return {
    ...state,
    attempt: nextAttempt,
    executionFee: computeBumpedFee(baseExecutionFee, nextAttempt, feeBumpPercent, feeCapMultiplier),
    relayerFee: computeBumpedFee(baseRelayerFee, nextAttempt, feeBumpPercent, feeCapMultiplier),
  };
}

/**
 * Computes a fee bumped by `(100 + feeBumpPercent) / 100` raised to the power of `attempt`,
 * capped at `baseFee * feeCapMultiplier`.
 *
 * All arithmetic uses bigint to avoid floating-point imprecision.
 */
export function computeBumpedFee(
  baseFee: bigint,
  attempt: number,
  feeBumpPercent: number,
  feeCapMultiplier: number,
): bigint {
  const numerator = BigInt(100 + feeBumpPercent);
  const denominator = 100n;

  let bumped = baseFee;
  for (let i = 0; i < attempt; i++) {
    bumped = (bumped * numerator) / denominator;
  }

  const cap = baseFee * BigInt(feeCapMultiplier);
  return bumped < cap ? bumped : cap;
}
