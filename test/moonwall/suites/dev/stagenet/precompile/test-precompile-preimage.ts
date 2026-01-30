import "@moonbeam-network/api-augment";
import { beforeAll, beforeEach, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { type Abi, decodeEventLog } from "viem";
import { Preimage, expectEVMResult, expectSubstrateEvent } from "../../../../helpers";

// Each test is instantiating a new proposal (Not ideal for isolation but easier to write)
// Be careful to not reach the maximum number of proposals.
describeSuite({
  id: "D030501",
  title: "Precompiles - Preimage precompile",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    let PreimageAbi: Abi;
    let preimage: Preimage;

    beforeAll(async function () {
      const { abi } = fetchCompiledContract("Preimage");
      PreimageAbi = abi;
    });

    beforeEach(async function () {
      preimage = new Preimage(context);
    });

    it({
      id: "T01",
      title: "should allow to note Preimage",
      test: async function () {
        const call = context.polkadotJs().tx.identity.setIdentity({ display: { raw: "Me" } });
        const block = await preimage.notePreimage(call.toHex()).block();

        // Verifies the EVM Side
        expectEVMResult(block.result!.events, "Succeed");
        const { data } = expectSubstrateEvent(block, "evm", "Log");
        const evmLog = decodeEventLog({
          abi: PreimageAbi,
          topics: data[0].topics.map((t) => t.toHex()) as any,
          data: data[0].data.toHex(),
        }) as any;
        expect(evmLog.eventName, "Wrong event").to.equal("PreimageNoted");
        expect(evmLog.args.hash).to.equal(call.hash.toHex());

        // Verifies the Substrate side
        const preImage = await context
          .polkadotJs()
          .query.preimage.preimageFor([call.hash.toHex(), 15]);
        expect(preImage.unwrap().toHex()).to.equal(call.toHex());
      },
    });

    it({
      id: "T02",
      title: "should allow to unnote a Preimage",
      test: async function () {
        const call = context.polkadotJs().tx.identity.setIdentity({ display: { raw: "You" } });
        await preimage.notePreimage(call.toHex()).block();
        const block = await preimage.unnotePreimage(call.hash.toHex()).block();

        // Verifies the EVM Side
        expectEVMResult(block.result!.events, "Succeed");
        const { data } = expectSubstrateEvent(block, "evm", "Log");
        const evmLog = decodeEventLog({
          abi: PreimageAbi,
          topics: data[0].topics.map((t) => t.toHex()) as any,
          data: data[0].data.toHex(),
        }) as any;
        // context.readPrecompile!({functionName})
        expect(evmLog.eventName, "Wrong event").to.equal("PreimageUnnoted");
        expect(evmLog.args.hash).to.equal(call.hash.toHex());

        // Verifies the Substrate side
        const preImage = await context
          .polkadotJs()
          .query.preimage.preimageFor([call.hash.toHex(), 1000]);
        expect(preImage.isNone).to.equal(true);
      },
    });

    it({
      id: "T03",
      title: "should fail to note the same Preimage twice",
      test: async function () {
        const call = context.polkadotJs().tx.identity.setIdentity({ display: { raw: "Repeated" } });
        await preimage.notePreimage(call.toHex()).block();
        await expect(
          async () => await preimage.notePreimage(call.toHex()).block(),
          "Transaction should be reverted but instead preimage noted"
        ).rejects.toThrowError("AlreadyNoted");
      },
    });

    it({
      id: "T04",
      title: "should fail to unnote a missing Preimage",
      test: async function () {
        const call = context
          .polkadotJs()
          .tx.identity.setIdentity({ display: { raw: "Missing Preimage" } });
        await expect(
          async () => await preimage.unnotePreimage(call.hash.toHex()).block(),
          "Transaction should be reverted but instead preimage unnoted"
        ).rejects.toThrowError("NotNoted");
      },
    });
  },
});
