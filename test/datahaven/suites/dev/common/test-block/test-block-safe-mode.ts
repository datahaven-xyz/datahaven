import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ApiPromise } from "@polkadot/api";

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

    it({
      id: "T01",
      title: "should produce blocks while in safe mode",
      test: async () => {
        const startBlock = await getSubstrateBlockNumber();

        // Check if safe mode is already active from genesis
        let enteredUntil = (await api.query.safeMode.enteredUntil()) as any;

        if (!enteredUntil.isSome) {
          const enterSafeModeCall = api.tx.safeMode.forceEnter();
          const sudoTx = api.tx.sudo.sudo(enterSafeModeCall);
          await context.createBlock(sudoTx);

          enteredUntil = (await api.query.safeMode.enteredUntil()) as any;
        }

        expect(enteredUntil.isSome, "Safe mode should be active").to.be.true;

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

        const exitSafeModeCall = api.tx.safeMode.forceExit();
        const exitSudoTx = api.tx.sudo.sudo(exitSafeModeCall);

        await context.createBlock(exitSudoTx);

        const enteredUntilAfterExit = (await api.query.safeMode.enteredUntil()) as any;
        expect(!enteredUntilAfterExit.isSome, "Safe mode should be deactivated").to.be.true;

        await context.createBlock();
        const finalBlock = await getSubstrateBlockNumber();
        expect(finalBlock).to.be.greaterThan(currentBlock);
      }
    });

    it({
      id: "T02",
      title: "should allow whitelisted calls in safe mode",
      test: async () => {
        let enteredUntil = (await api.query.safeMode.enteredUntil()) as any;

        if (!enteredUntil.isSome) {
          const enterSafeModeCall = api.tx.safeMode.forceEnter();
          const sudoTx = api.tx.sudo.sudo(enterSafeModeCall);
          await context.createBlock(sudoTx);

          enteredUntil = (await api.query.safeMode.enteredUntil()) as any;
        }

        expect(enteredUntil.isSome, "Safe mode should be active").to.be.true;

        const blockBefore = await getSubstrateBlockNumber();

        // System calls are whitelisted, so this should succeed
        const remarkTx = api.tx.system.remark("0x74657374"); // "test" in hex

        // Create block with the remark transaction
        await context.createBlock(remarkTx);

        // Verify the block was created (block number increased)
        const blockAfter = await getSubstrateBlockNumber();
        expect(blockAfter, "Block should have been created").to.be.greaterThan(blockBefore);

        // Exit safe mode
        const exitSafeModeCall = api.tx.safeMode.forceExit();
        const exitSudoTx = api.tx.sudo.sudo(exitSafeModeCall);

        await context.createBlock(exitSudoTx);

        // Verify we exited safe mode
        const enteredUntilAfterExit = (await api.query.safeMode.enteredUntil()) as any;
        expect(!enteredUntilAfterExit.isSome, "Safe mode should be deactivated").to.be.true;
      }
    });

    it({
      id: "T03",
      title: "should allow timestamp calls in safe mode",
      test: async () => {
        const startBlock = await getSubstrateBlockNumber();

        // Check if safe mode is already active from genesis
        let enteredUntil = (await api.query.safeMode.enteredUntil()) as any;

        if (!enteredUntil.isSome) {
          // Not in safe mode, so enter it
          const enterSafeModeCall = api.tx.safeMode.forceEnter();
          const sudoTx = api.tx.sudo.sudo(enterSafeModeCall);
          await context.createBlock(sudoTx);

          enteredUntil = (await api.query.safeMode.enteredUntil()) as any;
        }

        // Verify safe mode is active
        expect(enteredUntil.isSome, "Safe mode should be active").to.be.true;

        // Create a block - this implicitly includes timestamp extrinsic
        // The fact that this succeeds proves Timestamp is whitelisted
        await context.createBlock();

        // Verify the block was created (contains valid timestamp)
        const block = await context.viem().getBlock({ blockTag: "latest" });
        expect(Number(block.timestamp)).to.be.greaterThan(0);

        // Verify block number increased
        const currentBlock = await getSubstrateBlockNumber();
        expect(currentBlock).to.be.greaterThan(startBlock);

        // Exit safe mode
        const exitSafeModeCall = api.tx.safeMode.forceExit();
        const exitSudoTx = api.tx.sudo.sudo(exitSafeModeCall);

        await context.createBlock(exitSudoTx);

        // Verify we exited safe mode
        const enteredUntilAfterExit = (await api.query.safeMode.enteredUntil()) as any;
        expect(!enteredUntilAfterExit.isSome, "Safe mode should be deactivated").to.be.true;
      }
    });
  }
});

