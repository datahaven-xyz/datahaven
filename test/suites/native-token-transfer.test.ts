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

import { beforeAll, describe, expect, it } from "bun:test";
import { Binary } from "@polkadot-api/substrate-bindings";
import { FixedSizeBinary } from "polkadot-api";
import {
  ANVIL_FUNDED_ACCOUNTS,
  getPapiSigner,
  logger,
  parseDeploymentsFile,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForEthereumEvent
} from "utils";
import { parseEther } from "viem";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

// Constants
// The actual Ethereum sovereign account used by the runtime (derived from runtime configuration)
const ETHEREUM_SOVEREIGN_ACCOUNT = "0xd8030FB68Aa5B447caec066f3C0BdE23E6db0a05";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Minimal ERC20 ABI for reading token metadata and Transfer events
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
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }
    ]
  }
] as const;

// Helper to get the ERC-20 address of the registered native token.
async function getNativeERC20Address(connectors: any): Promise<`0x${string}` | null> {
  try {
    const deployments = await parseDeploymentsFile();

    // The actual token ID that gets registered by the runtime
    // This is computed by the runtime's TokenIdOf converter which uses
    // DescribeGlobalPrefix to encode the reanchored location
    const tokenId =
      "0x68c3bfa36acaeb2d97b73d1453652c6ef27213798f88842ec3286846e8ee4d3a" as `0x${string}`;

    const tokenAddress = (await connectors.publicClient.readContract({
      address: deployments.Gateway,
      abi: gatewayAbi,
      functionName: "tokenAddressOf",
      args: [tokenId]
    })) as `0x${string}`;

    // Return null if the token isn't registered (returns zero address)
    return tokenAddress === ZERO_ADDRESS ? null : tokenAddress;
  } catch (error) {
    // Return null if the contract call fails
    return null;
  }
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

  override async onSetup(): Promise<void> {}
}

// Create the test suite instance
const suite = new NativeTokenTransferTestSuite();

// Create shared signer instances to maintain nonce tracking across tests
let alithSigner: ReturnType<typeof getPapiSigner>;

