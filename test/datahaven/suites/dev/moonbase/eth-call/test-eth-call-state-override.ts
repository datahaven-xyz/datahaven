import {
  beforeAll,
  describeSuite,
  expect,
  deployCreateCompiledContract,
  fetchCompiledContract,
  customDevRpcRequest,
} from "@moonwall/cli";
import { ALITH_ADDRESS, GLMR, baltathar, createEthersTransaction } from "@moonwall/util";
import { hexToBigInt, nToHex } from "@polkadot/util";
import { encodeFunctionData, encodePacked, keccak256, pad, parseEther, type Abi } from "viem";
import { expectOk } from "../../../../helpers";

describeSuite({
  id: "D020901",
  title: "Call - State Override",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let stateOverrideAddress: string;
    let contractAbi: Abi;

    beforeAll(async function () {
      const { contractAddress, abi, status } = await deployCreateCompiledContract(
        context,
        "StateOverrideTest",
        { args: [100n], value: parseEther("1") }
      );

      expect(status).to.equal("success");

      const rawSigned = await createEthersTransaction(context, {
        to: contractAddress,
        data: encodeFunctionData({
          abi,
          functionName: "setAllowance",
          args: [baltathar.address, 10n],
        }),
        gasLimit: 10_000_000,
      });

      await expectOk(context.createBlock(rawSigned));

      contractAbi = abi;
      stateOverrideAddress = contractAddress;
    });

    it({
      id: "T01",
      title: "should have a balance of > 100 GLMR without state override",
      test: async function () {
        const { data } = await context.viem().call({
          account: baltathar.address,
          to: stateOverrideAddress as `0x${string}`,
          data: encodeFunctionData({ abi: contractAbi, functionName: "getSenderBalance" }),
        });
        expect(hexToBigInt(data) > 100n * GLMR).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "should have a balance of 50 GLMR with state override",
      test: async function () {
        const result = await customDevRpcRequest("eth_call", [
          {
            from: baltathar.address,
            to: stateOverrideAddress,
            data: encodeFunctionData({ abi: contractAbi, functionName: "getSenderBalance" }),
          },
          "latest",
          {
            [baltathar.address]: {
              balance: nToHex(50n * GLMR),
            },
          },
        ]);

        expect(hexToBigInt(result)).to.equal(50n * GLMR);
      },
    });

    it({
      id: "T03",
      title: "should have availableFunds of 100 without state override",
      test: async function () {
        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({ abi: contractAbi, functionName: "availableFunds" }),
          },
        ]);
        expect(hexToBigInt(result)).to.equal(100n);
      },
    });

    it({
      id: "T04",
      title: "should have availableFunds of 500 with state override",
      test: async function () {
        const availableFundsKey = pad(nToHex(1)); // slot 1
        const newValue = pad(nToHex(500));

        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({ abi: contractAbi, functionName: "availableFunds" }),
          },
          "latest",
          {
            [stateOverrideAddress]: {
              stateDiff: {
                [availableFundsKey]: newValue,
              },
            },
          },
        ]);

        expect(hexToBigInt(result)).to.equal(500n);
      },
    });

    it({
      id: "T05",
      title: "should have allowance of 10 without state override",
      test: async function () {
        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({
              abi: contractAbi,
              functionName: "allowance",
              args: [ALITH_ADDRESS, baltathar.address],
            }),
          },
        ]);
        expect(hexToBigInt(result)).to.equal(10n);
      },
    });

    it({
      id: "T06",
      title: "should have allowance of 50 with state override",
      test: async function () {
        const allowanceKey = keccak256(
          encodePacked(
            ["uint256", "uint256"],
            [
              baltathar.address,
              keccak256(
                encodePacked(
                  ["uint256", "uint256"],
                  [
                    ALITH_ADDRESS as any,
                    2n, // slot 2
                  ]
                )
              ) as unknown as bigint,
            ]
          )
        );

        const newValue = pad(nToHex(50));
        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({
              abi: contractAbi,
              functionName: "allowance",
              args: [ALITH_ADDRESS, baltathar.address],
            }),
          },
          "latest",
          {
            [stateOverrideAddress]: {
              stateDiff: {
                [allowanceKey]: newValue,
              },
            },
          },
        ]);
        expect(hexToBigInt(result)).to.equal(50n);
      },
    });

    it({
      id: "T07",
      title: "should have allowance 50 but availableFunds 0 with full state override",
      test: async function () {
        const allowanceKey = keccak256(
          encodePacked(
            ["uint256", "uint256"],
            [
              baltathar.address,
              keccak256(
                encodePacked(
                  ["uint256", "uint256"],
                  [
                    ALITH_ADDRESS as any,
                    2n, // slot 2
                  ]
                )
              ) as unknown as bigint,
            ]
          )
        );
        const newValue = pad(nToHex(50));
        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({
              abi: contractAbi,
              functionName: "allowance",
              args: [ALITH_ADDRESS, baltathar.address],
            }),
          },
          "latest",
          {
            [stateOverrideAddress]: {
              state: {
                [allowanceKey]: newValue,
              },
            },
          },
        ]);
        expect(hexToBigInt(result)).to.equal(50n);

        const result2 = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({
              abi: contractAbi,
              functionName: "availableFunds",
            }),
          },
          "latest",
          {
            [stateOverrideAddress]: {
              state: {
                [allowanceKey]: newValue,
              },
            },
          },
        ]);
        expect(hexToBigInt(result2)).to.equal(0n);
      },
    });

    it({
      id: "T08",
      title: "should set MultiplyBy7 deployedBytecode with state override",
      test: async function () {
        const { abi, deployedBytecode } = fetchCompiledContract("MultiplyBy7");

        const result = await customDevRpcRequest("eth_call", [
          {
            from: ALITH_ADDRESS,
            to: stateOverrideAddress,
            data: encodeFunctionData({
              abi,
              functionName: "multiply",
              args: [5n],
            }),
          },
          "latest",
          {
            [stateOverrideAddress]: {
              code: deployedBytecode,
            },
          },
        ]);
        expect(hexToBigInt(result)).to.equal(35n);
      },
    });
  },
});
