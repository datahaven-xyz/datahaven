import { describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { hexToU8a } from "@polkadot/util";
import { encodeDeployData, keccak256, numberToHex, toRlp } from "viem";
import { deployedContractsInLatestBlock } from "../../../../helpers";

describeSuite({
  id: "D010201",
  title: "Contract creation",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should return transaction hash for contract deployment",
      test: async function () {
        const { contractAddress, hash } = await context.deployContract!("MultiplyBy7");
        await context.createBlock();

        expect(hash).toBeTruthy();
        expect(contractAddress).toBeTruthy();
      },
    });

    it({
      id: "T02",
      title: "should return the contract code after deployment",
      test: async () => {
        const contractData = fetchCompiledContract("MultiplyBy7");
        const callCode = (await context.viem().call({ data: contractData.bytecode })).data;
        const { contractAddress } = await context.deployContract!("MultiplyBy7");
        await context.createBlock();

        const deployedCode = await context
          .viem("public")
          .getCode({ address: contractAddress!, blockTag: "latest" });
        expect(deployedCode).toBe(callCode);
      },
    });

    it({
      id: "T03",
      title: "should not contain contract at genesis",
      test: async function () {
        const { contractAddress } = await context.deployContract!("MultiplyBy7");
        expect(
          await context.viem().getCode({ address: contractAddress!, blockNumber: 0n })
        ).toBeUndefined();
      },
    });

    it({
      id: "T04",
      title: "deployed contracts should store the code on chain",
      test: async function () {
        // This is to enable pending tag support
        await context.createBlock();
        const compiled = fetchCompiledContract("MultiplyBy7");
        const callData = encodeDeployData({
          abi: compiled.abi,
          bytecode: compiled.bytecode,
          args: [],
        }) as `0x${string}`;

        const nonce = await context
          .viem("public")
          .getTransactionCount({ address: ALITH_ADDRESS });

        await context.viem().sendTransaction({
          data: callData,
          nonce,
        });

        await context.createBlock();

        const contractAddress = ("0x" +
          keccak256(hexToU8a(toRlp([ALITH_ADDRESS, numberToHex(nonce)])))
            .slice(12)
            .substring(14)) as `0x${string}`;

        const deployedCode = await context
          .viem("public")
          .getCode({ address: contractAddress, blockTag: "latest" });
        expect(deployedCode).toEqual(compiled.deployedBytecode);
      },
    });

    it({
      id: "T05",
      title: "Check smart-contract nonce increase when calling CREATE/CREATE2 opcodes",
      test: async function () {
        const factory = await context.deployContract!("SimpleContractFactory");
        expect(await deployedContractsInLatestBlock(context)).toContain(factory.contractAddress);

        // Factory deploys 2 contracts in constructor (1 with CREATE, 1 with CREATE2)
        // So nonce should be 3 (1 for deployment + 2 for constructor deployments)
        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).toBe(
          3
        );

        await context.writeContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "createSimpleContractWithCreate",
          value: 0n,
        });
        await context.createBlock();

        // After one more CREATE call, nonce should be 4
        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).toBe(
          4
        );

        const deployedWithCreate = (await context.readContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "getDeployedWithCreate",
          args: [],
        })) as string[];
        expect(deployedWithCreate.length).toBe(2);

        await context.writeContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "createSimpleContractWithCreate2",
          args: [1],
          value: 0n,
        });
        await context.createBlock();

        // After CREATE2 call, nonce should be 5
        // Note: CREATE2 also increments nonce even though it uses salt-based addressing
        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).toBe(
          5
        );

        const deployedWithCreate2 = (await context.readContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "getDeployedWithCreate2",
          args: [],
        })) as string[];
        expect(deployedWithCreate2.length).toBe(2);
      },
    });
  },
});

