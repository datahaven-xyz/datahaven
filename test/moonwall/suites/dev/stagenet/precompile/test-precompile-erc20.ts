import "@moonbeam-network/api-augment";
import { beforeEach, describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_ADDRESS,
  PRECOMPILE_NATIVE_ERC20_ADDRESS,
  baltathar,
} from "@moonwall/util";
import { type PrivateKeyAccount, keccak256, pad, parseEther, toBytes, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ALITH_GENESIS_TRANSFERABLE_BALANCE } from "../../../../helpers";

// const SELECTORS = {
//   balanceOf: "70a08231",
//   totalSupply: "18160ddd",
//   approve: "095ea7b3",
//   allowance: "dd62ed3e",
//   transfer: "a9059cbb",
//   transferFrom: "23b872dd",
//   deposit: "d0e30db0",
//   logApprove: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
//   logTransfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
// };

// Error(string)
const ABI_REVERT_SELECTOR = "0x08c379a0";

describeSuite({
  id: "D030401",
  title: "Precompiles - ERC20 Native",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let randomAccount: PrivateKeyAccount;

    beforeEach(async () => {
      randomAccount = privateKeyToAccount(generatePrivateKey());
    });

    it({
      id: "T01",
      title: "allows to call getBalance",
      test: async function () {
        const balance = await context.readPrecompile!({
          precompileName: "NativeErc20",
          functionName: "balanceOf",
          args: [ALITH_ADDRESS],
        });

        const signedTx = context
          .polkadotJs()
          .tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 1000)
          .signAsync(baltathar);
        await context.createBlock(signedTx);

        const tx = context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 1000);
        await context.createBlock(tx, {
          signer: { privateKey: BALTATHAR_PRIVATE_KEY, type: "ethereum" },
        });

        expect(balance).equals(ALITH_GENESIS_TRANSFERABLE_BALANCE);
      },
    });

    it({
      id: "T02",
      title: "allows to call totalSupply",
      test: async function () {
        const totalSupply = await context.readPrecompile!({
          precompileName: "NativeErc20",
          functionName: "totalSupply",
        });

        const totalIssuance = (
          await context.polkadotJs().query.balances.totalIssuance()
        ).toBigInt();
        expect(totalSupply).toBe(totalIssuance);
      },
    });

    it({
      id: "T03",
      title: "allows to approve transfers, and allowance matches",
      test: async function () {
        const allowanceBefore = (await context.readPrecompile!({
          precompileName: "NativeErc20",
          functionName: "allowance",
          args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
        })) as bigint;
        const amount = parseEther("10");

        const rawTx = await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "approve",
          args: [BALTATHAR_ADDRESS, amount],
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);

        const allowanceAfter = (await context.readPrecompile!({
          precompileName: "NativeErc20",
          functionName: "allowance",
          args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
        })) as bigint;

        expect(allowanceAfter - allowanceBefore).equals(BigInt(amount));

        const { status, logs } = await context
          .viem()
          .getTransactionReceipt({ hash: result?.hash as `0x${string}` });

        expect(status).to.equal("success");
        expect(logs.length).to.eq(1);
        expect(logs[0].topics[0]).toBe(keccak256(toBytes("Approval(address,address,uint256)")));
        expect(logs[0].topics[1]?.toLowerCase()).toBe(
          pad(ALITH_ADDRESS.toLowerCase() as `0x${string}`)
        );
        expect(logs[0].topics[2]?.toLowerCase()).toBe(
          pad(BALTATHAR_ADDRESS.toLowerCase() as `0x${string}`)
        );
      },
    });

    it({
      id: "T04",
      title: "allows to call transfer",
      test: async function () {
        expect(
          await context.readPrecompile!({
            precompileName: "NativeErc20",
            functionName: "balanceOf",
            args: [randomAccount.address],
          })
        ).equals(0n);

        const balanceBefore = await context.viem().getBalance({ address: BALTATHAR_ADDRESS });

        const rawTx = await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "transfer",
          args: [randomAccount.address, parseEther("3")],
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        const { status, gasUsed } = await context
          .viem()
          .getTransactionReceipt({ hash: result?.hash as `0x${string}` });
        expect(status).to.equal("success");

        const balanceAfter = await context.viem().getBalance({ address: BALTATHAR_ADDRESS });
        const block = await context.viem().getBlock();
        const fees = gasUsed * block.baseFeePerGas!;
        expect(balanceAfter).toBeLessThanOrEqual(balanceBefore - parseEther("3") - fees);
        expect(await context.viem().getBalance({ address: randomAccount.address })).to.equal(
          parseEther("3")
        );
      },
    });

    it({
      id: "T05",
      title: "allows to approve transfer and use transferFrom",
      test: async function () {
        const allowedAmount = parseEther("10");
        const transferAmount = parseEther("5");

        await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "approve",
          args: [BALTATHAR_ADDRESS, allowedAmount],
        });
        await context.createBlock();

        const fromBalBefore = (
          await context.polkadotJs().query.system.account(ALITH_ADDRESS)
        ).data.free.toBigInt();
        const toBalBefore = await context.viem().getBalance({ address: CHARLETH_ADDRESS });

        const rawTx = await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "transferFrom",
          args: [ALITH_ADDRESS, CHARLETH_ADDRESS, transferAmount],
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
        });

        const { result } = await context.createBlock(rawTx);
        const { logs, status } = await context
          .viem()
          .getTransactionReceipt({ hash: result?.hash as `0x${string}` });

        const fromBalAfter = (
          await context.polkadotJs().query.system.account(ALITH_ADDRESS)
        ).data.free.toBigInt();

        const toBalAfter = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(logs.length).to.eq(1);
        expect(logs[0].address).to.eq(PRECOMPILE_NATIVE_ERC20_ADDRESS);
        expect(logs[0].data).to.eq(pad(toHex(transferAmount)));
        expect(logs[0].topics.length).to.eq(3);
        expect(logs[0].topics[0]).toBe(keccak256(toBytes("Transfer(address,address,uint256)")));
        expect(logs[0].topics[1]?.toLowerCase()).toBe(
          pad(ALITH_ADDRESS.toLowerCase() as `0x${string}`)
        );
        expect(logs[0].topics[2]?.toLowerCase()).toBe(
          pad(CHARLETH_ADDRESS.toLowerCase() as `0x${string}`)
        );
        expect(status).to.equal("success");
        expect(toBalAfter).toBe(toBalBefore + transferAmount);
        expect(fromBalAfter).toBe(fromBalBefore - transferAmount);
        const newAllowedAmount = allowedAmount - transferAmount;
        expect(
          await context.readPrecompile!({
            precompileName: "NativeErc20",
            functionName: "allowance",
            args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
          })
        ).toBe(newAllowedAmount);
      },
    });

    it({
      id: "T06",
      title: "refuses to transferFrom more than allowed",
      test: async function () {
        const allowedAmount = parseEther("10");
        const transferAmount = parseEther("15");

        await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "approve",
          args: [BALTATHAR_ADDRESS, allowedAmount],
        });
        await context.createBlock();

        const fromBalBefore = (
          await context.polkadotJs().query.system.account(ALITH_ADDRESS)
        ).data.free.toBigInt();
        const toBalBefore = await context.viem().getBalance({ address: CHARLETH_ADDRESS });

        const rawTxn = await context.writePrecompile!({
          precompileName: "NativeErc20",
          functionName: "transferFrom",
          args: [ALITH_ADDRESS, CHARLETH_ADDRESS, transferAmount],
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          gas: 200_000n,
          web3Library: "ethers",
        });

        const { result } = await context.createBlock(rawTxn);
        expect(result?.successful).toBe(false);

        const fromBalAfter = (
          await context.polkadotJs().query.system.account(ALITH_ADDRESS)
        ).data.free.toBigInt();

        const toBalAfter = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(toBalAfter).toBe(toBalBefore);
        expect(fromBalAfter).toBe(fromBalBefore);
        expect(
          await context.readPrecompile!({
            precompileName: "NativeErc20",
            functionName: "allowance",
            args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
          })
        ).toBe(allowedAmount);
      },
    });
  },
});

// describeDevMoonbeamAllEthTxTypes("Precompiles - ERC20 Native", (context) => {
//   it("revert message is abi-encoded as a String(error) call", async function () {
//     const request = await web3EthCall(context.web3, {
//       to: PRECOMPILE_NATIVE_ERC20_ADDRESS,
//       data: `0x${SELECTORS.deposit}`,
//     });
//     expect(request as any).to.haveOwnProperty("error");
//     // Data
//     let data = (request as any).error.data;
//     expect(data.length).to.be.eq(266);
//     expect(data.slice(0, 10)).to.be.eq(ABI_REVERT_SELECTOR);
//     // Message
//     expect((request as any).error.message).to.be.eq(
//       "VM Exception while processing transaction: revert deposited amount must be non-zero"
//     );
//   });
// });
