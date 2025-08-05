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
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForDataHavenEvent,
  waitForEthereumEvent
} from "utils";
import { getContract, parseEther } from "viem";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

// Constants
const ETHEREUM_SOVEREIGN_ACCOUNT = "0x23e598fa2f50bba6885988e5077200c6d0c5f5cf";
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

let registeredTokenId: string | undefined;
let deployedERC20Address: `0x${string}` | undefined;

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
    // No longer need to wait - will use event-based synchronization
    logger.info("Test setup complete - using event-based synchronization");
  }
}

// Create the test suite instance
const suite = new NativeTokenTransferTestSuite();

describe("Native Token Transfer", () => {
  it("should register DataHaven native token on Ethereum", async () => {
    const connectors = suite.getTestConnectors();
    const alithSigner = getPapiSigner("ALITH");
    const deployments = await parseDeploymentsFile();

    // Check if token is already registered (use stored ID if available)
    expect(registeredTokenId).toBeUndefined();

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
        timeout: 180000, // 3 minutes (2 epochs @ 2s slots = ~128s + buffer for propagation)
        onEvent: (log) => {
          logger.info(
            `Token registered on Ethereum - tokenID: ${(log as any).args.tokenID}, address: ${(log as any).args.token}`
          );
        }
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

    logger.debug(`Token registered on DataHaven with ID: ${tokenId}`);
    registeredTokenId = tokenId;

    // Verify the Ethereum event was received
    expect(ethEventResult.log).not.toBeNull();

    const eventArgs = (ethEventResult.log as any)?.args;
    expect(eventArgs?.tokenID).toBe(tokenId);

    // Get the deployed token address from the event
    deployedERC20Address = eventArgs?.token as `0x${string}`;
    expect(deployedERC20Address).not.toBe(ZERO_ADDRESS);

    logger.info(`ERC20 token deployed at: ${deployedERC20Address}`);

    const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
      connectors.publicClient.readContract({
        address: deployedERC20Address!,
        abi: ERC20_METADATA_ABI,
        functionName: "name"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address!,
        abi: ERC20_METADATA_ABI,
        functionName: "symbol"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address!,
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
    const baltatharSigner = getPapiSigner("BALTATHAR");

    expect(registeredTokenId).toBeDefined();
    expect(deployedERC20Address).toBeDefined();

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = parseEther("1");

    const initialDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
    );

    const initialWrappedHaveBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    logger.info("Initial balances:");
    logger.info(`  DataHaven: ${initialDHBalance.data.free}`);
    logger.info(`  wHAVE on Ethereum: ${initialWrappedHaveBalance}`);

    // Perform transfer
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    // Submit transaction and wait for both DataHaven events and Ethereum token transfer
    const [txResult, tokenTransferEvent, tokenMintEvent] = await Promise.all([
      // Submit the transaction
      tx.signAndSubmit(baltatharSigner),
      // Wait for DataHaven transfer event
      waitForDataHavenEvent({
        api: connectors.dhApi,
        pallet: "DataHavenNativeTransfer",
        event: "TokensTransferredToEthereum",
        filter: (event: any) => event.from === SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey,
        timeout: 30000,
        onEvent: (event) => {
          logger.info(
            `Tokens transferred on DataHaven - from: ${event.from}, to: ${event.to}, amount: ${event.amount?.toString()}`
          );
        }
      }),
      // Wait for ERC20 Transfer event on Ethereum (minting to recipient)
      waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployedERC20Address!,
        abi: ERC20_METADATA_ABI,
        eventName: "Transfer",
        args: {
          from: ZERO_ADDRESS, // Minting from zero address
          to: recipient
        },
        timeout: 180000, // 3 minutes (2 epochs @ 2s slots = ~128s + buffer for propagation)
        onEvent: (log) => {
          logger.info(
            `Tokens minted on Ethereum: ${(log as any).args.value} to ${(log as any).args.to}`
          );
        }
      })
    ]);

    logger.info(`Transfer transaction submitted, hash: ${txResult.txHash}`);

    // Verify DataHaven event was received
    expect(tokenTransferEvent.data).toBeDefined();
    expect(tokenMintEvent.log).toBeDefined();
    const finalDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
    );

    const finalWrappedHaveBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "balanceOf",
      args: [recipient]
    })) as bigint;

    logger.info("Final balances:");
    logger.info(`  DataHaven: ${finalDHBalance.data.free}`);
    logger.info(`  wHAVE on Ethereum: ${finalWrappedHaveBalance}`);

    expect(finalDHBalance.data.free).toBeLessThan(initialDHBalance.data.free);
    expect(finalWrappedHaveBalance).toBeGreaterThan(initialWrappedHaveBalance);

    const dhDecrease = initialDHBalance.data.free - finalDHBalance.data.free;
    const wrappedHaveIncrease = finalWrappedHaveBalance - initialWrappedHaveBalance;

    expect(dhDecrease).toBe(amount + fee);
    expect(wrappedHaveIncrease).toBe(amount);

    logger.success("Transfer completed successfully!");
  }, 180_000); // 3 minute timeout (2 epochs @ 2s slots = ~128s + buffer)

  it("should reject transfer with zero amount", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    expect(registeredTokenId).toBeDefined();

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = 0n;
    const fee = parseEther("1");

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

    expect(registeredTokenId).toBeDefined();

    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = 0n;

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

    const initialPaused = await connectors.dhApi.query.DataHavenNativeTransfer.Paused.getValue();
    logger.info(`Initial paused state: ${initialPaused}`);

    if (initialPaused) {
      logger.info("Pallet is already paused, unpausing first...");
      const unpauseTx = connectors.dhApi.tx.DataHavenNativeTransfer.unpause();
      const sudoUnpauseTx = connectors.dhApi.tx.Sudo.sudo({ call: unpauseTx.decodedCall });
      const result = await sudoUnpauseTx.signAndSubmit(alithSigner);

      // Verify transaction succeeded and check events
      expect(result.ok).toBe(true);
      const sudoEvent = result.events.find(
        (e: any) => e.type === "Sudo" && e.value.type === "Sudid"
      );
      expect(sudoEvent).toBeDefined();

      const unpausedEvent = result.events.find(
        (e: any) => e.type === "DataHavenNativeTransfer" && e.value.type === "Unpaused"
      );
      expect(unpausedEvent).toBeDefined();
      logger.info("Pallet unpaused successfully");
    }

    // Pause transfers
    const pauseTx = connectors.dhApi.tx.DataHavenNativeTransfer.pause();
    const sudoPauseTx = connectors.dhApi.tx.Sudo.sudo({ call: pauseTx.decodedCall });

    const pauseResult = await sudoPauseTx.signAndSubmit(alithSigner);

    // Verify transaction succeeded and check events
    expect(pauseResult.ok).toBe(true);
    const pauseSudoEvent = pauseResult.events.find(
      (e: any) => e.type === "Sudo" && e.value.type === "Sudid"
    );
    expect(pauseSudoEvent).toBeDefined();

    const pausedEvent = pauseResult.events.find(
      (e: any) => e.type === "DataHavenNativeTransfer" && e.value.type === "Paused"
    );
    expect(pausedEvent).toBeDefined();
    logger.info("Pallet paused successfully");

    // Try transfer while paused
    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("10");
    const fee = parseEther("0.1");

    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    let transferFailed = false;
    try {
      await tx.signAndSubmit(baltatharSigner);
    } catch (error: any) {
      transferFailed = true;
      logger.info("Transfer correctly rejected while paused");
    }
    expect(transferFailed).toBe(true);

    // Unpause transfers
    const unpauseTx = connectors.dhApi.tx.DataHavenNativeTransfer.unpause();
    const sudoUnpauseTx = connectors.dhApi.tx.Sudo.sudo({ call: unpauseTx.decodedCall });

    const unpauseResult = await sudoUnpauseTx.signAndSubmit(alithSigner);

    // Verify transaction succeeded and check events
    expect(unpauseResult.ok).toBe(true);
    const unpauseSudoEvent = unpauseResult.events.find(
      (e: any) => e.type === "Sudo" && e.value.type === "Sudid"
    );
    expect(unpauseSudoEvent).toBeDefined();

    const finalUnpausedEvent = unpauseResult.events.find(
      (e: any) => e.type === "DataHavenNativeTransfer" && e.value.type === "Unpaused"
    );
    expect(finalUnpausedEvent).toBeDefined();

    logger.success("Pause/unpause functionality verified");
  });

  it("should maintain 1:1 backing ratio", async () => {
    const connectors = suite.getTestConnectors();

    expect(registeredTokenId).toBeDefined();
    expect(deployedERC20Address).toBeDefined();

    const totalSupply = (await connectors.publicClient.readContract({
      address: deployedERC20Address!,
      abi: ERC20_METADATA_ABI,
      functionName: "totalSupply"
    })) as bigint;

    const sovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    logger.info(`Wrapped token total supply: ${totalSupply}`);
    logger.info(`Sovereign account balance: ${sovereignBalance.data.free}`);

    expect(sovereignBalance.data.free).toBeGreaterThanOrEqual(totalSupply);

    logger.success("1:1 backing ratio verified");
  });

  it("should emit transfer events", async () => {
    const connectors = suite.getTestConnectors();
    const baltatharSigner = getPapiSigner("BALTATHAR");

    expect(registeredTokenId).toBeDefined();

    // Perform small transfer
    const recipient = ANVIL_FUNDED_ACCOUNTS[2].publicKey;
    const amount = parseEther("1");
    const fee = parseEther("0.01");

    logger.info("Starting transfer for event verification...");

    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    // Submit transaction and wait for both events
    const [txResult, transferredEvent, lockedEvent] = await Promise.all([
      tx.signAndSubmit(baltatharSigner),
      waitForDataHavenEvent({
        api: connectors.dhApi,
        pallet: "DataHavenNativeTransfer",
        event: "TokensTransferredToEthereum",
        timeout: 30000, // Increased timeout
        filter: (event: any) => event.from === SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey,
        onEvent: (event) => {
          logger.info(
            `TokensTransferredToEthereum event received - from: ${event.from}, to: ${event.to}, amount: ${event.amount?.toString()}`
          );
        }
      }),
      waitForDataHavenEvent({
        api: connectors.dhApi,
        pallet: "DataHavenNativeTransfer",
        event: "TokensLocked",
        timeout: 30000, // Increased timeout
        filter: (event: any) => event.from === SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey,
        onEvent: (event) => {
          logger.info(
            `TokensLocked event received - from: ${event.from}, amount: ${event.amount?.toString()}`
          );
        }
      })
    ]);

    // Verify transaction succeeded
    expect(txResult.ok).toBe(true);

    // Verify events were received
    expect(transferredEvent.data).toBeTruthy();
    expect(lockedEvent.data).toBeTruthy();

    logger.success("Event emissions verified");
  }, 30_000); // 30 second timeout
});
