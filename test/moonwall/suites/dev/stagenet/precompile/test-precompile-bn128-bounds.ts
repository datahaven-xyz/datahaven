import { describeSuite } from "@moonwall/cli";
import { createViemTransaction, sendRawTransaction } from "@moonwall/util";
/*
 * These test cases trigger bugs in the bn128 precompiles which perform a from_slice()
 * call on unchecked input.
 *
 * Fixed by:
 * https://github.com/paritytech/frontier/pull/394
 */

describeSuite({
  id: "D022703",
  title: "Precompiles - bn128 bounds",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should fail gracefully (case 1)",
      test: async () => {
        // some call data which will cause bn128 to be called with insufficient input. this
        // presumably was generated through fuzzing.
        const data =
          ("0x608060405234801561001057600080fd5b5060008060405180608001604052807f2243525c5eda" +
            "1401003c45ac0ca3fe4dd85e830a4ce6b65fa1eeaee202839703815260207f6e01001d33be6da800" +
            "00002bcc35964723180eed75f91a010001007d48f195c91581526020017f18b18acfb4c2c30276db" +
            "5411000000000000000b4691610c5d3b00010001b17f81526020017f063c909c4720840cb5134cb9" +
            "f546c80200579d040100d32efc0d288197f37266815246475b6100bf61044d505b6040604b808460" +
            "006007600019f1925082610142576000000000acd401000000000000000000000000000000000000" +
            "000000000000000000008152600401808060200182810300192c748252601e8152602001887f656c" +
            "6c967074000381327572766520616464ad74696f6e206661696c6564000081525060200191500000" +
            "000000000009fd5b7f2bd3e6d0f3b142924f5ca7b49ce5b9d585420400ae5648e61d02268b1a0a9f" +
            "b7816000600202020202020202020202020202020202fd0202020203020202020202020202020202" +
            "0202fb02020a02020202020202020202020202020202020202020202020202020202020202020202" +
            "02020202020200000000000000000a1c000000000000000000000000000000000000000901010037" +
            "190100000000000000000000f81a0100000002020202020202020202020202020202020202028a30" +
            "a82123b27db75200aedc4a45a0e84fbd1f9f3621350bb778119630350eb7a7e613058daf51e9f514" +
            "8ea65715eaac3d8019f80498112fc4860a020202020202020202fd02020202020202020202020202" +
            "02020202020202020202020202020202020202020202020202020202020202020202020202020212" +
            "02020202020202020202010202fd0202020202020202020202020202020202020202020202020202" +
            "020202020202020202020202005f02d2020202020202020202020202020202020202020202020202" +
            "02020202020202020202020302020202020202020202020202020202020202020202020202020202" +
            "0302020202020202020202020202") as `0x${string}`;

        const tx = await createViemTransaction(context, {
          to: "0x0000000000000000000000000000000000000007",
          data,
          skipEstimation: true,
        });

        await sendRawTransaction(context, tx);

        // we expect that the node hasn't crashed by here. without a fix, the previous web3 request
        // would have been sufficient to crash our node. now it fails with "ExhaustsResources". if
        // we can create a block, we must not have crashed.
        await context.createBlock();
      },
    });

    it({
      id: "T02",
      title: "should fail gracefully (case 2)",
      test: async () => {
        // similar to the above call data, although triggers a slightly different bug

        const tx = await createViemTransaction(context, {
          to: "0x0000000000000000000000000000000000000007",
          data: "0x0000000000000000000000000000000000000000050000000000008303d0300d901401",
          skipEstimation: true,
        });

        await sendRawTransaction(context, tx);

        // we expect that the node hasn't crashed by here. without a fix, the previous web3 request
        // would have been sufficient to crash our node. now it fails with "ExhaustsResources". if
        // we can create a block, we must not have crashed.
        await context.createBlock();
      },
    });
  },
});
