import { beforeAll, describe, expect, it } from "bun:test";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type ViemClientInterface,
  createDefaultClient,
  fetchContractAbiByAddress,
  fetchContractAddressByName,
  logger
} from "utils";
import { isAddress, parseAbi, parseEther } from "viem";

// Tests are disabled because we lack ability to run blockscout reliably
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

  it.skip("Snowbridge contract is deployed and verified", async () => {
    const contractAddress = await fetchContractAddressByName("BeefyClient");
    logger.info(`Contract BeefyClient deployed to ${contractAddress}`);
    expect(isAddress(contractAddress)).toBeTrue();

    const contractCode = await api.getCode({ address: contractAddress });
    expect(contractCode).toBeTruthy();

    describe("BeefyClient contract", async () => {
      it("latestBeefyBlock()) can be read", async () => {
        const value = await api.readContract({
          abi: parseAbi(["function latestBeefyBlock() view returns (uint64)"]),
          address: contractAddress,
          functionName: "latestBeefyBlock"
        });
        expect(value, "Expected contract read to give positive blocknum").toBeGreaterThan(0n);
      });

      it("blockscout can fetch abi", async () => {
        const address = await fetchContractAddressByName("BeefyClient");
        const abi = await fetchContractAbiByAddress(address);

        const resp = await api.readContract({
          address,
          abi,
          functionName: "randaoCommitExpiration"
        });
        expect(resp, "Expected contract read").toBeGreaterThan(0n);
      });
    });
  });

  it.skip("AVS contract is deployed and verified", async () => {
    const contractAddress = await fetchContractAddressByName("DataHavenServiceManager");
    logger.info(`Contract DataHavenServiceManager deployed to ${contractAddress}`);
    expect(isAddress(contractAddress)).toBeTrue();

    const contractCode = await api.getCode({ address: contractAddress });
    expect(contractCode).toBeTruthy();
  });
});
