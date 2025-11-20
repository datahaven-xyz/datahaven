import { customDevRpcRequest, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { hexToNumber, numberToHex } from "@polkadot/util";
import { CHAIN_ID } from "utils/constants";
import { parseGwei } from "viem";

// We use ethers library in this test as apparently web3js's types are not fully EIP-1559
// compliant yet.
describeSuite({
  id: "D021001",
  title: "Fee History",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    interface FeeHistory {
      oldestBlock: string;
      baseFeePerGas: string[];
      gasUsedRatio: number[];
      reward: string[][];
    }

    async function createBlocks(
      block_count: number,
      priority_fees: number[],
      max_fee_per_gas: string
    ) {
      let nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
      const contractData = fetchCompiledContract("MultiplyBy7");
      for (let b = 0; b < block_count; b++) {
        for (let p = 0; p < priority_fees.length; p++) {
          await context.ethers().sendTransaction({
            from: ALITH_ADDRESS,
            data: contractData.bytecode,
            value: "0x00",
            maxFeePerGas: max_fee_per_gas,
            maxPriorityFeePerGas: numberToHex(priority_fees[p]),
            accessList: [],
            nonce: nonce,
            gasLimit: "0x100000",
            chainId: CHAIN_ID
          });
          nonce++;
        }
        await context.createBlock();
      }
    }

    function getPercentile(percentile: number, array: number[]) {
      array.sort((a, b) => a - b);
      const index = (percentile / 100) * array.length - 1;
      if (Math.floor(index) === index) {
        return array[index];
      }
      return Math.ceil((array[Math.floor(index)] + array[Math.ceil(index)]) / 2);
    }

    function matchExpectations(
      feeResults: FeeHistory,
      block_count: number,
      reward_percentiles: number[]
    ) {
      expect(
        feeResults.baseFeePerGas.length,
        "baseFeePerGas should always the requested block range + 1 (the next derived base fee)"
      ).toBe(block_count + 1);
      expect(feeResults.gasUsedRatio).to.be.deep.eq(Array(block_count).fill(0.0105225));
      expect(
        feeResults.reward.length,
        "should return two-dimensional reward list for the requested block range"
      ).to.be.eq(block_count);

      const failures = feeResults.reward.filter((item) => {
        item.length !== reward_percentiles.length;
      });
      expect(
        failures.length,
        "each block has a reward list which's size is the requested percentile list"
      ).toBe(0);
    }

    it({
      id: "T01",
      title: "result length should match spec",
      timeout: 40_000,
      test: async () => {
        const block_count = 2;
        const reward_percentiles = [20, 50, 70];
        const priority_fees = [1, 2, 3];
        const startingBlock = await context.viem().getBlockNumber();

        const feeHistory = new Promise<FeeHistory>((resolve, reject) => {
          const unwatch = context.viem().watchBlocks({
            onBlock: async (block) => {
              if (Number(block.number! - startingBlock) === block_count) {
                const result = (await customDevRpcRequest("eth_feeHistory", [
                  "0x2",
                  "latest",
                  reward_percentiles
                ])) as FeeHistory;
                unwatch();
                resolve(result);
              }
            }
          });
        });

        await createBlocks(block_count, priority_fees, parseGwei("10").toString());

        matchExpectations(await feeHistory, block_count, reward_percentiles);
      }
    });

    it({
      id: "T02",
      title: "should calculate percentiles",
      timeout: 40_000,
      test: async () => {
        const max_fee_per_gas = parseGwei("10").toString();
        const block_count = 11;
        const reward_percentiles = [20, 50, 70, 85, 100];
        const priority_fees = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const startingBlock = await context.viem().getBlockNumber();

        const feeHistory = new Promise<FeeHistory>((resolve, reject) => {
          const unwatch = context.viem().watchBlocks({
            onBlock: async (block) => {
              if (Number(block.number! - startingBlock) === block_count) {
                const result = (await customDevRpcRequest("eth_feeHistory", [
                  "0xA",
                  "latest",
                  reward_percentiles
                ])) as FeeHistory;

                unwatch();
                resolve(result);
              }
            }
          });
        });

        await createBlocks(block_count, priority_fees, max_fee_per_gas);

        const feeResults = await feeHistory;
        const localRewards = reward_percentiles
          .map((percentile) => getPercentile(percentile, priority_fees))
          .map((reward) => numberToHex(reward));
        // We only test if BaseFee update is enabled.
        //
        // If BaseFee is a constant 1GWEI, that means that there is no effective reward using
        // the specs formula MIN(tx.maxPriorityFeePerGas, tx.maxFeePerGas-block.baseFee).
        //
        // In other words, for this tip oracle there would be no need to provide a priority fee
        // when the block fullness is considered ideal in an EIP-1559 chain.
        const mismatchDetails = feeResults.reward
          .map((item, index) => {
            const isEmptyBlock =
              feeResults.gasUsedRatio[index] === 0 || item.every((val) => BigInt(val) === 0n);
            const checkAgainstLocal =
              !isEmptyBlock &&
              hexToNumber(max_fee_per_gas) - hexToNumber(feeResults.baseFeePerGas[index]) > 0 &&
              (item.length !== localRewards.length ||
                !item.every((val, idx) => BigInt(val) === BigInt(localRewards[idx])));

            return {
              index,
              baseFee: feeResults.baseFeePerGas[index],
              actual: item,
              expectedUncapped: localRewards,
              checkAgainstLocal
            };
          })
          .filter(({ checkAgainstLocal }) => checkAgainstLocal);

        const failures = mismatchDetails.filter(({ checkAgainstLocal }) => checkAgainstLocal);

        expect(
          failures.length,
          "each block should have rewards matching the requested percentile list"
        ).toBe(0);
      }
    });

    it({
      id: "T03",
      title: "result length should match spec using an integer block count",
      timeout: 40_000,
      test: async () => {
        const block_count = 2;
        const reward_percentiles = [20, 50, 70];
        const priority_fees = [1, 2, 3];
        const startingBlock = await context.viem().getBlockNumber();

        const feeHistory = new Promise<FeeHistory>((resolve, reject) => {
          const unwatch = context.viem().watchBlocks({
            onBlock: async (block) => {
              if (Number(block.number! - startingBlock) === block_count) {
                const result = (await customDevRpcRequest("eth_feeHistory", [
                  block_count,
                  "latest",
                  reward_percentiles
                ])) as FeeHistory;
                unwatch();
                resolve(result);
              }
            }
          });
        });

        await createBlocks(block_count, priority_fees, parseGwei("10").toString());

        matchExpectations(await feeHistory, block_count, reward_percentiles);
      }
    });
  }
});
