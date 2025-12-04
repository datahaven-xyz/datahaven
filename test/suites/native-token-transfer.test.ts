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
  expectDhEvent,
  getPapiSigner,
  logger,
  parseDeploymentsFile,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForDataHavenEvent,
  waitForEthereumEvent,
  ZERO_ADDRESS
} from "utils";
import { decodeEventLog, encodeAbiParameters, erc20Abi, parseEventLogs, parseEther } from "viem";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";
import type { TestConnectors } from "../framework/connectors";

// Constants
const ETHEREUM_SOVEREIGN_ACCOUNT = "0xd8030FB68Aa5B447caec066f3C0BdE23E6db0a05";
const NATIVE_TOKEN_ID =
  "0x68c3bfa36acaeb2d97b73d1453652c6ef27213798f88842ec3286846e8ee4d3a" as `0x${string}`;

// Cross-chain operation timeouts
// DH → ETH: ~17-30s ideal (DH block + BEEFY finality + relay poll + ETH tx)
// ETH → DH: ~2-3 min ideal (ETH block + beacon finality ~2min + relay poll + DH block)
const DH_TO_ETH_TIMEOUT_MS = 3 * 60 * 1000;   // 3 minutes (conservative)
const ETH_TO_DH_TIMEOUT_MS = 6 * 60 * 1000;   // 6 minutes (Ethereum finality dominates)

interface ForeignTokenRegisteredEvent {
  tokenID: string;
  token: `0x${string}`;
}

interface BalanceSnapshot {
  dh: bigint;
  sovereign: bigint;
  erc20: bigint;
}

async function getBalanceSnapshot(
  connectors: Pick<TestConnectors, "dhApi" | "publicClient">,
  opts: { dhAccount?: string; ethAccount?: `0x${string}`; erc20Address?: `0x${string}` }
): Promise<BalanceSnapshot> {
  const { dhApi, publicClient } = connectors;
  const { dhAccount, ethAccount, erc20Address } = opts;

  const [dhBalance, sovereignBalance, erc20Balance] = await Promise.all([
    dhAccount ? dhApi.query.System.Account.getValue(dhAccount) : null,
    dhApi.query.System.Account.getValue(ETHEREUM_SOVEREIGN_ACCOUNT),
    erc20Address && ethAccount
      ? publicClient.readContract({ address: erc20Address, abi: erc20Abi, functionName: "balanceOf", args: [ethAccount] })
      : 0n
  ]);

  return {
    dh: dhBalance?.data.free ?? 0n,
    sovereign: sovereignBalance.data.free,
    erc20: erc20Balance as bigint
  };
}

function expectBalanceDeltas(
  before: BalanceSnapshot,
  after: BalanceSnapshot,
  expected: { dhMin?: bigint; dhExact?: bigint; sovereign?: bigint; erc20?: bigint }
): void {
  if (expected.dhMin !== undefined) {
    const decrease = before.dh - after.dh;
    expect(decrease).toBeGreaterThanOrEqual(expected.dhMin);
    expect(decrease - expected.dhMin).toBeLessThan(parseEther("0.01")); // tx fee sanity check
  }
  if (expected.dhExact !== undefined) {
    expect(after.dh - before.dh).toBe(expected.dhExact);
  }
  if (expected.sovereign !== undefined) {
    expect(after.sovereign - before.sovereign).toBe(expected.sovereign);
  }
  if (expected.erc20 !== undefined) {
    expect(after.erc20 - before.erc20).toBe(expected.erc20);
  }
}

let deployments: any;

