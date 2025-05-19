import { beforeAll, describe, expect, it } from "bun:test";
import { beefyClientAbi } from "contract-bindings";
import {
  type AnvilDeployments,
  type ContractInstance,
  createDefaultClient,
  getContractInstance,
  logger,
  parseDeploymentsFile,
  type ViemClientInterface
} from "utils";
import { isAddress } from "viem";

describe("BeefyClient contract", async () => {
  let api: ViemClientInterface;
  let deployments: AnvilDeployments;
  let instance: ContractInstance<"BeefyClient">;

  beforeAll(async () => {
    api = await createDefaultClient();
    deployments = await parseDeploymentsFile();
    instance = await getContractInstance("BeefyClient");
  });

  it("BeefyClient contract is deployed", async () => {
    const contractAddress = deployments.BeefyClient;
    expect(isAddress(contractAddress)).toBeTrue();
  });

  it("latestBeefyBlock() can be read", async () => {
    const value = await api.readContract({
      abi: beefyClientAbi,
      functionName: "latestBeefyBlock",
      address: deployments.BeefyClient
    });
    logger.debug(`latestBeefyBlock() value: ${value}`);
    expect(value, "Expected contract read to give positive blocknum").toBeGreaterThan(0n);
  });

  it("latestBeefyBlock() can be read from contract instance", async () => {
    const value = await instance.read.latestBeefyBlock();

    logger.debug(`latestBeefyBlock() value: ${value}`);
    expect(value, "Expected contract read to give positive blocknum").toBeGreaterThan(0n);
  });
});