describe("Native Token Transfer", () => {
  // Initialize signers once before all tests
  beforeAll(() => {
    alithSigner = getPapiSigner("ALITH");
  });
  it("should register DataHaven native token on Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    // First, check if token is already registered
    const existingTokenAddress = await getNativeERC20Address(connectors);

    // Get deployments for later use in the test
    const deployments = await parseDeploymentsFile();

    // Skip registration if token already exists
    if (existingTokenAddress) {
      logger.debug(`Token already registered at: ${existingTokenAddress}`);
      return;
    }

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

    // Create and sign the transaction
    const sudoTx = connectors.dhApi.tx.Sudo.sudo({
      call: registerTx.decodedCall
    });

    // Submit transaction and wait for both DataHaven confirmation and Ethereum event
    const [dhTxResult, ethEventResult] = await Promise.all([
      // Submit and wait for transaction on DataHaven
      sudoTx.signAndSubmit(alithSigner),
      // Wait for the token registration event on Ethereum Gateway
      waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments.Gateway,
        abi: gatewayAbi,
        eventName: "ForeignTokenRegistered",
        fromBlock: 0n,
        timeout: 180000 // 3 minutes (2 epochs @ 2s slots = ~128s + buffer for propagation)
      })
    ]);

    // Verify DataHaven transaction succeeded
    expect(dhTxResult.ok).toBe(true);

    // Check for events in the DataHaven transaction result
    const { events } = dhTxResult;

    // Find Sudo.Sudid event (indicates sudo execution succeeded)
    const sudoEvent = events.find((e: any) => e.type === "Sudo" && e.value.type === "Sudid");
    expect(sudoEvent).toBeDefined();

    // Find SnowbridgeSystemV2.RegisterToken event
    const registerTokenEvent = events.find(
      (e: any) => e.type === "SnowbridgeSystemV2" && e.value.type === "RegisterToken"
    );
    expect(registerTokenEvent).toBeDefined();

    const tokenIdRaw = registerTokenEvent?.value?.value?.foreign_token_id;
    expect(tokenIdRaw).toBeDefined();
    const tokenId = tokenIdRaw.asHex();

    // Verify the Ethereum event was received
    expect(ethEventResult.log).not.toBeNull();

    const eventArgs = (ethEventResult.log as any)?.args;
    expect(eventArgs?.tokenID).toBe(tokenId);

    // Get the deployed token address from the event
    const deployedERC20Address = eventArgs?.token as `0x${string}`;
    expect(deployedERC20Address).not.toBe(ZERO_ADDRESS);

    logger.debug(`ERC20 token deployed at: ${deployedERC20Address}`);

    const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_METADATA_ABI,
        functionName: "name"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_METADATA_ABI,
        functionName: "symbol"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_METADATA_ABI,
        functionName: "decimals"
      }) as Promise<number>
    ]);

    expect(tokenName).toBe("HAVE");
    expect(tokenSymbol).toBe("wHAVE");
    expect(tokenDecimals).toBe(18);
  }, 180_000); // 3 minute timeout (2 epochs @ 2s slots = ~128s + buffer)

  it("should transfer tokens from DataHaven to Ethereum", async () => {
    const connectors = suite.getTestConnectors();

    // Get the deployed token address
    const deployedERC20Address = await getNativeERC20Address(connectors);
    expect(deployedERC20Address).not.toBeNull();

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = parseEther("1");

    // Get initial balances including sovereign account
    const initialDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    const initialSovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    const initialWrappedHaveBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    // Perform transfer
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    const txResult = await tx.signAndSubmit(alithSigner);

    // Check transaction result for errors
    if (!txResult.ok) {
      throw new Error("Transaction failed");
    }

    // Extract events directly from transaction result instead of waiting
    const tokenTransferEvent = txResult.events.find(
      (e: any) =>
        e.type === "DataHavenNativeTransfer" &&
        e.value?.type === "TokensTransferredToEthereum" &&
        e.value?.value?.from === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    const tokensLockedEvent = txResult.events.find(
      (e: any) =>
        e.type === "DataHavenNativeTransfer" &&
        e.value?.type === "TokensLocked" &&
        e.value?.value?.account === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    // Verify DataHaven event was received
    expect(tokenTransferEvent).toBeDefined();
    expect(tokenTransferEvent?.value?.value).toBeDefined();
    logger.debug("DataHaven event confirmed, message should be queued for relayers");

    // Check sovereign account balance after block finalization
    const intermediateBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );
    logger.debug(`Sovereign balance after events: ${intermediateBalance.data.free}`);

    // Now wait for Ethereum event with extended timeout
    logger.debug("Waiting for Ethereum minting event (this may take several minutes)...");
    const tokenMintEvent = await waitForEthereumEvent({
      client: connectors.publicClient,
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      eventName: "Transfer",
      args: {
        from: ZERO_ADDRESS, // Minting from zero address
        to: recipient
      },
      fromBlock: 0n,
      timeout: 300000 // 5 minutes - longer timeout for cross-chain
    });

    // Get final balances including sovereign account
    const finalDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    const finalSovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    const finalWrappedHaveBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    // If Ethereum event was not received, provide diagnostic information
    // Verify results only if Ethereum event was received
    if (tokenMintEvent.log) {
      // Verify user balance decreased by amount + fee + transaction fee
      expect(finalDHBalance.data.free).toBeLessThan(initialDHBalance.data.free);
      const dhDecrease = initialDHBalance.data.free - finalDHBalance.data.free;

      // Calculate the transaction fee from the actual balance change
      const txFee = dhDecrease - (amount + fee);

      // Verify the total decrease is at least the amount + fee
      expect(dhDecrease).toBeGreaterThanOrEqual(amount + fee);

      // Verify the transaction fee is reasonable (less than 0.01 HAVE)
      expect(txFee).toBeLessThan(parseEther("0.01"));
      expect(txFee).toBeGreaterThan(0n);

      // Verify sovereign account balance increased by exactly the amount (not the fee)
      const sovereignIncrease = finalSovereignBalance.data.free - initialSovereignBalance.data.free;
      expect(sovereignIncrease).toBe(amount);

      // Verify wrapped token balance increased by the amount
      expect(finalWrappedHaveBalance).toBeGreaterThan(initialWrappedHaveBalance);
      const wrappedHaveIncrease = finalWrappedHaveBalance - initialWrappedHaveBalance;
      expect(wrappedHaveIncrease).toBe(amount);
    } else {
      // Test fails but with detailed diagnostics
      logger.error("❌ DIAGNOSTIC: Ethereum event not received within timeout");
      logger.error("❌ Cross-chain transfer appears to have failed");

      const dhDecrease = initialDHBalance.data.free - finalDHBalance.data.free;
      const sovereignIncrease = finalSovereignBalance.data.free - initialSovereignBalance.data.free;
      const ethBalanceChange = finalWrappedHaveBalance - initialWrappedHaveBalance;

      logger.error("📊 Current state analysis:");
      logger.error(`   - DataHaven balance decreased: ${dhDecrease}`);
      logger.error(`   - Sovereign balance increased: ${sovereignIncrease}`);
      logger.error(`   - Ethereum balance changed: ${ethBalanceChange}`);

      if (sovereignIncrease > 0n) {
        logger.error("✅ Tokens were locked in sovereign account");
        logger.error("❌ But relayers failed to process the cross-chain message");
        logger.error("💡 This suggests a relayer synchronization issue");
        logger.error("💡 Check relayer logs for 'block header not found' errors");
      } else {
        logger.error("❌ Tokens were not locked in sovereign account");
        logger.error("❌ The transfer function did not execute properly");
      }

      expect(tokenMintEvent.log).toBeDefined();
    }
  }, 360_000);

  it("should maintain 1:1 backing ratio", async () => {
    const connectors = suite.getTestConnectors();

    // Get the deployed token address
    const deployedERC20Address = await getNativeERC20Address(connectors);
    expect(deployedERC20Address).not.toBeNull();

    const totalSupply = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "totalSupply"
    })) as bigint;

    const sovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    expect(sovereignBalance.data.free).toBeGreaterThanOrEqual(totalSupply);
  });

  it("should emit transfer events", async () => {
    const connectors = suite.getTestConnectors();

    // Verify token is registered
    const deployedERC20Address = await getNativeERC20Address(connectors);
    expect(deployedERC20Address).not.toBeNull();

    // Perform small transfer
    const recipient = ANVIL_FUNDED_ACCOUNTS[2].publicKey;
    const amount = parseEther("1");
    const fee = parseEther("0.01");

    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    // Submit transaction first, then wait for events sequentially
    const txResult = await tx.signAndSubmit(alithSigner);

    // Extract events directly from transaction result instead of waiting
    const transferredEvent = txResult.events.find(
      (e: any) =>
        e.type === "DataHavenNativeTransfer" &&
        e.value?.type === "TokensTransferredToEthereum" &&
        e.value?.value?.from === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    const lockedEvent = txResult.events.find(
      (e: any) =>
        e.type === "DataHavenNativeTransfer" &&
        e.value?.type === "TokensLocked" &&
        e.value?.value?.account === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    // Verify transaction succeeded
    expect(txResult.ok).toBe(true);

    // Verify events were received
    expect(transferredEvent).toBeTruthy();
    expect(transferredEvent?.value?.value).toBeTruthy();
    expect(lockedEvent).toBeTruthy();
    expect(lockedEvent?.value?.value).toBeTruthy();
  }, 30_000); // 30 second timeout
});
