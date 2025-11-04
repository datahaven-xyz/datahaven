import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";
import { EXTRINSIC_GAS_LIMIT, createEthersTransaction } from "@moonwall/util";
import { EIP7623_GAS_CONSTANTS } from "../../../../helpers/fees";

describeSuite({
  id: "D021303",
  title: "Ethereum Transaction - Large Transaction",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    // EIP-7623: When sending pure data (all 0xFF bytes) with no execution,
    // the floor cost dominates: 21000 + nonzero_bytes * 40
    const { BASE_TX_COST, COST_FLOOR_PER_NON_ZERO_BYTE } = EIP7623_GAS_CONSTANTS;

    // Calculate exact max size that fits within gas limit
    const exactMaxSize =
      (BigInt(EXTRINSIC_GAS_LIMIT) - BASE_TX_COST) / COST_FLOOR_PER_NON_ZERO_BYTE;

    // TODO: I'm not sure where this 2000 came from...
    const maxSize = exactMaxSize - 2000n;

    it({
      id: "T01",
      title: "should accept txns up to known size",
      test: async function () {
        // Dynamically calculated: (13000000 - 21000) / 40 - 2000 = 322475
        expect(maxSize).to.equal(322475n); // max Ethereum TXN size with EIP-7623 floor cost
        // max_size - shanghai init cost - create cost
        const maxSizeShanghai = maxSize - 6474n;
        const data = ("0x" + "FF".repeat(Number(maxSizeShanghai))) as `0x${string}`;

        const rawSigned = await createEthersTransaction(context, {
          value: 0n,
          data,
          gasLimit: EXTRINSIC_GAS_LIMIT,
        });

        const { result } = await context.createBlock(rawSigned);
        const receipt = await context
          .viem("public")
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });

        expect(receipt.status, "Junk txn should be accepted by RPC but reverted").toBe("reverted");
      },
    });

    it({
      id: "T02",
      title: "should reject txns which are too large to pay for",
      test: async function () {
        // Use exactMaxSize + 1 to ensure we exceed the gas limit
        const data = ("0x" + "FF".repeat(Number(exactMaxSize) + 1)) as `0x${string}`;

        const rawSigned = await createEthersTransaction(context, {
          value: 0n,
          data,
          gasLimit: EXTRINSIC_GAS_LIMIT,
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [rawSigned]),
          "RPC must reject before gossiping to prevent spam"
        ).rejects.toThrowError("intrinsic gas too low");
      },
    });
  },
});
