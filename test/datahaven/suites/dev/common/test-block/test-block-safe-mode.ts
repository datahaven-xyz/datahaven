import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "D010105",
  title: "Safe Mode Block Production",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let api: ApiPromise;

    beforeAll(async () => {
      api = context.polkadotJs();
    });

    async function getSubstrateBlockNumber(): Promise<number> {
      const blockNumber = await api.query.system.number();
      return blockNumber.toNumber();
    }

    async function ensureSafeModeActive(): Promise<void> {
      let enteredUntil = (await api.query.safeMode.enteredUntil()) as any;

      if (!enteredUntil.isSome) {
        const enterSafeModeCall = api.tx.safeMode.forceEnter();
        const sudoTx = api.tx.sudo.sudo(enterSafeModeCall);
        await context.createBlock(sudoTx);

        await context.createBlock();

        enteredUntil = (await api.query.safeMode.enteredUntil()) as any;
        expect(enteredUntil.isSome, "Safe mode should be active after entering").to.be.true;
      }
    }

    async function exitSafeModeAndVerify(): Promise<void> {
      const exitBlockBefore = await getSubstrateBlockNumber();
      const exitSafeModeCall = api.tx.safeMode.forceExit();
      const exitSudoTx = api.tx.sudo.sudo(exitSafeModeCall);

      const blockHash = await context.createBlock(exitSudoTx);

      const blockHashStr = typeof blockHash === "string" ? blockHash : (await api.rpc.chain.getBlockHash()).toString();
      const apiAtBlock = await api.at(blockHashStr);

      const events = await apiAtBlock.query.system.events();
      const safeModeExited = events.some((record: any) => {
        const { event } = record;
        return event.section === "safeMode" && event.method === "Exited";
      });

      const sudoExecuted = events.some((record: any) => {
        const { event } = record;
        return event.section === "sudo" && event.method === "Sudid";
      });

      const extrinsicFailed = events.some((record: any) => {
        const { event } = record;
        return event.section === "system" && event.method === "ExtrinsicFailed";
      });

      expect(safeModeExited, "SafeMode.Exited event should be present").to.be.true;
      expect(sudoExecuted, "Sudo.Sudid event should be present").to.be.true;
      expect(extrinsicFailed, "Extrinsic should not have failed").to.be.false;

      const enteredUntilAtExitBlock = (await apiAtBlock.query.safeMode.enteredUntil()) as any;

      expect(
        !enteredUntilAtExitBlock.isSome,
        "Safe mode should be deactivated in the block where forceExit executed"
      ).to.be.true;

      await context.createBlock();
      const exitBlockAfter = await getSubstrateBlockNumber();
      expect(exitBlockAfter, "Should be able to create blocks after exit").to.be.greaterThan(
        exitBlockBefore
      );
    }

    it({
      id: "T01",
      title: "should produce blocks while in safe mode",
      test: async () => {
        await ensureSafeModeActive();
        const startBlock = await getSubstrateBlockNumber();

        const blocksToCreate = 5;
        for (let i = 0; i < blocksToCreate; i++) {
          await context.createBlock();
        }

        const currentBlock = await getSubstrateBlockNumber();
        const blocksProduced = currentBlock - startBlock;

        expect(blocksProduced).to.be.greaterThanOrEqual(
          blocksToCreate,
          "Blocks should continue to be produced in safe mode"
        );

        await exitSafeModeAndVerify();

        const beforeFinalBlock = await getSubstrateBlockNumber();
        await context.createBlock();
        const finalBlock = await getSubstrateBlockNumber();
        expect(finalBlock).to.be.greaterThan(beforeFinalBlock);
      }
    });

    it({
      id: "T02",
      title: "should allow timestamp calls in safe mode",
      test: async () => {
        await ensureSafeModeActive();
        const startBlock = await getSubstrateBlockNumber();

        await context.createBlock();

        const block = await context.viem().getBlock({ blockTag: "latest" });
        expect(Number(block.timestamp)).to.be.greaterThan(0);

        const currentBlock = await getSubstrateBlockNumber();
        expect(currentBlock).to.be.greaterThan(startBlock);

        await exitSafeModeAndVerify();
      }
    });
  }
});
