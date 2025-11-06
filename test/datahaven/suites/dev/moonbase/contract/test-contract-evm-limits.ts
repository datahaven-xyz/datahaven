import { describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, createEthersTransaction } from "@moonwall/util";

describeSuite({
  id: "D020504",
  title: "Contract - Excessive memory allocation",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    // this tests a security vulnerability in our EVM which was patched in May 2021 or so.
    // The vulnerability allowed contract code to request an extremely large amount of memory,
    // causing a node to crash.
    //
    // fixed by:
    // https://github.com/rust-blockchain/evm/commit/19ade858c430ab13eb562764a870ac9f8506f8dd
    it({
      id: "T01",
      title: "should fail with out of gas",
      test: async () => {
        const bytecode = new Uint8Array([
          65, 65, 4, 97, 89, 134, 65, 65, 65, 65, 65, 52, 57, 51, 52, 51, 70, 70, 1, 0, 0, 0, 40,
          249, 0, 224, 111, 1, 0, 0, 0, 247, 30, 1, 0, 0, 0, 0, 0, 0
        ]);

        const value = `0x${993452714685890559n.toString(16)}`;

        const rawSigned = await createEthersTransaction(context, {
          from: ALITH_ADDRESS,
          to: null,
          value,
          gasLimit: 0x100000,
          gasPrice: 10_000_000_000,
          data:
            "0x4141046159864141414141343933343346" +
            "460100000028F900E06F01000000F71E01000000000000"
        });

        const { result } = await context.createBlock(rawSigned);

        const receipt = await context
          .viem("public")
          .getTransactionReceipt({ hash: result?.hash as `0x${string}` });

        expect(receipt.status).toBe("reverted");
      }
    });
  }
});
