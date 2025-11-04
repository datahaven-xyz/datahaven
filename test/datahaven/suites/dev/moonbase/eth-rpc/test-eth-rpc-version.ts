import { describeSuite, expect, customDevRpcRequest } from "@moonwall/cli";

describeSuite({
  id: "D021207",
  title: "Version RPC",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    const DATAHAVEN_CHAIN_ID = 1283n;
    it({
      id: "T01",
      title: "should return 1283 for eth_chainId",
      test: async function () {
        expect(await customDevRpcRequest("eth_chainId")).to.equal(
          `0x${DATAHAVEN_CHAIN_ID.toString(16)}`
        );
      },
    });

    it({
      id: "T02",
      title: "should return 1283 for net_version",
      test: async function () {
        expect(await customDevRpcRequest("net_version")).to.equal(DATAHAVEN_CHAIN_ID.toString());
      },
    });

    it({
      id: "T03",
      title: "should include client version",
      test: async function () {
        const version = await customDevRpcRequest("web3_clientVersion");
        const specName = context.polkadotJs().runtimeVersion.specName.toString();
        const specVersion = context.polkadotJs().runtimeVersion.specVersion.toString();
        const implVersion = context.polkadotJs().runtimeVersion.implVersion.toString();
        const expectedString = `${specName}/v${specVersion}.${implVersion}/fc-rpc-2.0.0-dev`;

        expect(version).toContain(expectedString);
      },
    });
  },
});
