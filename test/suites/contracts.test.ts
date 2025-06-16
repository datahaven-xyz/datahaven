import { describe, expect, it } from "bun:test";
import { getContract } from "viem";
import { logger, parseDeploymentsFile } from "utils";
import { BaseTestSuite } from "../framework";

// Import ABI files
import BeefyClientAbi from "../../contracts/out/BeefyClient.sol/BeefyClient.json";
import ServiceManagerAbi from "../../contracts/out/DataHavenServiceManager.sol/DataHavenServiceManager.json";

class ContractsTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "contracts",
      networkOptions: {
        // Default options
      }
    });
    
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new ContractsTestSuite();

describe("Smart Contract Interactions", () => {
  it("should interact with BeefyClient contract", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    
    expect(deployments.BeefyClient).toBeDefined();
    
    // Create contract instance
    const beefyClient = getContract({
      address: deployments.BeefyClient as `0x${string}`,
      abi: BeefyClientAbi.abi,
      client: connectors.publicClient
    });
    
    // Query latest BEEFY block
    const latestBlock = await beefyClient.read.latestBeefyBlock();
    logger.info(`Latest BEEFY block: ${latestBlock}`);
    
    expect(latestBlock).toBeGreaterThanOrEqual(0n);
  });

  it("should interact with ServiceManager contract", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    
    expect(deployments.DataHavenServiceManager).toBeDefined();
    
    // Create contract instance
    const serviceManager = getContract({
      address: deployments.DataHavenServiceManager as `0x${string}`,
      abi: ServiceManagerAbi.abi,
      client: connectors.publicClient
    });
    
    // Query AVS directory
    const avsDirectory = await serviceManager.read.avsDirectory();
    logger.info(`AVS Directory: ${avsDirectory}`);
    
    expect(avsDirectory).toBeDefined();
    expect(avsDirectory.startsWith("0x")).toBeTrue();
  });

  it("should query contract deployment block", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    
    // Get deployment transaction receipt for BeefyClient
    const code = await connectors.publicClient.getCode({
      address: deployments.BeefyClient as `0x${string}`
    });
    
    expect(code).toBeDefined();
    expect(code!.length).toBeGreaterThan(2); // More than just "0x"
    
    logger.info(`BeefyClient contract code size: ${code!.length} bytes`);
  });

  it("should check contract balances", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    
    // Check ETH balance of contracts
    const beefyBalance = await connectors.publicClient.getBalance({
      address: deployments.BeefyClient as `0x${string}`
    });
    
    const serviceManagerBalance = await connectors.publicClient.getBalance({
      address: deployments.DataHavenServiceManager as `0x${string}`
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
      "DataHavenServiceManager",
      "RewardsRegistry",
      "AVSDirectory",
      "DelegationManager",
      "StrategyManager"
    ];
    
    for (const contractName of expectedContracts) {
      const address = deployments[contractName];
      
      // Verify address exists
      expect(address).toBeDefined();
      
      // Verify it's a valid address format
      expect(address.startsWith("0x")).toBeTrue();
      expect(address.length).toBe(42);
      
      // Verify contract exists (has code)
      const code = await connectors.publicClient.getCode({
        address: address as `0x${string}`
      });
      
      expect(code).toBeDefined();
      expect(code!.length).toBeGreaterThan(2);
      
      logger.info(`✓ ${contractName} deployed at ${address}`);
    }
  });
});