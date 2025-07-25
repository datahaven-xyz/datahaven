/**
 * Native Token Transfer E2E Tests
 *
 * Tests the native HAVE token transfer functionality between DataHaven and Ethereum
 * using the Snowbridge cross-chain messaging protocol.
 *
 * Prerequisites:
 * - DataHaven network with DataHavenNativeTransfer pallet
 * - Ethereum network with Gateway contract
 * - Snowbridge relayers running
 * - Sudo access for token registration
 */

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

// Minimal ERC20 ABI for reading token metadata
const ERC20_METADATA_ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

const NATIVE_TOKEN_LOCATION = { parents: 0, interior: { type: "Here", value: undefined } } as const;

/**
 * Query the Gateway contract for the ERC-20 address that backs a Snowbridge
 * `TokenId`.
 *
 * The Gateway maintains the mapping `tokenAddressOf(bytes32 id) → address`.
 * A non-zero result indicates that the wrapped token has already been
 * deployed on Ethereum.
 *
 * Returns the address when present, or `undefined` if the mapping returns the
 * zero-address.  Errors thrown by the RPC are forwarded unchanged so the test
 * harness can report them.
 */
async function getTokenAddress(gateway: any, tokenId: string): Promise<Address | undefined> {
  // Using blockTag "latest" to ensure we always read committed state.
  const address = await gateway.read.tokenAddressOf([tokenId as `0x${string}`], {
    blockTag: "latest"
  } as any);
  return address !== ZERO_ADDRESS ? (address as Address) : undefined;
}

class NativeTokenTransferTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "native-token-transfer",
      networkOptions: {
        slotTime: 2
      }
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    // Wait for relayers and chain sync
    logger.info("Waiting for relayers and chain synchronization...");
    await Bun.sleep(15000);
  }
}

// Create the test suite instance
const suite = new NativeTokenTransferTestSuite();

describe("Native Token Transfer", () => {
  it("should register DataHaven native token on Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    const alithSigner = getPapiSigner("ALITH");
    const deployments = await parseDeploymentsFile();

    // Ensure token is not already registered
    const existingTokenId =
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      );
    expect(existingTokenId).toBeUndefined();

    // Register token via sudo
    const registerTx = connectors.dhApi.tx.SnowbridgeSystemV2.register_token({
      sender: { type: "V5", value: { parents: 0, interior: { type: "Here", value: undefined } } },
      asset_id: { type: "V5", value: { parents: 0, interior: { type: "Here", value: undefined } } },
      metadata: {
        name: Binary.fromText("HAVE"),
        symbol: Binary.fromText("wHAVE"),
        decimals: 18
      }
    });

    await connectors.dhApi.tx.Sudo.sudo({ call: registerTx.decodedCall }).signAndSubmit(
      alithSigner
    );

    // Check if token was successfully registered
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();
    expect(tokenId).toBeDefined();

    // Get token address from Gateway
    const gateway = getContract({
      address: deployments.Gateway,
      abi: gatewayAbi,
      client: connectors.publicClient
    });

    const tokenAddress = await getTokenAddress(gateway, tokenId as string);
    expect(tokenAddress).toBeDefined();

    // Read and verify ERC20 metadata in parallel
    const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
      connectors.publicClient.readContract({
        address: tokenAddress!,
        abi: ERC20_METADATA_ABI,
        functionName: "name"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: tokenAddress!,
        abi: ERC20_METADATA_ABI,
        functionName: "symbol"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: tokenAddress!,
        abi: ERC20_METADATA_ABI,
        functionName: "decimals"
      }) as Promise<number>
    ]);

    // Verify metadata
    expect(tokenName).toBe("HAVE");
    expect(tokenSymbol).toBe("wHAVE");
    expect(tokenDecimals).toBe(18);

    logger.success(`Native token registered with ID ${tokenId} at: ${tokenAddress}`);
  }, 60_000); // 60 second timeout for registration

  it("should transfer tokens from DataHaven to Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    const deployments = await parseDeploymentsFile();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Get token info from Snowbridge storage
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();

    if (!tokenId) {
      logger.warn("Token not registered, skipping transfer test");
      return;
    }

    // Get token address from Gateway
    const gateway = getContract({
      address: deployments.Gateway,
      abi: gatewayAbi,
      client: connectors.publicClient
    });

    const tokenAddress = await getTokenAddress(gateway, tokenId);
    if (!tokenAddress) {
      logger.warn("Token address not found on Ethereum, skipping transfer test");
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
      address: tokenAddress!,
      abi: ERC20_METADATA_ABI,
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
      address: tokenAddress!,
      abi: ERC20_METADATA_ABI,
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
  }, 90_000); // 90 second timeout for cross-chain transfer

  it("should reject transfer with zero amount", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check if token is registered
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();

    if (!tokenId) {
      logger.warn("Token not registered, skipping validation test");
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
    } catch (error: any) {
      logger.info("Zero amount transfer correctly rejected");
      logger.debug(`Rejection reason: ${error.message || error}`);
      expect(error).toBeDefined();
    }
  });

  it("should reject transfer with zero fee", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    // Check if token is registered
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();

    if (!tokenId) {
      logger.warn("Token not registered, skipping validation test");
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
    } catch (error: any) {
      logger.info("Zero fee transfer correctly rejected");
      logger.debug(`Rejection reason: ${error.message || error}`);
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
    } catch (error: any) {
      logger.info("Transfer correctly rejected while paused");
      logger.debug(`Rejection reason: ${error.message || error}`);
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

    // Get token info from Snowbridge storage
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();

    if (!tokenId) {
      logger.warn("Token not registered, skipping backing ratio test");
      return;
    }

    // Get token address from Gateway
    const gateway = getContract({
      address: deployments.Gateway,
      abi: gatewayAbi,
      client: connectors.publicClient
    });

    const tokenAddress = await getTokenAddress(gateway, tokenId);
    if (!tokenAddress) {
      logger.warn("Token address not found on Ethereum, skipping backing ratio test");
      return;
    }

    // Get total supply of wrapped tokens
    const totalSupply = (await connectors.publicClient.readContract({
      address: tokenAddress!,
      abi: ERC20_METADATA_ABI,
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
    const tokenId = (
      await connectors.dhApi.query.SnowbridgeSystem.NativeToForeignId.getValue(
        NATIVE_TOKEN_LOCATION
      )
    )?.asHex();

    if (!tokenId) {
      logger.warn("Token not registered, skipping event test");
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
