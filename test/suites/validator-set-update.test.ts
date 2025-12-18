/**
 * Validator Set Update E2E: Ethereum → Snowbridge → DataHaven
 *
 * Exercises:
 * - Start network and ensure 4 validator nodes are running (Alice, Bob, Charlie, Dave).
 * - Confirm initial mapping exists only for Alice/Bob on `ServiceManager`.
 * - Allowlist and register Charlie/Dave as operators on Ethereum.
 * - Send updated validator set via `ServiceManager.sendNewValidatorSet`, assert Gateway `OutboundMessageAccepted`.
 * - Observe `ExternalValidators.ExternalValidatorsSet` on DataHaven (substrate), confirming propagation.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { getOwnerAccount, registerOperator } from "launcher/validators";
import {
  addValidatorToAllowlist,
  CROSS_CHAIN_TIMEOUTS,
  type Deployments,
  isValidatorRunning,
  launchDatahavenValidator,
  logger,
  parseDeploymentsFile,
  ZERO_ADDRESS
} from "utils";
import { waitForDataHavenEvent } from "utils/events";
import { decodeEventLog, parseEther } from "viem";
import validatorSet from "../configs/validator-set.json";
import { dataHavenServiceManagerAbi, gatewayAbi } from "../contract-bindings";
import { BaseTestSuite, type TestConnectors } from "../framework";

const getValidator = (name: string) => {
  const v = validatorSet.validators.find((v) => v.solochainAuthorityName === name);
  if (!v) throw new Error(`Validator ${name} not found`);
  return v;
};

class ValidatorSetUpdateTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "validator-set-update",
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    // Launch two new nodes to be authorities
    logger.debug("Launching Charlie and Dave validators...");

    const { launchedNetwork } = this.getConnectors();
    await Promise.all([
      launchDatahavenValidator("charlie", { launchedNetwork }),
      launchDatahavenValidator("dave", { launchedNetwork }),
    ]);
  }

  public getNetworkId(): string {
    return this.getConnectors().launchedNetwork.networkId;
  }

}

// Create the test suite instance
const suite = new ValidatorSetUpdateTestSuite();
let deployments: Deployments;
let connectors: TestConnectors;

describe("Validator Set Update", () => {
  const initialValidators = [getValidator("alice"), getValidator("bob")];
  const newValidators = [getValidator("charlie"), getValidator("dave")];

  beforeAll(async () => {
    deployments = await parseDeploymentsFile();
    connectors = suite.getTestConnectors();
  });

  it("should verify test environment", async () => {
    const networkId = suite.getNetworkId();
    const { publicClient, papiClient } = connectors;

    // Validators running
    expect(await isValidatorRunning("alice", networkId)).toBe(true);
    expect(await isValidatorRunning("bob", networkId)).toBe(true);
    expect(await isValidatorRunning("charlie", networkId)).toBe(true);
    expect(await isValidatorRunning("dave", networkId)).toBe(true);

    // Chain connectivity
    expect(await publicClient.getBlockNumber()).toBeGreaterThan(0);
    expect((await papiClient.getBlockHeader()).number).toBeGreaterThan(0);

    // Contract deployed
    expect(deployments.ServiceManager).toBeDefined();
  });

  it("should verify initial validator set state", async () => {
    const { publicClient } = connectors;
    const readSolochainAddress = (validator: (typeof initialValidators)[0]) =>
      publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

    // Check initial validators have correct mappings and new validators are not registered
    const [initialResults, newResults] = await Promise.all([
      Promise.all(initialValidators.map(readSolochainAddress)),
      Promise.all(newValidators.map(readSolochainAddress))
    ]);

    expect(initialResults).toEqual(initialValidators.map((v) => v.solochainAddress as `0x${string}`));
    expect(newResults).toEqual(newValidators.map(() => ZERO_ADDRESS));
  });

  it("should allowlist and register new validators as operators", async () => {
    const opts = { connectors, deployments };

    // Add to allowlist and register as operators
    await Promise.all([
      addValidatorToAllowlist("charlie", opts),
      addValidatorToAllowlist("dave", opts)
    ]);
    await Promise.all([
      registerOperator("charlie", opts),
      registerOperator("dave", opts)
    ]);

    // Verify allowlist and registration status
    const { publicClient } = connectors;
    const isAllowlisted = (name: string) =>
      publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorsAllowlist",
        args: [getValidator(name).publicKey as `0x${string}`]
      });

    const isRegistered = async (name: string) => {
      const validator = getValidator(name);
      const solochainAddress = await publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });
      return solochainAddress.toLowerCase() === validator.solochainAddress.toLowerCase();
    };

    const [charlieAllowlisted, daveAllowlisted, charlieRegistered, daveRegistered] =
      await Promise.all([
        isAllowlisted("charlie"),
        isAllowlisted("dave"),
        isRegistered("charlie"),
        isRegistered("dave")
      ]);

    expect(charlieAllowlisted).toBe(true);
    expect(daveAllowlisted).toBe(true);
    expect(charlieRegistered).toBe(true);
    expect(daveRegistered).toBe(true);
  });

  it("should send updated validator set and verify on DataHaven", async () => {
    const { publicClient, walletClient, dhApi } = connectors;

    // Send the updated validator set via Snowbridge
    const hash = await walletClient.writeContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "sendNewValidatorSet",
      args: [parseEther("0.1"), parseEther("0.2")],
      value: parseEther("0.3"),
      gas: 1000000n,
      account: getOwnerAccount(),
      chain: null
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // Verify OutboundMessageAccepted event was emitted
    const hasOutboundAccepted = (receipt.logs ?? []).some((log: any) => {
      try {
        const decoded = decodeEventLog({ abi: gatewayAbi, data: log.data, topics: log.topics });
        return decoded.eventName === "OutboundMessageAccepted";
      } catch {
        return false;
      }
    });
    expect(hasOutboundAccepted).toBe(true);

    // Wait for the validator set to be updated on Substrate
    await waitForDataHavenEvent({
      api: dhApi,
      pallet: "ExternalValidators",
      event: "ExternalValidatorsSet",
      timeout: CROSS_CHAIN_TIMEOUTS.ETH_TO_DH_MS
    });

    // Verify new validators are in storage
    const validators = await dhApi.query.ExternalValidators.ExternalValidators.getValue();
    const expectedAddresses = newValidators.map((v) => v.solochainAddress.toLowerCase());

    for (const address of expectedAddresses) {
      expect(validators.some((v) => v.toLowerCase() === address)).toBe(true);
    }
  }, CROSS_CHAIN_TIMEOUTS.ETH_TO_DH_MS);
});
