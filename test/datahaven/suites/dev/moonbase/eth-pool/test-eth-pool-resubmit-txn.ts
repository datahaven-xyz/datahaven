import { beforeEach, describeSuite, expect } from "@moonwall/cli";
import {
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
  createRawTransfer,
  GLMR,
  sendRawTransaction
} from "@moonwall/util";
import { parseGwei } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

describeSuite({
  id: "D021105",
  title: "Resubmit transations",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let randomAddress: `0x${string}`;
    let currentNonce: number;
    let actorPrivateKey: `0x${string}`;
    let actorAddress: `0x${string}`;

    beforeEach(async () => {
      actorPrivateKey = CHARLETH_PRIVATE_KEY;
      actorAddress = CHARLETH_ADDRESS;
      randomAddress = privateKeyToAccount(generatePrivateKey()).address;
      currentNonce = await context.viem().getTransactionCount({ address: actorAddress });
    });

    it({
      id: "T01",
      title: "should allow resubmitting with higher gas (implying higher tip)",
      test: async () => {
        await context.createBlock([
          await createRawTransfer(context, randomAddress, 1, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("300"),
            maxPriorityFeePerGas: parseGwei("300"),
            privateKey: actorPrivateKey
          }),
          await createRawTransfer(context, randomAddress, 2, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("400"),
            maxPriorityFeePerGas: parseGwei("300"),
            privateKey: actorPrivateKey
            // same priority fee but higher max fee so higher tip
          })
        ]);
        expect(await context.viem().getBalance({ address: randomAddress })).to.equal(2n);
      }
    });

    it({
      id: "T02",
      title: "should ignore resubmitting with lower gas",
      test: async () => {
        await context.createBlock([
          await createRawTransfer(context, randomAddress, 1, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("20"),
            privateKey: actorPrivateKey
          }),
          await createRawTransfer(context, randomAddress, 2, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("10"),
            privateKey: actorPrivateKey
          })
        ]);
        expect(await context.viem().getBalance({ address: randomAddress })).to.equal(1n);
      }
    });

    it({
      id: "T03",
      title: "should allow cancelling transaction by reducing limit",
      test: async () => {
        // gas price should trump limit
        await context.createBlock([
          await createRawTransfer(context, randomAddress, 1, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("10"),
            gas: 1048575n,
            privateKey: actorPrivateKey
          }),
          await createRawTransfer(context, randomAddress, 2, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("20"),
            gas: 65536n,
            privateKey: actorPrivateKey
          })
        ]);

        expect(await context.viem().getBalance({ address: randomAddress })).to.equal(1n);
      }
    });

    it({
      id: "T04",
      title: "should prioritize higher gas tips",
      test: async () => {
        // GasFee are using very high value to ensure gasPrice is not impacting
        const addressGLMR = (await context.viem().getBalance({ address: actorAddress })) / GLMR;
        await sendRawTransaction(
          context,
          await createRawTransfer(context, randomAddress, 66, {
            nonce: currentNonce,
            maxFeePerGas: 1n * GLMR,
            maxPriorityFeePerGas: 1n * GLMR,
            privateKey: actorPrivateKey
          })
        );

        const testParameters = [1n * GLMR, 2n * GLMR, 20n * GLMR, 4n * GLMR, 10n * GLMR];
        const txns: string[] = await Promise.all(
          testParameters.map(
            async (gasPrice) =>
              await createRawTransfer(context, randomAddress, 77, {
                nonce: currentNonce,
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: gasPrice,
                privateKey: actorPrivateKey
              })
          )
        );

        await context.createBlock(txns);

        expect((await context.viem().getBalance({ address: actorAddress })) / GLMR).to.equal(
          addressGLMR - 21000n * 20n
        );
        expect(await context.viem().getBalance({ address: randomAddress })).to.equal(77n);
      }
    });

    it({
      id: "T05",
      title: "should not allow resubmitting with higher gas (implying same tip)",
      test: async () => {
        await context.createBlock([
          await createRawTransfer(context, randomAddress, 1, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("300"),
            maxPriorityFeePerGas: parseGwei("10"),
            privateKey: actorPrivateKey
          }),
          await createRawTransfer(context, randomAddress, 2, {
            nonce: currentNonce,
            maxFeePerGas: parseGwei("400"),
            maxPriorityFeePerGas: parseGwei("10"),
            privateKey: actorPrivateKey
          })
        ]);
        expect(await context.viem().getBalance({ address: randomAddress })).to.equal(1n);
      }
    });
  }
});
