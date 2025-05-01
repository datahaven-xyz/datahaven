import { beforeAll, describe, expect, it } from "bun:test";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type ViemClientInterface,
  createDefaultClient,
  generateRandomAccount,
  logger
} from "utils";
import { parseEther } from "viem";

describe("E2E: Read-only", () => {
  let api: ViemClientInterface;

  beforeAll(async () => {
    api = await createDefaultClient();
  });

  it("should be able to query block number", async () => {
    const blockNumber = await api.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0n);

    const balance = await api.getBalance({
      address: ANVIL_FUNDED_ACCOUNTS[0].publicKey
    });
    expect(balance).toBeGreaterThan(parseEther("1"));
  });

  it("funds anvil acc 0", async () => {
    const balance = await api.getBalance({
      address: ANVIL_FUNDED_ACCOUNTS[0].publicKey
    });
    expect(balance).toBeGreaterThan(parseEther("1"));
  });

  it("can send ETH txs", async () => {
    const amount = parseEther("1");
    const randomAddress = generateRandomAccount();
    const balanceBefore = await api.getBalance({
      address: randomAddress.address
    });
    logger.debug(`Balance of ${randomAddress.address} before: ${balanceBefore}`);

    const hash = await api.sendTransaction({
      to: randomAddress.address,
      value: amount
    });

    const receipt = await api.waitForTransactionReceipt({ hash });
    logger.debug(`Transaction receipt: ${receipt}`);

    const balanceAfter = await api.getBalance({
      address: randomAddress.address
    });

    logger.debug(`Balance of ${randomAddress.address} after: ${balanceAfter}`);
    expect(balanceAfter - balanceBefore).toBe(amount);
  });
});
