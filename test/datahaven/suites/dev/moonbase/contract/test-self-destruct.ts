import { describeSuite, expect } from "@moonwall/cli";
import { createEthersTransaction } from "@moonwall/util";
import { encodeFunctionData } from "viem";

describeSuite({
  id: "D020513",
  title: "Test self-destruct contract",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "SELFDESTRUCT must reset contract account",
      test: async function () {
        const { contractAddress, abi } = await context.deployContract!("SelfDestructAfterCreate2");

        const block = await context.createBlock([
          await createEthersTransaction(context, {
            to: contractAddress,
            data: encodeFunctionData({
              abi,
              functionName: "step1",
              args: [],
            }),
            gasLimit: 100_000n,
            nonce: 1,
          }),
          await createEthersTransaction(context, {
            to: contractAddress,
            data: encodeFunctionData({
              abi,
              functionName: "step2",
              args: [],
            }),
            gasLimit: 100_000n,
            nonce: 2,
          }),
          await createEthersTransaction(context, {
            to: contractAddress,
            data: encodeFunctionData({
              abi,
              functionName: "cannotRecreateInTheSameCall",
              args: [],
            }),
            gasLimit: 100_000n,
            nonce: 3,
          }),
        ]);

        for (const result of block.result) {
          const receipt = await context
            .viem("public")
            .getTransactionReceipt({ hash: result.hash as `0x${string}` });

          expect(receipt.status).toBe("success");
        }

        const deployedAddress = await context.readContract!({
          contractName: "SelfDestructAfterCreate2",
          contractAddress: contractAddress,
          functionName: "deployed1",
          args: [],
          rawTxOnly: true,
        });

        const deletedAccount = await context.polkadotJs().query.system.account(deployedAddress);
        expect(deletedAccount.toJSON()).toEqual(
          expect.objectContaining({
            nonce: 0,
            consumers: 0,
            providers: 0,
            sufficients: 0,
            data: expect.objectContaining({
              free: 0,
              reserved: 0,
              frozen: 0,
            }),
          })
        );
      },
    });
  },
});
