import { generateRandomAccount, logger, printDivider, printHeader } from "utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { secp256k1 } from "@noble/curves/secp256k1";

import { http, createWalletClient, defineChain, parseEther, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { datahaven } from "@polkadot-api/descriptors";
import { createClient, type PolkadotSigner } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Binary } from "@polkadot-api/substrate-bindings";
import { getPolkadotSigner } from "polkadot-api/signer";

export const sendEthTxn = async (privateKey: string, networkRpcUrl: string) => {
  printHeader("Sending Test ETH Transaction");

  const localEth = defineChain({
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

  logger.debug(`Using account: ${signer.address}`);
  const client = createWalletClient({
    account: signer,
    chain: localEth,
    transport: http(networkRpcUrl)
  }).extend(publicActions);

  const randAccount = generateRandomAccount();
  const addresses = [
    // "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    // "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    // "0x976ea74026e726554db657fa54763abd0c3a0aa9",
    randAccount.address
  ];

  for (const address of addresses) {
    logger.debug(`Sending 1 ETH to address: ${address}`);

    const hash = await client.sendTransaction({
      to: address as `0x${string}`,
      value: parseEther("1.0")
    });

    logger.info(`Waiting for transaction ${hash} to be confirmed...`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

    printDivider();
  }
};

export const sendDataHavenTxn = async (privateKey: string, networkRpcUrl: string) => {
  printHeader("Sending Test DataHaven Transaction");

  const client = createClient(withPolkadotSdkCompat(getWsProvider(networkRpcUrl)));
  const dhApi = client.getTypedApi(datahaven);

  const signer = getEvmEcdsaSigner(
    Buffer.from(privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey, "hex")
  );

  const remarkBytes = new TextEncoder().encode("Hello, world!");
  const tx = dhApi.tx.System.remark_with_event({
    remark: new Binary(remarkBytes)
  });

  const txFinalisedPayload = await tx.signAndSubmit(signer);

  logger.info(
    `Transaction with hash ${txFinalisedPayload.txHash} submitted and finalised in block ${txFinalisedPayload.block.hash}`
  );

  printDivider();
};

// A signer for EVM like chains that use AccountId20 as their public address
const getEvmEcdsaSigner = (privateKey: Uint8Array): PolkadotSigner => {
  const publicAddress = keccak_256(secp256k1.getPublicKey(privateKey, false).slice(1)).slice(-20);

  return getPolkadotSigner(publicAddress, "Ecdsa", (input) =>
    signEcdsa(keccak_256, input, privateKey)
  );
};

const signEcdsa = (
  hasher: (input: Uint8Array) => Uint8Array,
  value: Uint8Array,
  priv: Uint8Array
) => {
  const signature = secp256k1.sign(hasher(value), priv);
  const signedBytes = signature.toCompactRawBytes();

  const result = new Uint8Array(signedBytes.length + 1);
  result.set(signedBytes);
  result[signedBytes.length] = signature.recovery;

  return result;
};
