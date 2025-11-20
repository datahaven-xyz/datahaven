import { describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, BALTATHAR_ADDRESS, createEthersTransaction } from "@moonwall/util";
import type { EthereumTransactionTransactionV2 } from "@polkadot/types/lookup";
import { CHAIN_ID } from "utils/constants";
import { DEFAULT_TXN_MAX_BASE_FEE } from "../../../../helpers";

describeSuite({
  id: "D021304",
  title: "Ethereum Transaction - Legacy",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    const DATAHAVEN_CHAIN_ID = CHAIN_ID;
    it({
      id: "T01",
      title: "should contain valid legacy Ethereum data",
      test: async () => {
        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            gasLimit: 12_000_000,
            gasPrice: 10_000_000_000,
            value: 512,
            txnType: "legacy"
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
          "0xbb5b5f596668edaeeba96caf66b361ca2bbbe8e325e75abd7aee7f8399cb1679"
        );
        expect(signature.s.toHex()).to.equal(
          "0x5a010be3c9f198c9e2f6681e0b95a66a741aa1e9ea63cbb2d57f02885d9beefc"
        );
      }
    });

    it({
      id: "T02",
      title: "should contain valid EIP2930 Ethereum data",
      test: async () => {
        const currentNonce = await context
          .viem("public")
          .getTransactionCount({ address: ALITH_ADDRESS });
        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            accessList: [],
            value: 512,
            gasLimit: 21000,
            txnType: "eip2930"
          })
        );

        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
        const extrinsic = signedBlock.block.extrinsics.find(
          (ex) => ex.method.section === "ethereum"
        )!.args[0] as EthereumTransactionTransactionV2;

        expect(extrinsic.isEip2930).to.be.true;

        const {
          chainId,
          nonce,
          gasPrice,
          gasLimit,
          action,
          value,
          input,
          accessList,
          oddYParity,
          r,
          s
        } = extrinsic.asEip2930;
        expect(chainId.toNumber()).to.equal(DATAHAVEN_CHAIN_ID);
        expect(nonce.toNumber()).to.equal(currentNonce);
        expect(gasPrice.toNumber()).to.equal(DEFAULT_TXN_MAX_BASE_FEE);
        expect(gasLimit.toBigInt()).to.equal(21000n);
        expect(action.asCall.toHex()).to.equal(BALTATHAR_ADDRESS.toLowerCase());
        expect(value.toBigInt()).to.equal(512n);
        expect(input.toHex()).to.equal("0x");
        expect(accessList.toString()).toBe("[]");
        expect(oddYParity.isFalse).to.be.true;
        expect(r.toHex()).to.equal(
          "0x1a703ae78b4f5bd48b04e848a0e261c195e037f39a4e1e2b2637edfe7bdf5328"
        );
        expect(s.toHex()).to.equal(
          "0x772b2d95acc14739bdd57565a87ce4e51fb7457724e4c42b148c544e4ae3e968"
        );
      }
    });

    it({
      id: "T03",
      title: "should contain valid EIP1559 Ethereum data",
      test: async () => {
        const currentNonce = await context
          .viem("public")
          .getTransactionCount({ address: ALITH_ADDRESS });

        await context.createBlock(
          await createEthersTransaction(context, {
            to: BALTATHAR_ADDRESS,
            accessList: [],
            value: 512,
            gasLimit: 21000,
            txnType: "eip1559"
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
          oddYParity,
          r,
          s
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
        expect(oddYParity.isFalse).to.be.true;
        expect(r.toHex()).to.equal(
          "0x07a83a8cea51ecfc21533dbec98de47b37d7f54110395b2b9fd514a9216bb741"
        );
        expect(s.toHex()).to.equal(
          "0x6448665043b9a23baa7d58c3f26c8a291f0db6c38a36a7df21bcc26091f1c5aa"
        );
      }
    });
  }
});
