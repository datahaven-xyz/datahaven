import { beforeEach, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { encodeFunctionData } from "viem";
import { verifyLatestBlockFees } from "../../../../helpers";

describeSuite({
  id: "D020506",
  title: "Contract loop",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    // let incrementorAbi: Abi;
    let incrementorAddress: `0x${string}`;

    beforeEach(async () => {
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
      title: "creation  be initialized at 0",
      test: async function () {
        expect(
          await context.readContract!({
            contractName: "Incrementor",
            contractAddress: incrementorAddress,
            functionName: "count",
          })
        ).toBe(0n);
      },
    });

    it({
      id: "T02",
      title: "should increment contract state",
      test: async function () {
        await context.writeContract!({
          contractName: "Incrementor",
          contractAddress: incrementorAddress,
          functionName: "incr",
          value: 0n,
        });
        await context.createBlock();

        expect(
          await context.readContract!({
            contractName: "Incrementor",
            contractAddress: incrementorAddress,
            functionName: "count",
          })
        ).toBe(1n);
      },
    });

    it({
      id: "T03",
      title: "should increment contract state (check fees)",
      test: async function () {
        const data = encodeFunctionData({
          abi: fetchCompiledContract("Incrementor").abi,
          functionName: "incr",
        });

        await context.createBlock(
          context.createTxn!({
            data,
            to: incrementorAddress,
            value: 0n,
            maxPriorityFeePerGas: 0n,
            txnType: "eip1559",
          })
        );

        await verifyLatestBlockFees(context);
      },
    });
  },
});
