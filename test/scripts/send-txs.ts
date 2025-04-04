import { http, type Hex, createWalletClient, defineChain, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { findLocalEthRpcPort, findBlockscoutFrontendPort } from "./utils";

const PRIVATE_KEY =
  process.env.PRIVATE_KEY || "bf3beef3bd999ba9f2451e06936f0423cd62b815c9233dd3bc90f7e02a1e8673";
const privateKey: Hex = PRIVATE_KEY.startsWith("0x") ? (PRIVATE_KEY as Hex) : `0x${PRIVATE_KEY}`;
const NETWORK_RPC_URL = process.env.NETWORK_RPC_URL || `http://localhost:${findLocalEthRpcPort()}`;

export const datahaven = defineChain({
  id: 3151908,
  name: "datahaven",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [NETWORK_RPC_URL]
    }
  },
  blockExplorers: {
    default: { name: "Explorer", url: `http://localhost:${findBlockscoutFrontendPort()}` }
  }
});

async function main() {
  try {
    const signer = privateKeyToAccount(privateKey);

    console.log(`Using account: ${signer.address}`);
    const client = createWalletClient({
      account: signer,
      chain: datahaven,
      transport: http(NETWORK_RPC_URL)
    });

    const randAccount = privateKeyToAccount(generatePrivateKey());
    const addresses = [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
      "0x976ea74026e726554db657fa54763abd0c3a0aa9",
      randAccount.address
    ];

    for (const address of addresses) {
      console.log(`Sending 1 ETH to address: ${address}`);

      const hash = await client.sendTransaction({
        to: address as `0x${string}`,
        value: parseEther("1.0")
      });

      console.log(`Transaction sent! Hash: http://localhost:3000/tx/${hash}`);
    }
  } catch (error) {
    console.error("Error sending transaction:", error);
    process.exit(1);
  }
}

main();
