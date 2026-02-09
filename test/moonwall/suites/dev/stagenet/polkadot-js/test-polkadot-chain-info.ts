import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D022502",
  title: "Web3Api Information",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should include client version",
      test: async function () {
        const version = (await customDevRpcRequest("web3_clientVersion", [])) as string;
        const specName = context.polkadotJs().runtimeVersion.specName.toString();
        const specVersion = context.polkadotJs().runtimeVersion.specVersion.toString();
        const implVersion = context.polkadotJs().runtimeVersion.implVersion.toString();
        const expected = `${specName}/v${specVersion}.${implVersion}/fc-rpc-2.0.0-dev`;
        expect(version).toBe(expected);
      },
    });
  },
});
