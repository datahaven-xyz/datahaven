// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.28 ^0.8.0;

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/math/Math.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/math/Math.sol)

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math_0 {
    enum Rounding {
        Down, // Toward negative infinity
        Up, // Toward infinity
        Zero // Toward zero
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b) + (a ^ b) / 2;
    }

    /**
     * @dev Returns the ceiling of the division of two numbers.
     *
     * This differs from standard division with `/` in that it rounds up instead
     * of rounding down.
     */
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b - 1) / b can overflow on addition, so we distribute.
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /**
     * @notice Calculates floor(x * y / denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
     * @dev Original credit to Remco Bloemen under MIT license (https://xn--2-umb.com/21/muldiv)
     * with further edits by Uniswap Labs also under MIT license.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            // 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1, then use
            // use the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256
            // variables such that product = prod1 * 2^256 + prod0.
            uint256 prod0; // Least significant 256 bits of the product
            uint256 prod1; // Most significant 256 bits of the product
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            // Handle non-overflow cases, 256 by 256 division.
            if (prod1 == 0) {
                // Solidity will revert if denominator == 0, unlike the div opcode on its own.
                // The surrounding unchecked block does not change this fact.
                // See https://docs.soliditylang.org/en/latest/control-structures.html#checked-or-unchecked-arithmetic.
                return prod0 / denominator;
            }

            // Make sure the result is less than 2^256. Also prevents denominator == 0.
            require(denominator > prod1, "Math: mulDiv overflow");

            ///////////////////////////////////////////////
            // 512 by 256 division.
            ///////////////////////////////////////////////

            // Make division exact by subtracting the remainder from [prod1 prod0].
            uint256 remainder;
            assembly {
                // Compute remainder using mulmod.
                remainder := mulmod(x, y, denominator)

                // Subtract 256 bit number from 512 bit number.
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 1.
            // See https://cs.stackexchange.com/q/138556/92363.

            // Does not overflow because the denominator cannot be zero at this stage in the function.
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                // Divide denominator by twos.
                denominator := div(denominator, twos)

                // Divide [prod1 prod0] by twos.
                prod0 := div(prod0, twos)

                // Flip twos such that it is 2^256 / twos. If twos is zero, then it becomes one.
                twos := add(div(sub(0, twos), twos), 1)
            }

            // Shift in bits from prod1 into prod0.
            prod0 |= prod1 * twos;

            // Invert denominator mod 2^256. Now that denominator is an odd number, it has an inverse modulo 2^256 such
            // that denominator * inv = 1 mod 2^256. Compute the inverse by starting with a seed that is correct for
            // four bits. That is, denominator * inv = 1 mod 2^4.
            uint256 inverse = (3 * denominator) ^ 2;

            // Use the Newton-Raphson iteration to improve the precision. Thanks to Hensel's lifting lemma, this also works
            // in modular arithmetic, doubling the correct bits in each step.
            inverse *= 2 - denominator * inverse; // inverse mod 2^8
            inverse *= 2 - denominator * inverse; // inverse mod 2^16
            inverse *= 2 - denominator * inverse; // inverse mod 2^32
            inverse *= 2 - denominator * inverse; // inverse mod 2^64
            inverse *= 2 - denominator * inverse; // inverse mod 2^128
            inverse *= 2 - denominator * inverse; // inverse mod 2^256

            // Because the division is now exact we can divide by multiplying with the modular inverse of denominator.
            // This will give us the correct result modulo 2^256. Since the preconditions guarantee that the outcome is
            // less than 2^256, this is the final result. We don't need to compute the high bits of the result and prod1
            // is no longer required.
            result = prod0 * inverse;
            return result;
        }
    }

    /**
     * @notice Calculates x * y / denominator with full precision, following the selected rounding direction.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding) internal pure returns (uint256) {
        uint256 result = mulDiv(x, y, denominator);
        if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
        return result;
    }

    /**
     * @dev Returns the square root of a number. If the number is not a perfect square, the value is rounded down.
     *
     * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
     */
    function sqrt(uint256 a) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
        //
        // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
        // `msb(a) <= a < 2*msb(a)`. This value can be written `msb(a)=2**k` with `k=log2(a)`.
        //
        // This can be rewritten `2**log2(a) <= a < 2**(log2(a) + 1)`
        // → `sqrt(2**k) <= sqrt(a) < sqrt(2**(k+1))`
        // → `2**(k/2) <= sqrt(a) < 2**((k+1)/2) <= 2**(k/2 + 1)`
        //
        // Consequently, `2**(log2(a) / 2)` is a good first approximation of `sqrt(a)` with at least 1 correct bit.
        uint256 result = 1 << (log2(a) >> 1);

        // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
        // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
        // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
        // into the expected uint128 result.
        unchecked {
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            return min(result, a / result);
        }
    }

    /**
     * @notice Calculates sqrt(a), following the selected rounding direction.
     */
    function sqrt(uint256 a, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = sqrt(a);
            return result + (rounding == Rounding.Up && result * result < a ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 2, rounded down, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 128;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 64;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 32;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 16;
            }
            if (value >> 8 > 0) {
                value >>= 8;
                result += 8;
            }
            if (value >> 4 > 0) {
                value >>= 4;
                result += 4;
            }
            if (value >> 2 > 0) {
                value >>= 2;
                result += 2;
            }
            if (value >> 1 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 2, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log2(value);
            return result + (rounding == Rounding.Up && 1 << result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 10, rounded down, of a positive value.
     * Returns 0 if given 0.
     */
    function log10(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >= 10 ** 64) {
                value /= 10 ** 64;
                result += 64;
            }
            if (value >= 10 ** 32) {
                value /= 10 ** 32;
                result += 32;
            }
            if (value >= 10 ** 16) {
                value /= 10 ** 16;
                result += 16;
            }
            if (value >= 10 ** 8) {
                value /= 10 ** 8;
                result += 8;
            }
            if (value >= 10 ** 4) {
                value /= 10 ** 4;
                result += 4;
            }
            if (value >= 10 ** 2) {
                value /= 10 ** 2;
                result += 2;
            }
            if (value >= 10 ** 1) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 10, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log10(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log10(value);
            return result + (rounding == Rounding.Up && 10 ** result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 256, rounded down, of a positive value.
     * Returns 0 if given 0.
     *
     * Adding one to the result gives the number of pairs of hex symbols needed to represent `value` as a hex string.
     */
    function log256(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 16;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 8;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 4;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 2;
            }
            if (value >> 8 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 256, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log256(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log256(value);
            return result + (rounding == Rounding.Up && 1 << (result << 3) < value ? 1 : 0);
        }
    }
}

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/math/SignedMath.sol

// OpenZeppelin Contracts (last updated v4.8.0) (utils/math/SignedMath.sol)

/**
 * @dev Standard signed math utilities missing in the Solidity language.
 */
library SignedMath {
    /**
     * @dev Returns the largest of two signed numbers.
     */
    function max(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two signed numbers.
     */
    function min(int256 a, int256 b) internal pure returns (int256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two signed numbers without overflow.
     * The result is rounded towards zero.
     */
    function average(int256 a, int256 b) internal pure returns (int256) {
        // Formula from the book "Hacker's Delight"
        int256 x = (a & b) + ((a ^ b) >> 1);
        return x + (int256(uint256(x) >> 255) & (a ^ b));
    }

    /**
     * @dev Returns the absolute unsigned value of a signed value.
     */
    function abs(int256 n) internal pure returns (uint256) {
        unchecked {
            // must be unchecked in order to support `n = type(int256).min`
            return uint256(n >= 0 ? n : -n);
        }
    }
}

// lib/snowbridge/contracts/src/utils/Bits.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
// Code from https://github.com/ethereum/solidity-examples

library Bits {
    uint256 internal constant ONE = uint256(1);
    uint256 internal constant ONES = type(uint256).max;

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }

    // Sets the bit at the given 'index' in 'self' to '0'.
    // Returns the modified value.
    function clearBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self & ~(ONE << index);
    }

    // Sets the bit at the given 'index' in 'self' to:
    //  '1' - if the bit is '0'
    //  '0' - if the bit is '1'
    // Returns the modified value.
    function toggleBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self ^ (ONE << index);
    }

    // Get the value of the bit at the given 'index' in 'self'.
    function bit(uint256 self, uint8 index) internal pure returns (uint8) {
        return uint8((self >> index) & 1);
    }

    // Check if the bit at the given 'index' in 'self' is set.
    // Returns:
    //  'true' - if the value of the bit is '1'
    //  'false' - if the value of the bit is '0'
    function bitSet(uint256 self, uint8 index) internal pure returns (bool) {
        return (self >> index) & 1 == 1;
    }

    // Checks if the bit at the given 'index' in 'self' is equal to the corresponding
    // bit in 'other'.
    // Returns:
    //  'true' - if both bits are '0' or both bits are '1'
    //  'false' - otherwise
    function bitEqual(uint256 self, uint256 other, uint8 index) internal pure returns (bool) {
        return ((self ^ other) >> index) & 1 == 0;
    }

    // Get the bitwise NOT of the bit at the given 'index' in 'self'.
    function bitNot(uint256 self, uint8 index) internal pure returns (uint8) {
        return uint8(1 - ((self >> index) & 1));
    }

    // Computes the bitwise AND of the bit at the given 'index' in 'self', and the
    // corresponding bit in 'other', and returns the value.
    function bitAnd(uint256 self, uint256 other, uint8 index) internal pure returns (uint8) {
        return uint8(((self & other) >> index) & 1);
    }

    // Computes the bitwise OR of the bit at the given 'index' in 'self', and the
    // corresponding bit in 'other', and returns the value.
    function bitOr(uint256 self, uint256 other, uint8 index) internal pure returns (uint8) {
        return uint8(((self | other) >> index) & 1);
    }

    // Computes the bitwise XOR of the bit at the given 'index' in 'self', and the
    // corresponding bit in 'other', and returns the value.
    function bitXor(uint256 self, uint256 other, uint8 index) internal pure returns (uint8) {
        return uint8(((self ^ other) >> index) & 1);
    }

    // Gets 'numBits' consecutive bits from 'self', starting from the bit at 'startIndex'.
    // Returns the bits as a 'uint'.
    // Requires that:
    //  - '0 < numBits <= 256'
    //  - 'startIndex < 256'
    //  - 'numBits + startIndex <= 256'
    function bits(uint256 self, uint8 startIndex, uint16 numBits)
        internal
        pure
        returns (uint256)
    {
        require(0 < numBits && startIndex < 256 && startIndex + numBits <= 256, "out of bounds");
        return (self >> startIndex) & (ONES >> (256 - numBits));
    }

    // Computes the index of the highest bit set in 'self'.
    // Returns the highest bit set as an 'uint8'.
    // Requires that 'self != 0'.
    function highestBitSet(uint256 self) internal pure returns (uint8 highest) {
        require(self != 0, "should not be zero");
        uint256 val = self;
        for (uint8 i = 128; i >= 1; i >>= 1) {
            if (val & (((ONE << i) - 1) << i) != 0) {
                highest += i;
                val >>= i;
            }
        }
    }

    // Computes the index of the lowest bit set in 'self'.
    // Returns the lowest bit set as an 'uint8'.
    // Requires that 'self != 0'.
    function lowestBitSet(uint256 self) internal pure returns (uint8 lowest) {
        require(self != 0, "should not be zero");
        uint256 val = self;
        for (uint8 i = 128; i >= 1; i >>= 1) {
            if (val & ((ONE << i) - 1) == 0) {
                lowest += i;
                val >>= i;
            }
        }
    }
}

// lib/snowbridge/contracts/src/utils/MMRProof.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library MMRProof {
    error ProofSizeExceeded();

    uint256 internal constant MAXIMUM_PROOF_SIZE = 256;

    /**
     * @dev Verify inclusion of a leaf in an MMR
     * @param root MMR root hash
     * @param leafHash leaf hash
     * @param proof an array of hashes
     * @param proofOrder a bitfield describing the order of each item (left vs right)
     */
    function verifyLeafProof(
        bytes32 root,
        bytes32 leafHash,
        bytes32[] calldata proof,
        uint256 proofOrder
    ) internal pure returns (bool) {
        // Size of the proof is bounded, since `proofOrder` can only contain `MAXIMUM_PROOF_SIZE` orderings.
        if (proof.length > MAXIMUM_PROOF_SIZE) {
            revert ProofSizeExceeded();
        }

        bytes32 acc = leafHash;
        for (uint256 i = 0; i < proof.length; i++) {
            acc = hashPairs(acc, proof[i], (proofOrder >> i) & 1);
        }
        return root == acc;
    }

    function hashPairs(bytes32 x, bytes32 y, uint256 order)
        internal
        pure
        returns (bytes32 value)
    {
        assembly {
            switch order
            case 0 {
                mstore(0x00, x)
                mstore(0x20, y)
            }
            default {
                mstore(0x00, y)
                mstore(0x20, x)
            }
            value := keccak256(0x0, 0x40)
        }
    }
}

// lib/snowbridge/contracts/src/utils/Math.sol

// SPDX-FileCopyrightText: 2023 OpenZeppelin
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
// Code from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/Math.sol

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math_1 {
    enum Rounding {
        Floor, // Toward negative infinity
        Ceil, // Toward positive infinity
        Trunc, // Toward zero
        Expand // Away from zero

    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Return the log in base 2 of a positive value rounded towards zero.
     * Returns 0 if given 0.
     */
    function log2(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 128;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 64;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 32;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 16;
            }
            if (value >> 8 > 0) {
                value >>= 8;
                result += 8;
            }
            if (value >> 4 > 0) {
                value >>= 4;
                result += 4;
            }
            if (value >> 2 > 0) {
                value >>= 2;
                result += 2;
            }
            if (value >> 1 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 2, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log2(value);
            return result + (unsignedRoundsUp(rounding) && 1 << result < value ? 1 : 0);
        }
    }

    /**
     * @dev Returns whether a provided rounding mode is considered rounding up for unsigned integers.
     */
    function unsignedRoundsUp(Rounding rounding) internal pure returns (bool) {
        return uint8(rounding) % 2 == 1;
    }

    /**
     * @dev Safely adds two unsigned 16-bit integers, preventing overflow by saturating to max uint16.
     */
    function saturatingAdd(uint16 a, uint16 b) internal pure returns (uint16) {
        unchecked {
            uint16 c = a + b;
            if (c < a) {
                return 0xFFFF;
            }
            return c;
        }
    }

    /**
     * @dev Safely subtracts two unsigned 256-bit integers, preventing overflow by saturating to min uint256.
     */
    function saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            if (b >= a) {
                return 0;
            }
            return a - b;
        }
    }
}

