/**
 * SHA3-FIPS precompile tests
 * Adapted from Moonbeam test suite
 */

import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D030106",
  title: "Precompiles - sha3fips",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    // Test taken from https://github.com/binance-chain/bsc/pull/118
    it({
      id: "T01",
      title: "sha3fips should be valid",
      test: async function () {
        expect(
          (
            await context.viem().call({
              to: "0x0000000000000000000000000000000000000400",
              data: ("0x0448250ebe88d77e0a12bcf530fe6a2cf1ac176945638d309b840d631940c93b78c2bd" +
                "6d16f227a8877e3f1604cd75b9c5a8ab0cac95174a8a0a0f8ea9e4c10bca") as `0x${string}`,
            })
          ).data
        ).equals("0xc7647f7e251bf1bd70863c8693e93a4e77dd0c9a689073e987d51254317dc704");
      },
    });
  },
});
