import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D023501",
  title: "Subscription - Logs",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should send a notification on new transaction",
      test: async function () {
        const logs: any[] = [];
        const sub = await context.web3().eth.subscribe("logs");

        await new Promise(async (resolve, reject) => {
          sub.once("data", async (event) => {
            logs.push(event);
            resolve("success");
          });

          sub.once("error", (error) => {
            console.error(error);
            reject(error);
          });

          await context.deployContract!("EventEmitter");
        });

        const block = await context.viem().getBlock();

        expect(logs[0]).to.include({
          blockHash: block.hash,
          blockNumber: block.number,
          data: "0x",
          logIndex: 0n,
          removed: false,
          transactionHash: block.transactions[0],
          transactionIndex: 0n,
        });
      },
    });
  },
});