// lib/snowbridge/contracts/src/utils/ScaleCodec.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library ScaleCodec {
    error UnsupportedCompactEncoding();

    uint256 internal constant MAX_COMPACT_ENCODABLE_UINT = 2 ** 30 - 1;

    // Sources:
    //   * https://ethereum.stackexchange.com/questions/15350/how-to-convert-an-bytes-to-address-in-solidity/50528
    //   * https://graphics.stanford.edu/~seander/bithacks.html#ReverseParallel

    function reverse256(uint256 input) internal pure returns (uint256 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00) >> 8)
            | ((v & 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v = ((v & 0xFFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000) >> 16)
            | ((v & 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v = ((v & 0xFFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000) >> 32)
            | ((v & 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF) << 32);

        // swap 8-byte long pairs
        v = ((v & 0xFFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF0000000000000000) >> 64)
            | ((v & 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF) << 64);

        // swap 16-byte long pairs
        v = (v >> 128) | (v << 128);
    }

    function reverse128(uint128 input) internal pure returns (uint128 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00FF00FF00FF00FF00FF00FF00) >> 8)
            | ((v & 0x00FF00FF00FF00FF00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v = ((v & 0xFFFF0000FFFF0000FFFF0000FFFF0000) >> 16)
            | ((v & 0x0000FFFF0000FFFF0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v = ((v & 0xFFFFFFFF00000000FFFFFFFF00000000) >> 32)
            | ((v & 0x00000000FFFFFFFF00000000FFFFFFFF) << 32);

        // swap 8-byte long pairs
        v = (v >> 64) | (v << 64);
    }

    function reverse64(uint64 input) internal pure returns (uint64 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00FF00FF00) >> 8) | ((v & 0x00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v = ((v & 0xFFFF0000FFFF0000) >> 16) | ((v & 0x0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v = (v >> 32) | (v << 32);
    }

    function reverse32(uint32 input) internal pure returns (uint32 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00) >> 8) | ((v & 0x00FF00FF) << 8);

        // swap 2-byte long pairs
        v = (v >> 16) | (v << 16);
    }

    function reverse16(uint16 input) internal pure returns (uint16 v) {
        v = input;

        // swap bytes
        v = (v >> 8) | (v << 8);
    }

    function encodeU256(uint256 input) internal pure returns (bytes32) {
        return bytes32(reverse256(input));
    }

    function encodeU128(uint128 input) internal pure returns (bytes16) {
        return bytes16(reverse128(input));
    }

    function encodeU64(uint64 input) internal pure returns (bytes8) {
        return bytes8(reverse64(input));
    }

    function encodeU32(uint32 input) internal pure returns (bytes4) {
        return bytes4(reverse32(input));
    }

    function encodeU16(uint16 input) internal pure returns (bytes2) {
        return bytes2(reverse16(input));
    }

    function encodeU8(uint8 input) internal pure returns (bytes1) {
        return bytes1(input);
    }

    // Supports compact encoding of integers in [0, uint32.MAX]
    function encodeCompactU32(uint32 value) internal pure returns (bytes memory) {
        if (value <= 2 ** 6 - 1) {
            // add single byte flag
            return abi.encodePacked(uint8(value << 2));
        } else if (value <= 2 ** 14 - 1) {
            // add two byte flag and create little endian encoding
            return abi.encodePacked(ScaleCodec.reverse16(uint16(((value << 2) + 1))));
        } else if (value <= 2 ** 30 - 1) {
            // add four byte flag and create little endian encoding
            return abi.encodePacked(ScaleCodec.reverse32(uint32((value << 2)) + 2));
        } else {
            return abi.encodePacked(uint8(3), ScaleCodec.reverse32(value));
        }
    }

    function encodeCompactU128(uint128 value) internal pure returns (bytes memory) {
        // 1) up to 2^6 - 1
        if (value <= 63) {
            // single byte = (value << 2)
            // (lowest two bits = 00)
            return abi.encodePacked(uint8(value << 2));
        }

        // 2) up to 2^14 - 1
        if (value <= 0x3FFF) {
            // two bytes = (value << 2) + 0x01
            // (lowest two bits = 01)
            uint16 encoded = uint16(value << 2) | 0x01;
            // We must store it in little-endian
            return abi.encodePacked(reverse16(encoded));
        }

        // 3) up to 2^30 - 1
        if (value <= 0x3FFF_FFFF) {
            // four bytes = (value << 2) + 0x02
            // (lowest two bits = 10)
            uint32 encoded = (uint32(value) << 2) | 0x02;
            return abi.encodePacked(reverse32(encoded));
        }

        // 4) otherwise
        // big integer => prefix + little-endian bytes (no leading zeros)
        // prefix = 0x03 + ((numValueBytes - 4) << 2)
        //   where numValueBytes is how many bytes needed to represent `value`.
        bytes memory littleEndian = _toLittleEndianNoLeadingZeros(value);
        uint8 len = uint8(littleEndian.length); // # of bytes needed

        // Substrate: prefix's lower 2 bits = 0b11,
        // the remaining upper bits = (len - 4).
        // Combined: prefix = 0x03 + ((len - 4) << 2).
        uint8 prefix = ((len - 4) << 2) | 0x03;

        // Concatenate prefix + actual bytes
        return abi.encodePacked(prefix, littleEndian);
    }

    // Convert `value` into a little-endian byte array with no leading zeros.
    // (Leading zeros in LE = trailing zeros in big-endian.)
    function _toLittleEndianNoLeadingZeros(uint128 value) private pure returns (bytes memory) {
        // Even if value=0, that case is handled above in smaller branches,
        // but let's just handle it gracefully anyway:
        if (value == 0) {
            return hex"00";
        }
        // Temporarily build up to 16 bytes in a buffer.
        bytes memory buf = new bytes(16);
        uint128 current = value;
        uint8 i = 0;
        while (current != 0) {
            buf[i] = bytes1(uint8(current & 0xFF));
            current >>= 8;
            unchecked {
                i++;
            }
        }
        // i is now the actual number of bytes used
        // Copy them into a new array of the correct size
        bytes memory out = new bytes(i);
        for (uint8 j = 0; j < i; j++) {
            out[j] = buf[j];
        }
        return out;
    }

    function checkedEncodeCompactU32(uint256 value) internal pure returns (bytes memory) {
        if (value > type(uint32).max) {
            revert UnsupportedCompactEncoding();
        }
        return encodeCompactU32(uint32(value));
    }
}

// lib/snowbridge/contracts/src/utils/SubstrateMerkleProof.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// Used to verify merkle proofs generated by https://github.com/paritytech/substrate/tree/master/utils/binary-merkle-tree
library SubstrateMerkleProof {
    /**
     * @notice Verify that a specific leaf element is part of the Merkle Tree at a specific position in the tree
     *
     * The tree would have been constructed using
     * https://paritytech.github.io/substrate/master/binary_merkle_tree/fn.merkle_root.html
     *
     * This implementation adapted from
     * https://paritytech.github.io/substrate/master/binary_merkle_tree/fn.verify_proof.html
     *
     * @param root the root of the merkle tree
     * @param leaf the leaf which needs to be proven
     * @param position the position of the leaf, index starting with 0
     * @param width the width or number of leaves in the tree
     * @param proof the array of proofs to help verify the leaf's membership, ordered from leaf to root
     * @return a boolean value representing the success or failure of the operation
     */
    function verify(
        bytes32 root,
        bytes32 leaf,
        uint256 position,
        uint256 width,
        bytes32[] calldata proof
    ) internal pure returns (bool) {
        if (position >= width) {
            return false;
        }
        return root == computeRoot(leaf, position, width, proof);
    }

    function computeRoot(bytes32 leaf, uint256 position, uint256 width, bytes32[] calldata proof)
        internal
        pure
        returns (bytes32)
    {
        bytes32 node = leaf;
        unchecked {
            for (uint256 i = 0; i < proof.length; i++) {
                if (position & 1 == 1 || position + 1 == width) {
                    node = efficientHash(proof[i], node);
                } else {
                    node = efficientHash(node, proof[i]);
                }
                position = position >> 1;
                width = ((width - 1) >> 1) + 1;
            }
            return node;
        }
    }

    function efficientHash(bytes32 a, bytes32 b) internal pure returns (bytes32 value) {
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}

// lib/snowbridge/contracts/src/utils/Uint16Array.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/**
 * @title A utility library for 16 bit counters packed in 256 bit array.
 * @dev The BeefyClient needs to store a count of how many times a validators signature is used. In solidity
 * a uint16 would take up as much space as a uin256 in storage, making storing counters for 1000 validators
 * expensive in terms of gas. The BeefyClient only needs 16 bits per counter. This library allows us to pack
 * 16 uint16 into a single uint256 and save 16x storage.
 *
 * Layout of 32 counters (2 uint256)
 * We store all counts in a single large uint256 array and convert from index from the logical uint16 array
 * to the physical uint256 array.
 *
 *           0                                               1                                               2
 * uint256[] |-- -- -- -- -- -- -- -- -- -- -- -- YY -- -- --|-- -- -- -- -- -- XX -- -- -- -- -- -- -- -- --|
 * uint16[]  |--|--|--|--|--|--|--|--|--|--|--|--|YY|--|--|--|--|--|--|--|--|--|XX|--|--|--|--|--|--|--|--|--|
 *           0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32
 *
 * Logical Index Layout
 * We use the first 4
 * |-------...---------|----|
 * 256                 4    0
 *        ^index          ^bit-index
 *
 * In the above table counter YY is at logical index 12 in the uint16 array. It will convert to a physical
 * index of 0 in the physical uint256 array and then to bit-index of 192 to 207 of that uint256. In the
 * above table counter XX is at logical index 22. It will convert to a physical index of 1 in the array and
 * then to bit-index 96 to 111 of uint256[1].
 */
using {get, set} for Uint16Array global;

error IndexOutOfBounds();

/**
 * @dev stores the backing array and the length.
 */
struct Uint16Array {
    uint256[] data;
    uint256 length;
}

/**
 * @dev Creates a new counter which can store at least `length` counters.
 * @param length The amount of counters.
 */
function createUint16Array(uint256 length) pure returns (Uint16Array memory) {
    // create space for `length` elements and round up if needed.
    uint256 bufferLength = length / 16 + (length % 16 == 0 ? 0 : 1);
    return Uint16Array({data: new uint256[](bufferLength), length: length});
}

/**
 * @dev Gets the counter at the logical index
 * @param self The array.
 * @param index The logical index.
 */
function get(Uint16Array storage self, uint256 index) view returns (uint16) {
    if (index >= self.length) {
        revert IndexOutOfBounds();
    }
    // Right-shift the index by 4. This truncates the first 4 bits (bit-index) leaving us with the index
    // into the array.
    uint256 element = index >> 4;
    // Mask out the first 4 bits of the logical index to give us the bit-index.
    uint8 inside = uint8(index) & 0x0F;
    // find the element in the array, shift until its bit index and mask to only take the first 16 bits.
    return uint16((self.data[element] >> (16 * inside)) & 0xFFFF);
}

/**
 * @dev Sets the counter at the logical index.
 * @param self The array.
 * @param index The logical index of the counter in the array.
 * @param value The value to set the counter to.
 */
function set(Uint16Array storage self, uint256 index, uint16 value) {
    if (index >= self.length) {
        revert IndexOutOfBounds();
    }
    // Right-shift the index by 4. This truncates the first 4 bits (bit-index) leaving us with the index
    // into the array.
    uint256 element = index >> 4;
    // Mask out the first 4 bytes of the logical index to give us the bit-index.
    uint8 inside = uint8(index) & 0x0F;
    // Create a zero mask which will clear the existing value at the bit-index.
    uint256 zero = ~(uint256(0xFFFF) << (16 * inside));
    // Shift the value to the bit index.
    uint256 shiftedValue = uint256(value) << (16 * inside);
    // Take the element, apply the zero mask to clear the existing value, and then apply the shifted value with bitwise or.
    self.data[element] = self.data[element] & zero | shiftedValue;
}

// lib/snowbridge/contracts/src/utils/Bitfield.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library Bitfield {
    using Bits for uint256;

    /**
     * @dev Constants used to efficiently calculate the hamming weight of a bitfield. See
     * https://en.wikipedia.org/wiki/Hamming_weight#Efficient_implementation for an explanation of those constants.
     */
    uint256 internal constant M1 =
        0x5555555555555555555555555555555555555555555555555555555555555555;
    uint256 internal constant M2 =
        0x3333333333333333333333333333333333333333333333333333333333333333;
    uint256 internal constant M4 =
        0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f;
    uint256 internal constant M8 =
        0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff;
    uint256 internal constant M16 =
        0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff;
    uint256 internal constant M32 =
        0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffff;
    uint256 internal constant M64 =
        0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffff;
    uint256 internal constant M128 =
        0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff;

    uint256 internal constant ONE = uint256(1);

    /**
     * @notice Core subsampling algorithm. Draws a random number, derives an index in the bitfield, and sets the bit if it is in the `prior` and not
     * yet set. Repeats that `n` times.
     * @param seed Source of randomness for selecting validator signatures.
     * @param prior Bitfield indicating which validators claim to have signed the commitment.
     * @param n Number of unique bits in prior that must be set in the result. Must be <= number of set bits in `prior`.
     * @param length Length of the bitfield prior to draw bits from. Must be <= prior.length * 256.
     */
    function subsample(uint256 seed, uint256[] memory prior, uint256 n, uint256 length)
        internal
        pure
        returns (uint256[] memory bitfield)
    {
        bitfield = new uint256[](prior.length);
        uint256 found = 0;

        for (uint256 i = 0; found < n;) {
            uint256 index = makeIndex(seed, i, length);

            // require randomly selected bit to be set in prior and not yet set in bitfield
            if (!isSet(prior, index) || isSet(bitfield, index)) {
                unchecked {
                    i++;
                }
                continue;
            }

            set(bitfield, index);

            unchecked {
                found++;
                i++;
            }
        }

        return bitfield;
    }

    /**
     * @dev Helper to create a bitfield.
     */
    function createBitfield(uint256[] calldata bitsToSet, uint256 length)
        internal
        pure
        returns (uint256[] memory bitfield)
    {
        // Calculate length of uint256 array based on rounding up to number of uint256 needed
        uint256 arrayLength = (length + 255) / 256;

        bitfield = new uint256[](arrayLength);

        for (uint256 i = 0; i < bitsToSet.length; i++) {
            set(bitfield, bitsToSet[i]);
        }

        return bitfield;
    }

    /**
     * @notice Calculates the number of set bits by using the hamming weight of the bitfield.
     * The algorithm below is implemented after https://en.wikipedia.org/wiki/Hamming_weight#Efficient_implementation.
     * Further improvements are possible, see the article above.
     */
    function countSetBits(uint256[] memory self) internal pure returns (uint256) {
        unchecked {
            uint256 count = 0;
            for (uint256 i = 0; i < self.length; i++) {
                uint256 x = self[i];
                x = (x & M1) + ((x >> 1) & M1); //put count of each  2 bits into those  2 bits
                x = (x & M2) + ((x >> 2) & M2); //put count of each  4 bits into those  4 bits
                x = (x & M4) + ((x >> 4) & M4); //put count of each  8 bits into those  8 bits
                x = (x & M8) + ((x >> 8) & M8); //put count of each 16 bits into those 16 bits
                x = (x & M16) + ((x >> 16) & M16); //put count of each 32 bits into those 32 bits
                x = (x & M32) + ((x >> 32) & M32); //put count of each 64 bits into those 64 bits
                x = (x & M64) + ((x >> 64) & M64); //put count of each 128 bits into those 128 bits
                x = (x & M128) + ((x >> 128) & M128); //put count of each 256 bits into those 256 bits
                count += x;
            }
            return count;
        }
    }

    function isSet(uint256[] memory self, uint256 index) internal pure returns (bool) {
        uint256 element = index >> 8;
        return self[element].bit(uint8(index)) == 1;
    }

    function set(uint256[] memory self, uint256 index) internal pure {
        uint256 element = index >> 8;
        self[element] = self[element].setBit(uint8(index));
    }

    function unset(uint256[] memory self, uint256 index) internal pure {
        uint256 element = index >> 8;
        self[element] = self[element].clearBit(uint8(index));
    }

    function makeIndex(uint256 seed, uint256 iteration, uint256 length)
        internal
        pure
        returns (uint256 index)
    {
        // Handle case where length is 0 to prevent infinite loop in subsample
        if (length == 0) {
            return 0;
        }

        assembly {
            mstore(0x00, seed)
            mstore(0x20, iteration)
            index := mod(keccak256(0x00, 0x40), length)
        }
    }
}

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/Strings.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/Strings.sol)

/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant _SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        unchecked {
            uint256 length = Math_0.log10(value) + 1;
            string memory buffer = new string(length);
            uint256 ptr;
            /// @solidity memory-safe-assembly
            assembly {
                ptr := add(buffer, add(32, length))
            }
            while (true) {
                ptr--;
                /// @solidity memory-safe-assembly
                assembly {
                    mstore8(ptr, byte(mod(value, 10), _SYMBOLS))
                }
                value /= 10;
                if (value == 0) break;
            }
            return buffer;
        }
    }

    /**
     * @dev Converts a `int256` to its ASCII `string` decimal representation.
     */
    function toString(int256 value) internal pure returns (string memory) {
        return string(abi.encodePacked(value < 0 ? "-" : "", toString(SignedMath.abs(value))));
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        unchecked {
            return toHexString(value, Math_0.log256(value) + 1);
        }
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

    /**
     * @dev Converts an `address` with fixed length of 20 bytes to its not checksummed ASCII `string` hexadecimal representation.
     */
    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }

    /**
     * @dev Returns true if the two strings are equal.
     */
    function equal(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/cryptography/ECDSA.sol)

/**
 * @dev Elliptic Curve Digital Signature Algorithm (ECDSA) operations.
 *
 * These functions can be used to verify that a message was signed by the holder
 * of the private keys of a given address.
 */
library ECDSA {
    enum RecoverError {
        NoError,
        InvalidSignature,
        InvalidSignatureLength,
        InvalidSignatureS,
        InvalidSignatureV // Deprecated in v4.8
    }

    function _throwError(RecoverError error) private pure {
        if (error == RecoverError.NoError) {
            return; // no error: do nothing
        } else if (error == RecoverError.InvalidSignature) {
            revert("ECDSA: invalid signature");
        } else if (error == RecoverError.InvalidSignatureLength) {
            revert("ECDSA: invalid signature length");
        } else if (error == RecoverError.InvalidSignatureS) {
            revert("ECDSA: invalid signature 's' value");
        }
    }

    /**
     * @dev Returns the address that signed a hashed message (`hash`) with
     * `signature` or error string. This address can then be used for verification purposes.
     *
     * The `ecrecover` EVM opcode allows for malleable (non-unique) signatures:
     * this function rejects them by requiring the `s` value to be in the lower
     * half order, and the `v` value to be either 27 or 28.
     *
     * IMPORTANT: `hash` _must_ be the result of a hash operation for the
     * verification to be secure: it is possible to craft signatures that
     * recover to arbitrary addresses for non-hashed data. A safe way to ensure
     * this is by receiving a hash of the original message (which may otherwise
     * be too long), and then calling {toEthSignedMessageHash} on it.
     *
     * Documentation for signature generation:
     * - with https://web3js.readthedocs.io/en/v1.3.4/web3-eth-accounts.html#sign[Web3.js]
     * - with https://docs.ethers.io/v5/api/signer/#Signer-signMessage[ethers]
     *
     * _Available since v4.3._
     */
    function tryRecover(bytes32 hash, bytes memory signature) internal pure returns (address, RecoverError) {
        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            // ecrecover takes the signature parameters, and the only way to get them
            // currently is to use assembly.
            /// @solidity memory-safe-assembly
            assembly {
                r := mload(add(signature, 0x20))
                s := mload(add(signature, 0x40))
                v := byte(0, mload(add(signature, 0x60)))
            }
            return tryRecover(hash, v, r, s);
        } else {
            return (address(0), RecoverError.InvalidSignatureLength);
        }
    }

    /**
     * @dev Returns the address that signed a hashed message (`hash`) with
     * `signature`. This address can then be used for verification purposes.
     *
     * The `ecrecover` EVM opcode allows for malleable (non-unique) signatures:
     * this function rejects them by requiring the `s` value to be in the lower
     * half order, and the `v` value to be either 27 or 28.
     *
     * IMPORTANT: `hash` _must_ be the result of a hash operation for the
     * verification to be secure: it is possible to craft signatures that
     * recover to arbitrary addresses for non-hashed data. A safe way to ensure
     * this is by receiving a hash of the original message (which may otherwise
     * be too long), and then calling {toEthSignedMessageHash} on it.
     */
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        (address recovered, RecoverError error) = tryRecover(hash, signature);
        _throwError(error);
        return recovered;
    }

    /**
     * @dev Overload of {ECDSA-tryRecover} that receives the `r` and `vs` short-signature fields separately.
     *
     * See https://eips.ethereum.org/EIPS/eip-2098[EIP-2098 short signatures]
     *
     * _Available since v4.3._
     */
    function tryRecover(bytes32 hash, bytes32 r, bytes32 vs) internal pure returns (address, RecoverError) {
        bytes32 s = vs & bytes32(0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        uint8 v = uint8((uint256(vs) >> 255) + 27);
        return tryRecover(hash, v, r, s);
    }

    /**
     * @dev Overload of {ECDSA-recover} that receives the `r and `vs` short-signature fields separately.
     *
     * _Available since v4.2._
     */
    function recover(bytes32 hash, bytes32 r, bytes32 vs) internal pure returns (address) {
        (address recovered, RecoverError error) = tryRecover(hash, r, vs);
        _throwError(error);
        return recovered;
    }

    /**
     * @dev Overload of {ECDSA-tryRecover} that receives the `v`,
     * `r` and `s` signature fields separately.
     *
     * _Available since v4.3._
     */
    function tryRecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address, RecoverError) {
        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return (address(0), RecoverError.InvalidSignatureS);
        }

        // If the signature is valid (and not malleable), return the signer address
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) {
            return (address(0), RecoverError.InvalidSignature);
        }

        return (signer, RecoverError.NoError);
    }

    /**
     * @dev Overload of {ECDSA-recover} that receives the `v`,
     * `r` and `s` signature fields separately.
     */
    function recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        (address recovered, RecoverError error) = tryRecover(hash, v, r, s);
        _throwError(error);
        return recovered;
    }

    /**
     * @dev Returns an Ethereum Signed Message, created from a `hash`. This
     * produces hash corresponding to the one signed with the
     * https://eth.wiki/json-rpc/API#eth_sign[`eth_sign`]
     * JSON-RPC method as part of EIP-191.
     *
     * See {recover}.
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32 message) {
        // 32 is the length in bytes of hash,
        // enforced by the type signature above
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32")
            mstore(0x1c, hash)
            message := keccak256(0x00, 0x3c)
        }
    }

    /**
     * @dev Returns an Ethereum Signed Message, created from `s`. This
     * produces hash corresponding to the one signed with the
     * https://eth.wiki/json-rpc/API#eth_sign[`eth_sign`]
     * JSON-RPC method as part of EIP-191.
     *
     * See {recover}.
     */
    function toEthSignedMessageHash(bytes memory s) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", Strings.toString(s.length), s));
    }

    /**
     * @dev Returns an Ethereum Signed Typed Data, created from a
     * `domainSeparator` and a `structHash`. This produces hash corresponding
     * to the one signed with the
     * https://eips.ethereum.org/EIPS/eip-712[`eth_signTypedData`]
     * JSON-RPC method as part of EIP-712.
     *
     * See {recover}.
     */
    function toTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32 data) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, "\x19\x01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            data := keccak256(ptr, 0x42)
        }
    }

    /**
     * @dev Returns an Ethereum Signed Data with intended validator, created from a
     * `validator` and `data` according to the version 0 of EIP-191.
     *
     * See {recover}.
     */
    function toDataWithIntendedValidatorHash(address validator, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x00", validator, data));
    }
}

