import { beforeEach, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { expectEVMResult, expectSubstrateEvent } from "../../../../helpers";
import { GLMR, BALTATHAR_ADDRESS } from "@moonwall/util";
import { decodeEventLog } from "viem";

describeSuite({
  id: "D020510",
  title: "EIP-6780 - Self Destruct",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let contract: `0x${string}`;

    beforeEach(async function () {
      const { contractAddress } = await context.deployContract!("Suicide", {
        gas: 45_000_000n,
      });
      contract = contractAddress;
    });

    it({
      id: "T01",
      title:
        "Should not delete contract when self-destruct is not called in the same " +
        "transaction that created the contract",
      test: async function () {
        // Get Code
        const code = (await context.polkadotJs().query.evm.accountCodes(contract)).toHex();

        // transfer some tokens to the contract
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(contract, 10n * GLMR)
        );

        const balanceBaltatharBefore = (
          await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS)
        ).data.free.toBigInt();

        const rawTx = await context.writeContract!({
          contractName: "Suicide",
          contractAddress: contract,
          functionName: "destroy",
          args: [BALTATHAR_ADDRESS],
          rawTxOnly: true,
        });

        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed", "Suicided");

        // Code should not be deleted
        const postSuicideCode = (
          await context.polkadotJs().query.evm.accountCodes(contract)
        ).toHex();

        expect(postSuicideCode).to.eq(code);

        // Nonce should be one
        expect((await context.polkadotJs().query.system.account(contract)).nonce.toBigInt()).to.eq(
          1n
        );

        // Balance should be zero
        expect(
          (await context.polkadotJs().query.system.account(contract)).data.free.toBigInt()
        ).to.eq(0n);

        // Check funds are transmitted to Baltathar
        const balanceBaltatharAfter = (
          await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS)
        ).data.free.toBigInt();

        expect(balanceBaltatharAfter).to.be.eq(balanceBaltatharBefore + 10n * GLMR);
      },
    });

    it({
      id: "T02",
      title:
        "Should not burn funds if contract is not deleted in the same create tx and" +
        "funds are sent to deleted contract",
      test: async function () {
        // transfer some tokens to the contract
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(contract, 10n * GLMR)
        );

        const rawTx = await context.writeContract!({
          contractName: "Suicide",
          contractAddress: contract,
          functionName: "destroy",
          args: [contract],
          rawTxOnly: true,
        });

        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed", "Suicided");

        expect(
          (await context.polkadotJs().query.system.account(contract)).data.free.toBigInt()
        ).to.eq(10n * GLMR);
      },
    });

    it({
      id: "T03",
      title:
        "Should delete contract when self-destruct is called in the same transaction" +
        "that created the contract",
      test: async function () {
        const { contractAddress } = await context.deployContract!("ProxyDeployer", {
          gas: 1000000n,
        });

        const block = await context.createBlock(
          await context.writeContract!({
            contractName: "ProxyDeployer",
            contractAddress,
            functionName: "deployAndDestroy",
            rawTxOnly: true,
            args: [BALTATHAR_ADDRESS],
          })
        );

        const { data } = expectSubstrateEvent(block, "evm", "Log");
        const evmLog = decodeEventLog({
          abi: fetchCompiledContract("ProxyDeployer").abi,
          topics: data[0].topics.map((t) => t.toHex()) as any,
          data: data[0].data.toHex(),
        }) as any;
        const suicideAddress: `0x${string}` = evmLog.args.destroyedAddress.toLowerCase();

        // Code should be deleted
        expect((await context.polkadotJs().query.evm.accountCodes(suicideAddress)).toHex()).to.eq(
          "0x"
        );

        // Balance should be zero
        expect(
          (await context.polkadotJs().query.system.account(suicideAddress)).data.free.toBigInt()
        ).to.eq(0n);

        // Sufficients should be zero
        expect(
          (await context.polkadotJs().query.system.account(suicideAddress)).sufficients.toBigInt()
        ).to.eq(0n);

        // Nonce should be zero
        expect(
          (await context.polkadotJs().query.system.account(suicideAddress)).nonce.toBigInt()
        ).to.eq(0n);
      },
    });
  },
});
