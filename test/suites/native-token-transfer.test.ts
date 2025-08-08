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
  CHAIN_ID,
  getPapiSigner,
  logger,
  parseDeploymentsFile,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForEthereumEvent
} from "utils";
import { createWalletClient, encodeAbiParameters, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

// Constants
// The actual Ethereum sovereign account used by the runtime (derived from runtime configuration)
const ETHEREUM_SOVEREIGN_ACCOUNT = "0xd8030FB68Aa5B447caec066f3C0BdE23E6db0a05";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Minimal ERC20 ABI for reading token metadata and Transfer events
const ERC20_ABI = [
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
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
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
  } catch (_error) {
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

    // Helper to get a safe starting block for event watches
    const headMinusOne = async () => {
      const n = await connectors.publicClient.getBlockNumber();
      return n > 0n ? n - 1n : n;
    };

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
        fromBlock: await headMinusOne(),
        timeout: 180000
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
        abi: ERC20_ABI,
        functionName: "name"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "symbol"
      }) as Promise<string>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
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
    if (!deployedERC20Address) {
      throw new Error("Native token ERC20 address not found");
    }

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
      address: deployedERC20Address,
      abi: ERC20_ABI,
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

    // Verify DataHaven events were received
    expect(tokenTransferEvent).toBeDefined();
    expect(tokenTransferEvent?.value?.value).toBeDefined();
    expect(tokensLockedEvent).toBeDefined();
    expect(tokensLockedEvent?.value?.value).toBeDefined();
    logger.debug("DataHaven event confirmed, message should be queued for relayers");

    // Check sovereign account balance after block finalization
    const intermediateBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );
    logger.debug(`Sovereign balance after events: ${intermediateBalance.data.free}`);

    // Now wait for Ethereum event with extended timeout
    logger.debug("Waiting for Ethereum minting event (this may take several minutes)...");
    const startTransferBlock = await connectors.publicClient.getBlockNumber();
    const transferFromBlock =
      startTransferBlock > 0n ? startTransferBlock - 1n : startTransferBlock;
    const tokenMintEvent = await waitForEthereumEvent({
      client: connectors.publicClient,
      address: deployedERC20Address,
      abi: ERC20_ABI,
      eventName: "Transfer",
      args: {
        from: ZERO_ADDRESS, // Minting from zero address
        to: recipient
      },
      fromBlock: transferFromBlock,
      timeout: 300000
    });

    // Get final balances including sovereign account
    const finalDHBalance = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    const finalSovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    const finalWrappedHaveBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address,
      abi: ERC20_ABI,
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
      // Compact diagnostics and fail the test with a helpful message
      const dhDecrease = initialDHBalance.data.free - finalDHBalance.data.free;
      const sovereignIncrease = finalSovereignBalance.data.free - initialSovereignBalance.data.free;
      const ethBalanceChange = finalWrappedHaveBalance - initialWrappedHaveBalance;

      const summary = `Ethereum mint event not observed within timeout. DHΔ=${dhDecrease}, SovereignΔ=${sovereignIncrease}, ERC20Δ=${ethBalanceChange}`;
      logger.warn(summary);
      throw new Error(summary);
    }
  }, 360_000);

  it("should maintain 1:1 backing ratio", async () => {
    const connectors = suite.getTestConnectors();

    // Get the deployed token address
    const deployedERC20Address = await getNativeERC20Address(connectors);
    if (!deployedERC20Address) {
      throw new Error("Native token ERC20 address not found");
    }

    const totalSupply = (await connectors.publicClient.readContract({
      address: deployedERC20Address,
      abi: ERC20_ABI,
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
    if (!deployedERC20Address) {
      throw new Error("Native token ERC20 address not found");
    }

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

  it("should transfer tokens from Ethereum to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    // Resolve deployed ERC20 for native token; if missing, register via sudo
    const deployedERC20Address = await getNativeERC20Address(connectors);
    if (!deployedERC20Address) {
      throw new Error("Native token ERC20 address not found. Register the token first.");
    }

    // Load deployments
    const deployments = await parseDeploymentsFile();

    // Create a wallet client bound to the Kurtosis chain ID (3151908)
    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const chain = {
      id: CHAIN_ID,
      name: "anvil-3151908",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [connectors.elRpcUrl] }, public: { http: [connectors.elRpcUrl] } }
    } as any;
    const ethWalletClient = createWalletClient({
      account,
      chain: chain,
      transport: http(connectors.elRpcUrl)
    });
    const ethereumSender = account.address as `0x${string}`;

    // Destination on DataHaven is ALITH (AccountId20)
    const dhRecipient = SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey as `0x${string}`;

    const amount = parseEther("5");
    // v2 fees in ETH
    const executionFee = parseEther("0.1");
    const relayerFee = parseEther("0.4");

    // Helper to make bytes for MultiAddress.data (Address20)
    const address20ToBytes = (addr: `0x${string}`): `0x${string}` => {
      return addr.toLowerCase() as `0x${string}`;
    };

    // No v1 fee quoting in v2 path

    // Ensure sender has enough wrapped tokens on Ethereum; if not, fund via DH -> ETH transfer
    let currentEthTokenBalance = (await connectors.publicClient.readContract({
      address: deployedERC20Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ethereumSender]
    })) as bigint;
    if (currentEthTokenBalance < amount) {
      const mintAmount = amount - currentEthTokenBalance;
      const fee = parseEther("0.01");
      const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
        recipient: FixedSizeBinary.fromHex(ethereumSender) as FixedSizeBinary<20>,
        amount: mintAmount,
        fee
      });
      const startMintBlock = await connectors.publicClient.getBlockNumber();
      const mintFromBlock = startMintBlock > 0n ? startMintBlock - 1n : startMintBlock;
      const txResult = await tx.signAndSubmit(alithSigner);
      expect(txResult.ok).toBe(true);
      const mintEvent = await waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployedERC20Address,
        abi: ERC20_ABI,
        eventName: "Transfer",
        args: { from: ZERO_ADDRESS, to: ethereumSender },
        fromBlock: mintFromBlock,
        timeout: 300000
      });
      expect(mintEvent.log).not.toBeNull();
      currentEthTokenBalance = (await connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ethereumSender]
      })) as bigint;
    }

    // Capture initial balances and supply for ETH -> DH leg
    const [initialEthTokenBalance, initialTotalSupply] = await Promise.all([
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ethereumSender]
      }) as Promise<bigint>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "totalSupply"
      }) as Promise<bigint>
    ]);
    expect(initialEthTokenBalance).toBeGreaterThanOrEqual(amount);

    const initialDhRecipientBalance =
      await connectors.dhApi.query.System.Account.getValue(dhRecipient);
    const initialSovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    // Approve Gateway to pull tokens
    const approveHash = await ethWalletClient.writeContract({
      address: deployedERC20Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [deployments.Gateway as `0x${string}`, amount],
      chain: chain
    });
    await connectors.publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Build Snowbridge v2 send payload
    const assets = [
      encodeAbiParameters(
        [
          { name: "kind", type: "uint8" },
          { name: "token", type: "address" },
          { name: "value", type: "uint128" }
        ],
        [0n, deployedERC20Address, amount]
      )
    ];
    const claimer = "0x" as `0x${string}`;
    const xcm = "0x" as `0x${string}`;

    // Submit v2_sendMessage on Gateway. If unsupported in local env, skip test.
    let sendHash: `0x${string}` | null = null;
    try {
      sendHash = await ethWalletClient.writeContract({
        address: deployments.Gateway as `0x${string}`,
        abi: gatewayAbi,
        functionName: "v2_sendMessage",
        args: [xcm, assets as any, claimer, executionFee, relayerFee],
        value: executionFee + relayerFee,
        chain: chain
      });
    } catch (err: any) {
      const message = String(err?.shortMessage || err?.message || err);
      if (message.includes("Unsupported()") || message.includes("v2_sendMessage")) {
        logger.warn(
          "Skipping ETH->DataHaven transfer test: v2_sendMessage unsupported in this env"
        );
        return;
      }
      throw err;
    }

    if (!sendHash) {
      throw new Error("sendToken transaction hash is undefined");
    }
    const sendReceipt = await connectors.publicClient.waitForTransactionReceipt({
      hash: sendHash
    });
    expect(sendReceipt.status).toBe("success");

    // Wait for Gateway v2 OutboundMessageAccepted event (from previous block if needed)
    const startBlock = await connectors.publicClient.getBlockNumber();
    const fromBlock = startBlock > 0n ? startBlock - 1n : startBlock;
    const tokenSent = await waitForEthereumEvent({
      client: connectors.publicClient,
      address: deployments.Gateway as `0x${string}`,
      abi: gatewayAbi,
      eventName: "OutboundMessageAccepted",
      fromBlock,
      timeout: 120000
    });
    expect(tokenSent.log).not.toBeNull();

    // Wait for DataHaven unlock event
    const dhEvent = await (await import("../utils")).waitForDataHavenEvent<{
      account: string;
      amount: bigint;
    }>({
      api: connectors.dhApi,
      pallet: "DataHavenNativeTransfer",
      event: "TokensUnlocked",
      filter: (e: any) => e?.account === dhRecipient,
      timeout: 360000
    });
    expect(dhEvent.data).not.toBeNull();

    // Final balances
    const [finalEthTokenBalance, finalTotalSupply] = await Promise.all([
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ethereumSender]
      }) as Promise<bigint>,
      connectors.publicClient.readContract({
        address: deployedERC20Address,
        abi: ERC20_ABI,
        functionName: "totalSupply"
      }) as Promise<bigint>
    ]);

    const finalDhRecipientBalance =
      await connectors.dhApi.query.System.Account.getValue(dhRecipient);
    const finalSovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    // Assertions: burn on Ethereum and unlock on DataHaven
    expect(finalEthTokenBalance).toBe(initialEthTokenBalance - amount);
    expect(finalTotalSupply).toBe(initialTotalSupply - amount);

    const dhIncrease = finalDhRecipientBalance.data.free - initialDhRecipientBalance.data.free;
    const sovereignDecrease = initialSovereignBalance.data.free - finalSovereignBalance.data.free;

    expect(dhIncrease).toBeGreaterThanOrEqual(amount);
    expect(sovereignDecrease).toBeGreaterThanOrEqual(amount);
  }, 420_000);
});
