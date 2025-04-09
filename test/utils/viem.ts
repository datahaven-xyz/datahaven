import { ANVIL_FUNDED_ACCOUNTS, CHAIN_ID, getRPCUrl, getWSUrl } from "utils";
import { http, createPublicClient, createWalletClient, defineChain, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const createChainConfig = async () =>
  defineChain({
    id: CHAIN_ID,
    name: "Kurtosis",
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH"
    },
    rpcUrls: {
      default: {
        http: [await getRPCUrl()],
        webSocket: [await getWSUrl()]
      }
    },
    blockExplorers: {
      default: { name: "Blockscout", url: "http://127.0.0.1:3000" }
    }
    // Example of how we can preload contracts into the API, useful for AVS

    // contracts: {
    //   multicall3: {
    //     address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    //     blockCreated: 5882,
    //   },
    // },
  });

export const createDefaultClient = async () =>
  createWalletClient({
    account: privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey),
    chain: await createChainConfig(),
    transport: http()
  }).extend(publicActions);

export type ViemClient = Awaited<ReturnType<typeof createDefaultClient>>;
