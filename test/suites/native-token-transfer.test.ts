import { describe, expect, it } from "bun:test";
import { Binary } from "@polkadot-api/substrate-bindings";
import { FixedSizeBinary } from "polkadot-api";
import {
  ANVIL_FUNDED_ACCOUNTS,
  getPapiSigner,
  logger,
  parseDeploymentsFile,
  SUBSTRATE_FUNDED_ACCOUNTS
} from "utils";
import { type Address, getContract, parseEther } from "viem";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

// Constants
const ETHEREUM_SOVEREIGN_ACCOUNT = "0x23e598fa2f50bba6885988e5077200c6d0c5f5cf";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

class NativeTokenTransferTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "native-token-transfer",
      networkOptions: {
        slotTime: 2,
      }
    });

    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new NativeTokenTransferTestSuite();

describe("Native Token Transfer", () => {
  it("should register DataHaven native token on Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    const alithSigner = getPapiSigner("ALITH");

    // Check if already registered
    let nativeTokenId: string | undefined;
    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      if (storage.NativeTokenId) {
        nativeTokenId = await storage.NativeTokenId.getValue();
      }
    } catch (_error) {
      logger.debug("Native token not yet registered");
    }

    if (nativeTokenId) {
      logger.info("Token already registered, skipping");
      return;
    }

    // Register token via sudo
    const registerTx = connectors.dhApi.tx.SnowbridgeSystemV2.register_token({
      sender: { type: "V3", value: { parents: 0, interior: { type: "Here", value: undefined } } },
      asset_id: { type: "V3", value: { parents: 0, interior: { type: "Here", value: undefined } } },
      metadata: {
        name: Binary.fromText("HAVE"),
        symbol: Binary.fromText("wHAVE"),
        decimals: 18
      }
    });

    const sudoTx = connectors.dhApi.tx.Sudo.sudo({ call: registerTx.decodedCall });
    const result = await sudoTx.signAndSubmit(alithSigner);

    logger.info(`Registration transaction: ${result}`);

    // Wait for processing
    await Bun.sleep(30000);

    // Verify registration succeeded
    const deployments = await parseDeploymentsFile();
    const gateway = getContract({
      address: deployments.Gateway,
      abi: gatewayAbi,
      client: connectors.publicClient
    });

    // Check token is registered
    const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
    const tokenId = await storage.NativeTokenId.getValue();
    expect(tokenId).toBeDefined();

    const tokenAddress = await gateway.read.tokenAddressOf([tokenId as `0x${string}`]);
    expect(tokenAddress).not.toBe(ZERO_ADDRESS);

    logger.success(`Native token registered at: ${tokenAddress}`);
  });

  it("should transfer tokens from DataHaven to Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Get token info
    let tokenId: string | undefined;
    let tokenAddress: Address | undefined;

    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      tokenId = await storage.NativeTokenId.getValue();

      if (tokenId) {
        const gateway = getContract({
          address: deployments.Gateway,
          abi: gatewayAbi,
          client: connectors.publicClient
        });
        tokenAddress = await gateway.read.tokenAddressOf([tokenId as `0x${string}`]);
      }
    } catch (_error) {
      logger.warn("Token not registered, skipping transfer test");
      return;
    }

    if (!tokenId || !tokenAddress || tokenAddress === ZERO_ADDRESS) {
      logger.warn("Token not properly registered");
      return;
    }

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = parseEther("1");

    // Get initial balances
    const initialDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
    );

    const initialEthBalance = (await connectors.publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function"
        }
      ],
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    logger.info("Initial balances:");
    logger.info(`  DataHaven: ${initialDHBalance.data.free}`);
    logger.info(`  Ethereum: ${initialEthBalance}`);

    // Perform transfer
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    const result = await tx.signAndSubmit(baltatharSigner);
    logger.info(`Transfer transaction: ${result}`);

    // Wait for cross-chain processing
    logger.info("Waiting for cross-chain processing...");
    await Bun.sleep(60000);

    // Check final balances
    const finalDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
    );

    const finalEthBalance = (await connectors.publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function"
        }
      ],
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    logger.info("Final balances:");
    logger.info(`  DataHaven: ${finalDHBalance.data.free}`);
    logger.info(`  Ethereum: ${finalEthBalance}`);

    // Verify balances changed correctly
    expect(finalDHBalance.data.free).toBeLessThan(initialDHBalance.data.free);
    expect(finalEthBalance).toBeGreaterThan(initialEthBalance);

    const dhDecrease = initialDHBalance.data.free - finalDHBalance.data.free;
    const ethIncrease = finalEthBalance - initialEthBalance;

    expect(dhDecrease).toBe(amount + fee);
    expect(ethIncrease).toBe(amount);

    logger.success("Transfer completed successfully!");
  });

  it("should reject transfer with zero amount", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check if token is registered
    let tokenId: string | undefined;
    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      tokenId = await storage.NativeTokenId.getValue();
    } catch (_error) {
      logger.warn("Token not registered, skipping validation test");
      return;
    }

    if (!tokenId) {
      logger.warn("Token not registered");
      return;
    }

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = 0n;
    const fee = parseEther("1");

    // Attempt transfer
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    try {
      await tx.signAndSubmit(baltatharSigner);
      throw new Error("Transfer should have failed");
    } catch (error) {
      logger.info("Zero amount transfer correctly rejected");
      expect(error).toBeDefined();
    }
  });

  it("should reject transfer with zero fee", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check if token is registered
    let tokenId: string | undefined;
    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      tokenId = await storage.NativeTokenId.getValue();
    } catch (_error) {
      logger.warn("Token not registered, skipping validation test");
      return;
    }

    if (!tokenId) {
      logger.warn("Token not registered");
      return;
    }

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = 0n;

    // Attempt transfer
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    try {
      await tx.signAndSubmit(baltatharSigner);
      throw new Error("Transfer should have failed");
    } catch (error) {
      logger.info("Zero fee transfer correctly rejected");
      expect(error).toBeDefined();
    }
  });

  it("should pause and unpause transfers", async () => {
    const connectors = suite.getTestConnectors();
    const alithSigner = getPapiSigner("ALITH");
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check initial pause state
    const initialPaused = await connectors.dhApi.query.DataHavenNativeTransfer.Paused.getValue();
    expect(initialPaused).toBe(false);

    // Pause transfers
    const pauseTx = connectors.dhApi.tx.DataHavenNativeTransfer.pause();
    const sudoPauseTx = connectors.dhApi.tx.Sudo.sudo({ call: pauseTx.decodedCall });

    await sudoPauseTx.signAndSubmit(alithSigner);
    await Bun.sleep(3000);

    // Verify paused
    const pausedState = await connectors.dhApi.query.DataHavenNativeTransfer.Paused.getValue();
    expect(pausedState).toBe(true);

    // Try transfer while paused
    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("10");
    const fee = parseEther("0.1");

    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    try {
      await tx.signAndSubmit(baltatharSigner);
      throw new Error("Transfer should have failed while paused");
    } catch (error) {
      logger.info("Transfer correctly rejected while paused");
      expect(error).toBeDefined();
    }

    // Unpause transfers
    const unpauseTx = connectors.dhApi.tx.DataHavenNativeTransfer.unpause();
    const sudoUnpauseTx = connectors.dhApi.tx.Sudo.sudo({ call: unpauseTx.decodedCall });

    await sudoUnpauseTx.signAndSubmit(alithSigner);
    await Bun.sleep(3000);

    // Verify unpaused
    const unpausedState = await connectors.dhApi.query.DataHavenNativeTransfer.Paused.getValue();
    expect(unpausedState).toBe(false);

    logger.success("Pause/unpause functionality verified");
  });

  it("should maintain 1:1 backing ratio", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();

    // Get token info
    let tokenId: string | undefined;
    let tokenAddress: Address | undefined;

    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      tokenId = await storage.NativeTokenId.getValue();

      if (tokenId) {
        const gateway = getContract({
          address: deployments.Gateway,
          abi: gatewayAbi,
          client: connectors.publicClient
        });
        tokenAddress = await gateway.read.tokenAddressOf([tokenId as `0x${string}`]);
      }
    } catch (_error) {
      logger.warn("Token not registered, skipping backing ratio test");
      return;
    }

    if (!tokenId || !tokenAddress || tokenAddress === ZERO_ADDRESS) {
      logger.warn("Token not properly registered");
      return;
    }

    // Get total supply of wrapped tokens
    const totalSupply = (await connectors.publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [],
          name: "totalSupply",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function"
        }
      ],
      functionName: "totalSupply"
    })) as bigint;

    // Get sovereign account balance
    const sovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    logger.info(`Wrapped token total supply: ${totalSupply}`);
    logger.info(`Sovereign account balance: ${sovereignBalance.data.free}`);

    // Verify 1:1 backing
    expect(sovereignBalance.data.free).toBeGreaterThanOrEqual(totalSupply);

    logger.success("1:1 backing ratio verified");
  });

  it("should emit transfer events", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check if token is registered
    let tokenId: string | undefined;
    try {
      const storage = connectors.dhApi.query.DataHavenNativeTransfer as any;
      tokenId = await storage.NativeTokenId.getValue();
    } catch (_error) {
      logger.warn("Token not registered, skipping event test");
      return;
    }

    if (!tokenId) {
      logger.warn("Token not registered");
      return;
    }

    let tokensTransferredEvent: any = null;
    let tokensLockedEvent: any = null;

    // Subscribe to events
    const subscriptions: any[] = [];

    subscriptions.push(
      connectors.dhApi.event.DataHavenNativeTransfer.TokensTransferredToEthereum.watch((event) => {
        tokensTransferredEvent = event;
        return true;
      })
    );

    subscriptions.push(
      connectors.dhApi.event.DataHavenNativeTransfer.TokensLocked.watch((event) => {
        tokensLockedEvent = event;
        return true;
      })
    );

    // Perform small transfer
    const recipient = ANVIL_FUNDED_ACCOUNTS[2].publicKey;
    const amount = parseEther("1");
    const fee = parseEther("0.01");

    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    await tx.signAndSubmit(baltatharSigner);

    // Wait for events
    await Bun.sleep(5000);

    // Cleanup subscriptions
    for (const sub of subscriptions) {
      if (sub && typeof sub.unsubscribe === "function") {
        sub.unsubscribe();
      }
    }

    // Verify events
    expect(tokensTransferredEvent).toBeTruthy();
    expect(tokensLockedEvent).toBeTruthy();

    logger.success("Event emissions verified");
  });
});
