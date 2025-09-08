import { describe, expect, it } from "bun:test";
import { logger, parseDeploymentsFile } from "utils";
import { SharedTestSuite } from "../framework";

class ContractsTestSuite extends SharedTestSuite {
  constructor() {
    super({
      suiteName: "contracts"
    });

    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new ContractsTestSuite();

describe("Smart Contract Interactions", () => {
  it("should query contract deployment addresses", async () => {
    const _connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();

    // Check that we have basic contract addresses
    expect(deployments.BeefyClient).toBeDefined();
    expect(deployments.Gateway).toBeDefined();
    expect(deployments.ServiceManager).toBeDefined();

    logger.info(`BeefyClient deployed at: ${deployments.BeefyClient}`);
    logger.info(`Gateway deployed at: ${deployments.Gateway}`);
    logger.info(`ServiceManager deployed at: ${deployments.ServiceManager}`);
  });

  it("should check contract code exists", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();

    // Get deployment transaction receipt for BeefyClient
    const code = await connectors.publicClient.getCode({
      address: deployments.BeefyClient as `0x${string}`
    });

    expect(code).toBeDefined();
    expect(code?.length).toBeGreaterThan(2); // More than just "0x"

    logger.info(`BeefyClient contract code size: ${code?.length} bytes`);
  });

  it("should check contract balances", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();

    // Check ETH balance of contracts
    const beefyBalance = await connectors.publicClient.getBalance({
      address: deployments.BeefyClient as `0x${string}`
    });

    const serviceManagerBalance = await connectors.publicClient.getBalance({
      address: deployments.ServiceManager as `0x${string}`
    });

    logger.info(`BeefyClient ETH balance: ${beefyBalance}`);
    logger.info(`ServiceManager ETH balance: ${serviceManagerBalance}`);

    // Contracts typically start with 0 balance
    expect(beefyBalance).toBeGreaterThanOrEqual(0n);
    expect(serviceManagerBalance).toBeGreaterThanOrEqual(0n);
  });

  it("should verify contract addresses are valid", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();

    // List of expected contracts
    const expectedContracts = [
      "BeefyClient",
      "ServiceManager",
      "RewardsRegistry",
      "AVSDirectory",
      "DelegationManager",
      "StrategyManager"
    ];

    for (const contractName of expectedContracts) {
      const address = deployments[contractName as keyof typeof deployments];

      if (address && typeof address === "string") {
        // Verify it's a valid address format
        expect(address.startsWith("0x")).toBeTrue();
        expect(address.length).toBe(42);

        // Verify contract exists (has code)
        const code = await connectors.publicClient.getCode({
          address: address as `0x${string}`
        });

        expect(code).toBeDefined();
        expect(code?.length).toBeGreaterThan(2);

        logger.info(`✓ ${contractName} deployed at ${address}`);
      } else {
        logger.warn(`⚠️ ${contractName} not found in deployments`);
      }
    }
  });
});
