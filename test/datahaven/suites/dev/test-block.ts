import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { ConstantStore } from "../../helpers";

describeSuite({
  id: "D010101",
  title: "Block 1",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let specVersion: number;
    beforeAll(async () => {
      await context.createBlock();
      specVersion = (await context.polkadotJs().runtimeVersion.specVersion).toNumber();
    });

    it({
      id: "T01",
      title: "should be at block 1",
      test: async () => {
        expect(await context.viem().getBlockNumber()).to.equal(1n);
      }
    });

    it({
      id: "T02",
      title: "should have valid timestamp after block production",
      test: async () => {
        // Seal a new block manually
        await context.createBlock();

        // Originally, this test required the timestamp be in the last five minutes.
        // This requirement doesn't make sense when we forge timestamps in manual seal.
        const block = await context.viem().getBlock({ blockTag: "latest" });
        const next5Minutes = BigInt(Math.floor(Date.now() / 1000 + 300));
        expect(block.timestamp).toBeGreaterThan(0n);
        expect(block.timestamp).toBeLessThan(next5Minutes);
      }
    });

    it({
      id: "T03",
      title: "should contain block information",
      test: async () => {
        const block = await context.viem().getBlock({ blockTag: "latest" });
        expect(block).to.include({
          author: ALITH_ADDRESS.toLocaleLowerCase(),
          difficulty: 0n,
          extraData: "0x",
          gasLimit: ConstantStore(context).GAS_LIMIT.get(specVersion),
          gasUsed: 0n,
          logsBloom: `0x${"0".repeat(512)}`,
          miner: ALITH_ADDRESS.toLocaleLowerCase(),
          number: 2n,
          receiptsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
          sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          totalDifficulty: 0n,
          transactionsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
        });

        expect(block.transactions).to.be.a("array").empty;
        expect(block.uncles).to.be.a("array").empty;
        expect(block.nonce).to.be.eq("0x0000000000000000");
        expect(block.hash).to.be.a("string").lengthOf(66);
        expect(block.parentHash).to.be.a("string").lengthOf(66);
        expect(block.timestamp).to.be.a("bigint");
      }
    });

    it({
      id: "T04",
      title: "should be accessible by hash",
      test: async () => {
        const latestBlock = await context.viem().getBlock({ blockTag: "latest" });
        if (!latestBlock.hash) {
          throw new Error("Latest block hash is null");
        }
        const block = await context.viem().getBlock({ blockHash: latestBlock.hash });
        expect(block.hash).toBe(latestBlock.hash);
      }
    });

    it({
      id: "T05",
      title: "should be accessible by number",
      test: async () => {
        const latestBlock = await context.viem().getBlock({ blockTag: "latest" });
        const block = await context.viem().getBlock({ blockNumber: latestBlock.number });
        expect(block.hash).toBe(latestBlock.hash);
      }
    });
  }
});
