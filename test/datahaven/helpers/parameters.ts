import type { DevModeContext } from "@moonwall/cli";

export const getFeesTreasuryProportion = async (context: DevModeContext): Promise<bigint> => {
  const parameter = await context.polkadotJs().query.parameters.parameters({
    RuntimeConfig: "FeesTreasuryProportion",
  });

  // 20% default value
  let feesTreasuryProportion = 200_000_000n;
  if (parameter.isSome) {
    feesTreasuryProportion = parameter.value.asRuntimeConfig.asFeesTreasuryProportion.toBigInt();
  }
  return feesTreasuryProportion;
};
