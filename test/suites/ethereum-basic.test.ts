import { describe, expect, it } from "bun:test";
import { ANVIL_FUNDED_ACCOUNTS, generateRandomAccount, logger } from "utils";
import { parseEther } from "viem";
import { BaseTestSuite } from "../framework";

class EthereumBasicTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "ethereum-basic"
    });

    // Set up hooks in constructor
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new EthereumBasicTestSuite();

describe("Ethereum Basic Operations", () => {
  it("should query block number", async () => {
    const connectors = suite.getTestConnectors();
    const blockNumber = await connectors.publicClient.getBlockNumber();

    expect(blockNumber).toBeGreaterThan(0n);
    logger.info(`Current block number: ${blockNumber}`);
  });

  it("should check funded account balance", async () => {
    const connectors = suite.getTestConnectors();
    const balance = await connectors.publicClient.getBalance({
      address: ANVIL_FUNDED_ACCOUNTS[0].publicKey
    });

    expect(balance).toBeGreaterThan(parseEther("1"));
    logger.info(`Account balance: ${balance} wei`);
  });

  it("should send ETH transaction", async () => {
    const connectors = suite.getTestConnectors();
    const amount = parseEther("1");
    const randomAccount = generateRandomAccount();

    // Check initial balance
    const balanceBefore = await connectors.publicClient.getBalance({
      address: randomAccount.address
    });
    expect(balanceBefore).toBe(0n);

    // Send transaction
    if (!connectors.walletClient.account) {
      throw new Error("Wallet client account not available");
    }
    const hash = await connectors.walletClient.sendTransaction({
      account: connectors.walletClient.account,
      chain: null,
      to: randomAccount.address as `0x${string}`,
      value: amount
    });

    // Wait for receipt
    const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // Check final balance
    const balanceAfter = await connectors.publicClient.getBalance({
      address: randomAccount.address
    });
    expect(balanceAfter).toBe(amount);

    logger.info(`Successfully sent ${amount} wei to ${randomAccount.address}`);
  });

  it("should interact with multiple accounts", async () => {
    const connectors = suite.getTestConnectors();
    const factory = suite.getConnectorFactory();

    // Create wallet clients for multiple accounts
    const wallet1 = factory.createWalletClient(ANVIL_FUNDED_ACCOUNTS[1].privateKey);
    const wallet2 = factory.createWalletClient(ANVIL_FUNDED_ACCOUNTS[2].privateKey);

    const recipient = generateRandomAccount();
    const amount = parseEther("0.5");

    // Send from account 1
    if (!wallet1.account) {
      throw new Error("Wallet1 account not available");
    }
    const hash1 = await wallet1.sendTransaction({
      account: wallet1.account,
      chain: null,
      to: recipient.address as `0x${string}`,
      value: amount
    });

    // Send from account 2
    if (!wallet2.account) {
      throw new Error("Wallet2 account not available");
    }
    const hash2 = await wallet2.sendTransaction({
      account: wallet2.account,
      chain: null,
      to: recipient.address as `0x${string}`,
      value: amount
    });

    // Wait for both transactions
    const [receipt1, receipt2] = await Promise.all([
      connectors.publicClient.waitForTransactionReceipt({ hash: hash1 }),
      connectors.publicClient.waitForTransactionReceipt({ hash: hash2 })
    ]);

    expect(receipt1.status).toBe("success");
    expect(receipt2.status).toBe("success");

    // Check final balance
    const finalBalance = await connectors.publicClient.getBalance({
      address: recipient.address
    });
    expect(finalBalance).toBe(amount * 2n);

    logger.info(`Received total of ${finalBalance} wei from multiple accounts`);
  });
});
