import { http, type Hex, createWalletClient, defineChain, parseEther, publicActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export default async function main(privateKey: string, networkRpcUrl: string) {
  const datahaven = defineChain({
    id: 3151908,
    name: "datahaven",
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH"
    },
    rpcUrls: {
      default: {
        http: [networkRpcUrl]
      }
    },
    blockExplorers: {
      default: { name: "Explorer", url: "http://localhost:3000" }
    }
  });

  const signer = privateKeyToAccount(privateKey as `0x${string}`);

  console.log(`Using account: ${signer.address}`);
  const client = createWalletClient({
    account: signer,
    chain: datahaven,
    transport: http(networkRpcUrl)
  }).extend(publicActions);

  const randAccount = privateKeyToAccount(generatePrivateKey());
  const addresses = [
    // "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    // "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    // "0x976ea74026e726554db657fa54763abd0c3a0aa9",
    randAccount.address
  ];

  for (const address of addresses) {
    console.log(`Sending 1 ETH to address: ${address}`);

    const hash = await client.sendTransaction({
      to: address as `0x${string}`,
      value: parseEther("1.0")
    });

    console.log(`Transaction sent! Hash: http://localhost:3000/tx/${hash}`);

    console.log(`Waiting for transaction ${hash} to be confirmed...`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  }
}
