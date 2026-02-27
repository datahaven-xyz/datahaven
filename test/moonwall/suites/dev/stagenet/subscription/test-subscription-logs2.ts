import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ALITH_CONTRACT_ADDRESSES } from "@moonwall/util";
import type { Log } from "web3";

describeSuite({
  id: "D023502",
  title: "Subscription - Logs",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let deployedContract: `0x${string}`;
    let deployHash: `0x${string}`;

    let subSingleAddPromise: Promise<Log>;
    let subMultiAddPromise: Promise<Log>;
    let subTopicPromise: Promise<Log>;
    let subTopicWildcardPromise: Promise<Log>;
    let subTopicListPromise: Promise<Log>;
    let subTopicCondPromise: Promise<Log>;
    let subTopicMultiCondPromise: Promise<Log>;
    let subTopicWildAndCondPromise: Promise<Log>;

    beforeAll(async () => {
      const openSub = async (filter?: object) => await context.web3().eth.subscribe("logs", filter);

      const onData = (logSub: any) => {
        return new Promise<Log>((resolve) => {
          logSub.once("data", resolve);
        });
      };

      const [
        singleSub,
        multiSub,
        subTopic,
        subTopicWildcard,
        subTopicList,
        subTopicCond,
        subTopicMultiCond,
        subTopicWildAndCond,
      ] = await Promise.all([
        openSub({
          address: ALITH_CONTRACT_ADDRESSES[0],
        }),
        openSub({
          address: [
            ALITH_CONTRACT_ADDRESSES[3],
            ALITH_CONTRACT_ADDRESSES[2],
            ALITH_CONTRACT_ADDRESSES[1],
            ALITH_CONTRACT_ADDRESSES[0],
          ],
        }),
        openSub({
          topics: ["0x0040d54d5e5b097202376b55bcbaaedd2ee468ce4496f1d30030c4e5308bf94d"],
        }),
        openSub({
          topics: [null, "0x000000000000000000000000f24ff3a9cf04c71dbc94d0b566f7a27b94566cac"],
        }),
        openSub({
          topics: [
            ["0x0040d54d5e5b097202376b55bcbaaedd2ee468ce4496f1d30030c4e5308bf94d"],
            ["0x000000000000000000000000f24ff3a9cf04c71dbc94d0b566f7a27b94566cac"],
          ],
        }),

        openSub({
          topics: [
            "0x0040d54d5e5b097202376b55bcbaaedd2ee468ce4496f1d30030c4e5308bf94d",
            ["0x000000000000000000000000f24ff3a9cf04c71dbc94d0b566f7a27b94566cac"],
          ],
        }),

        openSub({
          topics: [
            "0x0040d54d5e5b097202376b55bcbaaedd2ee468ce4496f1d30030c4e5308bf94d",
            [
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x000000000000000000000000f24ff3a9cf04c71dbc94d0b566f7a27b94566cac",
            ],
          ],
        }),
        openSub({
          topics: [
            null,
            [
              "0x000000000000000000000000f24ff3a9cf04c71dbc94d0b566f7a27b94566cac",
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            ],
            null,
          ],
        }),
      ]);

      subSingleAddPromise = onData(singleSub);
      subMultiAddPromise = onData(multiSub);
      subTopicPromise = onData(subTopic);
      subTopicWildcardPromise = onData(subTopicWildcard);
      subTopicListPromise = onData(subTopicList);
      subTopicCondPromise = onData(subTopicCond);
      subTopicMultiCondPromise = onData(subTopicMultiCond);
      subTopicWildAndCondPromise = onData(subTopicWildAndCond);

      const { contractAddress, hash } = await context.deployContract!("EventEmitter");
      deployedContract = contractAddress;
      deployHash = hash;
    });

    it({
      id: "T01",
      title: "should be able to filter by address",
      test: async function () {
        const eventLog = await subSingleAddPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T02",
      title: "should be able to filter by multiple addresses",
      test: async function () {
        const eventLog = await subMultiAddPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T03",
      title: "should be able to filter by topic",
      test: async function () {
        const eventLog = await subTopicPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T04",
      title: "should be able to filter by topic wildcards",
      test: async function () {
        const eventLog = await subTopicWildcardPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T05",
      title: "should be able to filter by topic list",
      test: async function () {
        const eventLog = await subTopicListPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T06",
      title: "should be able to filter by topic conditional parameters",
      test: async function () {
        const eventLog = await subTopicCondPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T07",
      title: "should support multiple topic conditional parameters",
      test: async function () {
        const eventLog = await subTopicMultiCondPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });

    it({
      id: "T08",
      title: "should combine topic wildcards and conditional parameters",
      test: async function () {
        const eventLog = await subTopicWildAndCondPromise;
        expect(eventLog.blockNumber).toBe(1n);
        expect(eventLog.address).toBe(deployedContract.toLowerCase());
        expect(eventLog.transactionHash).toBe(deployHash);
      },
    });
  },
});
