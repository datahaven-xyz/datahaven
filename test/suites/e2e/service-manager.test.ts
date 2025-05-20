import { beforeAll, describe, expect, it } from "bun:test";
import { type ContractInstance, getContractInstance, logger } from "utils";
import { isAddress } from "viem";

describe("BeefyClient contract", async () => {
  let instance: ContractInstance<"ServiceManager">;

  beforeAll(async () => {
    instance = await getContractInstance("ServiceManager");
  });

  it("avs() can be read from contract instance", async () => {
    const value = await instance.read.avs();

    logger.debug(`avs() value: ${value}`);
    expect(isAddress(value), "AVS getter should return an address").toBeTrue();
  });
});
