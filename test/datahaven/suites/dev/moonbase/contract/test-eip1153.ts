import { beforeAll, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D020511",
  title: "EIP-1153 - Transient storage",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let contract: `0x${string}`;

    beforeAll(async function () {
      const { contractAddress } = await context.deployContract!("ReentrancyProtected", {
        gas: 1000000n,
      });
      contract = contractAddress;
    });

    it({
      id: "T01",
      title: "should detect reentrant call and revert",
      test: async function () {
        try {
          await context.writeContract!({
            contractName: "ReentrancyProtected",
            contractAddress: contract,
            functionName: "test",
          });
        } catch (error) {
          return expect(error.details).to.be.eq(
            "VM Exception while processing transaction: revert Reentrant call detected."
          );
        }
        expect.fail("Expected the contract call to fail");
      },
    });
  },
});