async function getNativeERC20Address(connectors: any): Promise<`0x${string}` | null> {
  if (!deployments) throw new Error("Global deployments not initialized");

  // The actual token ID that gets registered by the runtime
  // This is computed by the runtime's TokenIdOf converter which uses
  // DescribeGlobalPrefix to encode the reanchored location
  const tokenAddress = (await connectors.publicClient.readContract({
    address: deployments!.Gateway,
    abi: gatewayAbi,
    functionName: "tokenAddressOf",
    args: [NATIVE_TOKEN_ID]
  })) as `0x${string}`;

  return tokenAddress === ZERO_ADDRESS ? null : tokenAddress;
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

// Create shared signer instance to maintain nonce tracking across tests
let alithSigner: ReturnType<typeof getPapiSigner>;

describe("Native Token Transfer", () => {
  beforeAll(async () => {
    alithSigner = getPapiSigner("ALITH");
    deployments = await parseDeploymentsFile();
  });
  it("should register DataHaven native token on Ethereum", async () => {
    const connectors = suite.getTestConnectors();

    // Ensure token is not already deployed
    expect(await getNativeERC20Address(connectors)).toBeNull();

    // Build transaction to register token
    const sudoTx = connectors.dhApi.tx.Sudo.sudo({
      call: connectors.dhApi.tx.SnowbridgeSystemV2.register_token({
        sender: { type: "V5", value: { parents: 0, interior: { type: "Here", value: undefined } } },
        asset_id: { type: "V5", value: { parents: 0, interior: { type: "Here", value: undefined } } },
        metadata: {
          name: Binary.fromText("HAVE"),
          symbol: Binary.fromText("wHAVE"),
          decimals: 18
        }
      }).decodedCall
    });

    // Submit transaction and wait for cross-chain confirmation
    const [ethEvent, dhTxResult] = await Promise.all([
      waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments!.Gateway,
        abi: gatewayAbi,
        eventName: "ForeignTokenRegistered",
        timeout: DH_TO_ETH_TIMEOUT_MS
      }),
      sudoTx.signAndSubmit(alithSigner)
    ]);
    expect(dhTxResult.ok).toBe(true);

    // Verify token IDs match across chains
    const registerEvent = dhTxResult.events.find(
      (e: any) => e.type === "SnowbridgeSystemV2" && e.value?.type === "RegisterToken"
    );
    expect(registerEvent).toBeDefined();
    const dhTokenId = registerEvent!.value.value.foreign_token_id.asHex();

    const { args: ethTokenEvent } = decodeEventLog({
      abi: gatewayAbi,
      eventName: "ForeignTokenRegistered",
      data: ethEvent.data,
      topics: ethEvent.topics
    }) as { args: ForeignTokenRegisteredEvent };

    expect(ethTokenEvent.tokenID).toBe(dhTokenId);

    // Verify ERC20 metadata
    const deployedERC20 = ethTokenEvent.token;
    logger.debug(`DataHaven native token deployed at: ${deployedERC20}`);

    const [name, symbol, decimals] = await Promise.all([
      connectors.publicClient.readContract({ address: deployedERC20, abi: erc20Abi, functionName: "name" }),
      connectors.publicClient.readContract({ address: deployedERC20, abi: erc20Abi, functionName: "symbol" }),
      connectors.publicClient.readContract({ address: deployedERC20, abi: erc20Abi, functionName: "decimals" })
    ]);

    expect(name).toBe("HAVE");
    expect(symbol).toBe("wHAVE");
    expect(decimals).toBe(18);
  }, DH_TO_ETH_TIMEOUT_MS);

  it("should transfer tokens from DataHaven to Ethereum", async () => {
    const connectors = suite.getTestConnectors();

    const erc20Address = (await getNativeERC20Address(connectors))!;

    // Set up transfer parameters
    const recipient = ANVIL_FUNDED_ACCOUNTS[0].publicKey;
    const amount = parseEther("100");
    const fee = parseEther("1");

    // Capture initial balances
    const before = await getBalanceSnapshot(connectors, {
      dhAccount: SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey,
      ethAccount: recipient,
      erc20Address
    });

    // Build transfer transaction
    const tx = connectors.dhApi.tx.DataHavenNativeTransfer.transfer_to_ethereum({
      recipient: FixedSizeBinary.fromHex(recipient) as FixedSizeBinary<20>,
      amount,
      fee
    });

    // Submit transaction and wait for cross-chain confirmation
    const startBlock = await connectors.publicClient.getBlockNumber();
    const [ethMintEvent, dhTxResult] = await Promise.all([
      waitForEthereumEvent({
        client: connectors.publicClient,
        address: erc20Address,
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: ZERO_ADDRESS, to: recipient },
        fromBlock: startBlock > 0n ? startBlock - 1n : startBlock,
        timeout: DH_TO_ETH_TIMEOUT_MS
      }),
      tx.signAndSubmit(alithSigner)
    ]);
    expect(dhTxResult.ok).toBe(true);

    // Verify DataHaven events
    expectDhEvent(dhTxResult.events, "DataHavenNativeTransfer", "TokensTransferredToEthereum",
      (v) => v?.from === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey);
    expectDhEvent(dhTxResult.events, "DataHavenNativeTransfer", "TokensLocked",
      (v) => v?.account === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey);

    // Capture final balances
    const after = await getBalanceSnapshot(connectors, {
      dhAccount: SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey,
      ethAccount: recipient,
      erc20Address
    });

    // Verify balance changes
    expectBalanceDeltas(before, after, {
      dhMin: amount + fee,
      sovereign: amount,
      erc20: amount
    });
  }, DH_TO_ETH_TIMEOUT_MS);

  it("should maintain 1:1 backing ratio", async () => {
    const connectors = suite.getTestConnectors();

    const erc20Address = (await getNativeERC20Address(connectors))!;

    const totalSupply = (await connectors.publicClient.readContract({
      address: erc20Address,
      abi: erc20Abi,
      functionName: "totalSupply"
    })) as bigint;

    const sovereignBalance = await connectors.dhApi.query.System.Account.getValue(
      ETHEREUM_SOVEREIGN_ACCOUNT
    );

    expect(sovereignBalance.data.free).toBeGreaterThanOrEqual(totalSupply);
  });

  it("should transfer tokens from Ethereum to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    const erc20Address = (await getNativeERC20Address(connectors))!;
    const ethWalletClient = connectors.walletClient;
    const ethereumSender = ethWalletClient.account.address as `0x${string}`;
    const dhRecipient = SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey as `0x${string}`;

    const amount = parseEther("5");
    const executionFee = parseEther("0.1");
    const relayerFee = parseEther("0.4");

    // Capture initial balances and supply for ETH -> DH leg
    const [before, initialTotalSupply] = await Promise.all([
      getBalanceSnapshot(connectors, {
        dhAccount: dhRecipient,
        ethAccount: ethereumSender,
        erc20Address
      }),
      connectors.publicClient.readContract({
        address: erc20Address,
        abi: erc20Abi,
        functionName: "totalSupply"
      }) as Promise<bigint>
    ]);
    expect(before.erc20).toBeGreaterThanOrEqual(amount);

    // Approve Gateway to pull tokens
    const approveHash = await ethWalletClient.writeContract({
      address: erc20Address,
      abi: erc20Abi,
      functionName: "approve",
      args: [deployments!.Gateway as `0x${string}`, amount],
      chain: null
    });
    const approveReceipt = await connectors.publicClient.waitForTransactionReceipt({
      hash: approveHash
    });
    expect(approveReceipt.status).toBe("success");

    // Send tokens to DataHaven via Gateway
    const sendHash = await ethWalletClient.writeContract({
      address: deployments!.Gateway as `0x${string}`,
      abi: gatewayAbi,
      functionName: "v2_sendMessage",
      args: [
        "0x" as `0x${string}`,
        [
          encodeAbiParameters(
            [
              { name: "kind", type: "uint8" },
              { name: "token", type: "address" },
              { name: "value", type: "uint128" }
            ],
            [0, erc20Address, amount]
          )
        ] as any,
        dhRecipient,
        executionFee,
        relayerFee
      ],
      value: executionFee + relayerFee,
      chain: null
    });
    const sendReceipt = await connectors.publicClient.waitForTransactionReceipt({ hash: sendHash });
    expect(sendReceipt.status).toBe("success");

    // Assert OutboundMessageAccepted event was emitted
    const gatewayLogs = sendReceipt.logs!.filter((log) => log.address.toLowerCase() === deployments!.Gateway.toLowerCase());
    const decodedEvents = parseEventLogs({ abi: gatewayAbi, logs: gatewayLogs });
    const hasOutboundAccepted = decodedEvents.some((event) => event.eventName === "OutboundMessageAccepted");
    expect(hasOutboundAccepted).toBe(true);

    // Assert ERC20 was burned (Transfer to zero address)
    const erc20Logs = sendReceipt.logs!.filter((log) => log.address.toLowerCase() === erc20Address.toLowerCase());
    const transferEvents = parseEventLogs({ abi: erc20Abi, logs: erc20Logs });
    const burnEvent = transferEvents.find(
      (event) =>
        event.eventName === "Transfer" &&
        event.args.from?.toLowerCase() === ethereumSender.toLowerCase() &&
        event.args.to?.toLowerCase() === ZERO_ADDRESS.toLowerCase() &&
        event.args.value === amount
    );
    expect(burnEvent).toBeDefined();

    // Wait for relay (takes ~2-3 min due to Ethereum finality)
    await waitForDataHavenEvent<{ account: { asHex: () => string }; amount: bigint }>({
      api: connectors.dhApi,
      pallet: "DataHavenNativeTransfer",
      event: "TokensUnlocked",
      filter: (e) => e.account.asHex().toLowerCase() === dhRecipient.toLowerCase() && e.amount === amount,
      timeout: ETH_TO_DH_TIMEOUT_MS
    });

    // Final balances
    const [after, finalTotalSupply] = await Promise.all([
      getBalanceSnapshot(connectors, {
        dhAccount: dhRecipient,
        ethAccount: ethereumSender,
        erc20Address
      }),
      connectors.publicClient.readContract({
        address: erc20Address,
        abi: erc20Abi,
        functionName: "totalSupply"
      }) as Promise<bigint>
    ]);

    // Assertions: burn on Ethereum and unlock on DataHaven
    expect(after.erc20).toBe(before.erc20 - amount);
    expect(finalTotalSupply).toBe(initialTotalSupply - amount);
    expectBalanceDeltas(before, after, {
      dhExact: amount, // recipient gets exactly amount
      sovereign: -amount // sovereign decreases by amount (unlocked)
    });
  }, DH_TO_ETH_TIMEOUT_MS + ETH_TO_DH_TIMEOUT_MS); // includes funding (DH→ETH) + transfer (ETH→DH)
});
