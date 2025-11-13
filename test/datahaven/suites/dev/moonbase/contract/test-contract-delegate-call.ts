import { beforeAll, deployCreateCompiledContract, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { type Abi, encodeFunctionData } from "viem";

const PRECOMPILE_PREFIXES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 1024, 1026, 2050, 2056, 2058, 2059
];

// Ethereum precompile 1-9 are pure and allowed to be called through DELEGATECALL
const ALLOWED_PRECOMPILE_PREFIXES = PRECOMPILE_PREFIXES.filter((add) => add <= 9);
const FORBIDDEN_PRECOMPILE_PREFIXES = PRECOMPILE_PREFIXES.filter((add) => add > 9);
const DELEGATECALL_FORDIDDEN_MESSAGE =
  // contract call result (boolean). False === failed.
  "0x0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000040" + // result offset
  "0000000000000000000000000000000000000000000000000000000000000084" + // result length
  "08c379a0" + // revert selector
  "0000000000000000000000000000000000000000000000000000000000000020" + // revert offset
  "000000000000000000000000000000000000000000000000000000000000002e" + // revert message length
  "43616e6e6f742062652063616c6c656420" + // Cannot be called
  "776974682044454c454741544543414c4c20" + // with DELEGATECALL
  "6f722043414c4c434f4445" + // or CALLCODE
  "0000000000000000000000000000" + // padding
  "0000000000000000000000000000000000000000000000000000000000000000"; // padding;

describeSuite({
  id: "D020501",
  title: "Delegate Call",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let forwardAddress: `0x${string}`;
    let forwardAbi: Abi;

    beforeAll(async () => {
      const { contractAddress, abi } = await deployCreateCompiledContract(context, "CallForwarder");
      forwardAddress = contractAddress;
      forwardAbi = abi;
    });

    it({
      id: "T01",
      timeout: 10000,
      title: "should work for normal smart contract",
      test: async () => {
        const { contractAddress: dummyAddress, abi: dummyAbi } = await deployCreateCompiledContract(
          context,
          "MultiplyBy7"
        );

        const txCall = await context.viem().call({
          account: ALITH_ADDRESS as `0x${string}`,
          to: forwardAddress,
          data: encodeFunctionData({
            abi: forwardAbi,
            functionName: "delegateCall",
            args: [
              dummyAddress,
              encodeFunctionData({ abi: dummyAbi, functionName: "multiply", args: [42] })
            ]
          })
        });

        expect(txCall.data).to.equal(
          "0x0000000000000000000000000000000000000000000000000000000000000001" +
          "0000000000000000000000000000000000000000000000000000000000000040" +
          "0000000000000000000000000000000000000000000000000000000000000020" +
          "0000000000000000000000000000000000000000000000000000000000000126"
        );
      }
    });

    for (const precompilePrefix of ALLOWED_PRECOMPILE_PREFIXES) {
      it({
        id: `T${ALLOWED_PRECOMPILE_PREFIXES.indexOf(precompilePrefix) + 1}`,
        title: `should succeed for standard precompile ${precompilePrefix}`,
        test: async () => {
          const precompileAddress = `0x${precompilePrefix.toString(16).padStart(40, "0")}`;

          const txCall = await context.viem().call({
            account: ALITH_ADDRESS as `0x${string}`,
            to: forwardAddress,
            data: encodeFunctionData({
              abi: forwardAbi,
              functionName: "delegateCall",
              args: [precompileAddress, "0x00"]
            })
          });
          expect(txCall.data).to.not.equal(DELEGATECALL_FORDIDDEN_MESSAGE);
        }
      });
    }

    for (const precompilePrefix of FORBIDDEN_PRECOMPILE_PREFIXES) {
      it({
        id: `T${ALLOWED_PRECOMPILE_PREFIXES.indexOf(precompilePrefix) * 2 + 1}`,
        title: `should fail for non-standard precompile ${precompilePrefix}`,
        test: async () => {
          const precompileAddress = `0x${precompilePrefix.toString(16).padStart(40, "0")}`;

          const txCall = await context.viem().call({
            account: ALITH_ADDRESS as `0x${string}`,
            to: forwardAddress,
            data: encodeFunctionData({
              abi: forwardAbi,
              functionName: "delegateCall",
              args: [precompileAddress, "0x00"]
            })
          });
          expect(txCall.data, "Call should be forbidden").to.equal(DELEGATECALL_FORDIDDEN_MESSAGE);
        }
      });
    }
  }
});
