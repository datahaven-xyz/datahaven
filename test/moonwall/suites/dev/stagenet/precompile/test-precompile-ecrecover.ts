/**
 * Ecrecover precompile tests
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, ALITH_PRIVATE_KEY } from "@moonwall/util";

describeSuite({
  id: "D030107",
  title: "Precompiles - ecrecover",
  foundationMethods: "dev",
  testCases: ({ context, log, it }) => {
    let contractAddress: `0x${string}`;

    beforeAll(async function () {
      const { contractAddress: deployedAddr } = await context.deployContract!("RecoveryChecker");
      contractAddress = deployedAddr;
    });

    it({
      id: "T01",
      title: "returns a matching address",
      test: async function () {
        const msg = context.web3().utils.sha3("Hello World!");
        const sig = context.web3().eth.accounts.sign(msg!, ALITH_PRIVATE_KEY);

        const address = await context.readContract!({
          contractAddress,
          contractName: "RecoveryChecker",
          functionName: "checkRecovery",
          args: [sig.messageHash, sig.v, sig.r, sig.s],
        });

        expect(address, "Recovered address doesn't match signer!").to.equals(ALITH_ADDRESS);
      },
    });

    it({
      id: "T02",
      title: "returns different address on modified message",
      test: async function () {
        const msg = context.web3().utils.sha3("Hello World!");
        const sig = context.web3().eth.accounts.sign(msg!, ALITH_PRIVATE_KEY);

        const address = await context.readContract!({
          contractAddress,
          contractName: "RecoveryChecker",
          functionName: "checkRecovery",
          args: [sig.messageHash.replace("1", "f"), sig.v, sig.r, sig.s],
        });

        expect(address, "Recovered address doesn't match signer!").to.equals(
          "0x58188b9AE77F7C865b04B12F5D29bF4fbDcbd937"
        );
      },
    });

    it({
      id: "T03",
      title: "returns empty on invalid V",
      test: async function () {
        const msg = context.web3().utils.sha3("Hello World!");
        const sig = context.web3().eth.accounts.sign(msg!, ALITH_PRIVATE_KEY);
        const v = "0x565656ff5656ffffffffffff3d3d02000000000040003dffff565656560f0000";

        await expect(
          async () =>
            await context.readContract!({
              contractAddress,
              contractName: "RecoveryChecker",
              functionName: "checkRecovery",
              args: [sig.messageHash, v, sig.r, sig.s],
              web3Library: "ethers",
              gas: 1_000_000n,
            })
        ).rejects.toThrowError("revert");
      },
    });
  },
});
