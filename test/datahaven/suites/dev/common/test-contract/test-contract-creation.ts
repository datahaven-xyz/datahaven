import {
  deployCreateCompiledContract,
  describeSuite,
  expect,
  fetchCompiledContract,
  TransactionTypes
} from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { hexToU8a } from "@polkadot/util";
import { encodeDeployData, keccak256, numberToHex, toRlp } from "viem";
import { verifyLatestBlockFees } from "../../../../helpers";

describeSuite({
  id: "D010201",
  title: "Contract creation",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    for (const txnType of TransactionTypes) {
      it({
        id: `T0-${TransactionTypes.indexOf(txnType) + 1}`,
        title: `should return the ${txnType} transaction hash`,
        test: async () => {
          const { hash } = await deployCreateCompiledContract(context, "MultiplyBy7", {
            txnType: txnType as any
          });
          await context.createBlock();
          expect(hash).toBeTruthy();
        }
      });

      it({
        id: `T0-${TransactionTypes.indexOf(txnType) + 4}`,
        title: `${txnType} should return the contract code`,
        test: async () => {
          const contractData = fetchCompiledContract("MultiplyBy7");
          const callCode = (await context.viem().call({ data: contractData.bytecode })).data;
          const { contractAddress } = await deployCreateCompiledContract(context, "MultiplyBy7", {
            txnType: txnType as any,
            gas: 5_000_000n
          });
          const deployedCode = await context.viem().getCode({ address: contractAddress! });
          expect(callCode).to.be.eq(deployedCode);
        }
      });

      it({
        id: `T0-${TransactionTypes.indexOf(txnType) + 7}`,
        title: `should not contain ${txnType}  contract at genesis`,
        test: async () => {
          const { contractAddress } = await deployCreateCompiledContract(context, "MultiplyBy7", {
            txnType: txnType as any
          });
          expect(
            await context.viem().getCode({ address: contractAddress!, blockNumber: 0n })
          ).toBeUndefined();
        }
      });

      it({
        id: `T0-${TransactionTypes.indexOf(txnType) + 10}`,
        title: `${txnType} deployed contracts should store the code on chain`,
        test: async () => {
          // This is to enable pending tag support
          await context.createBlock();
          const compiled = fetchCompiledContract("MultiplyBy7");
          const callData = encodeDeployData({
            abi: compiled.abi,
            bytecode: compiled.bytecode,
            args: []
          }) as `0x${string}`;

          const nonce = await context
            .viem("public")
            .getTransactionCount({ address: ALITH_ADDRESS });

          await context.viem().sendTransaction({
            data: callData,
            nonce,
            txnType: txnType as any,
            gas: 5_000_000n
          });

          const contractAddress = ("0x" +
            keccak256(hexToU8a(toRlp([ALITH_ADDRESS, numberToHex(nonce)])))
              .slice(12)
              .substring(14)) as `0x${string}`;

          expect(
            await context.viem("public").getCode({ address: contractAddress, blockTag: "pending" })
          ).to.deep.equal(compiled.deployedBytecode);

          await context.createBlock();

          expect(
            await context.viem("public").getCode({ address: contractAddress, blockTag: "latest" })
          ).to.deep.equal(compiled.deployedBytecode);
        }
      });

      it({
        id: `T0-${TransactionTypes.indexOf(txnType) + 13}`,
        title: `should check latest block fees for ${txnType}`,
        test: async () => {
          await context.createBlock();
          await deployCreateCompiledContract(context, "Fibonacci", {
            maxPriorityFeePerGas: 0n,
            txnType: txnType as any
          });
          await verifyLatestBlockFees(context);
        }
      });
    }

    it({
      id: "T1",
      title: "Check smart-contract nonce increase when calling CREATE/CREATE2 opcodes",
      test: async () => {
        const factory = await context.deployContract!("SimpleContractFactory");

        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).eq(
          3
        );

        await context.writeContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "createSimpleContractWithCreate",
          value: 0n
        });
        await context.createBlock();

        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).eq(
          4
        );

        const deployedWithCreate = (await context.readContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "getDeployedWithCreate",
          args: []
        })) as string[];
        expect(deployedWithCreate.length).eq(2);

        await context.writeContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "createSimpleContractWithCreate2",
          args: [1],
          value: 0n
        });
        await context.createBlock();

        expect(await context.viem().getTransactionCount({ address: factory.contractAddress })).eq(
          5
        );

        const deployedWithCreate2 = (await context.readContract!({
          contractName: "SimpleContractFactory",
          contractAddress: factory.contractAddress,
          functionName: "getDeployedWithCreate2",
          args: []
        })) as string[];
        expect(deployedWithCreate2.length).eq(2);
      }
    });
  }
});
