import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ConstantStore } from "../../../../helpers";

describeSuite({
  id: "D010104",
  title: "Block genesis",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let specVersion: number;

    beforeAll(async () => {
      specVersion = (await context.polkadotJs().runtimeVersion.specVersion).toNumber();
    });

    it({
      id: "T01",
      title: "should contain block details",
      test: async () => {
        const block = await context.viem().getBlock({ blockNumber: 0n });

        expect(block).to.include({
          difficulty: 0n,
          extraData: "0x",
          gasLimit: ConstantStore(context).GAS_LIMIT.get(specVersion),
          gasUsed: 0n,
          logsBloom: `0x${"0".repeat(512)}`,
          number: 0n,
          receiptsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
          sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          totalDifficulty: 0n,
          transactionsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
        });

        expect(block.transactions).to.be.an("array").that.is.empty;
        expect(block.uncles).to.be.an("array").that.is.empty;
        expect(block.nonce).to.equal("0x0000000000000000");
        expect(block.hash).to.be.a("string").with.lengthOf(66);
        expect(block.parentHash).to.be.a("string").with.lengthOf(66);
        expect(block.timestamp).to.be.a("bigint");
      }
    });

    it({
      id: "T02",
      title: "should be accessible by hash",
      test: async () => {
        const block = await context.viem().getBlock({ blockNumber: 0n });
        const { hash } = block;
        if (!hash) {
          throw new Error("Expected genesis block to have a hash");
        }
        const blockByHash = await context.viem().getBlock({ blockHash: hash });

        expect(blockByHash).to.include({
          difficulty: 0n,
          extraData: "0x",
          gasLimit: ConstantStore(context).GAS_LIMIT.get(specVersion),
          gasUsed: 0n,
          logsBloom: `0x${"0".repeat(512)}`,
          number: 0n,
          receiptsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
          sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          totalDifficulty: 0n,
          transactionsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
        });
      }
    });
  }
});
