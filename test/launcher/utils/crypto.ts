import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import type { Hex } from "viem";

/**
 * Converts a compressed ECDSA public key to an Ethereum address.
 * Used for converting BEEFY authorities public keys to Ethereum addresses.
 *
 * @param compressedPubKey - The compressed public key (33 bytes)
 * @returns The Ethereum address derived from the public key
 */
export const compressedPubKeyToEthereumAddress = (compressedPubKey: Hex): Hex => {
  // Remove 0x prefix if present
  const pubKeyBytes = compressedPubKey.startsWith("0x")
    ? compressedPubKey.slice(2)
    : compressedPubKey;

  // Convert hex string to Uint8Array
  const matches = pubKeyBytes.match(/.{1,2}/g);
  if (!matches) {
    throw new Error("Invalid hex string format");
  }
  const compressedBytes = new Uint8Array(matches.map((byte) => Number.parseInt(byte, 16)));

  // Get the uncompressed point
  const point = secp256k1.ProjectivePoint.fromHex(compressedBytes);
  const uncompressedBytes = point.toRawBytes(false); // false = uncompressed

  // Remove the first byte (0x04) which indicates uncompressed format
  const publicKeyBytes = uncompressedBytes.slice(1);

  // Keccak256 hash of the public key
  const hash = keccak_256(publicKeyBytes);

  // Take the last 20 bytes as the Ethereum address
  const address = hash.slice(-20);

  // Convert to hex string with 0x prefix
  return `0x${Array.from(address)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
};
