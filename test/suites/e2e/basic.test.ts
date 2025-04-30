import { beforeAll, describe, expect, it } from "bun:test";
import { beefyClientAbi } from "contract-bindings";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type AnvilDeployments,
  type ViemClientInterface,
  createDefaultClient,
  fetchContractAbiByAddress,
  fetchContractAddressByName,
  getContractInstance,
  logger,
  parseDeploymentsFile
} from "utils";
import { type Hash, isAddress, parseAbi, parseEther } from "viem";

describe("E2E: Read-only", () => {
  let api: ViemClientInterface;
  let deployments: AnvilDeployments;

  beforeAll(async () => {
    api = await createDefaultClient();
    deployments = await parseDeploymentsFile();
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
});
