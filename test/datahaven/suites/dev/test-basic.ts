import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D001",
  title: "Basic DataHaven Tests",
  foundationMethods: "dev",
  testCases: async ({ it, context }) => {
    it({
      id: "T01",
      title: "Should connect to DataHaven node",
      test: async () => {
        const api = context.polkadotJs();
        const chain = await api.rpc.system.chain();
        expect(chain.toString()).toBe("DataHaven Stagenet Dev");
      },
    });

    it({
      id: "T02",
      title: "Should produce blocks in manual sealing",
      test: async () => {
        const api = context.polkadotJs();

        // Get initial block number
        const initialBlock = await api.rpc.chain.getBlock();
        const initialBlockNumber = initialBlock.block.header.number.toNumber();

        // Create a block
        await context.createBlock();

        // Get new block number
        const newBlock = await api.rpc.chain.getBlock();
        const newBlockNumber = newBlock.block.header.number.toNumber();

        expect(newBlockNumber).toBe(initialBlockNumber + 1);
      },
    });

    it({
      id: "T03",
      title: "Should have expected runtime version",
      test: async () => {
        const api = context.polkadotJs();
        const version = await api.rpc.state.getRuntimeVersion();

        expect(version.specName.toString()).toBe("datahaven-stagenet");
        expect(version.implName.toString()).toBe("datahaven-stagenet");
      },
    });

    it({
      id: "T04",
      title: "Should support EVM calls",
      test: async () => {
        const client = context.viem();
        const chainId = await client.request({ method: "eth_chainId" });

        expect(chainId).toBeDefined();
      },
    });
  },
});