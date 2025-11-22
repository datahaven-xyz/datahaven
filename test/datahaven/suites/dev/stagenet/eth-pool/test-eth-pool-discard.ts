import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D021101",
  title: "Transaction Cost discards",
  foundationMethods: "dev",
  testCases: ({ it }) => {
    it({
      id: "T01",
      title: "should take transaction cost into account and not submit it to the pool",
      test: async () => {
        // This is a contract deployment signed by Alith but that doesn't have a high enough
        // gaslimit. Since the standard helpers reject such transactions, we need to use
        // the customDevRpcRequest helper to send it directly to the node.

        const txString =
          "0xf9011b80843b9aca008252088080b8c960806040526000805534801561001457600080fd5b5060005b6064\
          81101561003557806000819055508080600101915050610018565b506085806100446000396000f3fe6080604\
          052348015600f57600080fd5b506004361060285760003560e01c80631572821714602d575b600080fd5b6033\
          6049565b6040518082815260200191505060405180910390f35b6000548156fea264697066735822122015105\
          f2e5f98d0c6e61fe09f704e2a86dd1cbf55424720229297a0fff65fe04064736f6c63430007000033820a26a0\
          8ac98ea04dec8017ebddd1e87cc108d1df1ef1bf69ba35606efad4df2dfdbae2a07ac9edffaa0fd7c91fa5688\
          b5e36a1944944bca22b8ff367e4094be21f7d85a3";

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [txString])
        ).rejects.toThrowError("intrinsic gas too low");
      }
    });
  }
});
