import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, BALTATHAR_ADDRESS, createRawTransfer } from "@moonwall/util";
import { type PublicClient, createPublicClient, webSocket } from "viem";

describeSuite({
  id: "D023505",
  title: "Subscription - Block headers",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let client: PublicClient;

    beforeAll(async () => {
      const transport = webSocket(context.viem().transport.url.replace("http", "ws"));
      client = createPublicClient({
        transport,
      });
    });

    it({
      id: "T01",
      title: "should return a valid subscriptionId",
      test: async function () {
        const result = (await client.transport.request({
          method: "eth_subscribe",
          params: ["newHeads"],
        })) as any;

        expect(result.length).toBe(34);
      },
    });

    it({
      id: "T02",
      title: "should send notification on new block",
      test: async function () {
        const blocks: any[] = [];
        const unwatch = client.watchBlocks({
          onBlock: (block) => blocks.push(block),
        });

        await context.createBlock(createRawTransfer(context, BALTATHAR_ADDRESS, 0));
        unwatch();

        const block = await context.viem().getBlock();

        expect(blocks[0]).to.include({
          author: ALITH_ADDRESS.toLowerCase(),
          difficulty: 0n,
          extraData: "0x",
          logsBloom: `0x${"0".repeat(512)}`,
          miner: ALITH_ADDRESS.toLowerCase(),
          sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
        });
        expect(blocks[0].nonce).to.be.eq("0x0000000000000000");
        // Verify subscription roots match the block fetched via RPC
        expect(blocks[0].receiptsRoot).toBe(block.receiptsRoot);
        expect(blocks[0].transactionsRoot).toBe(block.transactionsRoot);
      },
    });
  },
});
