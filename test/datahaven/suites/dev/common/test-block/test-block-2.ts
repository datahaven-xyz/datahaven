import { beforeAll, describeSuite, expect } from "@moonwall/cli";

describeSuite({
    id: "D010102",
    title: "Block creation - suite 2",
    foundationMethods: "dev",
    testCases: ({ context, it }) => {
        let initialBlockNumber: bigint;
        let postSetupBlockNumber: bigint;

        beforeAll(async () => {
            initialBlockNumber = await context.viem().getBlockNumber();
            await context.createBlock();
            postSetupBlockNumber = await context.viem().getBlockNumber();
        });

        it({
            id: "T01",
            title: "should be at block 2",
            test: async () => {
                expect(await context.viem().getBlockNumber()).to.equal(postSetupBlockNumber);
            }
        });

        it({
            id: "T02",
            title: "should include previous block hash as parent",
            test: async () => {
                const block = await context.viem().getBlock({ blockTag: "latest" });
                const previousBlock = await context.viem().getBlock({ blockNumber: initialBlockNumber });
                expect(block.hash).to.not.equal(previousBlock.hash);
                expect(block.parentHash).to.equal(previousBlock.hash);
            }
        });
    }
});

