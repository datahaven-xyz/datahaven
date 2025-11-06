import {
  beforeAll,
  customDevRpcRequest,
  describeSuite,
  expect,
  fetchCompiledContract
} from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_ADDRESS,
  createRawTransfer
} from "@moonwall/util";
import { encodeFunctionData } from "viem";

describeSuite({
  id: "D021305",
  title: "Ethereum Transaction - Nonce",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should be at 0 before using it",
      test: async () => {
        expect(await context.viem().getTransactionCount({ address: BALTATHAR_ADDRESS })).toBe(0);
      }
    });

    it({
      id: "T02",
      title: "should be at 0 for genesis account",
      test: async () => {
        expect(await context.viem().getTransactionCount({ address: ALITH_ADDRESS })).toBe(0);
      }
    });

    it({
      id: "T03",
      title: "should stay at 0 before block is created",
      test: async () => {
        await customDevRpcRequest("eth_sendRawTransaction", [
          await createRawTransfer(context, ALITH_ADDRESS, 512)
        ]);

        expect(await context.viem().getTransactionCount({ address: ALITH_ADDRESS })).toBe(0);
        await context.createBlock();
      }
    });

    it({
      id: "T04",
      title: "should stay at previous before block is created",
      test: async () => {
        const blockNumber = await context.viem().getBlockNumber();
        const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
        await context.createBlock(await createRawTransfer(context, ALITH_ADDRESS, 512));

        expect(
          await context.viem().getTransactionCount({ address: ALITH_ADDRESS, blockNumber })
        ).toBe(nonce);
      }
    });

    it({
      id: "T05",
      title: "pending transaction nonce",
      test: async () => {
        const blockNumber = await context.viem().getBlockNumber();
        const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });

        await customDevRpcRequest("eth_sendRawTransaction", [
          await createRawTransfer(context, CHARLETH_ADDRESS, 512)
        ]);

        expect(
          await context.viem().getTransactionCount({ address: ALITH_ADDRESS }),
          "should not increase transaction count"
        ).toBe(nonce);
        expect(
          await context
            .viem("public")
            .getTransactionCount({ address: ALITH_ADDRESS, blockTag: "latest" }),
          "should not increase transaction count in latest block"
        ).toBe(nonce);
        expect(
          await context
            .viem("public")
            .getTransactionCount({ address: ALITH_ADDRESS, blockTag: "pending" }),
          "should increase transaction count in pending block"
        ).toBe(nonce + 1);
        await context.createBlock();
      }
    });

    it({
      id: "T06",
      title: "transferring Nonce",
      test: async () => {
        const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });

        await context.createBlock([await createRawTransfer(context, BALTATHAR_ADDRESS, 512)]);

        expect(
          await context.viem().getTransactionCount({ address: ALITH_ADDRESS }),
          "should increase the sender nonce"
        ).toBe(nonce + 1);
        expect(
          await context.viem().getTransactionCount({ address: BALTATHAR_ADDRESS }),
          "should not increase the receiver nonce"
        ).toBe(0);
        await context.createBlock();
      }
    });
  }
});

describeSuite({
  id: "D011304",
  title: "Ethereum Transaction - Nonce #2",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let incrementorAddress: `0x${string}`;

    beforeAll(async () => {
      // const {
      //   // contract: incContract,
      //   contractAddress: incAddress,
      //   abi: incAbi,
      // } = await deployCreateCompiledContract(context, "Incrementor");

      const { contractAddress, abi } = await context.deployContract!("Incrementor");
      // incrementorContract = incContract;
      incrementorAddress = contractAddress;
    });

    it({
      id: "T01",
      title: "should be at 0 before using it",
      test: async () => {
        expect(await context.viem().getTransactionCount({ address: BALTATHAR_ADDRESS })).toBe(0);
      }
    });

    it({
      id: "T01",
      title: "should increment to 1",
      test: async () => {
        const data = encodeFunctionData({
          abi: fetchCompiledContract("Incrementor").abi,
          functionName: "incr"
        });
        await context.createBlock(
          context.createTxn!({
            privateKey: BALTATHAR_PRIVATE_KEY,
            to: incrementorAddress,
            data,
            value: 0n,
            gasLimit: 21000,
            txnType: "legacy"
          })
        );
        const block = await context.viem().getBlock({ blockTag: "latest" });
        expect(block.transactions.length, "should include the transaction in the block").to.be.eq(
          1
        );
        expect(
          await context.viem().getTransactionCount({ address: BALTATHAR_ADDRESS }),
          "should increase the sender nonce"
        ).toBe(1);
      }
    });
  }
});
