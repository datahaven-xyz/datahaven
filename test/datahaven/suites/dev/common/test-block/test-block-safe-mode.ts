import { afterEach, beforeAll, beforeEach, describeSuite, expect } from "@moonwall/cli";
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

    beforeEach(async () => {
      // Ensure safe mode is active
      let enteredUntil = (await api.query.safeMode.enteredUntil()) as any;

      if (!enteredUntil.isSome) {
        const enterSafeModeCall = api.tx.safeMode.forceEnter();
        const sudoTx = api.tx.sudo.sudo(enterSafeModeCall);
        await context.createBlock(sudoTx);

        await context.createBlock();

        enteredUntil = (await api.query.safeMode.enteredUntil()) as any;
        expect(enteredUntil.isSome, "Safe mode should be active after entering").to.be.true;
      }
    });

    afterEach(async () => {
      // Exit safe mode and verify
      const exitBlockBefore = await getSubstrateBlockNumber();
      const exitSafeModeCall = api.tx.safeMode.forceExit();
      const exitSudoTx = api.tx.sudo.sudo(exitSafeModeCall);

      const blockHash = await context.createBlock(exitSudoTx);

      const safeModeExited = await checkEvent("safeMode.Exited", blockHash);
      const sudoExecuted = await checkEvent("sudo.Sudid", blockHash);
      const extrinsicFailed = await checkEvent("system.ExtrinsicFailed", blockHash);

      expect(safeModeExited, "SafeMode.Exited event should be present").to.be.true;
      expect(sudoExecuted, "Sudo.Sudid event should be present").to.be.true;
      expect(extrinsicFailed, "Extrinsic should not have failed").to.be.false;

      const apiAtBlock = await getApiAtBlock(blockHash);
      const enteredUntilAtExitBlock = (await apiAtBlock.query.safeMode.enteredUntil()) as any;

      expect(!enteredUntilAtExitBlock.isSome, "Safe mode should be deactivated.").to.be.true;

      await context.createBlock();
      const exitBlockAfter = await getSubstrateBlockNumber();
      expect(exitBlockAfter, "Should be able to create blocks after exit").to.be.greaterThan(
        exitBlockBefore
      );
    });

    async function getSubstrateBlockNumber(): Promise<number> {
      const blockNumber = await api.query.system.number();
      return blockNumber.toNumber();
    }

    async function getApiAtBlock(
      blockHash?: string | Awaited<ReturnType<typeof context.createBlock>>
    ) {
      const blockHashStr =
        typeof blockHash === "string" ? blockHash : (await api.rpc.chain.getBlockHash()).toString();
      return await api.at(blockHashStr);
    }

    async function checkEvent(
      eventName: string,
      blockHash?: string | Awaited<ReturnType<typeof context.createBlock>>
    ): Promise<boolean> {
      const [section, method] = eventName.split(".");
      const apiAtBlock = await getApiAtBlock(blockHash);
      const events = await apiAtBlock.query.system.events();
      return events.some((record: any) => {
        const { event } = record;
        return event.section === section && event.method === method;
      });
    }

    it({
      id: "T01",
      title: "should produce blocks while in safe mode",
      test: async () => {
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
      }
    });

    it({
      id: "T02",
      title: "should allow timestamp calls in safe mode",
      test: async () => {
        const startBlock = await getSubstrateBlockNumber();

        await context.createBlock();

        const block = await context.viem().getBlock({ blockTag: "latest" });
        expect(Number(block.timestamp)).to.be.greaterThan(0);

        const currentBlock = await getSubstrateBlockNumber();
        expect(currentBlock).to.be.greaterThan(startBlock);
      }
    });

    it({
      id: "T03",
      title: "should allow system.remark calls in safe mode",
      test: async () => {
        const remarkData = "0x48656c6c6f"; // "Hello" in hex
        const remarkTx = api.tx.system.remarkWithEvent(remarkData);

        const blockHash = await context.createBlock(remarkTx);

        const remarkExecuted = await checkEvent("system.Remarked", blockHash);
        const extrinsicSuccess = await checkEvent("system.ExtrinsicSuccess", blockHash);

        expect(remarkExecuted, "System.Remarked event should be present").to.be.true;
        expect(extrinsicSuccess, "Extrinsic should have succeeded").to.be.true;
      }
    });

    it({
      id: "T04",
      title: "should allow preimage.notePreimage calls in safe mode",
      test: async () => {
        const preimageData = api.tx.system.remarkWithEvent("0x1234").method.toHex();
        const notePreimageTx = api.tx.preimage.notePreimage(preimageData);

        const blockHash = await context.createBlock(notePreimageTx);

        const preimageNoted = await checkEvent("preimage.Noted", blockHash);
        const extrinsicSuccess = await checkEvent("system.ExtrinsicSuccess", blockHash);

        expect(preimageNoted, "Preimage.Noted event should be present").to.be.true;
        expect(extrinsicSuccess, "Extrinsic should have succeeded").to.be.true;
      }
    });

    it({
      id: "T05",
      title: "should allow scheduler calls in safe mode",
      test: async () => {
        const currentBlock = await getSubstrateBlockNumber();
        const scheduleAtBlock = currentBlock + 10;

        const taskId = new Uint8Array(32).fill(0);
        taskId.set(new TextEncoder().encode("testTask"), 0);
        const call = api.tx.system.remarkWithEvent("0xabcd");
        const scheduleTx = api.tx.scheduler.scheduleNamed(taskId, scheduleAtBlock, null, 0, call);
        const sudoTx = api.tx.sudo.sudo(scheduleTx);
        const blockHash = await context.createBlock(sudoTx);

        const sudoExecuted = await checkEvent("sudo.Sudid", blockHash);
        const scheduled = await checkEvent("scheduler.Scheduled", blockHash);

        expect(sudoExecuted, "Sudo.Sudid event should be present").to.be.true;
        expect(scheduled, "Scheduler.Scheduled event should be present").to.be.true;
      }
    });

    it({
      id: "T06",
      title: "should allow txPause.pause calls in safe mode via sudo",
      test: async () => {
        const pauseCall = api.tx.txPause.pause(["System", "remark_with_event"]);
        const sudoTx = api.tx.sudo.sudo(pauseCall);
        const blockHash = await context.createBlock(sudoTx);
        const callPaused = await checkEvent("txPause.CallPaused", blockHash);
        expect(callPaused, "System.remark_with_event should have been paused").to.be.true;

        const remarkTx = api.tx.system.remarkWithEvent("0xpaused");
        let remarkFailed = false;
        try {
          await context.createBlock(remarkTx);
        } catch (error: any) {
          remarkFailed = error.message.includes("Transaction call is not expected");
        }
        expect(remarkFailed, "Remark call should have been rejected due to pause").to.be.true;

        // Unpause the call
        const unpauseCall = api.tx.txPause.unpause(["System", "remark_with_event"]);
        const unpauseSudoTx = api.tx.sudo.sudo(unpauseCall);
        const unpauseBlockHash = await context.createBlock(unpauseSudoTx);
        const callUnpaused = await checkEvent("txPause.CallUnpaused", unpauseBlockHash);
        expect(callUnpaused, "System.remark_with_event should have been unpaused").to.be.true;

        // Verify remark now works after unpausing
        const remarkTx2 = api.tx.system.remarkWithEvent("0xunpaused");
        const remarkBlockHash = await context.createBlock(remarkTx2);
        const remarkSuccess = await checkEvent("system.ExtrinsicSuccess", remarkBlockHash);
        expect(remarkSuccess, "Remark call should succeed after unpausing").to.be.true;
      }
    });
  }
});