// lib/snowbridge/contracts/src/BeefyClient.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/**
 * @title BeefyClient
 *
 * High-level documentation at https://docs.snowbridge.network/architecture/verification/polkadot
 *
 * To submit new commitments, relayers must call the following methods sequentially:
 * 1. submitInitial: Setup the session for the interactive submission
 * 2. commitPrevRandao: Commit to a random seed for generating a validator subsampling
 * 3. createFinalBitfield: Generate the validator subsampling
 * 4. submitFinal: Complete submission after providing the request validator signatures
 *
 */
contract BeefyClient {
    using Math_1 for uint16;
    using Math_1 for uint256;

    /* Events */

    /**
     * @dev Emitted when the MMR root is updated
     * @param mmrRoot the updated MMR root
     * @param blockNumber the beefy block number of the updated MMR root
     */
    event NewMMRRoot(bytes32 mmrRoot, uint64 blockNumber);

    /**
     * @dev Emitted when a new ticket has been created
     * @param relayer The relayer who created the ticket
     * @param blockNumber the parent block number of the candidate MMR root
     */
    event NewTicket(address relayer, uint64 blockNumber);

    /* Types */

    /**
     * @dev The Commitment, with its payload, is the core thing we are trying to verify with
     * this contract. It contains an MMR root that commits to the polkadot history, including
     * past blocks and parachain blocks and can be used to verify both polkadot and parachain blocks.
     */
    struct Commitment {
        // Relay chain block number
        uint32 blockNumber;
        // ID of the validator set that signed the commitment
        uint64 validatorSetID;
        // The payload of the new commitment in beefy justifications (in
        // our case, this is a new MMR root for all past polkadot blocks)
        PayloadItem[] payload;
    }

    /**
     * @dev Each PayloadItem is a piece of data signed by validators at a particular block.
     */
    struct PayloadItem {
        // An ID that references a description of the data in the payload item.
        // Known payload ids can be found [upstream](https://github.com/paritytech/substrate/blob/fe1f8ba1c4f23931ae89c1ada35efb3d908b50f5/primitives/consensus/beefy/src/payload.rs#L27).
        bytes2 payloadID;
        // The contents of the payload item
        bytes data;
    }

    /**
     * @dev The ValidatorProof is a proof used to verify a commitment signature
     */
    struct ValidatorProof {
        // The parity bit to specify the intended solution
        uint8 v;
        // The x component on the secp256k1 curve
        bytes32 r;
        // The challenge solution
        bytes32 s;
        // Leaf index of the validator address in the merkle tree
        uint256 index;
        // Validator address
        address account;
        // Merkle proof for the validator
        bytes32[] proof;
    }

    /**
     * @dev A ticket tracks working state for the interactive submission of new commitments
     */
    struct Ticket {
        // The block number this ticket was issued
        uint64 blockNumber;
        // Length of the validator set that signed the commitment
        uint32 validatorSetLen;
        // The number of signatures required
        uint32 numRequiredSignatures;
        // The PREVRANDAO seed selected for this ticket session
        uint256 prevRandao;
        // Hash of a bitfield claiming which validators have signed
        bytes32 bitfieldHash;
    }

    /// @dev The MMRLeaf describes the leaf structure of the MMR
    struct MMRLeaf {
        // Version of the leaf type
        uint8 version;
        // Parent number of the block this leaf describes
        uint32 parentNumber;
        // Parent hash of the block this leaf describes
        bytes32 parentHash;
        // Validator set id that will be part of consensus for the next block
        uint64 nextAuthoritySetID;
        // Length of that validator set
        uint32 nextAuthoritySetLen;
        // Merkle root of all public keys in that validator set
        bytes32 nextAuthoritySetRoot;
        // Merkle root of all message commitments in this block
        bytes32 beefyExtraField;
    }

    /**
     * @dev The ValidatorSet describes a BEEFY validator set
     */
    struct ValidatorSet {
        // Identifier for the set
        uint128 id;
        // Number of validators in the set
        uint128 length;
        // Merkle root of BEEFY validator addresses
        bytes32 root;
    }

    /**
     * @dev The ValidatorSetState describes a BEEFY validator set along with signature usage counters
     */
    struct ValidatorSetState {
        // Identifier for the set
        uint128 id;
        // Number of validators in the set
        uint128 length;
        // Merkle root of BEEFY validator addresses
        bytes32 root;
        // Number of times a validator signature has been used
        Uint16Array usageCounters;
    }

    /* State */

    /// @dev The latest verified MMR root
    bytes32 public latestMMRRoot;

    /// @dev The block number in the relay chain in which the latest MMR root was emitted
    uint64 public latestBeefyBlock;

    /// @dev State of the current validator set
    ValidatorSetState public currentValidatorSet;

    /// @dev State of the next validator set
    ValidatorSetState public nextValidatorSet;

    /// @dev Pending tickets for commitment submission
    mapping(bytes32 ticketID => Ticket) public tickets;

    /* Constants */

    /**
     * @dev Beefy payload id for MMR Root payload items:
     * https://github.com/paritytech/substrate/blob/fe1f8ba1c4f23931ae89c1ada35efb3d908b50f5/primitives/consensus/beefy/src/payload.rs#L33
     */
    bytes2 public constant MMR_ROOT_ID = bytes2("mh");

    /**
     * @dev Minimum delay in number of blocks that a relayer must wait between calling
     * submitInitial and commitPrevRandao. In production this should be set to MAX_SEED_LOOKAHEAD:
     * https://eth2book.info/altair/part3/config/preset#max_seed_lookahead
     */
    uint256 public immutable randaoCommitDelay;

    /**
     * @dev after randaoCommitDelay is reached, relayer must
     * call commitPrevRandao within this number of blocks.
     * Without this expiration, relayers can roll the dice infinitely to get the subsampling
     * they desire.
     */
    uint256 public immutable randaoCommitExpiration;

    /**
     * @dev Minimum number of signatures required to validate a new commitment. This parameter
     * is calculated based on `randaoCommitExpiration`. See ~/scripts/beefy_signature_sampling.py
     * for the calculation.
     */
    uint256 public immutable minNumRequiredSignatures;

    /* Errors */
    error InvalidBitfield();
    error InvalidBitfieldLength();
    error InvalidCommitment();
    error InvalidMMRLeaf();
    error InvalidMMRLeafProof();
    error InvalidMMRRootLength();
    error InvalidSignature();
    error InvalidTicket();
    error InvalidValidatorProof();
    error InvalidValidatorProofLength();
    error CommitmentNotRelevant();
    error NotEnoughClaims();
    error PrevRandaoAlreadyCaptured();
    error PrevRandaoNotCaptured();
    error StaleCommitment();
    error TicketExpired();
    error WaitPeriodNotOver();

    constructor(
        uint256 _randaoCommitDelay,
        uint256 _randaoCommitExpiration,
        uint256 _minNumRequiredSignatures,
        uint64 _initialBeefyBlock,
        ValidatorSet memory _initialValidatorSet,
        ValidatorSet memory _nextValidatorSet
    ) {
        if (_nextValidatorSet.id != _initialValidatorSet.id + 1) {
            revert("invalid-constructor-params");
        }
        randaoCommitDelay = _randaoCommitDelay;
        randaoCommitExpiration = _randaoCommitExpiration;
        minNumRequiredSignatures = _minNumRequiredSignatures;
        latestBeefyBlock = _initialBeefyBlock;
        currentValidatorSet.id = _initialValidatorSet.id;
        currentValidatorSet.length = _initialValidatorSet.length;
        currentValidatorSet.root = _initialValidatorSet.root;
        currentValidatorSet.usageCounters = createUint16Array(currentValidatorSet.length);
        nextValidatorSet.id = _nextValidatorSet.id;
        nextValidatorSet.length = _nextValidatorSet.length;
        nextValidatorSet.root = _nextValidatorSet.root;
        nextValidatorSet.usageCounters = createUint16Array(nextValidatorSet.length);
    }

    /* External Functions */

    /**
     * @dev Begin submission of commitment
     * @param commitment contains the commitment signed by the validators
     * @param bitfield a bitfield claiming which validators have signed the commitment
     * @param proof a proof that a single validator from currentValidatorSet has signed the commitment
     */
    function submitInitial(
        Commitment calldata commitment,
        uint256[] calldata bitfield,
        ValidatorProof calldata proof
    ) external {
        if (commitment.blockNumber <= latestBeefyBlock) {
            revert StaleCommitment();
        }

        ValidatorSetState storage vset;
        uint16 signatureUsageCount;
        if (commitment.validatorSetID == currentValidatorSet.id) {
            signatureUsageCount = currentValidatorSet.usageCounters.get(proof.index);
            currentValidatorSet.usageCounters.set(
                proof.index, signatureUsageCount.saturatingAdd(1)
            );
            vset = currentValidatorSet;
        } else if (commitment.validatorSetID == nextValidatorSet.id) {
            signatureUsageCount = nextValidatorSet.usageCounters.get(proof.index);
            nextValidatorSet.usageCounters.set(proof.index, signatureUsageCount.saturatingAdd(1));
            vset = nextValidatorSet;
        } else {
            revert InvalidCommitment();
        }

        // Check if merkle proof is valid based on the validatorSetRoot and if proof is included in bitfield
        if (
            !isValidatorInSet(vset, proof.account, proof.index, proof.proof)
                || !Bitfield.isSet(bitfield, proof.index)
        ) {
            revert InvalidValidatorProof();
        }

        // Check if validatorSignature is correct, ie. check if it matches
        // the signature of senderPublicKey on the commitmentHash
        bytes32 commitmentHash = keccak256(encodeCommitment(commitment));
        if (ECDSA.recover(commitmentHash, proof.v, proof.r, proof.s) != proof.account) {
            revert InvalidSignature();
        }

        // For the initial submission, the supplied bitfield should claim that more than
        // two thirds of the validator set have sign the commitment
        if (Bitfield.countSetBits(bitfield) < computeQuorum(vset.length)) {
            revert NotEnoughClaims();
        }

        tickets[createTicketID(msg.sender, commitmentHash)] = Ticket({
            blockNumber: uint64(block.number),
            validatorSetLen: uint32(vset.length),
            numRequiredSignatures: uint32(
                computeNumRequiredSignatures(
                    vset.length, signatureUsageCount, minNumRequiredSignatures
                )
            ),
            prevRandao: 0,
            bitfieldHash: keccak256(abi.encodePacked(bitfield))
        });

        emit NewTicket(msg.sender, commitment.blockNumber);
    }

    /**
     * @dev Capture PREVRANDAO
     * @param commitmentHash contains the commitmentHash signed by the validators
     */
    function commitPrevRandao(bytes32 commitmentHash) external {
        bytes32 ticketID = createTicketID(msg.sender, commitmentHash);
        Ticket storage ticket = tickets[ticketID];

        if (ticket.blockNumber == 0) {
            revert InvalidTicket();
        }

        if (ticket.prevRandao != 0) {
            revert PrevRandaoAlreadyCaptured();
        }

        // relayer must wait `randaoCommitDelay` blocks
        if (block.number < ticket.blockNumber + randaoCommitDelay) {
            revert WaitPeriodNotOver();
        }

        // relayer can capture within `randaoCommitExpiration` blocks
        if (block.number > ticket.blockNumber + randaoCommitDelay + randaoCommitExpiration) {
            delete tickets[ticketID];
            revert TicketExpired();
        }

        // Post-merge, the difficulty opcode now returns PREVRANDAO
        ticket.prevRandao = block.prevrandao;
    }

    /**
     * @dev Submit a commitment and leaf for final verification
     * @param commitment contains the full commitment that was used for the commitmentHash
     * @param bitfield claiming which validators have signed the commitment
     * @param proofs a struct containing the data needed to verify all validator signatures
     * @param leaf an MMR leaf provable using the MMR root in the commitment payload
     * @param leafProof an MMR leaf proof
     * @param leafProofOrder a bitfield describing the order of each item (left vs right)
     */
    function submitFinal(
        Commitment calldata commitment,
        uint256[] calldata bitfield,
        ValidatorProof[] calldata proofs,
        MMRLeaf calldata leaf,
        bytes32[] calldata leafProof,
        uint256 leafProofOrder
    ) external {
        bytes32 commitmentHash = keccak256(encodeCommitment(commitment));
        bytes32 ticketID = createTicketID(msg.sender, commitmentHash);
        validateTicket(ticketID, commitment, bitfield);

        bool is_next_session = false;
        ValidatorSetState storage vset;
        if (commitment.validatorSetID == nextValidatorSet.id) {
            is_next_session = true;
            vset = nextValidatorSet;
        } else if (commitment.validatorSetID == currentValidatorSet.id) {
            vset = currentValidatorSet;
        } else {
            revert InvalidCommitment();
        }

        verifyCommitment(commitmentHash, ticketID, bitfield, vset, proofs);

        bytes32 newMMRRoot = ensureProvidesMMRRoot(commitment);

        if (is_next_session) {
            if (leaf.nextAuthoritySetID != nextValidatorSet.id + 1) {
                revert InvalidMMRLeaf();
            }
            bool leafIsValid = MMRProof.verifyLeafProof(
                newMMRRoot, keccak256(encodeMMRLeaf(leaf)), leafProof, leafProofOrder
            );
            if (!leafIsValid) {
                revert InvalidMMRLeafProof();
            }
            currentValidatorSet = nextValidatorSet;
            nextValidatorSet.id = leaf.nextAuthoritySetID;
            nextValidatorSet.length = leaf.nextAuthoritySetLen;
            nextValidatorSet.root = leaf.nextAuthoritySetRoot;
            nextValidatorSet.usageCounters = createUint16Array(leaf.nextAuthoritySetLen);
        }

        latestMMRRoot = newMMRRoot;
        latestBeefyBlock = commitment.blockNumber;
        delete tickets[ticketID];

        emit NewMMRRoot(newMMRRoot, commitment.blockNumber);
    }

    /**
     * @dev Verify that the supplied MMR leaf is included in the latest verified MMR root.
     * @param leafHash contains the merkle leaf to be verified
     * @param proof contains simplified mmr proof
     * @param proofOrder a bitfield describing the order of each item (left vs right)
     */
    function verifyMMRLeafProof(bytes32 leafHash, bytes32[] calldata proof, uint256 proofOrder)
        external
        view
        returns (bool)
    {
        return MMRProof.verifyLeafProof(latestMMRRoot, leafHash, proof, proofOrder);
    }

    /**
     * @dev Helper to create an initial validator bitfield.
     * @param bitsToSet contains indexes of all signed validators, should be deduplicated
     * @param length of validator set
     */
    function createInitialBitfield(uint256[] calldata bitsToSet, uint256 length)
        external
        pure
        returns (uint256[] memory)
    {
        if (length < bitsToSet.length) {
            revert InvalidBitfieldLength();
        }
        return Bitfield.createBitfield(bitsToSet, length);
    }

    /**
     * @dev Helper to create a final bitfield, with subsampled validator selections
     * @param commitmentHash contains the commitmentHash signed by the validators
     * @param bitfield claiming which validators have signed the commitment
     */
    function createFinalBitfield(bytes32 commitmentHash, uint256[] calldata bitfield)
        external
        view
        returns (uint256[] memory)
    {
        Ticket storage ticket = tickets[createTicketID(msg.sender, commitmentHash)];
        if (ticket.bitfieldHash != keccak256(abi.encodePacked(bitfield))) {
            revert InvalidBitfield();
        }
        return Bitfield.subsample(
            ticket.prevRandao, bitfield, ticket.numRequiredSignatures, ticket.validatorSetLen
        );
    }

    /* Internal Functions */

    // Creates a unique ticket ID for a new interactive prover-verifier session
    function createTicketID(address account, bytes32 commitmentHash)
        internal
        pure
        returns (bytes32 value)
    {
        assembly {
            mstore(0x00, account)
            mstore(0x20, commitmentHash)
            value := keccak256(0x0, 0x40)
        }
    }

    /**
     * @dev Calculates the number of required signatures for `submitFinal`.
     * @param validatorSetLen The length of the validator set
     * @param signatureUsageCount A counter of the number of times the validator signature was previously used in a call to `submitInitial` within the session.
     * @param minRequiredSignatures The minimum amount of signatures to verify
     */
    // For more details on the calculation, read the following:
    // 1. https://docs.snowbridge.network/architecture/verification/polkadot#signature-sampling
    // 2. https://hackmd.io/9OedC7icR5m-in_moUZ_WQ
    function computeNumRequiredSignatures(
        uint256 validatorSetLen,
        uint256 signatureUsageCount,
        uint256 minRequiredSignatures
    ) internal pure returns (uint256) {
        // Start with the minimum number of signatures.
        uint256 numRequiredSignatures = minRequiredSignatures;
        // Add signatures based on the number of validators in the validator set.
        numRequiredSignatures += Math_1.log2(validatorSetLen, Math_1.Rounding.Ceil);
        // Add signatures based on the signature usage count.
        numRequiredSignatures += 1 + (2 * Math_1.log2(signatureUsageCount, Math_1.Rounding.Ceil));
        // Never require more signatures than a 2/3 majority
        return Math_1.min(numRequiredSignatures, computeQuorum(validatorSetLen));
    }

    /**
     * @dev Calculates 2/3 majority required for quorum for a given number of validators.
     * @param numValidators The number of validators in the validator set.
     */
    function computeQuorum(uint256 numValidators) internal pure returns (uint256) {
        return numValidators - (numValidators - 1) / 3;
    }

    /**
     * @dev Verify commitment using the supplied signature proofs
     */
    function verifyCommitment(
        bytes32 commitmentHash,
        bytes32 ticketID,
        uint256[] calldata bitfield,
        ValidatorSetState storage vset,
        ValidatorProof[] calldata proofs
    ) internal view {
        Ticket storage ticket = tickets[ticketID];
        // Verify that enough signature proofs have been supplied
        uint256 numRequiredSignatures = ticket.numRequiredSignatures;
        if (proofs.length != numRequiredSignatures) {
            revert InvalidValidatorProofLength();
        }

        // Generate final bitfield indicating which validators need to be included in the proofs.
        uint256[] memory finalbitfield =
            Bitfield.subsample(ticket.prevRandao, bitfield, numRequiredSignatures, vset.length);

        for (uint256 i = 0; i < proofs.length; i++) {
            ValidatorProof calldata proof = proofs[i];

            // Check that validator is in bitfield
            if (!Bitfield.isSet(finalbitfield, proof.index)) {
                revert InvalidValidatorProof();
            }

            // Check that validator is actually in a validator set
            if (!isValidatorInSet(vset, proof.account, proof.index, proof.proof)) {
                revert InvalidValidatorProof();
            }

            // Check that validator signed the commitment
            if (ECDSA.recover(commitmentHash, proof.v, proof.r, proof.s) != proof.account) {
                revert InvalidSignature();
            }

            // Ensure no validator can appear more than once in bitfield
            Bitfield.unset(finalbitfield, proof.index);
        }
    }

    // Ensure that the commitment provides a new MMR root
    function ensureProvidesMMRRoot(Commitment calldata commitment)
        internal
        pure
        returns (bytes32)
    {
        for (uint256 i = 0; i < commitment.payload.length; i++) {
            if (commitment.payload[i].payloadID == MMR_ROOT_ID) {
                if (commitment.payload[i].data.length != 32) {
                    revert InvalidMMRRootLength();
                } else {
                    return bytes32(commitment.payload[i].data);
                }
            }
        }
        revert CommitmentNotRelevant();
    }

    function encodeCommitment(Commitment calldata commitment)
        internal
        pure
        returns (bytes memory)
    {
        return bytes.concat(
            encodeCommitmentPayload(commitment.payload),
            ScaleCodec.encodeU32(commitment.blockNumber),
            ScaleCodec.encodeU64(commitment.validatorSetID)
        );
    }

    function encodeCommitmentPayload(PayloadItem[] calldata items)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory payload = ScaleCodec.checkedEncodeCompactU32(items.length);
        for (uint256 i = 0; i < items.length; i++) {
            payload = bytes.concat(
                payload,
                items[i].payloadID,
                ScaleCodec.checkedEncodeCompactU32(items[i].data.length),
                items[i].data
            );
        }

        return payload;
    }

    function encodeMMRLeaf(MMRLeaf calldata leaf) internal pure returns (bytes memory) {
        return bytes.concat(
            ScaleCodec.encodeU8(leaf.version),
            ScaleCodec.encodeU32(leaf.parentNumber),
            leaf.parentHash,
            ScaleCodec.encodeU64(leaf.nextAuthoritySetID),
            ScaleCodec.encodeU32(leaf.nextAuthoritySetLen),
            leaf.nextAuthoritySetRoot,
            leaf.beefyExtraField
        );
    }

    /**
     * @dev Checks if a validators address is a member of the merkle tree
     * @param vset The validator set
     * @param account The address of the validator to check for inclusion in `vset`.
     * @param index The leaf index of the account in the merkle tree of validator set addresses.
     * @param proof Merkle proof required for validation of the address
     * @return true if the validator is in the set
     */
    function isValidatorInSet(
        ValidatorSetState storage vset,
        address account,
        uint256 index,
        bytes32[] calldata proof
    ) internal view returns (bool) {
        bytes32 hashedLeaf = keccak256(abi.encodePacked(account));
        return SubstrateMerkleProof.verify(vset.root, hashedLeaf, index, vset.length, proof);
    }

    /**
     * @dev Basic validation of a ticket for submitFinal
     */
    function validateTicket(
        bytes32 ticketID,
        Commitment calldata commitment,
        uint256[] calldata bitfield
    ) internal view {
        Ticket storage ticket = tickets[ticketID];

        if (ticket.blockNumber == 0) {
            // submitInitial hasn't been called yet
            revert InvalidTicket();
        }

        if (ticket.prevRandao == 0) {
            // commitPrevRandao hasn't been called yet
            revert PrevRandaoNotCaptured();
        }

        if (commitment.blockNumber <= latestBeefyBlock) {
            // ticket is obsolete
            revert StaleCommitment();
        }

        if (ticket.bitfieldHash != keccak256(abi.encodePacked(bitfield))) {
            // The provided claims bitfield isn't the same one that was
            // passed to submitInitial
            revert InvalidBitfield();
        }
    }
}

