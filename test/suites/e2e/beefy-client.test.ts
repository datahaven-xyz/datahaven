import { beforeAll, describe, expect, it } from "bun:test";
import { beefyClientAbi } from "contract-bindings";
import {
  type AnvilDeployments,
  type ViemClientInterface,
  createDefaultClient,
  getContractInstance,
  logger,
  parseDeploymentsFile
} from "utils";
import { isAddress } from "viem";

describe("BeefyClient contract", async () => {
  let api: ViemClientInterface;
  let deployments: AnvilDeployments;
  let instance: Awaited<ReturnType<typeof getContractInstance<"BeefyClient">>>;

  beforeAll(async () => {
    api = await createDefaultClient();
    deployments = await parseDeploymentsFile();
    instance = await getContractInstance("BeefyClient");
  });

  it("BeefyClient contract is deployed", async () => {
    const contractAddress = deployments.BeefyClient;
    expect(isAddress(contractAddress)).toBeTrue();
  });

  it("latestBeefyBlock()) can be read", async () => {
    const value = await api.readContract({
      abi: beefyClientAbi,
      functionName: "latestBeefyBlock",
      address: deployments.BeefyClient
    });
    logger.debug(`latestBeefyBlock() value: ${value}`);
    expect(value, "Expected contract read to give positive blocknum").toBeGreaterThan(0n);
  });

  it("latestBeefyBlock() can be read from contract instance", async () => {
    const contract = await getContractInstance<"BeefyClient">("BeefyClient");
    const value = await contract.read.latestMMRRoot();
    logger.debug(`latestBeefyBlock() value: ${value}`);
    expect(value, "Expected contract read to give positive blocknum").toBeGreaterThan(0n);
  });
});
