import { describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  baltathar,
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
  createRawTransfer,
  createViemTransaction,
  EXTRINSIC_GAS_LIMIT,
  GLMR,
  WEIGHT_PER_GAS
} from "@moonwall/util";

// This tests an issue where pallet Ethereum in Frontier does not properly account for weight after
// transaction application. Specifically, it accounts for weight before a transaction by multiplying
// GasToWeight by gas_price, but does not adjust this afterwards. This leads to accounting for too
// much weight in a block.
describeSuite({
  id: "D021003",
  title: "Ethereum Weight Accounting",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should account for weight used",
      timeout: 10000,
      test: async () => {
        const { block, result } = await context.createBlock(
          await createViemTransaction(context, {
            gas: BigInt(EXTRINSIC_GAS_LIMIT),
            maxFeePerGas: 10_000_000_000n,
            maxPriorityFeePerGas: 0n,
            to: baltathar.address
          })
        );

        const EXPECTED_GAS_USED = 21_000n;
        const EXPECTED_WEIGHT = EXPECTED_GAS_USED * WEIGHT_PER_GAS;

        const receipt = await context
          .viem("public")
          .getTransactionReceipt({ hash: result?.hash as `0x${string}` });
        expect(BigInt(receipt.gasUsed)).to.equal(EXPECTED_GAS_USED);

        const apiAt = await context.polkadotJs().at(block.hash);
        const blockWeightsUsed = await apiAt.query.system.blockWeight();
        const normalWeight = blockWeightsUsed.normal.refTime.toBigInt();
        expect(normalWeight, "Block's Normal category should reflect this txn").to.equal(
          EXPECTED_WEIGHT
        );

        const wholeBlock = await context.polkadotJs().rpc.chain.getBlock(block.hash);
        const index = wholeBlock.block.extrinsics.findIndex(
          (ext) => ext.method.method === "transact" && ext.method.section === "ethereum"
        );
        const extSuccessEvent = result?.events
          .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
          .find(({ event }) => context.polkadotJs().events.system.ExtrinsicSuccess.is(event));

        expect(extSuccessEvent).to.not.be.eq(null);
        const eventWeight = extSuccessEvent.event.data.dispatchInfo.weight.refTime.toBigInt();
        expect(eventWeight).to.eq(EXPECTED_WEIGHT);
      }
    });

    it({
      id: "T02",
      title: "should correctly refund weight from excess gas_limit supplied",
      test: async () => {
        const gasAmount = (EXTRINSIC_GAS_LIMIT * 8n) / 10n;
        const tx1 = await createRawTransfer(context, BALTATHAR_ADDRESS, GLMR, {
          gas: BigInt(gasAmount),
          maxFeePerGas: 10_000_000_000n,
          maxPriorityFeePerGas: 0n
        });
        const tx2 = await createRawTransfer(context, CHARLETH_ADDRESS, GLMR, {
          privateKey: BALTATHAR_PRIVATE_KEY,
          gas: BigInt(gasAmount),
          maxFeePerGas: 10_000_000_000n,
          maxPriorityFeePerGas: 0n
        });
        const tx3 = await createRawTransfer(context, ALITH_ADDRESS, GLMR, {
          privateKey: CHARLETH_PRIVATE_KEY,
          gas: BigInt(gasAmount),
          maxFeePerGas: 10_000_000_000n,
          maxPriorityFeePerGas: 0n
        });

        const { result } = await context.createBlock([tx1, tx2, tx3]);
        const fails = result!.filter((a) => !a.successful);

        expect(
          fails,
          `Transactions ${fails.map((a) => a.hash).join(", ")} have failed to be included`
        ).to.be.empty;
      }
    });
  }
});
