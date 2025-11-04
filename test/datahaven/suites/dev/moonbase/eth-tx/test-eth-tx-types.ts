import { describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, BALTATHAR_ADDRESS, createEthersTransaction } from "@moonwall/util";
import type { EthereumTransactionTransactionV2 } from "@polkadot/types/lookup";
import { DEFAULT_TXN_MAX_BASE_FEE } from "../../../../helpers";

describeSuite({
  id: "D021304",
  title: "Ethereum Transaction - Legacy",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    const DATAHAVEN_CHAIN_ID = 1283;
    it({
      id: "T01",
      title: "should contain valid legacy Ethereum data",
      test: async function () {
        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            gasLimit: 12_000_000,
            gasPrice: 10_000_000_000,
            value: 512,
            txnType: "legacy",
          })
        );

        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
        const extrinsic = signedBlock.block.extrinsics.find(
          (ex) => ex.method.section === "ethereum"
        )!.args[0] as EthereumTransactionTransactionV2;

        expect(extrinsic.isLegacy).to.be.true;

        const { gasLimit, gasPrice, nonce, action, value, input, signature } = extrinsic.asLegacy;

        expect(gasPrice.toNumber()).to.equal(DEFAULT_TXN_MAX_BASE_FEE);
        expect(gasLimit.toBigInt()).to.equal(12_000_000n);
        expect(nonce.toNumber()).to.equal(0);
        expect(action.asCall.toHex()).to.equal(BALTATHAR_ADDRESS.toLowerCase());
        expect(value.toBigInt()).to.equal(512n);
        expect(input.toHex()).to.equal("0x");
        const actualV = signature.v.toNumber();
        const expectedVBase = DATAHAVEN_CHAIN_ID * 2 + 35;
        expect([expectedVBase, expectedVBase + 1]).to.include(actualV);
        expect(signature.r.toHex()).to.equal(
          "0xc4d57ab7b0e601a95299b70a46fdbb16371b477669e0f8245e0a9f12e27e15f2"
        );
        expect(signature.s.toHex()).to.equal(
          "0x4186b0a32dd279fed20b1f20805845e24eff2a2a035801fe19419c09e861a62d"
        );
      },
    });

    it({
      id: "T02",
      title: "should contain valid EIP2930 Ethereum data",
      test: async function () {
        const currentNonce = await context
          .viem("public")
          .getTransactionCount({ address: ALITH_ADDRESS });
        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            accessList: [],
            value: 512,
            gasLimit: 21000,
            txnType: "eip2930",
          })
        );

        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
        const extrinsic = signedBlock.block.extrinsics.find(
          (ex) => ex.method.section === "ethereum"
        )!.args[0] as EthereumTransactionTransactionV2;

        expect(extrinsic.isEip2930).to.be.true;

        const { chainId, nonce, gasPrice, gasLimit, action, value, input, accessList, signature } =
          extrinsic.asEip2930;
        expect(chainId.toNumber()).to.equal(DATAHAVEN_CHAIN_ID);
        expect(nonce.toNumber()).to.equal(currentNonce);
        expect(gasPrice.toNumber()).to.equal(DEFAULT_TXN_MAX_BASE_FEE);
        expect(gasLimit.toBigInt()).to.equal(21000n);
        expect(action.asCall.toHex()).to.equal(BALTATHAR_ADDRESS.toLowerCase());
        expect(value.toBigInt()).to.equal(512n);
        expect(input.toHex()).to.equal("0x");
        expect(accessList.toString()).toBe("[]");
        expect(signature.oddYParity.isTrue).to.be.true;
        expect(signature.r.toHex()).to.equal(
          "0x8b978b8a38a3237af932f1988af0b01e60311a440c80bfcae96d7b9ac4ef8310"
        );
        expect(signature.s.toHex()).to.equal(
          "0x67c4d6d489d7d5180c8764eb4eff3e16e0330c9a0000b52756847b9ca14069e1"
        );
      },
    });

    it({
      id: "T03",
      title: "should contain valid EIP1559 Ethereum data",
      test: async function () {
        const currentNonce = await context
          .viem("public")
          .getTransactionCount({ address: ALITH_ADDRESS });
        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            accessList: [],
            value: 512,
            gasLimit: 21000,
            txnType: "eip1559",
          })
        );

        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
        const extrinsic = signedBlock.block.extrinsics.find(
          (ex) => ex.method.section === "ethereum"
        )!.args[0] as EthereumTransactionTransactionV2;

        expect(extrinsic.isEip1559).to.be.true;

        const {
          chainId,
          nonce,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit,
          action,
          value,
          input,
          accessList,
          signature,
        } = extrinsic.asEip1559;
        expect(chainId.toNumber()).to.equal(DATAHAVEN_CHAIN_ID);
        expect(nonce.toNumber()).to.equal(currentNonce);
        expect(maxPriorityFeePerGas.toNumber()).to.equal(0);
        expect(maxFeePerGas.toNumber()).to.equal(DEFAULT_TXN_MAX_BASE_FEE);
        expect(gasLimit.toBigInt()).to.equal(21000n);
        expect(action.asCall.toHex()).to.equal(BALTATHAR_ADDRESS.toLowerCase());
        expect(value.toBigInt()).to.equal(512n);
        expect(input.toHex()).to.equal("0x");
        expect(accessList.toString()).toBe("[]");
        expect(signature.oddYParity.isFalse).to.be.true;
        expect(signature.r.toHex()).to.equal(
          "0x6a11d199415bee29b89a65a689546bbb7f50e95fae3a7d238e6a0d5e9753f998"
        );
        expect(signature.s.toHex()).to.equal(
          "0x45ec58c0626fef976a5e3a9cbad8d3aadbad03a4784fd7ca0cd332d2f571a000"
        );
      },
    });
  },
});
