import { BN } from "@polkadot/util";

// EIP-7623 Gas Cost Constants
// These constants define the gas costs under EIP-7623's floor cost mechanism
export const EIP7623_GAS_CONSTANTS = {
  // Base transaction cost
  BASE_TX_COST: 21000n,

  // Token costs (EIP-7623 defines tokens = zero_bytes + nonzero_bytes * 4)
  TOKENS_PER_NONZERO_BYTE: 4n,
  TOKENS_PER_ZERO_BYTE: 1n,

  // Floor costs per token
  TOTAL_COST_FLOOR_PER_TOKEN: 10n,

  // Derived floor costs per byte type
  COST_FLOOR_PER_ZERO_BYTE: 10n, // 1 token * 10 gas/token
  COST_FLOOR_PER_NON_ZERO_BYTE: 40n, // 4 tokens * 10 gas/token

  // Standard (pre-EIP-7623) costs
  STANDARD_COST_PER_ZERO_BYTE: 4n,
  STANDARD_COST_PER_NON_ZERO_BYTE: 16n,
} as const;

/**
 * Calculate the expected gas cost with EIP-7623 floor cost mechanism
 * @param numZeroBytes Number of zero bytes in calldata
 * @param numNonZeroBytes Number of non-zero bytes in calldata
 * @param executionGas Gas cost for the execution (e.g., contract execution, precompile)
 * @returns Expected total gas used (maximum of floor cost and standard cost + execution)
 */
export function calculateEIP7623Gas(
  numZeroBytes: number,
  numNonZeroBytes: number,
  executionGas: bigint = 0n
): bigint {
  const {
    BASE_TX_COST,
    COST_FLOOR_PER_ZERO_BYTE,
    COST_FLOOR_PER_NON_ZERO_BYTE,
    STANDARD_COST_PER_ZERO_BYTE,
    STANDARD_COST_PER_NON_ZERO_BYTE,
  } = EIP7623_GAS_CONSTANTS;

  // Floor cost calculation
  const floorCost =
    BigInt(numNonZeroBytes) * COST_FLOOR_PER_NON_ZERO_BYTE +
    BigInt(numZeroBytes) * COST_FLOOR_PER_ZERO_BYTE +
    BASE_TX_COST;

  // Standard cost + execution
  const standardCalldataCost =
    BigInt(numNonZeroBytes) * STANDARD_COST_PER_NON_ZERO_BYTE +
    BigInt(numZeroBytes) * STANDARD_COST_PER_ZERO_BYTE;
  const standardCostPlusExecution = standardCalldataCost + BASE_TX_COST + executionGas;

  // Return the maximum of floor cost and standard cost + execution
  return floorCost > standardCostPlusExecution ? floorCost : standardCostPlusExecution;
}

/// Recreation of fees.ration(burn_part, treasury_part)
export const split = (value: BN, part1: BN, part2: BN): [BN, BN] => {
  const total = part1.add(part2);
  if (total.eq(new BN(0)) || value.eq(new BN(0))) {
    return [new BN(0), new BN(0)];
  }
  const part1BN = value.mul(part1).div(total);
  const part2BN = value.sub(part1BN);
  return [part1BN, part2BN];
};

export const calculateFeePortions = (
  feesTreasuryProportion: bigint,
  fees: bigint
): {
  burnt: bigint;
  treasury: bigint;
} => {
  const feesBN = new BN(fees.toString());
  const treasuryPartBN = new BN(feesTreasuryProportion.toString());
  const burntPartBN = new BN(1e9).sub(treasuryPartBN);

  const [burntBN, treasuryBN] = split(feesBN, burntPartBN, treasuryPartBN);

  return {
    burnt: BigInt(burntBN.toString()),
    treasury: BigInt(treasuryBN.toString()),
  };
};
