import { describe, expect, it } from "bun:test";
import { parseEther } from "viem";
import { logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { BaseTestSuite } from "../framework";
import type { PolkadotSigner } from "polkadot-api";
import { getPapiSigner } from "utils";

class CrossChainTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "cross-chain",
      networkOptions: {
        // Default options - relayers are included
      }
    });
    
    this.setupHooks();
  }

  async onSetup(): Promise<void> {
    // Wait a bit for relayers to fully initialize
    logger.info("Waiting for relayers to initialize...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
  }
}

// Create the test suite instance
const suite = new CrossChainTestSuite();

describe("Cross-Chain Communication", () => {
  let signer: PolkadotSigner;

  beforeAll(() => {
    signer = getPapiSigner();
  });

  it("should query Ethereum client state on DataHaven", async () => {
    const connectors = suite.getTestConnectors();
    
    // Check if EthereumClient pallet has been initialized
    const initialized = await connectors.dhApi.query.EthereumClient.Initialized.getValue();
    
    logger.info(`EthereumClient initialized: ${initialized}`);
    expect(initialized).toBeDefined();
  });

  it("should check beacon relayer status", async () => {
    const connectors = suite.getTestConnectors();
    
    // Query latest finalized block info
    const latestFinalizedBlock = await connectors.dhApi.query.EthereumClient.LatestFinalizedBlock.getValue();
    
    if (latestFinalizedBlock) {
      logger.info(`Latest finalized block slot: ${latestFinalizedBlock.slot}`);
      logger.info(`Latest finalized block root: ${latestFinalizedBlock.root}`);
      
      expect(latestFinalizedBlock.slot).toBeGreaterThan(0n);
    } else {
      logger.warn("No finalized block yet - beacon relayer may still be syncing");
    }
  });

  it("should verify validator registry connection", async () => {
    const connectors = suite.getTestConnectors();
    
    // Check DataHaven validator registry
    const validatorCount = await connectors.dhApi.query.ValidatorRegistry.ValidatorCount.getValue();
    
    logger.info(`Validator count in registry: ${validatorCount}`);
    expect(validatorCount).toBeGreaterThanOrEqual(0);
  });

  it("should check rewards registry status", async () => {
    const connectors = suite.getTestConnectors();
    
    // Query rewards configuration
    const rewardsEnabled = await connectors.dhApi.query.Rewards.RewardsEnabled.getValue();
    const epochDuration = await connectors.dhApi.query.Rewards.EpochDuration.getValue();
    
    logger.info(`Rewards enabled: ${rewardsEnabled}`);
    logger.info(`Epoch duration: ${epochDuration} blocks`);
    
    expect(rewardsEnabled).toBeDefined();
    expect(epochDuration).toBeGreaterThan(0);
  });

  it("should query cross-chain message queue", async () => {
    const connectors = suite.getTestConnectors();
    
    // Check outbound message queue
    const outboundQueueSize = await connectors.dhApi.query.EthereumOutboundQueue.MessageQueueSize.getValue();
    
    logger.info(`Outbound message queue size: ${outboundQueueSize}`);
    expect(outboundQueueSize).toBeGreaterThanOrEqual(0);
  });

  it("should check BEEFY consensus status", async () => {
    const connectors = suite.getTestConnectors();
    
    // Query BEEFY validator set
    const validatorSet = await connectors.papiClient.runtimeCall(
      "BeefyApi", 
      "validator_set"
    );
    
    if (validatorSet) {
      logger.info(`BEEFY validator set ID: ${validatorSet.id}`);
      logger.info(`BEEFY validator count: ${validatorSet.validators.length}`);
      
      expect(validatorSet.validators.length).toBeGreaterThan(0);
    } else {
      logger.warn("BEEFY validator set not yet available");
    }
  });
});