/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param inputHexString - The hexadecimal string to convert. It can optionally start with "0x".
 * @returns A Uint8Array representing the hexadecimal string.
 * @throws Error if the hex string contains invalid characters.
 */
export const hexToUint8Array = (inputHexString: string): Uint8Array => {
  let hex = inputHexString;
  if (hex.startsWith("0x")) {
    hex = hex.slice(2);
  }
  if (hex.length % 2 !== 0) {
    console.warn(`Hex string has an odd number of digits: ${hex}`);
    // Optionally, pad with a leading zero, or throw an error
    // For now, let's proceed, but this might indicate an issue with the hex string
    // hex = "0" + hex; // Example padding
  }
  // If length is 0 after removing 0x, return empty array
  if (hex.length === 0) {
    return new Uint8Array(0);
  }
  const byteArray = new Uint8Array(hex.length / 2);
  for (let i = 0; i < byteArray.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character encountered in string: ${hex}`);
    }
    byteArray[i] = byte;
  }
  return byteArray;
};
