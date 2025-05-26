import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { datahaven } from "@polkadot-api/descriptors";
import { createClient, type PolkadotClient, type TypedApi } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner, type PolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { SUBSTRATE_FUNDED_ACCOUNTS } from "./constants";
import type { Prettify } from "./types";

// A signer for EVM like chains that use AccountId20 as their public address
export const getEvmEcdsaSigner = (privateKey: string): PolkadotSigner => {
  const privateKeyBytes = Buffer.from(
    privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey,
    "hex"
  );
  const publicAddress = keccak_256(secp256k1.getPublicKey(privateKeyBytes, false).slice(1)).slice(
    -20
  );

  return getPolkadotSigner(publicAddress, "Ecdsa", (input) =>
    signEcdsa(keccak_256, input, privateKeyBytes)
  );
};

export const signEcdsa = (
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

export const createPapiConnectors = (
  wsUrl?: string
): { client: PolkadotClient; typedApi: DataHavenApi } => {
  const url = wsUrl ?? "ws://127.0.0.1:9944";
  const client = createClient(withPolkadotSdkCompat(getWsProvider(url)));
  return { client, typedApi: client.getTypedApi(datahaven) };
};

export const getPapiSigner = (person: keyof typeof SUBSTRATE_FUNDED_ACCOUNTS = "ALITH") =>
  getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS[person].privateKey);

export type DataHavenApi = Prettify<TypedApi<typeof datahaven>>;
