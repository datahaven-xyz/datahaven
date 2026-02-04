import "@moonbeam-network/api-augment";
import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { EXTRINSIC_GAS_LIMIT, createViemTransaction } from "@moonwall/util";
import { hexToU8a, u8aToHex } from "@polkadot/util";
import { expectEVMResult, testVectors } from "../../../../helpers";
import { calculateEIP7623Gas } from "../../../../helpers/fees";

const MODEXP_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000005";

// TODO: Gas tests (T03, T05-T21) are skipped because DataHaven uses Frontier stable2412
// which doesn't include EIP-7623 gas calculation. Re-enable these tests after upgrading
// to Polkadot stable2506 (which includes the newer Frontier with EIP-7623 support).

describeSuite({
  id: "D030108",
  title: "Precompiles - modexp",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let hasherAddress: `0x${string}`;

    beforeAll(async function () {
      const { contractAddress } = await context.deployContract!("HasherChecker");
      hasherAddress = contractAddress;
    });

    it({
      id: "T01",
      title: "should be accessible from a smart contract",
      test: async function () {
        const rawTx = await context.writeContract!({
          contractName: "HasherChecker",
          contractAddress: hasherAddress,
          functionName: "modExpChecker",
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");
      },
    });

    it({
      id: "T02",
      title: "EIP example 1 - calculation",
      test: async function () {
        const rawTx = await context.writeContract!({
          contractName: "HasherChecker",
          contractAddress: hasherAddress,
          functionName: "modExpVerify",
          args: [
            "3",
            "115792089237316195423570985008687907853269984665640564039457584007908834671662",
            "115792089237316195423570985008687907853269984665640564039457584007908834671663",
          ],
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");

        expect(
          await context.readContract!({
            contractAddress: hasherAddress,
            contractName: "HasherChecker",
            functionName: "getResult",
          })
        ).to.be.equals(1n);
      },
    });

    it({
      id: "T03",
      title: "EIP example 1 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 3728n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000001" + // base length
          "0000000000000000000000000000000000000000000000000000000000000020" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000020" + // modulus length
          "03" + // base
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2e" + // exponent
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"; // modulus
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T04",
      title: "EIP example 2",
      test: async function () {
        await context.writeContract!({
          contractName: "HasherChecker",
          contractAddress: hasherAddress,
          functionName: "modExpVerify",
          args: [
            "0",
            "115792089237316195423570985008687907853269984665640564039457584007908834671662",
            "115792089237316195423570985008687907853269984665640564039457584007908834671663",
          ],
        });

        await context.createBlock();
        expect(
          await context.readContract!({
            contractAddress: hasherAddress,
            contractName: "HasherChecker",
            functionName: "getResult",
          })
        ).toBe(0n);
      },
    });

    it({
      id: "T05",
      title: "EIP example 2 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 3728n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000000" + // base length
          "0000000000000000000000000000000000000000000000000000000000000020" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000020" + // modulus length
          // base length is zero so value is inferred zero
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2e" + // exponent
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"; // modulus
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);
        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T06",
      title: "nagydani-1-square - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 1869n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000040" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000040" + // modulus length
          testVectors["nagydani-1-square"].base +
          testVectors["nagydani-1-square"].exponent +
          testVectors["nagydani-1-square"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });

        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T07",
      title: "nagydani-1-qube - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 1869n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000040" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000040" + // modulus length
          testVectors["nagydani-1-square"].base +
          testVectors["nagydani-1-qube"].exponent +
          testVectors["nagydani-1-qube"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T08",
      title: "nagydani-1-pow0x10001 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 2010n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000040" + // base length
          "0000000000000000000000000000000000000000000000000000000000000003" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000040" + // modulus length
          testVectors["nagydani-1-pow0x10001"].base +
          testVectors["nagydani-1-pow0x10001"].exponent +
          testVectors["nagydani-1-pow0x10001"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T09",
      title: "nagydani-2-square - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 1869n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000080" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000080" + // modulus length
          testVectors["nagydani-2-square"].base +
          testVectors["nagydani-2-square"].exponent +
          testVectors["nagydani-2-square"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T10",
      title: "nagydani-2-qube - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 1869n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000080" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000080" + // modulus length
          testVectors["nagydani-2-qube"].base +
          testVectors["nagydani-2-qube"].exponent +
          testVectors["nagydani-2-qube"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T11",
      title: "nagydani-2-pow0x10001 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 3034n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000080" + // base length
          "0000000000000000000000000000000000000000000000000000000000000003" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000080" + // modulus length
          testVectors["nagydani-2-pow0x10001"].base +
          testVectors["nagydani-2-pow0x10001"].exponent +
          testVectors["nagydani-2-pow0x10001"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T12",
      title: "nagydani-3-square - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 2010n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000100" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000100" + // modulus length
          testVectors["nagydani-3-square"].base +
          testVectors["nagydani-3-square"].exponent +
          testVectors["nagydani-3-square"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T13",
      title: "nagydani-3-qube - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 2010n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000100" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000100" + // modulus length
          testVectors["nagydani-3-qube"].base +
          testVectors["nagydani-3-qube"].exponent +
          testVectors["nagydani-3-qube"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T14",
      title: "nagydani-3-pow0x10001 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 7130n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000100" + // base length
          "0000000000000000000000000000000000000000000000000000000000000003" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000100" + // modulus length
          testVectors["nagydani-3-pow0x10001"].base +
          testVectors["nagydani-3-pow0x10001"].exponent +
          testVectors["nagydani-3-pow0x10001"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T15",
      title: "nagydani-4-square - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 3034n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000200" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000200" + // modulus length
          testVectors["nagydani-4-square"].base +
          testVectors["nagydani-4-square"].exponent +
          testVectors["nagydani-4-square"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T16",
      title: "nagydani-4-qube - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 3034n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000200" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000200" + // modulus length
          testVectors["nagydani-4-qube"].base +
          testVectors["nagydani-4-qube"].exponent +
          testVectors["nagydani-4-qube"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T17",
      title: "nagydani-4-pow0x10001 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 23514n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000200" + // base length
          "0000000000000000000000000000000000000000000000000000000000000003" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000200" + // modulus length
          testVectors["nagydani-4-pow0x10001"].base +
          testVectors["nagydani-4-pow0x10001"].exponent +
          testVectors["nagydani-4-pow0x10001"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T18",
      title: "nagydani-5-square - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 7130n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000400" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000400" + // modulus length
          testVectors["nagydani-5-square"].base +
          testVectors["nagydani-5-square"].exponent +
          testVectors["nagydani-5-square"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T19",
      title: "nagydani-5-qube - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 7130n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000400" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000400" + // modulus length
          testVectors["nagydani-5-qube"].base +
          testVectors["nagydani-5-qube"].exponent +
          testVectors["nagydani-5-qube"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T20",
      title: "nagydani-5-pow0x10001 - gas",
      modifier: "skip",
      test: async function () {
        const expectedModExpGasCost = 89749n;
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000400" + // base length
          "0000000000000000000000000000000000000000000000000000000000000003" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000400" + // modulus length
          testVectors["nagydani-5-pow0x10001"].base +
          testVectors["nagydani-5-pow0x10001"].exponent +
          testVectors["nagydani-5-pow0x10001"].modulus;
        const byteArray = hexToU8a(inputData);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T21",
      title: "Exponent > 32",
      modifier: "skip",
      test: async function () {
        // We multiply by a factor of 20 for an even mod.
        // See https://github.com/paritytech/frontier/pull/1017
        const expectedModExpGasCost = 7104n * 20n;
        const byteArray = new Uint8Array([
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x26, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x60, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x10, 0x0, 0x0, 0x0, 0xff, 0xff, 0xff, 0x02, 0x0, 0x0,
          0xb3, 0x0, 0x0, 0x02, 0x0, 0x0, 0x7a, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0xff,
          0xfb, 0x0, 0x0, 0x0, 0x0, 0x04, 0x26, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 96, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x10, 0x0, 0x0, 0x0, 0xff, 0xff, 0xff, 0x02, 0x0, 0x0, 0xb3, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
          0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0xff, 0xff, 0xff, 0xff, 0xf9,
        ]);
        const inputData = u8aToHex(byteArray);
        const inputLength = byteArray.length;
        const numZeroBytes = byteArray.filter((a) => a === 0).length;
        const numNonZeroBytes = inputLength - numZeroBytes;

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: inputData,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
        const isPrecompileCheckGas = 2368n;
        const expectedGasUsed = calculateEIP7623Gas(
          numZeroBytes,
          numNonZeroBytes,
          expectedModExpGasCost + isPrecompileCheckGas
        );
        expect(receipt.gasUsed, "ModExp gas pricing mismatch").to.equal(expectedGasUsed);
      },
    });

    it({
      id: "T22",
      title: "should pad input when too short",
      test: async function () {
        const inputData =
          "0000000000000000000000000000000000000000000000000000000000000001" + // base length
          "0000000000000000000000000000000000000000000000000000000000000001" + // exponent length
          "0000000000000000000000000000000000000000000000000000000000000002" + // modulus length
          "05" + // base
          "03" + // exponent
          "01"; // modulus

        const rawTxn = await createViemTransaction(context, {
          to: MODEXP_PRECOMPILE_ADDRESS,
          data: ("0x" + inputData) as `0x${string}`,
          gas: EXTRINSIC_GAS_LIMIT,
        });
        const { result } = await context.createBlock(rawTxn);

        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        expect(receipt.status).toBe("success");
      },
    });
  },
});
