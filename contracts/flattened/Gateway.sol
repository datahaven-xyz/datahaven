// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.28 >=0.8.19 ^0.8.0;

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol

// OpenZeppelin Contracts (last updated v4.9.2) (utils/cryptography/MerkleProof.sol)

/**
 * @dev These functions deal with verification of Merkle Tree proofs.
 *
 * The tree and the proofs can be generated using our
 * https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
 * You will find a quickstart guide in the readme.
 *
 * WARNING: You should avoid using leaf values that are 64 bytes long prior to
 * hashing, or use a hash function other than keccak256 for hashing leaves.
 * This is because the concatenation of a sorted pair of internal nodes in
 * the merkle tree could be reinterpreted as a leaf value.
 * OpenZeppelin's JavaScript library generates merkle trees that are safe
 * against this attack out of the box.
 */
library MerkleProof {
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     */
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    /**
     * @dev Calldata version of {verify}
     *
     * _Available since v4.7._
     */
    function verifyCalldata(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProofCalldata(proof, leaf) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leafs & pre-images are assumed to be sorted.
     *
     * _Available since v4.4._
     */
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = _hashPair(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Calldata version of {processProof}
     *
     * _Available since v4.7._
     */
    function processProofCalldata(bytes32[] calldata proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = _hashPair(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProof(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Calldata version of {multiProofVerify}
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * CAUTION: Not all merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * _Available since v4.7._
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofLen = proof.length;
        uint256 totalHashes = proofFlags.length;

        // Check proof validity.
        require(leavesLen + proofLen - 1 == totalHashes, "MerkleProof: invalid multiproof");

        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < totalHashes; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = _hashPair(a, b);
        }

        if (totalHashes > 0) {
            require(proofPos == proofLen, "MerkleProof: invalid multiproof");
            unchecked {
                return hashes[totalHashes - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Calldata version of {processMultiProof}.
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofLen = proof.length;
        uint256 totalHashes = proofFlags.length;

        // Check proof validity.
        require(leavesLen + proofLen - 1 == totalHashes, "MerkleProof: invalid multiproof");

        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < totalHashes; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = _hashPair(a, b);
        }

        if (totalHashes > 0) {
            require(proofPos == proofLen, "MerkleProof: invalid multiproof");
            unchecked {
                return hashes[totalHashes - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? _efficientHash(a, b) : _efficientHash(b, a);
    }

    function _efficientHash(bytes32 a, bytes32 b) private pure returns (bytes32 value) {
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}

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

// lib/snowbridge/contracts/lib/prb-math/src/Common.sol

// Common.sol
//
// Common mathematical functions needed by both SD59x18 and UD60x18. Note that these global functions do not
// always operate with SD59x18 and UD60x18 numbers.

/*//////////////////////////////////////////////////////////////////////////
                                CUSTOM ERRORS
//////////////////////////////////////////////////////////////////////////*/

/// @notice Thrown when the resultant value in {mulDiv} overflows uint256.
error PRBMath_MulDiv_Overflow(uint256 x, uint256 y, uint256 denominator);

/// @notice Thrown when the resultant value in {mulDiv18} overflows uint256.
error PRBMath_MulDiv18_Overflow(uint256 x, uint256 y);

/// @notice Thrown when one of the inputs passed to {mulDivSigned} is `type(int256).min`.
error PRBMath_MulDivSigned_InputTooSmall();

/// @notice Thrown when the resultant value in {mulDivSigned} overflows int256.
error PRBMath_MulDivSigned_Overflow(int256 x, int256 y);

/*//////////////////////////////////////////////////////////////////////////
                                    CONSTANTS
//////////////////////////////////////////////////////////////////////////*/

/// @dev The maximum value a uint128 number can have.
uint128 constant MAX_UINT128 = type(uint128).max;

/// @dev The maximum value a uint40 number can have.
uint40 constant MAX_UINT40 = type(uint40).max;

/// @dev The unit number, which the decimal precision of the fixed-point types.
uint256 constant UNIT_0 = 1e18;

/// @dev The unit number inverted mod 2^256.
uint256 constant UNIT_INVERSE = 78156646155174841979727994598816262306175212592076161876661_508869554232690281;

/// @dev The the largest power of two that divides the decimal value of `UNIT`. The logarithm of this value is the least significant
/// bit in the binary representation of `UNIT`.
uint256 constant UNIT_LPOTD = 262144;

/*//////////////////////////////////////////////////////////////////////////
                                    FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

/// @notice Calculates the binary exponent of x using the binary fraction method.
/// @dev Has to use 192.64-bit fixed-point numbers. See https://ethereum.stackexchange.com/a/96594/24693.
/// @param x The exponent as an unsigned 192.64-bit fixed-point number.
/// @return result The result as an unsigned 60.18-decimal fixed-point number.
/// @custom:smtchecker abstract-function-nondet
function exp2_0(uint256 x) pure returns (uint256 result) {
    unchecked {
        // Start from 0.5 in the 192.64-bit fixed-point format.
        result = 0x800000000000000000000000000000000000000000000000;

        // The following logic multiplies the result by $\sqrt{2^{-i}}$ when the bit at position i is 1. Key points:
        //
        // 1. Intermediate results will not overflow, as the starting point is 2^191 and all magic factors are under 2^65.
        // 2. The rationale for organizing the if statements into groups of 8 is gas savings. If the result of performing
        // a bitwise AND operation between x and any value in the array [0x80; 0x40; 0x20; 0x10; 0x08; 0x04; 0x02; 0x01] is 1,
        // we know that `x & 0xFF` is also 1.
        if (x & 0xFF00000000000000 > 0) {
            if (x & 0x8000000000000000 > 0) {
                result = (result * 0x16A09E667F3BCC909) >> 64;
            }
            if (x & 0x4000000000000000 > 0) {
                result = (result * 0x1306FE0A31B7152DF) >> 64;
            }
            if (x & 0x2000000000000000 > 0) {
                result = (result * 0x1172B83C7D517ADCE) >> 64;
            }
            if (x & 0x1000000000000000 > 0) {
                result = (result * 0x10B5586CF9890F62A) >> 64;
            }
            if (x & 0x800000000000000 > 0) {
                result = (result * 0x1059B0D31585743AE) >> 64;
            }
            if (x & 0x400000000000000 > 0) {
                result = (result * 0x102C9A3E778060EE7) >> 64;
            }
            if (x & 0x200000000000000 > 0) {
                result = (result * 0x10163DA9FB33356D8) >> 64;
            }
            if (x & 0x100000000000000 > 0) {
                result = (result * 0x100B1AFA5ABCBED61) >> 64;
            }
        }

        if (x & 0xFF000000000000 > 0) {
            if (x & 0x80000000000000 > 0) {
                result = (result * 0x10058C86DA1C09EA2) >> 64;
            }
            if (x & 0x40000000000000 > 0) {
                result = (result * 0x1002C605E2E8CEC50) >> 64;
            }
            if (x & 0x20000000000000 > 0) {
                result = (result * 0x100162F3904051FA1) >> 64;
            }
            if (x & 0x10000000000000 > 0) {
                result = (result * 0x1000B175EFFDC76BA) >> 64;
            }
            if (x & 0x8000000000000 > 0) {
                result = (result * 0x100058BA01FB9F96D) >> 64;
            }
            if (x & 0x4000000000000 > 0) {
                result = (result * 0x10002C5CC37DA9492) >> 64;
            }
            if (x & 0x2000000000000 > 0) {
                result = (result * 0x1000162E525EE0547) >> 64;
            }
            if (x & 0x1000000000000 > 0) {
                result = (result * 0x10000B17255775C04) >> 64;
            }
        }

        if (x & 0xFF0000000000 > 0) {
            if (x & 0x800000000000 > 0) {
                result = (result * 0x1000058B91B5BC9AE) >> 64;
            }
            if (x & 0x400000000000 > 0) {
                result = (result * 0x100002C5C89D5EC6D) >> 64;
            }
            if (x & 0x200000000000 > 0) {
                result = (result * 0x10000162E43F4F831) >> 64;
            }
            if (x & 0x100000000000 > 0) {
                result = (result * 0x100000B1721BCFC9A) >> 64;
            }
            if (x & 0x80000000000 > 0) {
                result = (result * 0x10000058B90CF1E6E) >> 64;
            }
            if (x & 0x40000000000 > 0) {
                result = (result * 0x1000002C5C863B73F) >> 64;
            }
            if (x & 0x20000000000 > 0) {
                result = (result * 0x100000162E430E5A2) >> 64;
            }
            if (x & 0x10000000000 > 0) {
                result = (result * 0x1000000B172183551) >> 64;
            }
        }

        if (x & 0xFF00000000 > 0) {
            if (x & 0x8000000000 > 0) {
                result = (result * 0x100000058B90C0B49) >> 64;
            }
            if (x & 0x4000000000 > 0) {
                result = (result * 0x10000002C5C8601CC) >> 64;
            }
            if (x & 0x2000000000 > 0) {
                result = (result * 0x1000000162E42FFF0) >> 64;
            }
            if (x & 0x1000000000 > 0) {
                result = (result * 0x10000000B17217FBB) >> 64;
            }
            if (x & 0x800000000 > 0) {
                result = (result * 0x1000000058B90BFCE) >> 64;
            }
            if (x & 0x400000000 > 0) {
                result = (result * 0x100000002C5C85FE3) >> 64;
            }
            if (x & 0x200000000 > 0) {
                result = (result * 0x10000000162E42FF1) >> 64;
            }
            if (x & 0x100000000 > 0) {
                result = (result * 0x100000000B17217F8) >> 64;
            }
        }

        if (x & 0xFF000000 > 0) {
            if (x & 0x80000000 > 0) {
                result = (result * 0x10000000058B90BFC) >> 64;
            }
            if (x & 0x40000000 > 0) {
                result = (result * 0x1000000002C5C85FE) >> 64;
            }
            if (x & 0x20000000 > 0) {
                result = (result * 0x100000000162E42FF) >> 64;
            }
            if (x & 0x10000000 > 0) {
                result = (result * 0x1000000000B17217F) >> 64;
            }
            if (x & 0x8000000 > 0) {
                result = (result * 0x100000000058B90C0) >> 64;
            }
            if (x & 0x4000000 > 0) {
                result = (result * 0x10000000002C5C860) >> 64;
            }
            if (x & 0x2000000 > 0) {
                result = (result * 0x1000000000162E430) >> 64;
            }
            if (x & 0x1000000 > 0) {
                result = (result * 0x10000000000B17218) >> 64;
            }
        }

        if (x & 0xFF0000 > 0) {
            if (x & 0x800000 > 0) {
                result = (result * 0x1000000000058B90C) >> 64;
            }
            if (x & 0x400000 > 0) {
                result = (result * 0x100000000002C5C86) >> 64;
            }
            if (x & 0x200000 > 0) {
                result = (result * 0x10000000000162E43) >> 64;
            }
            if (x & 0x100000 > 0) {
                result = (result * 0x100000000000B1721) >> 64;
            }
            if (x & 0x80000 > 0) {
                result = (result * 0x10000000000058B91) >> 64;
            }
            if (x & 0x40000 > 0) {
                result = (result * 0x1000000000002C5C8) >> 64;
            }
            if (x & 0x20000 > 0) {
                result = (result * 0x100000000000162E4) >> 64;
            }
            if (x & 0x10000 > 0) {
                result = (result * 0x1000000000000B172) >> 64;
            }
        }

        if (x & 0xFF00 > 0) {
            if (x & 0x8000 > 0) {
                result = (result * 0x100000000000058B9) >> 64;
            }
            if (x & 0x4000 > 0) {
                result = (result * 0x10000000000002C5D) >> 64;
            }
            if (x & 0x2000 > 0) {
                result = (result * 0x1000000000000162E) >> 64;
            }
            if (x & 0x1000 > 0) {
                result = (result * 0x10000000000000B17) >> 64;
            }
            if (x & 0x800 > 0) {
                result = (result * 0x1000000000000058C) >> 64;
            }
            if (x & 0x400 > 0) {
                result = (result * 0x100000000000002C6) >> 64;
            }
            if (x & 0x200 > 0) {
                result = (result * 0x10000000000000163) >> 64;
            }
            if (x & 0x100 > 0) {
                result = (result * 0x100000000000000B1) >> 64;
            }
        }

        if (x & 0xFF > 0) {
            if (x & 0x80 > 0) {
                result = (result * 0x10000000000000059) >> 64;
            }
            if (x & 0x40 > 0) {
                result = (result * 0x1000000000000002C) >> 64;
            }
            if (x & 0x20 > 0) {
                result = (result * 0x10000000000000016) >> 64;
            }
            if (x & 0x10 > 0) {
                result = (result * 0x1000000000000000B) >> 64;
            }
            if (x & 0x8 > 0) {
                result = (result * 0x10000000000000006) >> 64;
            }
            if (x & 0x4 > 0) {
                result = (result * 0x10000000000000003) >> 64;
            }
            if (x & 0x2 > 0) {
                result = (result * 0x10000000000000001) >> 64;
            }
            if (x & 0x1 > 0) {
                result = (result * 0x10000000000000001) >> 64;
            }
        }

        // In the code snippet below, two operations are executed simultaneously:
        //
        // 1. The result is multiplied by $(2^n + 1)$, where $2^n$ represents the integer part, and the additional 1
        // accounts for the initial guess of 0.5. This is achieved by subtracting from 191 instead of 192.
        // 2. The result is then converted to an unsigned 60.18-decimal fixed-point format.
        //
        // The underlying logic is based on the relationship $2^{191-ip} = 2^{ip} / 2^{191}$, where $ip$ denotes the,
        // integer part, $2^n$.
        result *= UNIT_0;
        result >>= (191 - (x >> 64));
    }
}

/// @notice Finds the zero-based index of the first 1 in the binary representation of x.
///
/// @dev See the note on "msb" in this Wikipedia article: https://en.wikipedia.org/wiki/Find_first_set
///
/// Each step in this implementation is equivalent to this high-level code:
///
/// ```solidity
/// if (x >= 2 ** 128) {
///     x >>= 128;
///     result += 128;
/// }
/// ```
///
/// Where 128 is replaced with each respective power of two factor. See the full high-level implementation here:
/// https://gist.github.com/PaulRBerg/f932f8693f2733e30c4d479e8e980948
///
/// The Yul instructions used below are:
///
/// - "gt" is "greater than"
/// - "or" is the OR bitwise operator
/// - "shl" is "shift left"
/// - "shr" is "shift right"
///
/// @param x The uint256 number for which to find the index of the most significant bit.
/// @return result The index of the most significant bit as a uint256.
/// @custom:smtchecker abstract-function-nondet
function msb(uint256 x) pure returns (uint256 result) {
    // 2^128
    assembly ("memory-safe") {
        let factor := shl(7, gt(x, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^64
    assembly ("memory-safe") {
        let factor := shl(6, gt(x, 0xFFFFFFFFFFFFFFFF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^32
    assembly ("memory-safe") {
        let factor := shl(5, gt(x, 0xFFFFFFFF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^16
    assembly ("memory-safe") {
        let factor := shl(4, gt(x, 0xFFFF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^8
    assembly ("memory-safe") {
        let factor := shl(3, gt(x, 0xFF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^4
    assembly ("memory-safe") {
        let factor := shl(2, gt(x, 0xF))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^2
    assembly ("memory-safe") {
        let factor := shl(1, gt(x, 0x3))
        x := shr(factor, x)
        result := or(result, factor)
    }
    // 2^1
    // No need to shift x any more.
    assembly ("memory-safe") {
        let factor := gt(x, 0x1)
        result := or(result, factor)
    }
}

/// @notice Calculates x*y÷denominator with 512-bit precision.
///
/// @dev Credits to Remco Bloemen under MIT license https://xn--2-umb.com/21/muldiv.
///
/// Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - The denominator must not be zero.
/// - The result must fit in uint256.
///
/// @param x The multiplicand as a uint256.
/// @param y The multiplier as a uint256.
/// @param denominator The divisor as a uint256.
/// @return result The result as a uint256.
/// @custom:smtchecker abstract-function-nondet
function mulDiv(uint256 x, uint256 y, uint256 denominator) pure returns (uint256 result) {
    // 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1, then use
    // use the Chinese Remainder Theorem to reconstruct the 512-bit result. The result is stored in two 256
    // variables such that product = prod1 * 2^256 + prod0.
    uint256 prod0; // Least significant 256 bits of the product
    uint256 prod1; // Most significant 256 bits of the product
    assembly ("memory-safe") {
        let mm := mulmod(x, y, not(0))
        prod0 := mul(x, y)
        prod1 := sub(sub(mm, prod0), lt(mm, prod0))
    }

    // Handle non-overflow cases, 256 by 256 division.
    if (prod1 == 0) {
        unchecked {
            return prod0 / denominator;
        }
    }

    // Make sure the result is less than 2^256. Also prevents denominator == 0.
    if (prod1 >= denominator) {
        revert PRBMath_MulDiv_Overflow(x, y, denominator);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 512 by 256 division
    ////////////////////////////////////////////////////////////////////////////

    // Make division exact by subtracting the remainder from [prod1 prod0].
    uint256 remainder;
    assembly ("memory-safe") {
        // Compute remainder using the mulmod Yul instruction.
        remainder := mulmod(x, y, denominator)

        // Subtract 256 bit number from 512-bit number.
        prod1 := sub(prod1, gt(remainder, prod0))
        prod0 := sub(prod0, remainder)
    }

    unchecked {
        // Calculate the largest power of two divisor of the denominator using the unary operator ~. This operation cannot overflow
        // because the denominator cannot be zero at this point in the function execution. The result is always >= 1.
        // For more detail, see https://cs.stackexchange.com/q/138556/92363.
        uint256 lpotdod = denominator & (~denominator + 1);
        uint256 flippedLpotdod;

        assembly ("memory-safe") {
            // Factor powers of two out of denominator.
            denominator := div(denominator, lpotdod)

            // Divide [prod1 prod0] by lpotdod.
            prod0 := div(prod0, lpotdod)

            // Get the flipped value `2^256 / lpotdod`. If the `lpotdod` is zero, the flipped value is one.
            // `sub(0, lpotdod)` produces the two's complement version of `lpotdod`, which is equivalent to flipping all the bits.
            // However, `div` interprets this value as an unsigned value: https://ethereum.stackexchange.com/q/147168/24693
            flippedLpotdod := add(div(sub(0, lpotdod), lpotdod), 1)
        }

        // Shift in bits from prod1 into prod0.
        prod0 |= prod1 * flippedLpotdod;

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
    }
}

/// @notice Calculates x*y÷1e18 with 512-bit precision.
///
/// @dev A variant of {mulDiv} with constant folding, i.e. in which the denominator is hard coded to 1e18.
///
/// Notes:
/// - The body is purposely left uncommented; to understand how this works, see the documentation in {mulDiv}.
/// - The result is rounded toward zero.
/// - We take as an axiom that the result cannot be `MAX_UINT256` when x and y solve the following system of equations:
///
/// $$
/// \begin{cases}
///     x * y = MAX\_UINT256 * UNIT \\
///     (x * y) \% UNIT \geq \frac{UNIT}{2}
/// \end{cases}
/// $$
///
/// Requirements:
/// - Refer to the requirements in {mulDiv}.
/// - The result must fit in uint256.
///
/// @param x The multiplicand as an unsigned 60.18-decimal fixed-point number.
/// @param y The multiplier as an unsigned 60.18-decimal fixed-point number.
/// @return result The result as an unsigned 60.18-decimal fixed-point number.
/// @custom:smtchecker abstract-function-nondet
function mulDiv18(uint256 x, uint256 y) pure returns (uint256 result) {
    uint256 prod0;
    uint256 prod1;
    assembly ("memory-safe") {
        let mm := mulmod(x, y, not(0))
        prod0 := mul(x, y)
        prod1 := sub(sub(mm, prod0), lt(mm, prod0))
    }

    if (prod1 == 0) {
        unchecked {
            return prod0 / UNIT_0;
        }
    }

    if (prod1 >= UNIT_0) {
        revert PRBMath_MulDiv18_Overflow(x, y);
    }

    uint256 remainder;
    assembly ("memory-safe") {
        remainder := mulmod(x, y, UNIT_0)
        result :=
            mul(
                or(
                    div(sub(prod0, remainder), UNIT_LPOTD),
                    mul(sub(prod1, gt(remainder, prod0)), add(div(sub(0, UNIT_LPOTD), UNIT_LPOTD), 1))
                ),
                UNIT_INVERSE
            )
    }
}

/// @notice Calculates x*y÷denominator with 512-bit precision.
///
/// @dev This is an extension of {mulDiv} for signed numbers, which works by computing the signs and the absolute values separately.
///
/// Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - Refer to the requirements in {mulDiv}.
/// - None of the inputs can be `type(int256).min`.
/// - The result must fit in int256.
///
/// @param x The multiplicand as an int256.
/// @param y The multiplier as an int256.
/// @param denominator The divisor as an int256.
/// @return result The result as an int256.
/// @custom:smtchecker abstract-function-nondet
function mulDivSigned(int256 x, int256 y, int256 denominator) pure returns (int256 result) {
    if (x == type(int256).min || y == type(int256).min || denominator == type(int256).min) {
        revert PRBMath_MulDivSigned_InputTooSmall();
    }

    // Get hold of the absolute values of x, y and the denominator.
    uint256 xAbs;
    uint256 yAbs;
    uint256 dAbs;
    unchecked {
        xAbs = x < 0 ? uint256(-x) : uint256(x);
        yAbs = y < 0 ? uint256(-y) : uint256(y);
        dAbs = denominator < 0 ? uint256(-denominator) : uint256(denominator);
    }

    // Compute the absolute value of x*y÷denominator. The result must fit in int256.
    uint256 resultAbs = mulDiv(xAbs, yAbs, dAbs);
    if (resultAbs > uint256(type(int256).max)) {
        revert PRBMath_MulDivSigned_Overflow(x, y);
    }

    // Get the signs of x, y and the denominator.
    uint256 sx;
    uint256 sy;
    uint256 sd;
    assembly ("memory-safe") {
        // "sgt" is the "signed greater than" assembly instruction and "sub(0,1)" is -1 in two's complement.
        sx := sgt(x, sub(0, 1))
        sy := sgt(y, sub(0, 1))
        sd := sgt(denominator, sub(0, 1))
    }

    // XOR over sx, sy and sd. What this does is to check whether there are 1 or 3 negative signs in the inputs.
    // If there are, the result should be negative. Otherwise, it should be positive.
    unchecked {
        result = sx ^ sy ^ sd == 0 ? -int256(resultAbs) : int256(resultAbs);
    }
}

/// @notice Calculates the square root of x using the Babylonian method.
///
/// @dev See https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method.
///
/// Notes:
/// - If x is not a perfect square, the result is rounded down.
/// - Credits to OpenZeppelin for the explanations in comments below.
///
/// @param x The uint256 number for which to calculate the square root.
/// @return result The result as a uint256.
/// @custom:smtchecker abstract-function-nondet
function sqrt_0(uint256 x) pure returns (uint256 result) {
    if (x == 0) {
        return 0;
    }

    // For our first guess, we calculate the biggest power of 2 which is smaller than the square root of x.
    //
    // We know that the "msb" (most significant bit) of x is a power of 2 such that we have:
    //
    // $$
    // msb(x) <= x <= 2*msb(x)$
    // $$
    //
    // We write $msb(x)$ as $2^k$, and we get:
    //
    // $$
    // k = log_2(x)
    // $$
    //
    // Thus, we can write the initial inequality as:
    //
    // $$
    // 2^{log_2(x)} <= x <= 2*2^{log_2(x)+1} \\
    // sqrt(2^k) <= sqrt(x) < sqrt(2^{k+1}) \\
    // 2^{k/2} <= sqrt(x) < 2^{(k+1)/2} <= 2^{(k/2)+1}
    // $$
    //
    // Consequently, $2^{log_2(x) /2} is a good first approximation of sqrt(x) with at least one correct bit.
    uint256 xAux = uint256(x);
    result = 1;
    if (xAux >= 2 ** 128) {
        xAux >>= 128;
        result <<= 64;
    }
    if (xAux >= 2 ** 64) {
        xAux >>= 64;
        result <<= 32;
    }
    if (xAux >= 2 ** 32) {
        xAux >>= 32;
        result <<= 16;
    }
    if (xAux >= 2 ** 16) {
        xAux >>= 16;
        result <<= 8;
    }
    if (xAux >= 2 ** 8) {
        xAux >>= 8;
        result <<= 4;
    }
    if (xAux >= 2 ** 4) {
        xAux >>= 4;
        result <<= 2;
    }
    if (xAux >= 2 ** 2) {
        result <<= 1;
    }

    // At this point, `result` is an estimation with at least one bit of precision. We know the true value has at
    // most 128 bits, since it is the square root of a uint256. Newton's method converges quadratically (precision
    // doubles at every iteration). We thus need at most 7 iteration to turn our partial result with one bit of
    // precision into the expected uint128 result.
    unchecked {
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;

        // If x is not a perfect square, round the result toward zero.
        uint256 roundedResult = x / result;
        if (result >= roundedResult) {
            result = roundedResult;
        }
    }
}

// lib/snowbridge/contracts/src/Agent.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @title An agent contract that acts on behalf of a consensus system on Polkadot
/// @dev Instances of this contract act as an agents for arbitrary consensus systems on Polkadot.
///      These consensus systems can include toplevel parachains as as well as nested consensus
///      systems within a parachain.
contract Agent {
    error Unauthorized();

    /// @dev The unique ID for this agent, derived from the MultiLocation of the corresponding
    ///      consensus system on Polkadot
    bytes32 public immutable AGENT_ID;

    /// @dev The gateway contract controlling this agent
    address public immutable GATEWAY;

    constructor(bytes32 agentID) {
        AGENT_ID = agentID;
        GATEWAY = msg.sender;
    }

    /// @dev Agents can receive ether permissionlessly.
    /// This is important, as agents are used to lock ether.
    receive() external payable {}

    /// @dev Allow the gateway to invoke some code within the context of this agent
    /// using `delegatecall`. Typically this code will be provided by `AgentExecutor.sol`.
    function invoke(address executor, bytes calldata data) external returns (bool, bytes memory) {
        if (msg.sender != GATEWAY) {
            revert Unauthorized();
        }
        return executor.delegatecall(data);
    }
}

// lib/snowbridge/contracts/src/interfaces/IERC20.sol

// SPDX-FileCopyrightText: 2023 Axelar Network
// SPDX-FileCopyrightText: 2025 Snowfork <hello@snowfork.com>

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    error InvalidSender(address);
    error InvalidReceiver(address);
    error InvalidSpender(address);
    error InvalidApprover(address);
    error InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount)
        external
        returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// lib/snowbridge/contracts/src/interfaces/IERC20Permit.sol

// SPDX-FileCopyrightText: 2023 Axelar Network
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

interface IERC20Permit {
    error PermitExpired();
    error InvalidSignature();

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function nonces(address account) external view returns (uint256);

    function permit(
        address issuer,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

// lib/snowbridge/contracts/src/interfaces/IInitializable.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/**
 * @title Initialization of gateway logic contracts
 */
interface IInitializable {
    function initialize(bytes calldata data) external;
}

// lib/snowbridge/contracts/src/interfaces/IUpgradable.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

interface IUpgradable {
    // The new implementation address is a not a contract
    error InvalidContract();
    // The supplied codehash does not match the new implementation codehash
    error InvalidCodeHash();

    // The implementation contract was upgraded
    event Upgraded(address indexed implementation);

    function implementation() external view returns (address);
}

// lib/snowbridge/contracts/src/utils/Address.sol

// SPDX-FileCopyrightText: 2023 Axelar Network
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library Address {
    // Checks whether `account` is a contract
    function isContract(address account) internal view returns (bool) {
        // https://eips.ethereum.org/EIPS/eip-1052
        // keccak256('') == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        return account.codehash != bytes32(0)
            && account.codehash != 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
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

// lib/snowbridge/contracts/src/utils/Call.sol

// SPDX-FileCopyrightText: 2023 OpenZeppelin
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// Derived from OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)
library Call {
    function verifyResult(bool success, bytes memory returndata)
        internal
        pure
        returns (bytes memory)
    {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly
                /// @solidity memory-safe-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert();
            }
        }
    }

    /**
     * @notice Safely perform a low level call without copying any returndata
     *
     * @param target   Address to call
     * @param data Calldata to pass to the call
     */
    function safeCall(address target, bytes memory data, uint256 value) internal returns (bool) {
        bool success;
        assembly {
            success :=
                call(
                    gas(), // gas
                    target, // recipient
                    value, // ether value
                    add(data, 0x20), // inloc
                    mload(data), // inlen
                    0, // outloc
                    0 // outlen
                )
        }
        return success;
    }
}

// lib/snowbridge/contracts/src/utils/ERC1967.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @title Minimal implementation of ERC1967 storage slot
library ERC1967 {
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    bytes32 public constant _IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function load() internal view returns (address implementation) {
        assembly {
            implementation := sload(_IMPLEMENTATION_SLOT)
        }
    }

    function store(address implementation) internal {
        assembly {
            sstore(_IMPLEMENTATION_SLOT, implementation)
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

// lib/snowbridge/contracts/src/utils/SparseBitmap.sol

struct SparseBitmap {
    mapping(uint256 bucket => uint256) data;
}

using {get_0, set_0} for SparseBitmap global;

function get_0(SparseBitmap storage self, uint256 index) view returns (bool) {
    uint256 bucket = index >> 8;
    uint256 mask = 1 << (index & 0xff);
    return self.data[bucket] & mask != 0;
}

function set_0(SparseBitmap storage self, uint256 index) {
    uint256 bucket = index >> 8;
    uint256 mask = 1 << (index & 0xff);
    self.data[bucket] |= mask;
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
using {get_1, set_1} for Uint16Array global;

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
function get_1(Uint16Array storage self, uint256 index) view returns (uint16) {
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
function set_1(Uint16Array storage self, uint256 index, uint16 value) {
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

// lib/snowbridge/contracts/src/v1/MultiAddress.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

using {
    isIndex,
    asIndex,
    isAddress32,
    asAddress32,
    isAddress20,
    asAddress20
} for MultiAddress global;

/// @dev An address for an on-chain account
struct MultiAddress {
    Kind kind;
    bytes data;
}

enum Kind {
    Index,
    Address32,
    Address20
}

function isIndex(MultiAddress calldata multiAddress) pure returns (bool) {
    return multiAddress.kind == Kind.Index;
}

function asIndex(MultiAddress calldata multiAddress) pure returns (uint32) {
    return abi.decode(multiAddress.data, (uint32));
}

function isAddress32(MultiAddress calldata multiAddress) pure returns (bool) {
    return multiAddress.kind == Kind.Address32;
}

function asAddress32(MultiAddress calldata multiAddress) pure returns (bytes32) {
    return bytes32(multiAddress.data);
}

function isAddress20(MultiAddress calldata multiAddress) pure returns (bool) {
    return multiAddress.kind == Kind.Address20;
}

function asAddress20(MultiAddress calldata multiAddress) pure returns (bytes20) {
    return bytes20(multiAddress.data);
}

function multiAddressFromUint32(uint32 id) pure returns (MultiAddress memory) {
    return MultiAddress({kind: Kind.Index, data: abi.encode(id)});
}

function multiAddressFromBytes32(bytes32 id) pure returns (MultiAddress memory) {
    return MultiAddress({kind: Kind.Address32, data: bytes.concat(id)});
}

function multiAddressFromBytes20(bytes20 id) pure returns (MultiAddress memory) {
    return MultiAddress({kind: Kind.Address20, data: bytes.concat(id)});
}

// lib/snowbridge/contracts/src/interfaces/IERC20Metadata.sol

// SPDX-FileCopyrightText: 2023 OpenZeppelin
// SPDX-FileCopyrightText: 2024 Snowfork <hello@snowfork.com>

/**
 * @dev Interface for the optional metadata functions from the ERC20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
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

// lib/snowbridge/contracts/src/utils/SafeTransfer.sol

// SPDX-FileCopyrightText: 2023 Axelar Network
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

error TokenTransferFailed();
error NativeTransferFailed();

library SafeTokenCall {
    function safeCall(IERC20 token, bytes memory callData) internal {
        (bool success, bytes memory returnData) = address(token).call(callData);
        bool transferred =
            success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));
        if (!transferred || address(token).code.length == 0) {
            revert TokenTransferFailed();
        }
    }
}

library SafeTokenTransfer {
    function safeTransfer(IERC20 token, address receiver, uint256 amount) internal {
        SafeTokenCall.safeCall(token, abi.encodeCall(IERC20.transfer, (receiver, amount)));
    }
}

library SafeTokenTransferFrom {
    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        SafeTokenCall.safeCall(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }
}

library SafeNativeTransfer {
    function safeNativeTransfer(address payable receiver, uint256 amount) internal {
        bool success;
        assembly {
            success := call(gas(), receiver, amount, 0, 0, 0, 0)
        }
        if (!success) {
            revert NativeTransferFailed();
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

// lib/snowbridge/contracts/src/AgentExecutor.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @title Code which will run within an `Agent` using `delegatecall`.
/// @dev This is a singleton contract, meaning that all agents will execute the same code.
contract AgentExecutor {
    using SafeTokenTransfer for IERC20;
    using SafeNativeTransfer for address payable;

    // Transfer ether to `recipient`.
    function transferEther(address payable recipient, uint256 amount) external {
        recipient.safeNativeTransfer(amount);
    }

    // Transfer ERC20 to `recipient`.
    function transferToken(address token, address recipient, uint128 amount) external {
        IERC20(token).safeTransfer(recipient, amount);
    }

    // Call contract with Ether value
    function callContract(address target, bytes memory data, uint256 value) external {
        bool success = Call.safeCall(target, data, value);
        if (!success) {
            revert();
        }
    }

    function deposit() external payable {}
}

// lib/snowbridge/contracts/src/Upgrade.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @dev Upgrades implementation contract
library Upgrade {
    using Address for address;

    function upgrade(address impl, bytes32 implCodeHash, bytes memory initializerParams)
        external
    {
        // Verify that the implementation is actually a contract
        if (!impl.isContract()) {
            revert IUpgradable.InvalidContract();
        }

        // As a sanity check, ensure that the codehash of implementation contract
        // matches the codehash in the upgrade proposal
        if (impl.codehash != implCodeHash) {
            revert IUpgradable.InvalidCodeHash();
        }

        // Update the proxy with the address of the new implementation
        ERC1967.store(impl);

        // Call the initializer
        (bool success, bytes memory returndata) =
            impl.delegatecall(abi.encodeCall(IInitializable.initialize, initializerParams));
        Call.verifyResult(success, returndata);

        emit IUpgradable.Upgraded(impl);
    }
}

// lib/snowbridge/contracts/src/TokenLib.sol

// SPDX-FileCopyrightText: 2025 Snowfork <hello@snowfork.com>

library TokenLib {
    /// The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// The EIP-712 typehash for the permit struct used by the contract
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    struct Token {
        mapping(address account => uint256) balance;
        mapping(address account => mapping(address spender => uint256)) allowance;
        mapping(address token => uint256) nonces;
        uint256 totalSupply;
    }

    function mint(Token storage token, address account, uint256 amount) external {
        require(account != address(0), IERC20.InvalidReceiver(address(0)));
        _update(token, address(0), account, amount);
    }

    function burn(Token storage token, address account, uint256 amount) external {
        require(account != address(0), IERC20.InvalidSender(address(0)));
        _update(token, account, address(0), amount);
    }

    function approve(Token storage token, address spender, uint256 amount)
        external
        returns (bool)
    {
        _approve(token, msg.sender, spender, amount, true);
        return true;
    }

    function transfer(Token storage token, address recipient, uint256 amount)
        external
        returns (bool)
    {
        _transfer(token, msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(Token storage token, address owner, address recipient, uint256 amount)
        external
        returns (bool)
    {
        _spendAllowance(token, owner, msg.sender, amount);
        _transfer(token, owner, recipient, amount);
        return true;
    }

    function permit(
        Token storage token,
        string storage tokenName,
        address issuer,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, IERC20Permit.PermitExpired());

        bytes32 digest = keccak256(
            abi.encodePacked(
                hex"1901",
                _domainSeparator(tokenName),
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH, issuer, spender, value, token.nonces[issuer]++, deadline
                    )
                )
            )
        );

        address signatory = ECDSA.recover(digest, v, r, s);
        require(signatory == issuer, IERC20Permit.InvalidSignature());

        _approve(token, issuer, spender, value, true);
    }

    function domainSeparator(string storage name) external view returns (bytes32) {
        return _domainSeparator(name);
    }

    function _domainSeparator(string storage name) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _transfer(Token storage token, address sender, address recipient, uint256 amount)
        internal
    {
        require(sender != address(0), IERC20.InvalidSender(address(0)));
        require(recipient != address(0), IERC20.InvalidReceiver(address(0)));
        _update(token, sender, recipient, amount);
    }

    function _spendAllowance(Token storage token, address owner, address spender, uint256 value)
        internal
        returns (bool)
    {
        uint256 allowance = token.allowance[owner][spender];
        if (allowance != type(uint256).max) {
            require(allowance >= value, IERC20.InsufficientAllowance(spender, allowance, value));
            unchecked {
                _approve(token, owner, spender, allowance - value, false);
            }
        }
        return true;
    }

    function _approve(
        Token storage token,
        address owner,
        address spender,
        uint256 amount,
        bool emitEvent
    ) internal {
        require(owner != address(0), IERC20.InvalidApprover(address(0)));
        require(spender != address(0), IERC20.InvalidSpender(address(0)));

        token.allowance[owner][spender] = amount;

        if (emitEvent) {
            emit IERC20.Approval(owner, spender, amount);
        }
    }

    function _update(Token storage token, address from, address to, uint256 value) internal {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never
            // overflows
            token.totalSupply += value;
        } else {
            uint256 fromBalance = token.balance[from];
            require(fromBalance >= value, IERC20.InsufficientBalance(from, fromBalance, value));
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply
                token.balance[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible:
                // value <= totalSupply or value <= fromBalance <= totalSupply
                token.totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know
                // fits into a uint256
                token.balance[to] += value;
            }
        }

        emit IERC20.Transfer(from, to, value);
    }
}

// lib/snowbridge/contracts/src/Token.sol

// SPDX-FileCopyrightText: 2025 Snowfork <hello@snowfork.com>

/**
 * @dev Implementation of the {IERC20} interface.
 */
contract Token is IERC20, IERC20Metadata, IERC20Permit {
    using TokenLib for TokenLib.Token;

    address public immutable gateway;
    uint8 public immutable decimals;

    string public name;
    string public symbol;

    TokenLib.Token internal token;

    error Unauthorized();

    /**
     * @dev Sets the values for {name}, {symbol}, and {decimals}.
     */
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        gateway = msg.sender;
    }

    modifier onlyGateway() {
        if (msg.sender != gateway) {
            revert Unauthorized();
        }
        _;
    }

    function mint(address account, uint256 amount) external onlyGateway {
        token.mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyGateway {
        token.burn(account, amount);
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        return token.transfer(recipient, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return token.approve(spender, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        external
        returns (bool)
    {
        return token.transferFrom(sender, recipient, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return token.balance[account];
    }

    function totalSupply() external view returns (uint256) {
        return token.totalSupply;
    }

    function allowance(address _owner, address spender) external view returns (uint256) {
        return token.allowance[_owner][spender];
    }

    // IERC20Permit

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return TokenLib.domainSeparator(name);
    }

    function permit(
        address issuer,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        token.permit(name, issuer, spender, value, deadline, v, r, s);
    }

    function nonces(address account) external view returns (uint256) {
        return token.nonces[account];
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
            signatureUsageCount = currentValidatorSet.usageCounters.get_1(proof.index);
            currentValidatorSet.usageCounters.set_1(
                proof.index, signatureUsageCount.saturatingAdd(1)
            );
            vset = currentValidatorSet;
        } else if (commitment.validatorSetID == nextValidatorSet.id) {
            signatureUsageCount = nextValidatorSet.usageCounters.get_1(proof.index);
            nextValidatorSet.usageCounters.set_1(proof.index, signatureUsageCount.saturatingAdd(1));
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

// lib/snowbridge/contracts/src/BeefyVerification.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library BeefyVerification {
    /// @dev An MMRLeaf without the `leaf_extra` field.
    /// Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/consensus/beefy/src/mmr.rs#L52
    struct MMRLeafPartial {
        uint8 version;
        uint32 parentNumber;
        bytes32 parentHash;
        uint64 nextAuthoritySetID;
        uint32 nextAuthoritySetLen;
        bytes32 nextAuthoritySetRoot;
    }

    /// @dev A proof that a given MMR leaf is part of the MMR maintained by the BEEFY light client
    struct Proof {
        // The MMR leaf to be proven
        MMRLeafPartial leafPartial;
        // The MMR leaf proof
        bytes32[] leafProof;
        // The order in which proof items should be combined
        uint256 leafProofOrder;
    }

    /// @dev Verify that a given MMR leaf is part of the MMR maintained by the BEEFY light client
    ///
    /// @param beefyClient The address of the BEEFY light client
    /// @param leafExtra The extra data to be included in the MMR leaf
    /// @param proof The MMR leaf proof containing the leaf data and proof elements
    function verifyBeefyMMRLeaf(address beefyClient, bytes32 leafExtra, Proof calldata proof)
        external
        view
        returns (bool)
    {
        // Create the MMR leaf by adding the leafExtra field and SCALE-encoding the full leaf
        bytes32 leafHash = createMMRLeaf(proof.leafPartial, leafExtra);

        // Verify that the MMR leaf is part of the MMR maintained by the BEEFY light client
        return BeefyClient(beefyClient).verifyMMRLeafProof(
            leafHash, proof.leafProof, proof.leafProofOrder
        );
    }

    // SCALE-encode: MMRLeaf
    // Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/consensus/beefy/src/mmr.rs#L52
    function createMMRLeaf(MMRLeafPartial memory leaf, bytes32 beefyExtraField)
        internal
        pure
        returns (bytes32)
    {
        bytes memory encodedLeaf = bytes.concat(
            ScaleCodec.encodeU8(leaf.version),
            ScaleCodec.encodeU32(leaf.parentNumber),
            leaf.parentHash,
            ScaleCodec.encodeU64(leaf.nextAuthoritySetID),
            ScaleCodec.encodeU32(leaf.nextAuthoritySetLen),
            leaf.nextAuthoritySetRoot,
            beefyExtraField
        );
        return keccak256(encodedLeaf);
    }
}

// lib/snowbridge/contracts/lib/prb-math/src/sd1x18/Casting.sol

/// @notice Casts an SD1x18 number into SD59x18.
/// @dev There is no overflow check because the domain of SD1x18 is a subset of SD59x18.
function intoSD59x18_0(SD1x18 x) pure returns (SD59x18 result) {
    result = SD59x18.wrap(int256(SD1x18.unwrap(x)));
}

/// @notice Casts an SD1x18 number into UD2x18.
/// - x must be positive.
function intoUD2x18_0(SD1x18 x) pure returns (UD2x18 result) {
    int64 xInt = SD1x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD1x18_ToUD2x18_Underflow(x);
    }
    result = UD2x18.wrap(uint64(xInt));
}

/// @notice Casts an SD1x18 number into UD60x18.
/// @dev Requirements:
/// - x must be positive.
function intoUD60x18_0(SD1x18 x) pure returns (UD60x18 result) {
    int64 xInt = SD1x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD1x18_ToUD60x18_Underflow(x);
    }
    result = UD60x18.wrap(uint64(xInt));
}

/// @notice Casts an SD1x18 number into uint256.
/// @dev Requirements:
/// - x must be positive.
function intoUint256_0(SD1x18 x) pure returns (uint256 result) {
    int64 xInt = SD1x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD1x18_ToUint256_Underflow(x);
    }
    result = uint256(uint64(xInt));
}

/// @notice Casts an SD1x18 number into uint128.
/// @dev Requirements:
/// - x must be positive.
function intoUint128_0(SD1x18 x) pure returns (uint128 result) {
    int64 xInt = SD1x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD1x18_ToUint128_Underflow(x);
    }
    result = uint128(uint64(xInt));
}

/// @notice Casts an SD1x18 number into uint40.
/// @dev Requirements:
/// - x must be positive.
/// - x must be less than or equal to `MAX_UINT40`.
function intoUint40_0(SD1x18 x) pure returns (uint40 result) {
    int64 xInt = SD1x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD1x18_ToUint40_Underflow(x);
    }
    if (xInt > int64(uint64(MAX_UINT40))) {
        revert PRBMath_SD1x18_ToUint40_Overflow(x);
    }
    result = uint40(uint64(xInt));
}

/// @notice Alias for {wrap}.
function sd1x18(int64 x) pure returns (SD1x18 result) {
    result = SD1x18.wrap(x);
}

/// @notice Unwraps an SD1x18 number into int64.
function unwrap_0(SD1x18 x) pure returns (int64 result) {
    result = SD1x18.unwrap(x);
}

/// @notice Wraps an int64 number into SD1x18.
function wrap_0(int64 x) pure returns (SD1x18 result) {
    result = SD1x18.wrap(x);
}

// lib/snowbridge/contracts/lib/prb-math/src/sd1x18/Constants.sol

/// @dev Euler's number as an SD1x18 number.
SD1x18 constant E_0 = SD1x18.wrap(2_718281828459045235);

/// @dev The maximum value an SD1x18 number can have.
int64 constant uMAX_SD1x18 = 9_223372036854775807;
SD1x18 constant MAX_SD1x18 = SD1x18.wrap(uMAX_SD1x18);

/// @dev The maximum value an SD1x18 number can have.
int64 constant uMIN_SD1x18 = -9_223372036854775808;
SD1x18 constant MIN_SD1x18 = SD1x18.wrap(uMIN_SD1x18);

/// @dev PI as an SD1x18 number.
SD1x18 constant PI_0 = SD1x18.wrap(3_141592653589793238);

/// @dev The unit number, which gives the decimal precision of SD1x18.
SD1x18 constant UNIT_1 = SD1x18.wrap(1e18);
int256 constant uUNIT_0 = 1e18;

// lib/snowbridge/contracts/lib/prb-math/src/sd1x18/Errors.sol

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in UD2x18.
error PRBMath_SD1x18_ToUD2x18_Underflow(SD1x18 x);

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in UD60x18.
error PRBMath_SD1x18_ToUD60x18_Underflow(SD1x18 x);

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in uint128.
error PRBMath_SD1x18_ToUint128_Underflow(SD1x18 x);

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in uint256.
error PRBMath_SD1x18_ToUint256_Underflow(SD1x18 x);

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in uint40.
error PRBMath_SD1x18_ToUint40_Overflow(SD1x18 x);

/// @notice Thrown when trying to cast a SD1x18 number that doesn't fit in uint40.
error PRBMath_SD1x18_ToUint40_Underflow(SD1x18 x);

// lib/snowbridge/contracts/lib/prb-math/src/sd1x18/ValueType.sol

/// @notice The signed 1.18-decimal fixed-point number representation, which can have up to 1 digit and up to 18
/// decimals. The values of this are bound by the minimum and the maximum values permitted by the underlying Solidity
/// type int64. This is useful when end users want to use int64 to save gas, e.g. with tight variable packing in contract
/// storage.
type SD1x18 is int64;

/*//////////////////////////////////////////////////////////////////////////
                                    CASTING
//////////////////////////////////////////////////////////////////////////*/

using {
    intoSD59x18_0,
    intoUD2x18_0,
    intoUD60x18_0,
    intoUint256_0,
    intoUint128_0,
    intoUint40_0,
    unwrap_0
} for SD1x18 global;

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/Casting.sol

/// @notice Casts an SD59x18 number into int256.
/// @dev This is basically a functional alias for {unwrap}.
function intoInt256(SD59x18 x) pure returns (int256 result) {
    result = SD59x18.unwrap(x);
}

/// @notice Casts an SD59x18 number into SD1x18.
/// @dev Requirements:
/// - x must be greater than or equal to `uMIN_SD1x18`.
/// - x must be less than or equal to `uMAX_SD1x18`.
function intoSD1x18_0(SD59x18 x) pure returns (SD1x18 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < uMIN_SD1x18) {
        revert PRBMath_SD59x18_IntoSD1x18_Underflow(x);
    }
    if (xInt > uMAX_SD1x18) {
        revert PRBMath_SD59x18_IntoSD1x18_Overflow(x);
    }
    result = SD1x18.wrap(int64(xInt));
}

/// @notice Casts an SD59x18 number into UD2x18.
/// @dev Requirements:
/// - x must be positive.
/// - x must be less than or equal to `uMAX_UD2x18`.
function intoUD2x18_1(SD59x18 x) pure returns (UD2x18 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD59x18_IntoUD2x18_Underflow(x);
    }
    if (xInt > int256(uint256(uMAX_UD2x18))) {
        revert PRBMath_SD59x18_IntoUD2x18_Overflow(x);
    }
    result = UD2x18.wrap(uint64(uint256(xInt)));
}

/// @notice Casts an SD59x18 number into UD60x18.
/// @dev Requirements:
/// - x must be positive.
function intoUD60x18_1(SD59x18 x) pure returns (UD60x18 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD59x18_IntoUD60x18_Underflow(x);
    }
    result = UD60x18.wrap(uint256(xInt));
}

/// @notice Casts an SD59x18 number into uint256.
/// @dev Requirements:
/// - x must be positive.
function intoUint256_1(SD59x18 x) pure returns (uint256 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD59x18_IntoUint256_Underflow(x);
    }
    result = uint256(xInt);
}

/// @notice Casts an SD59x18 number into uint128.
/// @dev Requirements:
/// - x must be positive.
/// - x must be less than or equal to `uMAX_UINT128`.
function intoUint128_1(SD59x18 x) pure returns (uint128 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD59x18_IntoUint128_Underflow(x);
    }
    if (xInt > int256(uint256(MAX_UINT128))) {
        revert PRBMath_SD59x18_IntoUint128_Overflow(x);
    }
    result = uint128(uint256(xInt));
}

/// @notice Casts an SD59x18 number into uint40.
/// @dev Requirements:
/// - x must be positive.
/// - x must be less than or equal to `MAX_UINT40`.
function intoUint40_1(SD59x18 x) pure returns (uint40 result) {
    int256 xInt = SD59x18.unwrap(x);
    if (xInt < 0) {
        revert PRBMath_SD59x18_IntoUint40_Underflow(x);
    }
    if (xInt > int256(uint256(MAX_UINT40))) {
        revert PRBMath_SD59x18_IntoUint40_Overflow(x);
    }
    result = uint40(uint256(xInt));
}

/// @notice Alias for {wrap}.
function sd(int256 x) pure returns (SD59x18 result) {
    result = SD59x18.wrap(x);
}

/// @notice Alias for {wrap}.
function sd59x18(int256 x) pure returns (SD59x18 result) {
    result = SD59x18.wrap(x);
}

/// @notice Unwraps an SD59x18 number into int256.
function unwrap_1(SD59x18 x) pure returns (int256 result) {
    result = SD59x18.unwrap(x);
}

/// @notice Wraps an int256 number into SD59x18.
function wrap_1(int256 x) pure returns (SD59x18 result) {
    result = SD59x18.wrap(x);
}

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/Constants.sol

// NOTICE: the "u" prefix stands for "unwrapped".

/// @dev Euler's number as an SD59x18 number.
SD59x18 constant E_1 = SD59x18.wrap(2_718281828459045235);

/// @dev The maximum input permitted in {exp}.
int256 constant uEXP_MAX_INPUT_0 = 133_084258667509499440;
SD59x18 constant EXP_MAX_INPUT_0 = SD59x18.wrap(uEXP_MAX_INPUT_0);

/// @dev The maximum input permitted in {exp2}.
int256 constant uEXP2_MAX_INPUT_0 = 192e18 - 1;
SD59x18 constant EXP2_MAX_INPUT_0 = SD59x18.wrap(uEXP2_MAX_INPUT_0);

/// @dev Half the UNIT number.
int256 constant uHALF_UNIT_0 = 0.5e18;
SD59x18 constant HALF_UNIT_0 = SD59x18.wrap(uHALF_UNIT_0);

/// @dev $log_2(10)$ as an SD59x18 number.
int256 constant uLOG2_10_0 = 3_321928094887362347;
SD59x18 constant LOG2_10_0 = SD59x18.wrap(uLOG2_10_0);

/// @dev $log_2(e)$ as an SD59x18 number.
int256 constant uLOG2_E_0 = 1_442695040888963407;
SD59x18 constant LOG2_E_0 = SD59x18.wrap(uLOG2_E_0);

/// @dev The maximum value an SD59x18 number can have.
int256 constant uMAX_SD59x18 = 57896044618658097711785492504343953926634992332820282019728_792003956564819967;
SD59x18 constant MAX_SD59x18 = SD59x18.wrap(uMAX_SD59x18);

/// @dev The maximum whole value an SD59x18 number can have.
int256 constant uMAX_WHOLE_SD59x18 = 57896044618658097711785492504343953926634992332820282019728_000000000000000000;
SD59x18 constant MAX_WHOLE_SD59x18 = SD59x18.wrap(uMAX_WHOLE_SD59x18);

/// @dev The minimum value an SD59x18 number can have.
int256 constant uMIN_SD59x18 = -57896044618658097711785492504343953926634992332820282019728_792003956564819968;
SD59x18 constant MIN_SD59x18 = SD59x18.wrap(uMIN_SD59x18);

/// @dev The minimum whole value an SD59x18 number can have.
int256 constant uMIN_WHOLE_SD59x18 = -57896044618658097711785492504343953926634992332820282019728_000000000000000000;
SD59x18 constant MIN_WHOLE_SD59x18 = SD59x18.wrap(uMIN_WHOLE_SD59x18);

/// @dev PI as an SD59x18 number.
SD59x18 constant PI_1 = SD59x18.wrap(3_141592653589793238);

/// @dev The unit number, which gives the decimal precision of SD59x18.
int256 constant uUNIT_1 = 1e18;
SD59x18 constant UNIT_2 = SD59x18.wrap(1e18);

/// @dev The unit number squared.
int256 constant uUNIT_SQUARED_0 = 1e36;
SD59x18 constant UNIT_SQUARED_0 = SD59x18.wrap(uUNIT_SQUARED_0);

/// @dev Zero as an SD59x18 number.
SD59x18 constant ZERO_0 = SD59x18.wrap(0);

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/Errors.sol

/// @notice Thrown when taking the absolute value of `MIN_SD59x18`.
error PRBMath_SD59x18_Abs_MinSD59x18();

/// @notice Thrown when ceiling a number overflows SD59x18.
error PRBMath_SD59x18_Ceil_Overflow(SD59x18 x);

/// @notice Thrown when converting a basic integer to the fixed-point format overflows SD59x18.
error PRBMath_SD59x18_Convert_Overflow(int256 x);

/// @notice Thrown when converting a basic integer to the fixed-point format underflows SD59x18.
error PRBMath_SD59x18_Convert_Underflow(int256 x);

/// @notice Thrown when dividing two numbers and one of them is `MIN_SD59x18`.
error PRBMath_SD59x18_Div_InputTooSmall();

/// @notice Thrown when dividing two numbers and one of the intermediary unsigned results overflows SD59x18.
error PRBMath_SD59x18_Div_Overflow(SD59x18 x, SD59x18 y);

/// @notice Thrown when taking the natural exponent of a base greater than 133_084258667509499441.
error PRBMath_SD59x18_Exp_InputTooBig(SD59x18 x);

/// @notice Thrown when taking the binary exponent of a base greater than 192e18.
error PRBMath_SD59x18_Exp2_InputTooBig(SD59x18 x);

/// @notice Thrown when flooring a number underflows SD59x18.
error PRBMath_SD59x18_Floor_Underflow(SD59x18 x);

/// @notice Thrown when taking the geometric mean of two numbers and their product is negative.
error PRBMath_SD59x18_Gm_NegativeProduct(SD59x18 x, SD59x18 y);

/// @notice Thrown when taking the geometric mean of two numbers and multiplying them overflows SD59x18.
error PRBMath_SD59x18_Gm_Overflow(SD59x18 x, SD59x18 y);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in SD1x18.
error PRBMath_SD59x18_IntoSD1x18_Overflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in SD1x18.
error PRBMath_SD59x18_IntoSD1x18_Underflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in UD2x18.
error PRBMath_SD59x18_IntoUD2x18_Overflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in UD2x18.
error PRBMath_SD59x18_IntoUD2x18_Underflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in UD60x18.
error PRBMath_SD59x18_IntoUD60x18_Underflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint128.
error PRBMath_SD59x18_IntoUint128_Overflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint128.
error PRBMath_SD59x18_IntoUint128_Underflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint256.
error PRBMath_SD59x18_IntoUint256_Underflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint40.
error PRBMath_SD59x18_IntoUint40_Overflow(SD59x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint40.
error PRBMath_SD59x18_IntoUint40_Underflow(SD59x18 x);

/// @notice Thrown when taking the logarithm of a number less than or equal to zero.
error PRBMath_SD59x18_Log_InputTooSmall(SD59x18 x);

/// @notice Thrown when multiplying two numbers and one of the inputs is `MIN_SD59x18`.
error PRBMath_SD59x18_Mul_InputTooSmall();

/// @notice Thrown when multiplying two numbers and the intermediary absolute result overflows SD59x18.
error PRBMath_SD59x18_Mul_Overflow(SD59x18 x, SD59x18 y);

/// @notice Thrown when raising a number to a power and hte intermediary absolute result overflows SD59x18.
error PRBMath_SD59x18_Powu_Overflow(SD59x18 x, uint256 y);

/// @notice Thrown when taking the square root of a negative number.
error PRBMath_SD59x18_Sqrt_NegativeInput(SD59x18 x);

/// @notice Thrown when the calculating the square root overflows SD59x18.
error PRBMath_SD59x18_Sqrt_Overflow(SD59x18 x);

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/Helpers.sol

/// @notice Implements the checked addition operation (+) in the SD59x18 type.
function add_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    return wrap_1(x.unwrap_1() + y.unwrap_1());
}

/// @notice Implements the AND (&) bitwise operation in the SD59x18 type.
function and_0(SD59x18 x, int256 bits) pure returns (SD59x18 result) {
    return wrap_1(x.unwrap_1() & bits);
}

/// @notice Implements the AND (&) bitwise operation in the SD59x18 type.
function and2_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    return wrap_1(x.unwrap_1() & y.unwrap_1());
}

/// @notice Implements the equal (=) operation in the SD59x18 type.
function eq_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() == y.unwrap_1();
}

/// @notice Implements the greater than operation (>) in the SD59x18 type.
function gt_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() > y.unwrap_1();
}

/// @notice Implements the greater than or equal to operation (>=) in the SD59x18 type.
function gte_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() >= y.unwrap_1();
}

/// @notice Implements a zero comparison check function in the SD59x18 type.
function isZero_0(SD59x18 x) pure returns (bool result) {
    result = x.unwrap_1() == 0;
}

/// @notice Implements the left shift operation (<<) in the SD59x18 type.
function lshift_0(SD59x18 x, uint256 bits) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() << bits);
}

/// @notice Implements the lower than operation (<) in the SD59x18 type.
function lt_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() < y.unwrap_1();
}

/// @notice Implements the lower than or equal to operation (<=) in the SD59x18 type.
function lte_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() <= y.unwrap_1();
}

/// @notice Implements the unchecked modulo operation (%) in the SD59x18 type.
function mod_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() % y.unwrap_1());
}

/// @notice Implements the not equal operation (!=) in the SD59x18 type.
function neq_0(SD59x18 x, SD59x18 y) pure returns (bool result) {
    result = x.unwrap_1() != y.unwrap_1();
}

/// @notice Implements the NOT (~) bitwise operation in the SD59x18 type.
function not_0(SD59x18 x) pure returns (SD59x18 result) {
    result = wrap_1(~x.unwrap_1());
}

/// @notice Implements the OR (|) bitwise operation in the SD59x18 type.
function or_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() | y.unwrap_1());
}

/// @notice Implements the right shift operation (>>) in the SD59x18 type.
function rshift_0(SD59x18 x, uint256 bits) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() >> bits);
}

/// @notice Implements the checked subtraction operation (-) in the SD59x18 type.
function sub_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() - y.unwrap_1());
}

/// @notice Implements the checked unary minus operation (-) in the SD59x18 type.
function unary(SD59x18 x) pure returns (SD59x18 result) {
    result = wrap_1(-x.unwrap_1());
}

/// @notice Implements the unchecked addition operation (+) in the SD59x18 type.
function uncheckedAdd_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    unchecked {
        result = wrap_1(x.unwrap_1() + y.unwrap_1());
    }
}

/// @notice Implements the unchecked subtraction operation (-) in the SD59x18 type.
function uncheckedSub_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    unchecked {
        result = wrap_1(x.unwrap_1() - y.unwrap_1());
    }
}

/// @notice Implements the unchecked unary minus operation (-) in the SD59x18 type.
function uncheckedUnary(SD59x18 x) pure returns (SD59x18 result) {
    unchecked {
        result = wrap_1(-x.unwrap_1());
    }
}

/// @notice Implements the XOR (^) bitwise operation in the SD59x18 type.
function xor_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() ^ y.unwrap_1());
}

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/Math.sol

/// @notice Calculates the absolute value of x.
///
/// @dev Requirements:
/// - x must be greater than `MIN_SD59x18`.
///
/// @param x The SD59x18 number for which to calculate the absolute value.
/// @param result The absolute value of x as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function abs(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt == uMIN_SD59x18) {
        revert PRBMath_SD59x18_Abs_MinSD59x18();
    }
    result = xInt < 0 ? wrap_1(-xInt) : x;
}

/// @notice Calculates the arithmetic average of x and y.
///
/// @dev Notes:
/// - The result is rounded toward zero.
///
/// @param x The first operand as an SD59x18 number.
/// @param y The second operand as an SD59x18 number.
/// @return result The arithmetic average as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function avg_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    int256 yInt = y.unwrap_1();

    unchecked {
        // This operation is equivalent to `x / 2 +  y / 2`, and it can never overflow.
        int256 sum = (xInt >> 1) + (yInt >> 1);

        if (sum < 0) {
            // If at least one of x and y is odd, add 1 to the result, because shifting negative numbers to the right
            // rounds toward negative infinity. The right part is equivalent to `sum + (x % 2 == 1 || y % 2 == 1)`.
            assembly ("memory-safe") {
                result := add(sum, and(or(xInt, yInt), 1))
            }
        } else {
            // Add 1 if both x and y are odd to account for the double 0.5 remainder truncated after shifting.
            result = wrap_1(sum + (xInt & yInt & 1));
        }
    }
}

/// @notice Yields the smallest whole number greater than or equal to x.
///
/// @dev Optimized for fractional value inputs, because every whole value has (1e18 - 1) fractional counterparts.
/// See https://en.wikipedia.org/wiki/Floor_and_ceiling_functions.
///
/// Requirements:
/// - x must be less than or equal to `MAX_WHOLE_SD59x18`.
///
/// @param x The SD59x18 number to ceil.
/// @param result The smallest whole number greater than or equal to x, as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function ceil_0(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt > uMAX_WHOLE_SD59x18) {
        revert PRBMath_SD59x18_Ceil_Overflow(x);
    }

    int256 remainder = xInt % uUNIT_1;
    if (remainder == 0) {
        result = x;
    } else {
        unchecked {
            // Solidity uses C fmod style, which returns a modulus with the same sign as x.
            int256 resultInt = xInt - remainder;
            if (xInt > 0) {
                resultInt += uUNIT_1;
            }
            result = wrap_1(resultInt);
        }
    }
}

/// @notice Divides two SD59x18 numbers, returning a new SD59x18 number.
///
/// @dev This is an extension of {Common.mulDiv} for signed numbers, which works by computing the signs and the absolute
/// values separately.
///
/// Notes:
/// - Refer to the notes in {Common.mulDiv}.
/// - The result is rounded toward zero.
///
/// Requirements:
/// - Refer to the requirements in {Common.mulDiv}.
/// - None of the inputs can be `MIN_SD59x18`.
/// - The denominator must not be zero.
/// - The result must fit in SD59x18.
///
/// @param x The numerator as an SD59x18 number.
/// @param y The denominator as an SD59x18 number.
/// @param result The quotient as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function div_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    int256 yInt = y.unwrap_1();
    if (xInt == uMIN_SD59x18 || yInt == uMIN_SD59x18) {
        revert PRBMath_SD59x18_Div_InputTooSmall();
    }

    // Get hold of the absolute values of x and y.
    uint256 xAbs;
    uint256 yAbs;
    unchecked {
        xAbs = xInt < 0 ? uint256(-xInt) : uint256(xInt);
        yAbs = yInt < 0 ? uint256(-yInt) : uint256(yInt);
    }

    // Compute the absolute value (x*UNIT÷y). The resulting value must fit in SD59x18.
    uint256 resultAbs = mulDiv(xAbs, uint256(uUNIT_1), yAbs);
    if (resultAbs > uint256(uMAX_SD59x18)) {
        revert PRBMath_SD59x18_Div_Overflow(x, y);
    }

    // Check if x and y have the same sign using two's complement representation. The left-most bit represents the sign (1 for
    // negative, 0 for positive or zero).
    bool sameSign = (xInt ^ yInt) > -1;

    // If the inputs have the same sign, the result should be positive. Otherwise, it should be negative.
    unchecked {
        result = wrap_1(sameSign ? int256(resultAbs) : -int256(resultAbs));
    }
}

/// @notice Calculates the natural exponent of x using the following formula:
///
/// $$
/// e^x = 2^{x * log_2{e}}
/// $$
///
/// @dev Notes:
/// - Refer to the notes in {exp2}.
///
/// Requirements:
/// - Refer to the requirements in {exp2}.
/// - x must be less than 133_084258667509499441.
///
/// @param x The exponent as an SD59x18 number.
/// @return result The result as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function exp_0(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();

    // This check prevents values greater than 192e18 from being passed to {exp2}.
    if (xInt > uEXP_MAX_INPUT_0) {
        revert PRBMath_SD59x18_Exp_InputTooBig(x);
    }

    unchecked {
        // Inline the fixed-point multiplication to save gas.
        int256 doubleUnitProduct = xInt * uLOG2_E_0;
        result = exp2_1(wrap_1(doubleUnitProduct / uUNIT_1));
    }
}

/// @notice Calculates the binary exponent of x using the binary fraction method using the following formula:
///
/// $$
/// 2^{-x} = \frac{1}{2^x}
/// $$
///
/// @dev See https://ethereum.stackexchange.com/q/79903/24693.
///
/// Notes:
/// - If x is less than -59_794705707972522261, the result is zero.
///
/// Requirements:
/// - x must be less than 192e18.
/// - The result must fit in SD59x18.
///
/// @param x The exponent as an SD59x18 number.
/// @return result The result as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function exp2_1(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt < 0) {
        // The inverse of any number less than this is truncated to zero.
        if (xInt < -59_794705707972522261) {
            return ZERO_0;
        }

        unchecked {
            // Inline the fixed-point inversion to save gas.
            result = wrap_1(uUNIT_SQUARED_0 / exp2_1(wrap_1(-xInt)).unwrap_1());
        }
    } else {
        // Numbers greater than or equal to 192e18 don't fit in the 192.64-bit format.
        if (xInt > uEXP2_MAX_INPUT_0) {
            revert PRBMath_SD59x18_Exp2_InputTooBig(x);
        }

        unchecked {
            // Convert x to the 192.64-bit fixed-point format.
            uint256 x_192x64 = uint256((xInt << 64) / uUNIT_1);

            // It is safe to cast the result to int256 due to the checks above.
            result = wrap_1(int256(exp2_0(x_192x64)));
        }
    }
}

/// @notice Yields the greatest whole number less than or equal to x.
///
/// @dev Optimized for fractional value inputs, because for every whole value there are (1e18 - 1) fractional
/// counterparts. See https://en.wikipedia.org/wiki/Floor_and_ceiling_functions.
///
/// Requirements:
/// - x must be greater than or equal to `MIN_WHOLE_SD59x18`.
///
/// @param x The SD59x18 number to floor.
/// @param result The greatest whole number less than or equal to x, as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function floor_0(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt < uMIN_WHOLE_SD59x18) {
        revert PRBMath_SD59x18_Floor_Underflow(x);
    }

    int256 remainder = xInt % uUNIT_1;
    if (remainder == 0) {
        result = x;
    } else {
        unchecked {
            // Solidity uses C fmod style, which returns a modulus with the same sign as x.
            int256 resultInt = xInt - remainder;
            if (xInt < 0) {
                resultInt -= uUNIT_1;
            }
            result = wrap_1(resultInt);
        }
    }
}

/// @notice Yields the excess beyond the floor of x for positive numbers and the part of the number to the right.
/// of the radix point for negative numbers.
/// @dev Based on the odd function definition. https://en.wikipedia.org/wiki/Fractional_part
/// @param x The SD59x18 number to get the fractional part of.
/// @param result The fractional part of x as an SD59x18 number.
function frac_0(SD59x18 x) pure returns (SD59x18 result) {
    result = wrap_1(x.unwrap_1() % uUNIT_1);
}

/// @notice Calculates the geometric mean of x and y, i.e. $\sqrt{x * y}$.
///
/// @dev Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - x * y must fit in SD59x18.
/// - x * y must not be negative, since complex numbers are not supported.
///
/// @param x The first operand as an SD59x18 number.
/// @param y The second operand as an SD59x18 number.
/// @return result The result as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function gm_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    int256 yInt = y.unwrap_1();
    if (xInt == 0 || yInt == 0) {
        return ZERO_0;
    }

    unchecked {
        // Equivalent to `xy / x != y`. Checking for overflow this way is faster than letting Solidity do it.
        int256 xyInt = xInt * yInt;
        if (xyInt / xInt != yInt) {
            revert PRBMath_SD59x18_Gm_Overflow(x, y);
        }

        // The product must not be negative, since complex numbers are not supported.
        if (xyInt < 0) {
            revert PRBMath_SD59x18_Gm_NegativeProduct(x, y);
        }

        // We don't need to multiply the result by `UNIT` here because the x*y product picked up a factor of `UNIT`
        // during multiplication. See the comments in {Common.sqrt}.
        uint256 resultUint = sqrt_0(uint256(xyInt));
        result = wrap_1(int256(resultUint));
    }
}

/// @notice Calculates the inverse of x.
///
/// @dev Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - x must not be zero.
///
/// @param x The SD59x18 number for which to calculate the inverse.
/// @return result The inverse as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function inv_0(SD59x18 x) pure returns (SD59x18 result) {
    result = wrap_1(uUNIT_SQUARED_0 / x.unwrap_1());
}

/// @notice Calculates the natural logarithm of x using the following formula:
///
/// $$
/// ln{x} = log_2{x} / log_2{e}
/// $$
///
/// @dev Notes:
/// - Refer to the notes in {log2}.
/// - The precision isn't sufficiently fine-grained to return exactly `UNIT` when the input is `E`.
///
/// Requirements:
/// - Refer to the requirements in {log2}.
///
/// @param x The SD59x18 number for which to calculate the natural logarithm.
/// @return result The natural logarithm as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function ln_0(SD59x18 x) pure returns (SD59x18 result) {
    // Inline the fixed-point multiplication to save gas. This is overflow-safe because the maximum value that
    // {log2} can return is ~195_205294292027477728.
    result = wrap_1(log2_0(x).unwrap_1() * uUNIT_1 / uLOG2_E_0);
}

/// @notice Calculates the common logarithm of x using the following formula:
///
/// $$
/// log_{10}{x} = log_2{x} / log_2{10}
/// $$
///
/// However, if x is an exact power of ten, a hard coded value is returned.
///
/// @dev Notes:
/// - Refer to the notes in {log2}.
///
/// Requirements:
/// - Refer to the requirements in {log2}.
///
/// @param x The SD59x18 number for which to calculate the common logarithm.
/// @return result The common logarithm as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function log10_0(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt < 0) {
        revert PRBMath_SD59x18_Log_InputTooSmall(x);
    }

    // Note that the `mul` in this block is the standard multiplication operation, not {SD59x18.mul}.
    // prettier-ignore
    assembly ("memory-safe") {
        switch x
        case 1 { result := mul(uUNIT_1, sub(0, 18)) }
        case 10 { result := mul(uUNIT_1, sub(1, 18)) }
        case 100 { result := mul(uUNIT_1, sub(2, 18)) }
        case 1000 { result := mul(uUNIT_1, sub(3, 18)) }
        case 10000 { result := mul(uUNIT_1, sub(4, 18)) }
        case 100000 { result := mul(uUNIT_1, sub(5, 18)) }
        case 1000000 { result := mul(uUNIT_1, sub(6, 18)) }
        case 10000000 { result := mul(uUNIT_1, sub(7, 18)) }
        case 100000000 { result := mul(uUNIT_1, sub(8, 18)) }
        case 1000000000 { result := mul(uUNIT_1, sub(9, 18)) }
        case 10000000000 { result := mul(uUNIT_1, sub(10, 18)) }
        case 100000000000 { result := mul(uUNIT_1, sub(11, 18)) }
        case 1000000000000 { result := mul(uUNIT_1, sub(12, 18)) }
        case 10000000000000 { result := mul(uUNIT_1, sub(13, 18)) }
        case 100000000000000 { result := mul(uUNIT_1, sub(14, 18)) }
        case 1000000000000000 { result := mul(uUNIT_1, sub(15, 18)) }
        case 10000000000000000 { result := mul(uUNIT_1, sub(16, 18)) }
        case 100000000000000000 { result := mul(uUNIT_1, sub(17, 18)) }
        case 1000000000000000000 { result := 0 }
        case 10000000000000000000 { result := uUNIT_1 }
        case 100000000000000000000 { result := mul(uUNIT_1, 2) }
        case 1000000000000000000000 { result := mul(uUNIT_1, 3) }
        case 10000000000000000000000 { result := mul(uUNIT_1, 4) }
        case 100000000000000000000000 { result := mul(uUNIT_1, 5) }
        case 1000000000000000000000000 { result := mul(uUNIT_1, 6) }
        case 10000000000000000000000000 { result := mul(uUNIT_1, 7) }
        case 100000000000000000000000000 { result := mul(uUNIT_1, 8) }
        case 1000000000000000000000000000 { result := mul(uUNIT_1, 9) }
        case 10000000000000000000000000000 { result := mul(uUNIT_1, 10) }
        case 100000000000000000000000000000 { result := mul(uUNIT_1, 11) }
        case 1000000000000000000000000000000 { result := mul(uUNIT_1, 12) }
        case 10000000000000000000000000000000 { result := mul(uUNIT_1, 13) }
        case 100000000000000000000000000000000 { result := mul(uUNIT_1, 14) }
        case 1000000000000000000000000000000000 { result := mul(uUNIT_1, 15) }
        case 10000000000000000000000000000000000 { result := mul(uUNIT_1, 16) }
        case 100000000000000000000000000000000000 { result := mul(uUNIT_1, 17) }
        case 1000000000000000000000000000000000000 { result := mul(uUNIT_1, 18) }
        case 10000000000000000000000000000000000000 { result := mul(uUNIT_1, 19) }
        case 100000000000000000000000000000000000000 { result := mul(uUNIT_1, 20) }
        case 1000000000000000000000000000000000000000 { result := mul(uUNIT_1, 21) }
        case 10000000000000000000000000000000000000000 { result := mul(uUNIT_1, 22) }
        case 100000000000000000000000000000000000000000 { result := mul(uUNIT_1, 23) }
        case 1000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 24) }
        case 10000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 25) }
        case 100000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 26) }
        case 1000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 27) }
        case 10000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 28) }
        case 100000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 29) }
        case 1000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 30) }
        case 10000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 31) }
        case 100000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 32) }
        case 1000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 33) }
        case 10000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 34) }
        case 100000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 35) }
        case 1000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 36) }
        case 10000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 37) }
        case 100000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 38) }
        case 1000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 39) }
        case 10000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 40) }
        case 100000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 41) }
        case 1000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 42) }
        case 10000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 43) }
        case 100000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 44) }
        case 1000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 45) }
        case 10000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 46) }
        case 100000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 47) }
        case 1000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 48) }
        case 10000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 49) }
        case 100000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 50) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 51) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 52) }
        case 100000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 53) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 54) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 55) }
        case 100000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 56) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 57) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_1, 58) }
        default { result := uMAX_SD59x18 }
    }

    if (result.unwrap_1() == uMAX_SD59x18) {
        unchecked {
            // Inline the fixed-point division to save gas.
            result = wrap_1(log2_0(x).unwrap_1() * uUNIT_1 / uLOG2_10_0);
        }
    }
}

/// @notice Calculates the binary logarithm of x using the iterative approximation algorithm:
///
/// $$
/// log_2{x} = n + log_2{y}, \text{ where } y = x*2^{-n}, \ y \in [1, 2)
/// $$
///
/// For $0 \leq x \lt 1$, the input is inverted:
///
/// $$
/// log_2{x} = -log_2{\frac{1}{x}}
/// $$
///
/// @dev See https://en.wikipedia.org/wiki/Binary_logarithm#Iterative_approximation.
///
/// Notes:
/// - Due to the lossy precision of the iterative approximation, the results are not perfectly accurate to the last decimal.
///
/// Requirements:
/// - x must be greater than zero.
///
/// @param x The SD59x18 number for which to calculate the binary logarithm.
/// @return result The binary logarithm as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function log2_0(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt <= 0) {
        revert PRBMath_SD59x18_Log_InputTooSmall(x);
    }

    unchecked {
        int256 sign;
        if (xInt >= uUNIT_1) {
            sign = 1;
        } else {
            sign = -1;
            // Inline the fixed-point inversion to save gas.
            xInt = uUNIT_SQUARED_0 / xInt;
        }

        // Calculate the integer part of the logarithm.
        uint256 n = msb(uint256(xInt / uUNIT_1));

        // This is the integer part of the logarithm as an SD59x18 number. The operation can't overflow
        // because n is at most 255, `UNIT` is 1e18, and the sign is either 1 or -1.
        int256 resultInt = int256(n) * uUNIT_1;

        // Calculate $y = x * 2^{-n}$.
        int256 y = xInt >> n;

        // If y is the unit number, the fractional part is zero.
        if (y == uUNIT_1) {
            return wrap_1(resultInt * sign);
        }

        // Calculate the fractional part via the iterative approximation.
        // The `delta >>= 1` part is equivalent to `delta /= 2`, but shifting bits is more gas efficient.
        int256 DOUBLE_UNIT = 2e18;
        for (int256 delta = uHALF_UNIT_0; delta > 0; delta >>= 1) {
            y = (y * y) / uUNIT_1;

            // Is y^2 >= 2e18 and so in the range [2e18, 4e18)?
            if (y >= DOUBLE_UNIT) {
                // Add the 2^{-m} factor to the logarithm.
                resultInt = resultInt + delta;

                // Halve y, which corresponds to z/2 in the Wikipedia article.
                y >>= 1;
            }
        }
        resultInt *= sign;
        result = wrap_1(resultInt);
    }
}

/// @notice Multiplies two SD59x18 numbers together, returning a new SD59x18 number.
///
/// @dev Notes:
/// - Refer to the notes in {Common.mulDiv18}.
///
/// Requirements:
/// - Refer to the requirements in {Common.mulDiv18}.
/// - None of the inputs can be `MIN_SD59x18`.
/// - The result must fit in SD59x18.
///
/// @param x The multiplicand as an SD59x18 number.
/// @param y The multiplier as an SD59x18 number.
/// @return result The product as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function mul_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    int256 yInt = y.unwrap_1();
    if (xInt == uMIN_SD59x18 || yInt == uMIN_SD59x18) {
        revert PRBMath_SD59x18_Mul_InputTooSmall();
    }

    // Get hold of the absolute values of x and y.
    uint256 xAbs;
    uint256 yAbs;
    unchecked {
        xAbs = xInt < 0 ? uint256(-xInt) : uint256(xInt);
        yAbs = yInt < 0 ? uint256(-yInt) : uint256(yInt);
    }

    // Compute the absolute value (x*y÷UNIT). The resulting value must fit in SD59x18.
    uint256 resultAbs = mulDiv18(xAbs, yAbs);
    if (resultAbs > uint256(uMAX_SD59x18)) {
        revert PRBMath_SD59x18_Mul_Overflow(x, y);
    }

    // Check if x and y have the same sign using two's complement representation. The left-most bit represents the sign (1 for
    // negative, 0 for positive or zero).
    bool sameSign = (xInt ^ yInt) > -1;

    // If the inputs have the same sign, the result should be positive. Otherwise, it should be negative.
    unchecked {
        result = wrap_1(sameSign ? int256(resultAbs) : -int256(resultAbs));
    }
}

/// @notice Raises x to the power of y using the following formula:
///
/// $$
/// x^y = 2^{log_2{x} * y}
/// $$
///
/// @dev Notes:
/// - Refer to the notes in {exp2}, {log2}, and {mul}.
/// - Returns `UNIT` for 0^0.
///
/// Requirements:
/// - Refer to the requirements in {exp2}, {log2}, and {mul}.
///
/// @param x The base as an SD59x18 number.
/// @param y Exponent to raise x to, as an SD59x18 number
/// @return result x raised to power y, as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function pow_0(SD59x18 x, SD59x18 y) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    int256 yInt = y.unwrap_1();

    // If both x and y are zero, the result is `UNIT`. If just x is zero, the result is always zero.
    if (xInt == 0) {
        return yInt == 0 ? UNIT_2 : ZERO_0;
    }
    // If x is `UNIT`, the result is always `UNIT`.
    else if (xInt == uUNIT_1) {
        return UNIT_2;
    }

    // If y is zero, the result is always `UNIT`.
    if (yInt == 0) {
        return UNIT_2;
    }
    // If y is `UNIT`, the result is always x.
    else if (yInt == uUNIT_1) {
        return x;
    }

    // Calculate the result using the formula.
    result = exp2_1(mul_0(log2_0(x), y));
}

/// @notice Raises x (an SD59x18 number) to the power y (an unsigned basic integer) using the well-known
/// algorithm "exponentiation by squaring".
///
/// @dev See https://en.wikipedia.org/wiki/Exponentiation_by_squaring.
///
/// Notes:
/// - Refer to the notes in {Common.mulDiv18}.
/// - Returns `UNIT` for 0^0.
///
/// Requirements:
/// - Refer to the requirements in {abs} and {Common.mulDiv18}.
/// - The result must fit in SD59x18.
///
/// @param x The base as an SD59x18 number.
/// @param y The exponent as a uint256.
/// @return result The result as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function powu_0(SD59x18 x, uint256 y) pure returns (SD59x18 result) {
    uint256 xAbs = uint256(abs(x).unwrap_1());

    // Calculate the first iteration of the loop in advance.
    uint256 resultAbs = y & 1 > 0 ? xAbs : uint256(uUNIT_1);

    // Equivalent to `for(y /= 2; y > 0; y /= 2)`.
    uint256 yAux = y;
    for (yAux >>= 1; yAux > 0; yAux >>= 1) {
        xAbs = mulDiv18(xAbs, xAbs);

        // Equivalent to `y % 2 == 1`.
        if (yAux & 1 > 0) {
            resultAbs = mulDiv18(resultAbs, xAbs);
        }
    }

    // The result must fit in SD59x18.
    if (resultAbs > uint256(uMAX_SD59x18)) {
        revert PRBMath_SD59x18_Powu_Overflow(x, y);
    }

    unchecked {
        // Is the base negative and the exponent odd? If yes, the result should be negative.
        int256 resultInt = int256(resultAbs);
        bool isNegative = x.unwrap_1() < 0 && y & 1 == 1;
        if (isNegative) {
            resultInt = -resultInt;
        }
        result = wrap_1(resultInt);
    }
}

/// @notice Calculates the square root of x using the Babylonian method.
///
/// @dev See https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method.
///
/// Notes:
/// - Only the positive root is returned.
/// - The result is rounded toward zero.
///
/// Requirements:
/// - x cannot be negative, since complex numbers are not supported.
/// - x must be less than `MAX_SD59x18 / UNIT`.
///
/// @param x The SD59x18 number for which to calculate the square root.
/// @return result The result as an SD59x18 number.
/// @custom:smtchecker abstract-function-nondet
function sqrt_1(SD59x18 x) pure returns (SD59x18 result) {
    int256 xInt = x.unwrap_1();
    if (xInt < 0) {
        revert PRBMath_SD59x18_Sqrt_NegativeInput(x);
    }
    if (xInt > uMAX_SD59x18 / uUNIT_1) {
        revert PRBMath_SD59x18_Sqrt_Overflow(x);
    }

    unchecked {
        // Multiply x by `UNIT` to account for the factor of `UNIT` picked up when multiplying two SD59x18 numbers.
        // In this case, the two numbers are both the square root.
        uint256 resultUint = sqrt_0(uint256(xInt * uUNIT_1));
        result = wrap_1(int256(resultUint));
    }
}

// lib/snowbridge/contracts/lib/prb-math/src/sd59x18/ValueType.sol

/// @notice The signed 59.18-decimal fixed-point number representation, which can have up to 59 digits and up to 18
/// decimals. The values of this are bound by the minimum and the maximum values permitted by the underlying Solidity
/// type int256.
type SD59x18 is int256;

/*//////////////////////////////////////////////////////////////////////////
                                    CASTING
//////////////////////////////////////////////////////////////////////////*/

using {
    intoInt256,
    intoSD1x18_0,
    intoUD2x18_1,
    intoUD60x18_1,
    intoUint256_1,
    intoUint128_1,
    intoUint40_1,
    unwrap_1
} for SD59x18 global;

/*//////////////////////////////////////////////////////////////////////////
                            MATHEMATICAL FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

using {
    abs,
    avg_0,
    ceil_0,
    div_0,
    exp_0,
    exp2_1,
    floor_0,
    frac_0,
    gm_0,
    inv_0,
    log10_0,
    log2_0,
    ln_0,
    mul_0,
    pow_0,
    powu_0,
    sqrt_1
} for SD59x18 global;

/*//////////////////////////////////////////////////////////////////////////
                                HELPER FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

using {
    add_0,
    and_0,
    eq_0,
    gt_0,
    gte_0,
    isZero_0,
    lshift_0,
    lt_0,
    lte_0,
    mod_0,
    neq_0,
    not_0,
    or_0,
    rshift_0,
    sub_0,
    uncheckedAdd_0,
    uncheckedSub_0,
    uncheckedUnary,
    xor_0
} for SD59x18 global;

/*//////////////////////////////////////////////////////////////////////////
                                    OPERATORS
//////////////////////////////////////////////////////////////////////////*/

// The global "using for" directive makes it possible to use these operators on the SD59x18 type.
using {
    add_0 as +,
    and2_0 as &,
    div_0 as /,
    eq_0 as ==,
    gt_0 as >,
    gte_0 as >=,
    lt_0 as <,
    lte_0 as <=,
    mod_0 as %,
    mul_0 as *,
    neq_0 as !=,
    not_0 as ~,
    or_0 as |,
    sub_0 as -,
    unary as -,
    xor_0 as ^
} for SD59x18 global;

// lib/snowbridge/contracts/lib/prb-math/src/ud2x18/Casting.sol

/// @notice Casts a UD2x18 number into SD1x18.
/// - x must be less than or equal to `uMAX_SD1x18`.
function intoSD1x18_1(UD2x18 x) pure returns (SD1x18 result) {
    uint64 xUint = UD2x18.unwrap(x);
    if (xUint > uint64(uMAX_SD1x18)) {
        revert PRBMath_UD2x18_IntoSD1x18_Overflow(x);
    }
    result = SD1x18.wrap(int64(xUint));
}

/// @notice Casts a UD2x18 number into SD59x18.
/// @dev There is no overflow check because the domain of UD2x18 is a subset of SD59x18.
function intoSD59x18_1(UD2x18 x) pure returns (SD59x18 result) {
    result = SD59x18.wrap(int256(uint256(UD2x18.unwrap(x))));
}

/// @notice Casts a UD2x18 number into UD60x18.
/// @dev There is no overflow check because the domain of UD2x18 is a subset of UD60x18.
function intoUD60x18_2(UD2x18 x) pure returns (UD60x18 result) {
    result = UD60x18.wrap(UD2x18.unwrap(x));
}

/// @notice Casts a UD2x18 number into uint128.
/// @dev There is no overflow check because the domain of UD2x18 is a subset of uint128.
function intoUint128_2(UD2x18 x) pure returns (uint128 result) {
    result = uint128(UD2x18.unwrap(x));
}

/// @notice Casts a UD2x18 number into uint256.
/// @dev There is no overflow check because the domain of UD2x18 is a subset of uint256.
function intoUint256_2(UD2x18 x) pure returns (uint256 result) {
    result = uint256(UD2x18.unwrap(x));
}

/// @notice Casts a UD2x18 number into uint40.
/// @dev Requirements:
/// - x must be less than or equal to `MAX_UINT40`.
function intoUint40_2(UD2x18 x) pure returns (uint40 result) {
    uint64 xUint = UD2x18.unwrap(x);
    if (xUint > uint64(MAX_UINT40)) {
        revert PRBMath_UD2x18_IntoUint40_Overflow(x);
    }
    result = uint40(xUint);
}

/// @notice Alias for {wrap}.
function ud2x18(uint64 x) pure returns (UD2x18 result) {
    result = UD2x18.wrap(x);
}

/// @notice Unwrap a UD2x18 number into uint64.
function unwrap_2(UD2x18 x) pure returns (uint64 result) {
    result = UD2x18.unwrap(x);
}

/// @notice Wraps a uint64 number into UD2x18.
function wrap_2(uint64 x) pure returns (UD2x18 result) {
    result = UD2x18.wrap(x);
}

// lib/snowbridge/contracts/lib/prb-math/src/ud2x18/Constants.sol

/// @dev Euler's number as a UD2x18 number.
UD2x18 constant E_2 = UD2x18.wrap(2_718281828459045235);

/// @dev The maximum value a UD2x18 number can have.
uint64 constant uMAX_UD2x18 = 18_446744073709551615;
UD2x18 constant MAX_UD2x18 = UD2x18.wrap(uMAX_UD2x18);

/// @dev PI as a UD2x18 number.
UD2x18 constant PI_2 = UD2x18.wrap(3_141592653589793238);

/// @dev The unit number, which gives the decimal precision of UD2x18.
uint256 constant uUNIT_2 = 1e18;
UD2x18 constant UNIT_3 = UD2x18.wrap(1e18);

// lib/snowbridge/contracts/lib/prb-math/src/ud2x18/Errors.sol

/// @notice Thrown when trying to cast a UD2x18 number that doesn't fit in SD1x18.
error PRBMath_UD2x18_IntoSD1x18_Overflow(UD2x18 x);

/// @notice Thrown when trying to cast a UD2x18 number that doesn't fit in uint40.
error PRBMath_UD2x18_IntoUint40_Overflow(UD2x18 x);

// lib/snowbridge/contracts/lib/prb-math/src/ud2x18/ValueType.sol

/// @notice The unsigned 2.18-decimal fixed-point number representation, which can have up to 2 digits and up to 18
/// decimals. The values of this are bound by the minimum and the maximum values permitted by the underlying Solidity
/// type uint64. This is useful when end users want to use uint64 to save gas, e.g. with tight variable packing in contract
/// storage.
type UD2x18 is uint64;

/*//////////////////////////////////////////////////////////////////////////
                                    CASTING
//////////////////////////////////////////////////////////////////////////*/

using {
    intoSD1x18_1,
    intoSD59x18_1,
    intoUD60x18_2,
    intoUint256_2,
    intoUint128_2,
    intoUint40_2,
    unwrap_2
} for UD2x18 global;

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Casting.sol

/// @notice Casts a UD60x18 number into SD1x18.
/// @dev Requirements:
/// - x must be less than or equal to `uMAX_SD1x18`.
function intoSD1x18_2(UD60x18 x) pure returns (SD1x18 result) {
    uint256 xUint = UD60x18.unwrap(x);
    if (xUint > uint256(int256(uMAX_SD1x18))) {
        revert PRBMath_UD60x18_IntoSD1x18_Overflow(x);
    }
    result = SD1x18.wrap(int64(uint64(xUint)));
}

/// @notice Casts a UD60x18 number into UD2x18.
/// @dev Requirements:
/// - x must be less than or equal to `uMAX_UD2x18`.
function intoUD2x18_2(UD60x18 x) pure returns (UD2x18 result) {
    uint256 xUint = UD60x18.unwrap(x);
    if (xUint > uMAX_UD2x18) {
        revert PRBMath_UD60x18_IntoUD2x18_Overflow(x);
    }
    result = UD2x18.wrap(uint64(xUint));
}

/// @notice Casts a UD60x18 number into SD59x18.
/// @dev Requirements:
/// - x must be less than or equal to `uMAX_SD59x18`.
function intoSD59x18_2(UD60x18 x) pure returns (SD59x18 result) {
    uint256 xUint = UD60x18.unwrap(x);
    if (xUint > uint256(uMAX_SD59x18)) {
        revert PRBMath_UD60x18_IntoSD59x18_Overflow(x);
    }
    result = SD59x18.wrap(int256(xUint));
}

/// @notice Casts a UD60x18 number into uint128.
/// @dev This is basically an alias for {unwrap}.
function intoUint256_3(UD60x18 x) pure returns (uint256 result) {
    result = UD60x18.unwrap(x);
}

/// @notice Casts a UD60x18 number into uint128.
/// @dev Requirements:
/// - x must be less than or equal to `MAX_UINT128`.
function intoUint128_3(UD60x18 x) pure returns (uint128 result) {
    uint256 xUint = UD60x18.unwrap(x);
    if (xUint > MAX_UINT128) {
        revert PRBMath_UD60x18_IntoUint128_Overflow(x);
    }
    result = uint128(xUint);
}

/// @notice Casts a UD60x18 number into uint40.
/// @dev Requirements:
/// - x must be less than or equal to `MAX_UINT40`.
function intoUint40_3(UD60x18 x) pure returns (uint40 result) {
    uint256 xUint = UD60x18.unwrap(x);
    if (xUint > MAX_UINT40) {
        revert PRBMath_UD60x18_IntoUint40_Overflow(x);
    }
    result = uint40(xUint);
}

/// @notice Alias for {wrap}.
function ud(uint256 x) pure returns (UD60x18 result) {
    result = UD60x18.wrap(x);
}

/// @notice Alias for {wrap}.
function ud60x18(uint256 x) pure returns (UD60x18 result) {
    result = UD60x18.wrap(x);
}

/// @notice Unwraps a UD60x18 number into uint256.
function unwrap_3(UD60x18 x) pure returns (uint256 result) {
    result = UD60x18.unwrap(x);
}

/// @notice Wraps a uint256 number into the UD60x18 value type.
function wrap_3(uint256 x) pure returns (UD60x18 result) {
    result = UD60x18.wrap(x);
}

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Constants.sol

// NOTICE: the "u" prefix stands for "unwrapped".

/// @dev Euler's number as a UD60x18 number.
UD60x18 constant E_3 = UD60x18.wrap(2_718281828459045235);

/// @dev The maximum input permitted in {exp}.
uint256 constant uEXP_MAX_INPUT_1 = 133_084258667509499440;
UD60x18 constant EXP_MAX_INPUT_1 = UD60x18.wrap(uEXP_MAX_INPUT_1);

/// @dev The maximum input permitted in {exp2}.
uint256 constant uEXP2_MAX_INPUT_1 = 192e18 - 1;
UD60x18 constant EXP2_MAX_INPUT_1 = UD60x18.wrap(uEXP2_MAX_INPUT_1);

/// @dev Half the UNIT number.
uint256 constant uHALF_UNIT_1 = 0.5e18;
UD60x18 constant HALF_UNIT_1 = UD60x18.wrap(uHALF_UNIT_1);

/// @dev $log_2(10)$ as a UD60x18 number.
uint256 constant uLOG2_10_1 = 3_321928094887362347;
UD60x18 constant LOG2_10_1 = UD60x18.wrap(uLOG2_10_1);

/// @dev $log_2(e)$ as a UD60x18 number.
uint256 constant uLOG2_E_1 = 1_442695040888963407;
UD60x18 constant LOG2_E_1 = UD60x18.wrap(uLOG2_E_1);

/// @dev The maximum value a UD60x18 number can have.
uint256 constant uMAX_UD60x18 = 115792089237316195423570985008687907853269984665640564039457_584007913129639935;
UD60x18 constant MAX_UD60x18 = UD60x18.wrap(uMAX_UD60x18);

/// @dev The maximum whole value a UD60x18 number can have.
uint256 constant uMAX_WHOLE_UD60x18 = 115792089237316195423570985008687907853269984665640564039457_000000000000000000;
UD60x18 constant MAX_WHOLE_UD60x18 = UD60x18.wrap(uMAX_WHOLE_UD60x18);

/// @dev PI as a UD60x18 number.
UD60x18 constant PI_3 = UD60x18.wrap(3_141592653589793238);

/// @dev The unit number, which gives the decimal precision of UD60x18.
uint256 constant uUNIT_3 = 1e18;
UD60x18 constant UNIT_4 = UD60x18.wrap(uUNIT_3);

/// @dev The unit number squared.
uint256 constant uUNIT_SQUARED_1 = 1e36;
UD60x18 constant UNIT_SQUARED_1 = UD60x18.wrap(uUNIT_SQUARED_1);

/// @dev Zero as a UD60x18 number.
UD60x18 constant ZERO_1 = UD60x18.wrap(0);

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Errors.sol

/// @notice Thrown when ceiling a number overflows UD60x18.
error PRBMath_UD60x18_Ceil_Overflow(UD60x18 x);

/// @notice Thrown when converting a basic integer to the fixed-point format overflows UD60x18.
error PRBMath_UD60x18_Convert_Overflow(uint256 x);

/// @notice Thrown when taking the natural exponent of a base greater than 133_084258667509499441.
error PRBMath_UD60x18_Exp_InputTooBig(UD60x18 x);

/// @notice Thrown when taking the binary exponent of a base greater than 192e18.
error PRBMath_UD60x18_Exp2_InputTooBig(UD60x18 x);

/// @notice Thrown when taking the geometric mean of two numbers and multiplying them overflows UD60x18.
error PRBMath_UD60x18_Gm_Overflow(UD60x18 x, UD60x18 y);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in SD1x18.
error PRBMath_UD60x18_IntoSD1x18_Overflow(UD60x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in SD59x18.
error PRBMath_UD60x18_IntoSD59x18_Overflow(UD60x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in UD2x18.
error PRBMath_UD60x18_IntoUD2x18_Overflow(UD60x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint128.
error PRBMath_UD60x18_IntoUint128_Overflow(UD60x18 x);

/// @notice Thrown when trying to cast a UD60x18 number that doesn't fit in uint40.
error PRBMath_UD60x18_IntoUint40_Overflow(UD60x18 x);

/// @notice Thrown when taking the logarithm of a number less than 1.
error PRBMath_UD60x18_Log_InputTooSmall(UD60x18 x);

/// @notice Thrown when calculating the square root overflows UD60x18.
error PRBMath_UD60x18_Sqrt_Overflow(UD60x18 x);

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Helpers.sol

/// @notice Implements the checked addition operation (+) in the UD60x18 type.
function add_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() + y.unwrap_3());
}

/// @notice Implements the AND (&) bitwise operation in the UD60x18 type.
function and_1(UD60x18 x, uint256 bits) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() & bits);
}

/// @notice Implements the AND (&) bitwise operation in the UD60x18 type.
function and2_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() & y.unwrap_3());
}

/// @notice Implements the equal operation (==) in the UD60x18 type.
function eq_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() == y.unwrap_3();
}

/// @notice Implements the greater than operation (>) in the UD60x18 type.
function gt_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() > y.unwrap_3();
}

/// @notice Implements the greater than or equal to operation (>=) in the UD60x18 type.
function gte_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() >= y.unwrap_3();
}

/// @notice Implements a zero comparison check function in the UD60x18 type.
function isZero_1(UD60x18 x) pure returns (bool result) {
    // This wouldn't work if x could be negative.
    result = x.unwrap_3() == 0;
}

/// @notice Implements the left shift operation (<<) in the UD60x18 type.
function lshift_1(UD60x18 x, uint256 bits) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() << bits);
}

/// @notice Implements the lower than operation (<) in the UD60x18 type.
function lt_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() < y.unwrap_3();
}

/// @notice Implements the lower than or equal to operation (<=) in the UD60x18 type.
function lte_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() <= y.unwrap_3();
}

/// @notice Implements the checked modulo operation (%) in the UD60x18 type.
function mod_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() % y.unwrap_3());
}

/// @notice Implements the not equal operation (!=) in the UD60x18 type.
function neq_1(UD60x18 x, UD60x18 y) pure returns (bool result) {
    result = x.unwrap_3() != y.unwrap_3();
}

/// @notice Implements the NOT (~) bitwise operation in the UD60x18 type.
function not_1(UD60x18 x) pure returns (UD60x18 result) {
    result = wrap_3(~x.unwrap_3());
}

/// @notice Implements the OR (|) bitwise operation in the UD60x18 type.
function or_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() | y.unwrap_3());
}

/// @notice Implements the right shift operation (>>) in the UD60x18 type.
function rshift_1(UD60x18 x, uint256 bits) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() >> bits);
}

/// @notice Implements the checked subtraction operation (-) in the UD60x18 type.
function sub_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() - y.unwrap_3());
}

/// @notice Implements the unchecked addition operation (+) in the UD60x18 type.
function uncheckedAdd_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    unchecked {
        result = wrap_3(x.unwrap_3() + y.unwrap_3());
    }
}

/// @notice Implements the unchecked subtraction operation (-) in the UD60x18 type.
function uncheckedSub_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    unchecked {
        result = wrap_3(x.unwrap_3() - y.unwrap_3());
    }
}

/// @notice Implements the XOR (^) bitwise operation in the UD60x18 type.
function xor_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(x.unwrap_3() ^ y.unwrap_3());
}

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Math.sol

/*//////////////////////////////////////////////////////////////////////////
                            MATHEMATICAL FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

/// @notice Calculates the arithmetic average of x and y using the following formula:
///
/// $$
/// avg(x, y) = (x & y) + ((xUint ^ yUint) / 2)
/// $$
//
/// In English, this is what this formula does:
///
/// 1. AND x and y.
/// 2. Calculate half of XOR x and y.
/// 3. Add the two results together.
///
/// This technique is known as SWAR, which stands for "SIMD within a register". You can read more about it here:
/// https://devblogs.microsoft.com/oldnewthing/20220207-00/?p=106223
///
/// @dev Notes:
/// - The result is rounded toward zero.
///
/// @param x The first operand as a UD60x18 number.
/// @param y The second operand as a UD60x18 number.
/// @return result The arithmetic average as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function avg_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();
    uint256 yUint = y.unwrap_3();
    unchecked {
        result = wrap_3((xUint & yUint) + ((xUint ^ yUint) >> 1));
    }
}

/// @notice Yields the smallest whole number greater than or equal to x.
///
/// @dev This is optimized for fractional value inputs, because for every whole value there are (1e18 - 1) fractional
/// counterparts. See https://en.wikipedia.org/wiki/Floor_and_ceiling_functions.
///
/// Requirements:
/// - x must be less than or equal to `MAX_WHOLE_UD60x18`.
///
/// @param x The UD60x18 number to ceil.
/// @param result The smallest whole number greater than or equal to x, as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function ceil_1(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();
    if (xUint > uMAX_WHOLE_UD60x18) {
        revert PRBMath_UD60x18_Ceil_Overflow(x);
    }

    assembly ("memory-safe") {
        // Equivalent to `x % UNIT`.
        let remainder := mod(x, uUNIT_3)

        // Equivalent to `UNIT - remainder`.
        let delta := sub(uUNIT_3, remainder)

        // Equivalent to `x + remainder > 0 ? delta : 0`.
        result := add(x, mul(delta, gt(remainder, 0)))
    }
}

/// @notice Divides two UD60x18 numbers, returning a new UD60x18 number.
///
/// @dev Uses {Common.mulDiv} to enable overflow-safe multiplication and division.
///
/// Notes:
/// - Refer to the notes in {Common.mulDiv}.
///
/// Requirements:
/// - Refer to the requirements in {Common.mulDiv}.
///
/// @param x The numerator as a UD60x18 number.
/// @param y The denominator as a UD60x18 number.
/// @param result The quotient as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function div_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(mulDiv(x.unwrap_3(), uUNIT_3, y.unwrap_3()));
}

/// @notice Calculates the natural exponent of x using the following formula:
///
/// $$
/// e^x = 2^{x * log_2{e}}
/// $$
///
/// @dev Requirements:
/// - x must be less than 133_084258667509499441.
///
/// @param x The exponent as a UD60x18 number.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function exp_1(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();

    // This check prevents values greater than 192e18 from being passed to {exp2}.
    if (xUint > uEXP_MAX_INPUT_1) {
        revert PRBMath_UD60x18_Exp_InputTooBig(x);
    }

    unchecked {
        // Inline the fixed-point multiplication to save gas.
        uint256 doubleUnitProduct = xUint * uLOG2_E_1;
        result = exp2_2(wrap_3(doubleUnitProduct / uUNIT_3));
    }
}

/// @notice Calculates the binary exponent of x using the binary fraction method.
///
/// @dev See https://ethereum.stackexchange.com/q/79903/24693
///
/// Requirements:
/// - x must be less than 192e18.
/// - The result must fit in UD60x18.
///
/// @param x The exponent as a UD60x18 number.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function exp2_2(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();

    // Numbers greater than or equal to 192e18 don't fit in the 192.64-bit format.
    if (xUint > uEXP2_MAX_INPUT_1) {
        revert PRBMath_UD60x18_Exp2_InputTooBig(x);
    }

    // Convert x to the 192.64-bit fixed-point format.
    uint256 x_192x64 = (xUint << 64) / uUNIT_3;

    // Pass x to the {Common.exp2} function, which uses the 192.64-bit fixed-point number representation.
    result = wrap_3(exp2_0(x_192x64));
}

/// @notice Yields the greatest whole number less than or equal to x.
/// @dev Optimized for fractional value inputs, because every whole value has (1e18 - 1) fractional counterparts.
/// See https://en.wikipedia.org/wiki/Floor_and_ceiling_functions.
/// @param x The UD60x18 number to floor.
/// @param result The greatest whole number less than or equal to x, as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function floor_1(UD60x18 x) pure returns (UD60x18 result) {
    assembly ("memory-safe") {
        // Equivalent to `x % UNIT`.
        let remainder := mod(x, uUNIT_3)

        // Equivalent to `x - remainder > 0 ? remainder : 0)`.
        result := sub(x, mul(remainder, gt(remainder, 0)))
    }
}

/// @notice Yields the excess beyond the floor of x using the odd function definition.
/// @dev See https://en.wikipedia.org/wiki/Fractional_part.
/// @param x The UD60x18 number to get the fractional part of.
/// @param result The fractional part of x as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function frac_1(UD60x18 x) pure returns (UD60x18 result) {
    assembly ("memory-safe") {
        result := mod(x, uUNIT_3)
    }
}

/// @notice Calculates the geometric mean of x and y, i.e. $\sqrt{x * y}$, rounding down.
///
/// @dev Requirements:
/// - x * y must fit in UD60x18.
///
/// @param x The first operand as a UD60x18 number.
/// @param y The second operand as a UD60x18 number.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function gm_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();
    uint256 yUint = y.unwrap_3();
    if (xUint == 0 || yUint == 0) {
        return ZERO_1;
    }

    unchecked {
        // Checking for overflow this way is faster than letting Solidity do it.
        uint256 xyUint = xUint * yUint;
        if (xyUint / xUint != yUint) {
            revert PRBMath_UD60x18_Gm_Overflow(x, y);
        }

        // We don't need to multiply the result by `UNIT` here because the x*y product picked up a factor of `UNIT`
        // during multiplication. See the comments in {Common.sqrt}.
        result = wrap_3(sqrt_0(xyUint));
    }
}

/// @notice Calculates the inverse of x.
///
/// @dev Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - x must not be zero.
///
/// @param x The UD60x18 number for which to calculate the inverse.
/// @return result The inverse as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function inv_1(UD60x18 x) pure returns (UD60x18 result) {
    unchecked {
        result = wrap_3(uUNIT_SQUARED_1 / x.unwrap_3());
    }
}

/// @notice Calculates the natural logarithm of x using the following formula:
///
/// $$
/// ln{x} = log_2{x} / log_2{e}
/// $$
///
/// @dev Notes:
/// - Refer to the notes in {log2}.
/// - The precision isn't sufficiently fine-grained to return exactly `UNIT` when the input is `E`.
///
/// Requirements:
/// - Refer to the requirements in {log2}.
///
/// @param x The UD60x18 number for which to calculate the natural logarithm.
/// @return result The natural logarithm as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function ln_1(UD60x18 x) pure returns (UD60x18 result) {
    unchecked {
        // Inline the fixed-point multiplication to save gas. This is overflow-safe because the maximum value that
        // {log2} can return is ~196_205294292027477728.
        result = wrap_3(log2_1(x).unwrap_3() * uUNIT_3 / uLOG2_E_1);
    }
}

/// @notice Calculates the common logarithm of x using the following formula:
///
/// $$
/// log_{10}{x} = log_2{x} / log_2{10}
/// $$
///
/// However, if x is an exact power of ten, a hard coded value is returned.
///
/// @dev Notes:
/// - Refer to the notes in {log2}.
///
/// Requirements:
/// - Refer to the requirements in {log2}.
///
/// @param x The UD60x18 number for which to calculate the common logarithm.
/// @return result The common logarithm as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function log10_1(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();
    if (xUint < uUNIT_3) {
        revert PRBMath_UD60x18_Log_InputTooSmall(x);
    }

    // Note that the `mul` in this assembly block is the standard multiplication operation, not {UD60x18.mul}.
    // prettier-ignore
    assembly ("memory-safe") {
        switch x
        case 1 { result := mul(uUNIT_3, sub(0, 18)) }
        case 10 { result := mul(uUNIT_3, sub(1, 18)) }
        case 100 { result := mul(uUNIT_3, sub(2, 18)) }
        case 1000 { result := mul(uUNIT_3, sub(3, 18)) }
        case 10000 { result := mul(uUNIT_3, sub(4, 18)) }
        case 100000 { result := mul(uUNIT_3, sub(5, 18)) }
        case 1000000 { result := mul(uUNIT_3, sub(6, 18)) }
        case 10000000 { result := mul(uUNIT_3, sub(7, 18)) }
        case 100000000 { result := mul(uUNIT_3, sub(8, 18)) }
        case 1000000000 { result := mul(uUNIT_3, sub(9, 18)) }
        case 10000000000 { result := mul(uUNIT_3, sub(10, 18)) }
        case 100000000000 { result := mul(uUNIT_3, sub(11, 18)) }
        case 1000000000000 { result := mul(uUNIT_3, sub(12, 18)) }
        case 10000000000000 { result := mul(uUNIT_3, sub(13, 18)) }
        case 100000000000000 { result := mul(uUNIT_3, sub(14, 18)) }
        case 1000000000000000 { result := mul(uUNIT_3, sub(15, 18)) }
        case 10000000000000000 { result := mul(uUNIT_3, sub(16, 18)) }
        case 100000000000000000 { result := mul(uUNIT_3, sub(17, 18)) }
        case 1000000000000000000 { result := 0 }
        case 10000000000000000000 { result := uUNIT_3 }
        case 100000000000000000000 { result := mul(uUNIT_3, 2) }
        case 1000000000000000000000 { result := mul(uUNIT_3, 3) }
        case 10000000000000000000000 { result := mul(uUNIT_3, 4) }
        case 100000000000000000000000 { result := mul(uUNIT_3, 5) }
        case 1000000000000000000000000 { result := mul(uUNIT_3, 6) }
        case 10000000000000000000000000 { result := mul(uUNIT_3, 7) }
        case 100000000000000000000000000 { result := mul(uUNIT_3, 8) }
        case 1000000000000000000000000000 { result := mul(uUNIT_3, 9) }
        case 10000000000000000000000000000 { result := mul(uUNIT_3, 10) }
        case 100000000000000000000000000000 { result := mul(uUNIT_3, 11) }
        case 1000000000000000000000000000000 { result := mul(uUNIT_3, 12) }
        case 10000000000000000000000000000000 { result := mul(uUNIT_3, 13) }
        case 100000000000000000000000000000000 { result := mul(uUNIT_3, 14) }
        case 1000000000000000000000000000000000 { result := mul(uUNIT_3, 15) }
        case 10000000000000000000000000000000000 { result := mul(uUNIT_3, 16) }
        case 100000000000000000000000000000000000 { result := mul(uUNIT_3, 17) }
        case 1000000000000000000000000000000000000 { result := mul(uUNIT_3, 18) }
        case 10000000000000000000000000000000000000 { result := mul(uUNIT_3, 19) }
        case 100000000000000000000000000000000000000 { result := mul(uUNIT_3, 20) }
        case 1000000000000000000000000000000000000000 { result := mul(uUNIT_3, 21) }
        case 10000000000000000000000000000000000000000 { result := mul(uUNIT_3, 22) }
        case 100000000000000000000000000000000000000000 { result := mul(uUNIT_3, 23) }
        case 1000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 24) }
        case 10000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 25) }
        case 100000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 26) }
        case 1000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 27) }
        case 10000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 28) }
        case 100000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 29) }
        case 1000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 30) }
        case 10000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 31) }
        case 100000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 32) }
        case 1000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 33) }
        case 10000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 34) }
        case 100000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 35) }
        case 1000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 36) }
        case 10000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 37) }
        case 100000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 38) }
        case 1000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 39) }
        case 10000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 40) }
        case 100000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 41) }
        case 1000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 42) }
        case 10000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 43) }
        case 100000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 44) }
        case 1000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 45) }
        case 10000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 46) }
        case 100000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 47) }
        case 1000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 48) }
        case 10000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 49) }
        case 100000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 50) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 51) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 52) }
        case 100000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 53) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 54) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 55) }
        case 100000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 56) }
        case 1000000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 57) }
        case 10000000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 58) }
        case 100000000000000000000000000000000000000000000000000000000000000000000000000000 { result := mul(uUNIT_3, 59) }
        default { result := uMAX_UD60x18 }
    }

    if (result.unwrap_3() == uMAX_UD60x18) {
        unchecked {
            // Inline the fixed-point division to save gas.
            result = wrap_3(log2_1(x).unwrap_3() * uUNIT_3 / uLOG2_10_1);
        }
    }
}

/// @notice Calculates the binary logarithm of x using the iterative approximation algorithm:
///
/// $$
/// log_2{x} = n + log_2{y}, \text{ where } y = x*2^{-n}, \ y \in [1, 2)
/// $$
///
/// For $0 \leq x \lt 1$, the input is inverted:
///
/// $$
/// log_2{x} = -log_2{\frac{1}{x}}
/// $$
///
/// @dev See https://en.wikipedia.org/wiki/Binary_logarithm#Iterative_approximation
///
/// Notes:
/// - Due to the lossy precision of the iterative approximation, the results are not perfectly accurate to the last decimal.
///
/// Requirements:
/// - x must be greater than zero.
///
/// @param x The UD60x18 number for which to calculate the binary logarithm.
/// @return result The binary logarithm as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function log2_1(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();

    if (xUint < uUNIT_3) {
        revert PRBMath_UD60x18_Log_InputTooSmall(x);
    }

    unchecked {
        // Calculate the integer part of the logarithm.
        uint256 n = msb(xUint / uUNIT_3);

        // This is the integer part of the logarithm as a UD60x18 number. The operation can't overflow because n
        // n is at most 255 and UNIT is 1e18.
        uint256 resultUint = n * uUNIT_3;

        // Calculate $y = x * 2^{-n}$.
        uint256 y = xUint >> n;

        // If y is the unit number, the fractional part is zero.
        if (y == uUNIT_3) {
            return wrap_3(resultUint);
        }

        // Calculate the fractional part via the iterative approximation.
        // The `delta >>= 1` part is equivalent to `delta /= 2`, but shifting bits is more gas efficient.
        uint256 DOUBLE_UNIT = 2e18;
        for (uint256 delta = uHALF_UNIT_1; delta > 0; delta >>= 1) {
            y = (y * y) / uUNIT_3;

            // Is y^2 >= 2e18 and so in the range [2e18, 4e18)?
            if (y >= DOUBLE_UNIT) {
                // Add the 2^{-m} factor to the logarithm.
                resultUint += delta;

                // Halve y, which corresponds to z/2 in the Wikipedia article.
                y >>= 1;
            }
        }
        result = wrap_3(resultUint);
    }
}

/// @notice Multiplies two UD60x18 numbers together, returning a new UD60x18 number.
///
/// @dev Uses {Common.mulDiv} to enable overflow-safe multiplication and division.
///
/// Notes:
/// - Refer to the notes in {Common.mulDiv}.
///
/// Requirements:
/// - Refer to the requirements in {Common.mulDiv}.
///
/// @dev See the documentation in {Common.mulDiv18}.
/// @param x The multiplicand as a UD60x18 number.
/// @param y The multiplier as a UD60x18 number.
/// @return result The product as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function mul_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    result = wrap_3(mulDiv18(x.unwrap_3(), y.unwrap_3()));
}

/// @notice Raises x to the power of y.
///
/// For $1 \leq x \leq \infty$, the following standard formula is used:
///
/// $$
/// x^y = 2^{log_2{x} * y}
/// $$
///
/// For $0 \leq x \lt 1$, since the unsigned {log2} is undefined, an equivalent formula is used:
///
/// $$
/// i = \frac{1}{x}
/// w = 2^{log_2{i} * y}
/// x^y = \frac{1}{w}
/// $$
///
/// @dev Notes:
/// - Refer to the notes in {log2} and {mul}.
/// - Returns `UNIT` for 0^0.
/// - It may not perform well with very small values of x. Consider using SD59x18 as an alternative.
///
/// Requirements:
/// - Refer to the requirements in {exp2}, {log2}, and {mul}.
///
/// @param x The base as a UD60x18 number.
/// @param y The exponent as a UD60x18 number.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function pow_1(UD60x18 x, UD60x18 y) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();
    uint256 yUint = y.unwrap_3();

    // If both x and y are zero, the result is `UNIT`. If just x is zero, the result is always zero.
    if (xUint == 0) {
        return yUint == 0 ? UNIT_4 : ZERO_1;
    }
    // If x is `UNIT`, the result is always `UNIT`.
    else if (xUint == uUNIT_3) {
        return UNIT_4;
    }

    // If y is zero, the result is always `UNIT`.
    if (yUint == 0) {
        return UNIT_4;
    }
    // If y is `UNIT`, the result is always x.
    else if (yUint == uUNIT_3) {
        return x;
    }

    // If x is greater than `UNIT`, use the standard formula.
    if (xUint > uUNIT_3) {
        result = exp2_2(mul_1(log2_1(x), y));
    }
    // Conversely, if x is less than `UNIT`, use the equivalent formula.
    else {
        UD60x18 i = wrap_3(uUNIT_SQUARED_1 / xUint);
        UD60x18 w = exp2_2(mul_1(log2_1(i), y));
        result = wrap_3(uUNIT_SQUARED_1 / w.unwrap_3());
    }
}

/// @notice Raises x (a UD60x18 number) to the power y (an unsigned basic integer) using the well-known
/// algorithm "exponentiation by squaring".
///
/// @dev See https://en.wikipedia.org/wiki/Exponentiation_by_squaring.
///
/// Notes:
/// - Refer to the notes in {Common.mulDiv18}.
/// - Returns `UNIT` for 0^0.
///
/// Requirements:
/// - The result must fit in UD60x18.
///
/// @param x The base as a UD60x18 number.
/// @param y The exponent as a uint256.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function powu_1(UD60x18 x, uint256 y) pure returns (UD60x18 result) {
    // Calculate the first iteration of the loop in advance.
    uint256 xUint = x.unwrap_3();
    uint256 resultUint = y & 1 > 0 ? xUint : uUNIT_3;

    // Equivalent to `for(y /= 2; y > 0; y /= 2)`.
    for (y >>= 1; y > 0; y >>= 1) {
        xUint = mulDiv18(xUint, xUint);

        // Equivalent to `y % 2 == 1`.
        if (y & 1 > 0) {
            resultUint = mulDiv18(resultUint, xUint);
        }
    }
    result = wrap_3(resultUint);
}

/// @notice Calculates the square root of x using the Babylonian method.
///
/// @dev See https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method.
///
/// Notes:
/// - The result is rounded toward zero.
///
/// Requirements:
/// - x must be less than `MAX_UD60x18 / UNIT`.
///
/// @param x The UD60x18 number for which to calculate the square root.
/// @return result The result as a UD60x18 number.
/// @custom:smtchecker abstract-function-nondet
function sqrt_2(UD60x18 x) pure returns (UD60x18 result) {
    uint256 xUint = x.unwrap_3();

    unchecked {
        if (xUint > uMAX_UD60x18 / uUNIT_3) {
            revert PRBMath_UD60x18_Sqrt_Overflow(x);
        }
        // Multiply x by `UNIT` to account for the factor of `UNIT` picked up when multiplying two UD60x18 numbers.
        // In this case, the two numbers are both the square root.
        result = wrap_3(sqrt_0(xUint * uUNIT_3));
    }
}

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/ValueType.sol

/// @notice The unsigned 60.18-decimal fixed-point number representation, which can have up to 60 digits and up to 18
/// decimals. The values of this are bound by the minimum and the maximum values permitted by the Solidity type uint256.
/// @dev The value type is defined here so it can be imported in all other files.
type UD60x18 is uint256;

/*//////////////////////////////////////////////////////////////////////////
                                    CASTING
//////////////////////////////////////////////////////////////////////////*/

using {
    intoSD1x18_2,
    intoUD2x18_2,
    intoSD59x18_2,
    intoUint128_3,
    intoUint256_3,
    intoUint40_3,
    unwrap_3
} for UD60x18 global;

/*//////////////////////////////////////////////////////////////////////////
                            MATHEMATICAL FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

// The global "using for" directive makes the functions in this library callable on the UD60x18 type.
using {
    avg_1,
    ceil_1,
    div_1,
    exp_1,
    exp2_2,
    floor_1,
    frac_1,
    gm_1,
    inv_1,
    ln_1,
    log10_1,
    log2_1,
    mul_1,
    pow_1,
    powu_1,
    sqrt_2
} for UD60x18 global;

/*//////////////////////////////////////////////////////////////////////////
                                HELPER FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

// The global "using for" directive makes the functions in this library callable on the UD60x18 type.
using {
    add_1,
    and_1,
    eq_1,
    gt_1,
    gte_1,
    isZero_1,
    lshift_1,
    lt_1,
    lte_1,
    mod_1,
    neq_1,
    not_1,
    or_1,
    rshift_1,
    sub_1,
    uncheckedAdd_1,
    uncheckedSub_1,
    xor_1
} for UD60x18 global;

/*//////////////////////////////////////////////////////////////////////////
                                    OPERATORS
//////////////////////////////////////////////////////////////////////////*/

// The global "using for" directive makes it possible to use these operators on the UD60x18 type.
using {
    add_1 as +,
    and2_1 as &,
    div_1 as /,
    eq_1 as ==,
    gt_1 as >,
    gte_1 as >=,
    lt_1 as <,
    lte_1 as <=,
    or_1 as |,
    mod_1 as %,
    mul_1 as *,
    neq_1 as !=,
    not_1 as ~,
    sub_1 as -,
    xor_1 as ^
} for UD60x18 global;

// lib/snowbridge/contracts/lib/prb-math/src/ud60x18/Conversions.sol

/// @notice Converts a UD60x18 number to a simple integer by dividing it by `UNIT`.
/// @dev The result is rounded toward zero.
/// @param x The UD60x18 number to convert.
/// @return result The same number in basic integer form.
function convert_0(UD60x18 x) pure returns (uint256 result) {
    result = UD60x18.unwrap(x) / uUNIT_3;
}

/// @notice Converts a simple integer to UD60x18 by multiplying it by `UNIT`.
///
/// @dev Requirements:
/// - x must be less than or equal to `MAX_UD60x18 / UNIT`.
///
/// @param x The basic integer to convert.
/// @param result The same number converted to UD60x18.
function convert_1(uint256 x) pure returns (UD60x18 result) {
    if (x > uMAX_UD60x18 / uUNIT_3) {
        revert PRBMath_UD60x18_Convert_Overflow(x);
    }
    unchecked {
        result = UD60x18.wrap(x * uUNIT_3);
    }
}

// lib/snowbridge/contracts/lib/prb-math/src/UD60x18.sol

/*

██████╗ ██████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗██╗  ██╗
██╔══██╗██╔══██╗██╔══██╗████╗ ████║██╔══██╗╚══██╔══╝██║  ██║
██████╔╝██████╔╝██████╔╝██╔████╔██║███████║   ██║   ███████║
██╔═══╝ ██╔══██╗██╔══██╗██║╚██╔╝██║██╔══██║   ██║   ██╔══██║
██║     ██║  ██║██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║
╚═╝     ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝

██╗   ██╗██████╗  ██████╗  ██████╗ ██╗  ██╗ ██╗ █████╗
██║   ██║██╔══██╗██╔════╝ ██╔═████╗╚██╗██╔╝███║██╔══██╗
██║   ██║██║  ██║███████╗ ██║██╔██║ ╚███╔╝ ╚██║╚█████╔╝
██║   ██║██║  ██║██╔═══██╗████╔╝██║ ██╔██╗  ██║██╔══██╗
╚██████╔╝██████╔╝╚██████╔╝╚██████╔╝██╔╝ ██╗ ██║╚█████╔╝
 ╚═════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═╝ ╚════╝

*/

// lib/snowbridge/contracts/src/storage/PricingStorage.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library PricingStorage {
    struct Layout {
        /// @dev The ETH/DOT exchange rate
        UD60x18 exchangeRate;
        /// @dev The cost of delivering messages to BridgeHub in DOT
        uint128 deliveryCost;
        /// @dev Fee multiplier
        UD60x18 multiplier;
    }

    bytes32 internal constant SLOT = keccak256("org.snowbridge.storage.pricing");

    function layout() internal pure returns (Layout storage $) {
        bytes32 slot = SLOT;
        assembly {
            $.slot := slot
        }
    }
}

// lib/snowbridge/contracts/src/types/Common.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

enum OperatingMode {
    Normal,
    RejectingOutboundMessages
}

struct TokenInfo {
    bool isRegistered;
    bytes32 foreignID;
}

using {isNative, isForeign} for TokenInfo global;

function isNative(TokenInfo storage self) view returns (bool) {
    return self.foreignID == bytes32(0);
}

function isForeign(TokenInfo storage self) view returns (bool) {
    return !isNative(self);
}

// lib/snowbridge/contracts/src/interfaces/IGatewayBase.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// Base interface for Gateway
interface IGatewayBase {
    error InvalidToken();
    error InvalidAmount();
    error InvalidDestination();
    error TokenNotRegistered();
    error Unsupported();
    error InvalidDestinationFee();
    error AgentDoesNotExist();
    error TokenAlreadyRegistered();
    error TokenMintFailed();
    error TokenTransferFailed();
    error InvalidProof();
    error InvalidNonce();
    error NotEnoughGas();
    error InsufficientEther();
    error Unauthorized();
    error Disabled();
    error AgentExecutionFailed(bytes returndata);
    error InvalidAgentExecutionPayload();
    error InvalidConstructorParams();
    error AlreadyInitialized();

    // Emitted when the operating mode is changed
    event OperatingModeChanged(OperatingMode mode);

    // Emitted when foreign token from polkadot registered
    event ForeignTokenRegistered(bytes32 indexed tokenID, address token);

    /// @dev Emitted when a command is sent to register a new wrapped token on AssetHub
    event TokenRegistrationSent(address token);
}

// lib/snowbridge/contracts/src/v2/Types.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// Inbound message from a Polkadot parachain (via BridgeHub)
struct InboundMessage_0 {
    // origin
    bytes32 origin;
    // Message nonce
    uint64 nonce;
    // Topic
    bytes32 topic;
    // Commands
    Command_0[] commands;
}

struct Command_0 {
    uint8 kind;
    uint64 gas;
    bytes payload;
}

// Command IDs
library CommandKind {
    // Upgrade the Gateway implementation contract
    uint8 constant Upgrade = 0;
    // Set the operating mode for outbound messaging in the Gateway
    uint8 constant SetOperatingMode = 1;
    // Unlock native ERC20 and transfer to recipient
    uint8 constant UnlockNativeToken = 2;
    // Register a foreign token
    uint8 constant RegisterForeignToken = 3;
    // Mint foreign tokens
    uint8 constant MintForeignToken = 4;
    // Call an arbitrary solidity contract
    uint8 constant CallContract = 5;
}

// Payload for outbound messages destined for Polkadot
struct Payload {
    // Sender of the message
    address origin;
    // Asset transfer instructions
    Asset[] assets;
    // Actual Message
    Message message;
    // SCALE-encoded location of claimer who can claim trapped assets on AssetHub
    bytes claimer;
    // Ether value not reserved for fees
    uint128 value;
    // Ether value reserved for execution fees on AH
    uint128 executionFee;
    // Ether value reserved for relayer incentives
    uint128 relayerFee;
}

struct Message {
    // Variant ID
    uint8 kind;
    // SCALE-encoded message
    bytes data;
}

library MessageKind {
    // SCALE-encoded raw bytes to be interpreted by the Substrate chain
    // For example, as a SCALE-encoded `VersionedXcm`
    uint8 constant Raw = 0;
    // Create a new asset in the ForeignAssets pallet of AH
    uint8 constant CreateAsset = 1;
}

// Format of Message.data when Message.kind == MessageKind.CreateAsset
struct AsCreateAsset {
    // Token address
    address token;
    // Network to create the asset in
    uint8 network;
}

function makeRawMessage(bytes memory message) pure returns (Message memory) {
    return Message({kind: MessageKind.Raw, data: message});
}

function makeCreateAssetMessage(address token, Network network) pure returns (Message memory) {
    return Message({
        kind: MessageKind.CreateAsset,
        data: abi.encode(AsCreateAsset({token: token, network: uint8(network)}))
    });
}

struct Asset {
    uint8 kind;
    bytes data;
}

library AssetKind {
    uint8 constant NativeTokenERC20 = 0;
    uint8 constant ForeignTokenERC20 = 1;
}

// Format of Asset.data when Asset.kind == AssetKind.NativeTokenERC20
struct AsNativeTokenERC20 {
    address token;
    uint128 amount;
}

// Format of Asset.data when Asset.kind == AssetKind.ForeignTokenERC20
struct AsForeignTokenERC20 {
    bytes32 foreignID;
    uint128 amount;
}

function makeNativeAsset(address token, uint128 amount) pure returns (Asset memory) {
    return Asset({
        kind: AssetKind.NativeTokenERC20,
        data: abi.encode(AsNativeTokenERC20({token: token, amount: amount}))
    });
}

function makeForeignAsset(bytes32 foreignID, uint128 amount) pure returns (Asset memory) {
    return Asset({
        kind: AssetKind.ForeignTokenERC20,
        data: abi.encode(AsForeignTokenERC20({foreignID: foreignID, amount: amount}))
    });
}

// V2 Command Params

// Payload for Upgrade
struct UpgradeParams_0 {
    // The address of the implementation contract
    address impl;
    // Codehash of the new implementation contract.
    bytes32 implCodeHash;
    // Parameters used to upgrade storage of the gateway
    bytes initParams;
}

// Payload for SetOperatingMode instruction
struct SetOperatingModeParams_0 {
    /// The new operating mode
    OperatingMode mode;
}

// Payload for NativeTokenUnlock instruction
struct UnlockNativeTokenParams_0 {
    // Token address
    address token;
    // Recipient address
    address recipient;
    // Amount to unlock
    uint128 amount;
}

// Payload for RegisterForeignToken
struct RegisterForeignTokenParams_0 {
    /// @dev The token ID (hash of stable location id of token)
    bytes32 foreignTokenID;
    /// @dev The name of the token
    string name;
    /// @dev The symbol of the token
    string symbol;
    /// @dev The decimal of the token
    uint8 decimals;
}

// Payload for MintForeignTokenParams instruction
struct MintForeignTokenParams_0 {
    // Foreign token ID
    bytes32 foreignTokenID;
    // Recipient address
    address recipient;
    // Amount to mint
    uint128 amount;
}

// Payload for CallContractParams instruction
struct CallContractParams {
    // target contract
    address target;
    // Call data
    bytes data;
    // Ether value
    uint256 value;
}

enum Network {
    Solochain
}

// lib/snowbridge/contracts/src/v1/Types.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

type ParaID is uint32;

using {ParaIDEq as ==, ParaIDNe as !=, into} for ParaID global;

function ParaIDEq(ParaID a, ParaID b) pure returns (bool) {
    return ParaID.unwrap(a) == ParaID.unwrap(b);
}

function ParaIDNe(ParaID a, ParaID b) pure returns (bool) {
    return !ParaIDEq(a, b);
}

function into(ParaID paraID) pure returns (ChannelID) {
    return ChannelID.wrap(keccak256(abi.encodePacked("para", ParaID.unwrap(paraID))));
}

type ChannelID is bytes32;

using {ChannelIDEq as ==, ChannelIDNe as !=} for ChannelID global;

function ChannelIDEq(ChannelID a, ChannelID b) pure returns (bool) {
    return ChannelID.unwrap(a) == ChannelID.unwrap(b);
}

function ChannelIDNe(ChannelID a, ChannelID b) pure returns (bool) {
    return !ChannelIDEq(a, b);
}

/// @dev A messaging channel for a Polkadot parachain
struct Channel {
    /// @dev The operating mode for this channel. Can be used to
    /// disable messaging on a per-channel basis.
    OperatingMode mode;
    /// @dev The current nonce for the inbound lane
    uint64 inboundNonce;
    /// @dev The current node for the outbound lane
    uint64 outboundNonce;
    /// @dev The address of the agent of the parachain owning this channel
    address agent;
}

/// @dev Inbound message from a Polkadot parachain (via BridgeHub)
struct InboundMessage_1 {
    /// @dev The parachain from which this message originated
    ChannelID channelID;
    /// @dev The channel nonce
    uint64 nonce;
    /// @dev The command to execute
    Command_1 command;
    /// @dev The Parameters for the command
    bytes params;
    /// @dev The maximum gas allowed for message dispatch
    uint64 maxDispatchGas;
    /// @dev The maximum fee per gas
    uint256 maxFeePerGas;
    /// @dev The reward for message submission
    uint256 reward;
    /// @dev ID for this message
    bytes32 id;
}

/// @dev Messages from Polkadot take the form of these commands.
enum Command_1 {
    AgentExecute, // Deprecated in favour of UnlockNativeToken
    Upgrade,
    CreateAgent,
    CreateChannel,
    UpdateChannel,
    SetOperatingMode,
    TransferNativeFromAgent,
    SetTokenTransferFees,
    SetPricingParameters,
    UnlockNativeToken,
    RegisterForeignToken,
    MintForeignToken
}

// Deprecated
enum AgentExecuteCommand {
    TransferToken
}

/// @dev Application-level costs for a message
struct Costs {
    /// @dev Costs in foreign currency
    uint256 foreign;
    /// @dev Costs in native currency
    uint256 native;
}

struct Ticket {
    ParaID dest;
    Costs costs;
    bytes payload;
    uint128 value;
}

// Payload for AgentExecute. Deprecated
struct AgentExecuteParams {
    bytes32 agentID;
    bytes payload;
}

// Payload for Upgrade
struct UpgradeParams_1 {
    /// @dev The address of the implementation contract
    address impl;
    /// @dev the codehash of the new implementation contract.
    /// Used to ensure the implementation isn't updated while
    /// the upgrade is in flight
    bytes32 implCodeHash;
    /// @dev parameters used to upgrade storage of the gateway
    bytes initParams;
}

// Payload for SetOperatingMode
struct SetOperatingModeParams_1 {
    /// @dev The new operating mode
    OperatingMode mode;
}

// Payload for SetTokenTransferFees
struct SetTokenTransferFeesParams {
    /// @dev The remote fee (DOT) for registering a token on AssetHub
    uint128 assetHubCreateAssetFee;
    /// @dev The remote fee (DOT) for send tokens to AssetHub
    uint128 assetHubReserveTransferFee;
    /// @dev extra fee to register an asset and discourage spamming (Ether)
    uint256 registerTokenFee;
}

// Payload for SetPricingParameters
struct SetPricingParametersParams {
    /// @dev The ETH/DOT exchange rate
    UD60x18 exchangeRate;
    /// @dev The cost of delivering messages to BridgeHub in DOT
    uint128 deliveryCost;
    /// @dev Fee multiplier
    UD60x18 multiplier;
}

// Payload for TransferToken
struct UnlockNativeTokenParams_1 {
    /// @dev The agent ID of the consensus system
    bytes32 agentID;
    /// @dev The token address
    address token;
    /// @dev The address of the recipient
    address recipient;
    /// @dev The amount to mint with
    uint128 amount;
}

// Payload for RegisterForeignToken
struct RegisterForeignTokenParams_1 {
    /// @dev The token ID (hash of stable location id of token)
    bytes32 foreignTokenID;
    /// @dev The name of the token
    string name;
    /// @dev The symbol of the token
    string symbol;
    /// @dev The decimal of the token
    uint8 decimals;
}

// Payload for MintForeignToken
struct MintForeignTokenParams_1 {
    /// @dev The token ID
    bytes32 foreignTokenID;
    /// @dev The address of the recipient
    address recipient;
    /// @dev The amount to mint with
    uint128 amount;
}

// lib/snowbridge/contracts/src/Constants.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library Constants {
    ParaID constant ASSET_HUB_PARA_ID = ParaID.wrap(1000);
    bytes32 constant ASSET_HUB_AGENT_ID =
        0x81c5ab2571199e3188135178f3c2c8e2d268be1313d029b30f534fa579b69b79;

    ParaID constant BRIDGE_HUB_PARA_ID = ParaID.wrap(1002);
    bytes32 constant BRIDGE_HUB_AGENT_ID =
        0x03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314;

    // ChannelIDs
    ChannelID internal constant PRIMARY_GOVERNANCE_CHANNEL_ID = ChannelID.wrap(bytes32(uint256(1)));
    ChannelID internal constant SECONDARY_GOVERNANCE_CHANNEL_ID =
        ChannelID.wrap(bytes32(uint256(2)));
}

// lib/snowbridge/contracts/src/storage/AssetsStorage.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library AssetsStorage {
    struct Layout {
        // Native token registry by token address
        mapping(address token => TokenInfo) tokenRegistry;
        address assetHubAgent;
        ParaID assetHubParaID;
        // XCM fee charged by AssetHub for registering a token (DOT)
        uint128 assetHubCreateAssetFee;
        // XCM fee charged by AssetHub for receiving a token from the Gateway (DOT)
        uint128 assetHubReserveTransferFee;
        // Extra fee for registering a token, to discourage spamming (Ether)
        uint256 registerTokenFee;
        // Foreign token registry by token ID
        mapping(bytes32 foreignID => address) tokenAddressOf;
        uint8 foreignTokenDecimals;
        // The maximum fee that can be sent to a destination parachain to pay for execution (DOT).
        // Has two functions:
        // * Reduces the ability of users to perform arbitrage using a favourable exchange rate
        // * Prevents users from mistakenly providing too much fees, which would drain AssetHub's
        //   sovereign account here on Ethereum.
        uint128 maxDestinationFee;
    }

    bytes32 internal constant SLOT = keccak256("org.snowbridge.storage.assets");

    function layout() internal pure returns (Layout storage $) {
        bytes32 slot = SLOT;
        assembly {
            $.slot := slot
        }
    }
}

// lib/snowbridge/contracts/src/SubstrateTypes.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/**
 * @title SCALE encoders for common Substrate types
 */
library SubstrateTypes {
    error UnsupportedCompactEncoding();

    /**
     * @dev Encodes `H160`: https://crates.parity.io/sp_core/struct.H160.html
     * @return bytes SCALE-encoded bytes
     */
    // solhint-disable-next-line func-name-mixedcase
    function H160(address account) internal pure returns (bytes memory) {
        return abi.encodePacked(account);
    }

    function VecU8(bytes memory input) internal pure returns (bytes memory) {
        return bytes.concat(ScaleCodec.checkedEncodeCompactU32(input.length), input);
    }

    /**
     * @dev Encodes `Option::None`:
     *         https://doc.rust-lang.org/std/option/enum.Option.html#variant.None
     * @return bytes SCALE-encoded bytes
     */
    // solhint-disable-next-line func-name-mixedcase
    function None() internal pure returns (bytes memory) {
        return hex"00";
    }

    /**
     * @dev SCALE-encodes `router_primitives::inbound::VersionedMessage` containing payload
     * `NativeTokensMessage::Create`
     */
    // solhint-disable-next-line func-name-mixedcase
    function RegisterToken(address token, uint128 fee) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x00),
            SubstrateTypes.H160(token),
            ScaleCodec.encodeU128(fee)
        );
    }

    /**
     * @dev SCALE-encodes `router_primitives::inbound::VersionedMessage` containing payload
     * `NativeTokensMessage::Mint`
     */
    // destination is AccountID32 address on AssetHub
    function SendTokenToAssetHubAddress32(
        address token,
        bytes32 recipient,
        uint128 xcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x01),
            SubstrateTypes.H160(token),
            bytes1(0x00),
            recipient,
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }

    // destination is AccountID32 address
    function SendTokenToAddress32(
        address token,
        ParaID paraID,
        bytes32 recipient,
        uint128 xcmFee,
        uint128 destinationXcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x01),
            SubstrateTypes.H160(token),
            bytes1(0x01),
            ScaleCodec.encodeU32(uint32(ParaID.unwrap(paraID))),
            recipient,
            ScaleCodec.encodeU128(destinationXcmFee),
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }

    // destination is AccountID20 address
    function SendTokenToAddress20(
        address token,
        ParaID paraID,
        bytes20 recipient,
        uint128 xcmFee,
        uint128 destinationXcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x01),
            SubstrateTypes.H160(token),
            bytes1(0x02),
            ScaleCodec.encodeU32(uint32(ParaID.unwrap(paraID))),
            recipient,
            ScaleCodec.encodeU128(destinationXcmFee),
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }

    function SendForeignTokenToAssetHubAddress32(
        bytes32 tokenID,
        bytes32 recipient,
        uint128 xcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x02),
            tokenID,
            bytes1(0x00),
            recipient,
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }

    // destination is AccountID32 address
    function SendForeignTokenToAddress32(
        bytes32 tokenID,
        ParaID paraID,
        bytes32 recipient,
        uint128 xcmFee,
        uint128 destinationXcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x02),
            tokenID,
            bytes1(0x01),
            ScaleCodec.encodeU32(uint32(ParaID.unwrap(paraID))),
            recipient,
            ScaleCodec.encodeU128(destinationXcmFee),
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }

    // destination is AccountID20 address
    function SendForeignTokenToAddress20(
        bytes32 tokenID,
        ParaID paraID,
        bytes20 recipient,
        uint128 xcmFee,
        uint128 destinationXcmFee,
        uint128 amount
    ) internal view returns (bytes memory) {
        return bytes.concat(
            bytes1(0x00),
            ScaleCodec.encodeU64(uint64(block.chainid)),
            bytes1(0x02),
            tokenID,
            bytes1(0x02),
            ScaleCodec.encodeU32(uint32(ParaID.unwrap(paraID))),
            recipient,
            ScaleCodec.encodeU128(destinationXcmFee),
            ScaleCodec.encodeU128(amount),
            ScaleCodec.encodeU128(xcmFee)
        );
    }
}

// lib/snowbridge/contracts/src/storage/CoreStorage.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library CoreStorage {
    struct Layout {
        // Operating mode:
        OperatingMode mode;
        // Message channels
        mapping(ChannelID channelID => Channel) channels;
        // Agents
        mapping(bytes32 agentID => address) agents;
        // Reserve slot to prevent state collision
        uint256 __gap;
        // V2
        SparseBitmap inboundNonce;
        uint64 outboundNonce;
    }

    bytes32 internal constant SLOT = keccak256("org.snowbridge.storage.core");

    function layout() internal pure returns (Layout storage $) {
        bytes32 slot = SLOT;
        assembly {
            $.slot := slot
        }
    }
}

// lib/snowbridge/contracts/src/ParachainVerification.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library ParachainVerification {
    /// @dev Merkle proof for parachain header finalized by BEEFY
    /// Reference: https://github.com/paritytech/polkadot/blob/09b61286da11921a3dda0a8e4015ceb9ef9cffca/runtime/rococo/src/lib.rs#L1312
    struct HeadProof {
        // The leaf index of the parachain being proven
        uint256 pos;
        // The number of leaves in the merkle tree
        uint256 width;
        // The proof items
        bytes32[] proof;
    }

    /// @dev Parachain header
    /// References:
    /// * https://paritytech.github.io/substrate/master/sp_runtime/generic/struct.Header.html
    /// * https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/header.rs#L41
    struct ParachainHeader {
        bytes32 parentHash;
        uint256 number;
        bytes32 stateRoot;
        bytes32 extrinsicsRoot;
        DigestItem[] digestItems;
    }

    /// @dev Represents a digest item within a parachain header.
    /// References:
    /// * https://paritytech.github.io/substrate/master/sp_runtime/generic/enum.DigestItem.html
    /// * https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L75
    struct DigestItem {
        uint256 kind;
        bytes4 consensusEngineID;
        bytes data;
    }

    /// @dev A proof to reconstruct the root of the parachain heads merkle tree
    struct Proof {
        // The parachain header containing the message commitment as a digest item
        ParachainHeader header;
        // The proof used to generate a merkle root of parachain heads
        HeadProof headProof;
    }

    error InvalidParachainHeader();
    error InvalidParachainHeaderProof();

    /// @dev IDs of enum variants of DigestItem
    /// Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L201
    uint256 public constant DIGEST_ITEM_OTHER = 0;
    uint256 public constant DIGEST_ITEM_CONSENSUS = 4;
    uint256 public constant DIGEST_ITEM_SEAL = 5;
    uint256 public constant DIGEST_ITEM_PRERUNTIME = 6;
    uint256 public constant DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED = 8;

    /// @dev Enum variant ID for CustomDigestItem::Snowbridge
    bytes1 public constant DIGEST_ITEM_OTHER_SNOWBRIDGE = 0x00;

    /// @dev Verify the message commitment by applying several proofs
    ///
    /// 1. First check that the commitment is included in the digest items of the parachain header
    /// 2. Generate the root of the parachain heads merkle tree
    /// 3. Construct an MMR leaf containing the parachain heads root.
    /// 4. Verify that the MMR leaf is included in the MMR maintained by the BEEFY light client.
    ///
    /// Background info:
    ///
    /// In the Polkadot relay chain, for every block:
    /// 1. A merkle root of finalized parachain headers is constructed:
    ///    https://github.com/paritytech/polkadot/blob/09b61286da11921a3dda0a8e4015ceb9ef9cffca/runtime/rococo/src/lib.rs#L1312.
    /// 2. An MMR leaf is produced, containing this parachain headers root, and is then inserted into the
    ///    MMR maintained by the `merkle-mountain-range` pallet:
    ///    https://github.com/paritytech/substrate/tree/master/frame/merkle-mountain-range
    ///
    /// @param encodedParaID The SCALE-encoded parachain ID of BridgeHub
    /// @param commitment The message commitment root expected to be contained within the
    ///                   digest of BridgeHub parachain header.
    /// @param proof The chain of proofs described above
    /// @return The MMR root hash after verification
    function processProof(bytes4 encodedParaID, bytes32 commitment, Proof calldata proof)
        external
        pure
        returns (bytes32)
    {
        // Verify that parachain header contains the commitment
        if (!isCommitmentInHeaderDigest(commitment, proof.header)) {
            revert InvalidParachainHeader();
        }

        // Compute the merkle leaf hash of our parachain
        bytes32 parachainHeadHash = createParachainHeaderMerkleLeaf(encodedParaID, proof.header);

        if (proof.headProof.pos >= proof.headProof.width) {
            revert InvalidParachainHeaderProof();
        }

        // Compute the merkle root hash of all parachain heads
        return SubstrateMerkleProof.computeRoot(
            parachainHeadHash, proof.headProof.pos, proof.headProof.width, proof.headProof.proof
        );
    }

    // Verify that a message commitment is in the header digest
    function isCommitmentInHeaderDigest(bytes32 commitment, ParachainHeader calldata header)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < header.digestItems.length; i++) {
            if (
                header.digestItems[i].kind == DIGEST_ITEM_OTHER
                    && header.digestItems[i].data.length == 33
                    && header.digestItems[i].data[0] == DIGEST_ITEM_OTHER_SNOWBRIDGE
                    && commitment == bytes32(header.digestItems[i].data[1:])
            ) {
                return true;
            }
        }
        return false;
    }

    // SCALE-Encodes: Vec<DigestItem>
    // Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L40
    function encodeDigestItems(DigestItem[] calldata digestItems)
        internal
        pure
        returns (bytes memory)
    {
        // encode all digest items into a buffer
        bytes memory accum = hex"";
        for (uint256 i = 0; i < digestItems.length; i++) {
            accum = bytes.concat(accum, encodeDigestItem(digestItems[i]));
        }
        // Encode number of digest items, followed by encoded digest items
        return bytes.concat(ScaleCodec.checkedEncodeCompactU32(digestItems.length), accum);
    }

    function encodeDigestItem(DigestItem calldata digestItem)
        internal
        pure
        returns (bytes memory)
    {
        if (
            digestItem.kind == DIGEST_ITEM_PRERUNTIME || digestItem.kind == DIGEST_ITEM_CONSENSUS
                || digestItem.kind == DIGEST_ITEM_SEAL
        ) {
            return bytes.concat(
                bytes1(uint8(digestItem.kind)),
                digestItem.consensusEngineID,
                ScaleCodec.checkedEncodeCompactU32(digestItem.data.length),
                digestItem.data
            );
        } else if (digestItem.kind == DIGEST_ITEM_OTHER) {
            return bytes.concat(
                bytes1(uint8(DIGEST_ITEM_OTHER)),
                ScaleCodec.checkedEncodeCompactU32(digestItem.data.length),
                digestItem.data
            );
        } else if (digestItem.kind == DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED) {
            return bytes.concat(bytes1(uint8(DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED)));
        } else {
            revert InvalidParachainHeader();
        }
    }

    // Creates a keccak hash of a SCALE-encoded parachain header
    function createParachainHeaderMerkleLeaf(bytes4 encodedParaID, ParachainHeader calldata header)
        internal
        pure
        returns (bytes32)
    {
        // Hash of encoded parachain header merkle leaf
        return keccak256(createParachainHeader(encodedParaID, header));
    }

    function createParachainHeader(bytes4 encodedParaID, ParachainHeader calldata header)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory encodedHeader = bytes.concat(
            // H256
            header.parentHash,
            // Compact unsigned int
            ScaleCodec.checkedEncodeCompactU32(header.number),
            // H256
            header.stateRoot,
            // H256
            header.extrinsicsRoot,
            // Vec<DigestItem>
            encodeDigestItems(header.digestItems)
        );

        return bytes.concat(
            // u32
            encodedParaID,
            // length of encoded header
            ScaleCodec.checkedEncodeCompactU32(encodedHeader.length),
            encodedHeader
        );
    }
}

// lib/snowbridge/contracts/src/Verification.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library Verification {
    /// @dev Merkle proof for parachain header finalized by BEEFY
    /// Reference: https://github.com/paritytech/polkadot/blob/09b61286da11921a3dda0a8e4015ceb9ef9cffca/runtime/rococo/src/lib.rs#L1312
    struct HeadProof {
        // The leaf index of the parachain being proven
        uint256 pos;
        // The number of leaves in the merkle tree
        uint256 width;
        // The proof items
        bytes32[] proof;
    }

    /// @dev An MMRLeaf without the `leaf_extra` field.
    /// Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/consensus/beefy/src/mmr.rs#L52
    struct MMRLeafPartial {
        uint8 version;
        uint32 parentNumber;
        bytes32 parentHash;
        uint64 nextAuthoritySetID;
        uint32 nextAuthoritySetLen;
        bytes32 nextAuthoritySetRoot;
    }

    /// @dev Parachain header
    /// References:
    /// * https://paritytech.github.io/substrate/master/sp_runtime/generic/struct.Header.html
    /// * https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/header.rs#L41
    struct ParachainHeader {
        bytes32 parentHash;
        uint256 number;
        bytes32 stateRoot;
        bytes32 extrinsicsRoot;
        DigestItem[] digestItems;
    }

    /// @dev Represents a digest item within a parachain header.
    /// References:
    /// * https://paritytech.github.io/substrate/master/sp_runtime/generic/enum.DigestItem.html
    /// * https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L75
    struct DigestItem {
        uint256 kind;
        bytes4 consensusEngineID;
        bytes data;
    }

    /// @dev A chain of proofs
    struct Proof {
        // The parachain header containing the message commitment as a digest item
        ParachainHeader header;
        // The proof used to generate a merkle root of parachain heads
        HeadProof headProof;
        // The MMR leaf to be proven
        MMRLeafPartial leafPartial;
        // The MMR leaf prove
        bytes32[] leafProof;
        // The order in which proof items should be combined
        uint256 leafProofOrder;
    }

    error InvalidParachainHeader();

    /// @dev IDs of enum variants of DigestItem
    /// Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L201
    uint256 public constant DIGEST_ITEM_OTHER = 0;
    uint256 public constant DIGEST_ITEM_CONSENSUS = 4;
    uint256 public constant DIGEST_ITEM_SEAL = 5;
    uint256 public constant DIGEST_ITEM_PRERUNTIME = 6;
    uint256 public constant DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED = 8;

    /// @dev Enum variant ID for CustomDigestItem::Snowbridge
    bytes1 public constant DIGEST_ITEM_OTHER_SNOWBRIDGE = 0x00;

    /// @dev Enum variant ID for CustomDigestItem::SnowbridgeV2
    bytes1 public constant DIGEST_ITEM_OTHER_SNOWBRIDGE_V2 = 0x01;

    /// @dev Verify the message commitment by applying several proofs
    ///
    /// 1. First check that the commitment is included in the digest items of the parachain header
    /// 2. Generate the root of the parachain heads merkle tree
    /// 3. Construct an MMR leaf containing the parachain heads root.
    /// 4. Verify that the MMR leaf is included in the MMR maintained by the BEEFY light client.
    ///
    /// Background info:
    ///
    /// In the Polkadot relay chain, for every block:
    /// 1. A merkle root of finalized parachain headers is constructed:
    ///    https://github.com/paritytech/polkadot/blob/09b61286da11921a3dda0a8e4015ceb9ef9cffca/runtime/rococo/src/lib.rs#L1312.
    /// 2. An MMR leaf is produced, containing this parachain headers root, and is then inserted into the
    ///    MMR maintained by the `merkle-mountain-range` pallet:
    ///    https://github.com/paritytech/substrate/tree/master/frame/merkle-mountain-range
    ///
    /// @param beefyClient The address of the BEEFY light client
    /// @param encodedParaID The SCALE-encoded parachain ID of BridgeHub
    /// @param commitment The message commitment root expected to be contained within the
    ///                   digest of BridgeHub parachain header.
    /// @param proof The chain of proofs described above
    function verifyCommitment(
        address beefyClient,
        bytes4 encodedParaID,
        bytes32 commitment,
        Proof calldata proof,
        bool isV2
    ) external view returns (bool) {
        // Verify that parachain header contains the commitment
        if (!isCommitmentInHeaderDigest(commitment, proof.header, isV2)) {
            return false;
        }

        if (proof.headProof.pos >= proof.headProof.width) {
            return false;
        }

        // Compute the merkle leaf hash of our parachain
        bytes32 parachainHeadHash = createParachainHeaderMerkleLeaf(encodedParaID, proof.header);

        // Compute the merkle root hash of all parachain heads
        bytes32 parachainHeadsRoot = SubstrateMerkleProof.computeRoot(
            parachainHeadHash, proof.headProof.pos, proof.headProof.width, proof.headProof.proof
        );

        bytes32 leafHash = createMMRLeaf(proof.leafPartial, parachainHeadsRoot);

        // Verify that the MMR leaf is part of the MMR maintained by the BEEFY light client
        return BeefyClient(beefyClient).verifyMMRLeafProof(
            leafHash, proof.leafProof, proof.leafProofOrder
        );
    }

    // Verify that a message commitment is in the header digest
    function isCommitmentInHeaderDigest(
        bytes32 commitment,
        ParachainHeader calldata header,
        bool isV2
    ) internal pure returns (bool) {
        bytes1 digestItemOtherKind = isV2 ? DIGEST_ITEM_OTHER_SNOWBRIDGE_V2 : DIGEST_ITEM_OTHER_SNOWBRIDGE;
        
        for (uint256 i = 0; i < header.digestItems.length; i++) {
            // First check if the digest item is of the correct kind (DIGEST_ITEM_OTHER)
            // and has the correct length (33 bytes)
            if (header.digestItems[i].kind == DIGEST_ITEM_OTHER && 
                header.digestItems[i].data.length == 33 &&
                header.digestItems[i].data[0] == digestItemOtherKind &&
                commitment == bytes32(header.digestItems[i].data[1:])
            ) {
                return true;
            }
        }
        return false;
    }

    // SCALE-Encodes: Vec<DigestItem>
    // Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/runtime/src/generic/digest.rs#L40
    function encodeDigestItems(DigestItem[] calldata digestItems)
        internal
        pure
        returns (bytes memory)
    {
        // encode all digest items into a buffer
        bytes memory accum = hex"";
        for (uint256 i = 0; i < digestItems.length; i++) {
            accum = bytes.concat(accum, encodeDigestItem(digestItems[i]));
        }
        // Encode number of digest items, followed by encoded digest items
        return bytes.concat(ScaleCodec.checkedEncodeCompactU32(digestItems.length), accum);
    }

    function encodeDigestItem(DigestItem calldata digestItem)
        internal
        pure
        returns (bytes memory)
    {
        if (
            digestItem.kind == DIGEST_ITEM_PRERUNTIME || digestItem.kind == DIGEST_ITEM_CONSENSUS
                || digestItem.kind == DIGEST_ITEM_SEAL
        ) {
            return bytes.concat(
                bytes1(uint8(digestItem.kind)),
                digestItem.consensusEngineID,
                ScaleCodec.checkedEncodeCompactU32(digestItem.data.length),
                digestItem.data
            );
        } else if (digestItem.kind == DIGEST_ITEM_OTHER) {
            return bytes.concat(
                bytes1(uint8(DIGEST_ITEM_OTHER)),
                ScaleCodec.checkedEncodeCompactU32(digestItem.data.length),
                digestItem.data
            );
        } else if (digestItem.kind == DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED) {
            return bytes.concat(bytes1(uint8(DIGEST_ITEM_RUNTIME_ENVIRONMENT_UPDATED)));
        } else {
            revert InvalidParachainHeader();
        }
    }

    // Creates a keccak hash of a SCALE-encoded parachain header
    function createParachainHeaderMerkleLeaf(bytes4 encodedParaID, ParachainHeader calldata header)
        internal
        pure
        returns (bytes32)
    {
        // Hash of encoded parachain header merkle leaf
        return keccak256(createParachainHeader(encodedParaID, header));
    }

    function createParachainHeader(bytes4 encodedParaID, ParachainHeader calldata header)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory encodedHeader = bytes.concat(
            // H256
            header.parentHash,
            // Compact unsigned int
            ScaleCodec.checkedEncodeCompactU32(header.number),
            // H256
            header.stateRoot,
            // H256
            header.extrinsicsRoot,
            // Vec<DigestItem>
            encodeDigestItems(header.digestItems)
        );

        return bytes.concat(
            // u32
            encodedParaID,
            // length of encoded header
            ScaleCodec.checkedEncodeCompactU32(encodedHeader.length),
            encodedHeader
        );
    }

    // SCALE-encode: MMRLeaf
    // Reference: https://github.com/paritytech/substrate/blob/14e0a0b628f9154c5a2c870062c3aac7df8983ed/primitives/consensus/beefy/src/mmr.rs#L52
    function createMMRLeaf(MMRLeafPartial memory leaf, bytes32 parachainHeadsRoot)
        internal
        pure
        returns (bytes32)
    {
        bytes memory encodedLeaf = bytes.concat(
            ScaleCodec.encodeU8(leaf.version),
            ScaleCodec.encodeU32(leaf.parentNumber),
            leaf.parentHash,
            ScaleCodec.encodeU64(leaf.nextAuthoritySetID),
            ScaleCodec.encodeU32(leaf.nextAuthoritySetLen),
            leaf.nextAuthoritySetRoot,
            parachainHeadsRoot
        );
        return keccak256(encodedLeaf);
    }
}

// lib/snowbridge/contracts/src/v1/IGateway.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

interface IGatewayV1 {
    error ChannelDoesNotExist();
    error InvalidChannelUpdate();

    /**
     * Events
     */

    // V1: Emitted when inbound message has been dispatched
    event InboundMessageDispatched(
        ChannelID indexed channelID, uint64 nonce, bytes32 indexed messageID, bool success
    );

    // Emitted when an outbound message has been accepted for delivery to a Polkadot parachain
    event OutboundMessageAccepted(
        ChannelID indexed channelID, uint64 nonce, bytes32 indexed messageID, bytes payload
    );

    // Emitted when pricing params updated
    event PricingParametersChanged();

    // Emitted when funds are withdrawn from an agent
    event AgentFundsWithdrawn(bytes32 indexed agentID, address indexed recipient, uint256 amount);

    // Emitted when ether is deposited
    event Deposited(address sender, uint256 amount);

    /**
     * Getters
     */
    function operatingMode() external view returns (OperatingMode);

    function agentOf(bytes32 agentID) external view returns (address);

    function channelOperatingModeOf(ChannelID channelID) external view returns (OperatingMode);

    function channelNoncesOf(ChannelID channelID) external view returns (uint64, uint64);

    function pricingParameters() external view returns (UD60x18, uint128);

    /**
     * Fee management
     */
    function depositEther() external payable;

    /**
     * Messaging
     */

    // Submit a message from a Polkadot network
    function submitV1(
        InboundMessage_1 calldata message,
        bytes32[] calldata leafProof,
        Verification.Proof calldata headerProof
    ) external;

    /**
     * Token Transfers
     */

    // @dev Emitted when the fees updated
    event TokenTransferFeesChanged();

    /// @dev Emitted once the funds are locked and an outbound message is successfully queued.
    event TokenSent(
        address indexed token,
        address indexed sender,
        ParaID indexed destinationChain,
        MultiAddress destinationAddress,
        uint128 amount
    );

    /// @dev Check whether a token is registered
    function isTokenRegistered(address token) external view returns (bool);

    /// @dev Get token id of an ERC20 contract address.
    function queryForeignTokenID(address token) external view returns (bytes32);

    /// @dev Quote a fee in Ether for registering a token, covering
    /// 1. Delivery costs to BridgeHub
    /// 2. XCM Execution costs on AssetHub
    function quoteRegisterTokenFee() external view returns (uint256);

    /// @dev Register an ERC20 token and create a wrapped derivative on AssetHub in the
    /// `ForeignAssets` pallet.
    function registerToken(address token) external payable;

    /// @dev Quote a fee in Ether for sending a token
    /// 1. Delivery costs to BridgeHub
    /// 2. XCM execution costs on destinationChain
    function quoteSendTokenFee(address token, ParaID destinationChain, uint128 destinationFee)
        external
        view
        returns (uint256);

    /// @dev Send a token to parachain `destinationChain` and deposit into account
    /// `destinationAddress`. The user can send native Ether by supplying `address(0)` for
    /// the `token` parameter.
    function sendToken(
        address token,
        ParaID destinationChain,
        MultiAddress calldata destinationAddress,
        uint128 destinationFee,
        uint128 amount
    ) external payable;

    /// @dev Get token address by tokenID
    function tokenAddressOf(bytes32 tokenID) external view returns (address);
}

// lib/snowbridge/contracts/src/v2/IGateway.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

interface IGatewayV2 {
    error AgentAlreadyExists();
    error ShouldNotReachHere();
    error InvalidNetwork();
    error InvalidAsset();
    error InsufficientGasLimit();
    error InsufficientValue();
    error ExceededMaximumValue();
    error TooManyAssets();

    /// Return the current operating mode for outbound messaging
    function operatingMode() external view returns (OperatingMode);

    /// Return the address of the agent contract registered for `agentId`.
    function agentOf(bytes32 agentID) external view returns (address);

    /**
     * Events
     */

    /// Emitted when an agent has been created for a consensus system on Polkadot
    event AgentCreated(bytes32 agentID, address agent);

    /// Emitted when inbound message has been dispatched.The "success" field is "true" if all
    //commands successfully executed, otherwise "false" if all or some of the commands failed.
    event InboundMessageDispatched(
        uint64 indexed nonce, bytes32 topic, bool success, bytes32 rewardAddress
    );

    /// Emitted when a command at `index` within an inbound message identified by `nonce` fails to execute
    event CommandFailed(uint64 indexed nonce, uint256 index);

    /// Emitted when an outbound message has been accepted for delivery to a Polkadot parachain
    event OutboundMessageAccepted(uint64 nonce, Payload payload);

    /// @dev Submit a message from the Substrate chain for verification and dispatch
    /// @param message A message produced by the OutboundQueue pallet on the Substrate chain
    /// @param messageProof A message proof used to verify that the message is in the merkle
    ///        tree committed by the OutboundQueue pallet
    /// @param beefyProof A proof that the there is a BEEFY MMR leaf that includes the message
    ///        commitment in the latest finalized BEEFY MMR root
    /// @param rewardAddress An `AccountId` on BridgeHub that can claim rewards for relaying
    ///        this message, after the relayer has submitted a delivery receipt back to BridgeHub.
    function v2_submit(
        InboundMessage_0 calldata message,
        bytes32[] calldata messageProof,
        BeefyVerification.Proof calldata beefyProof,
        bytes32 rewardAddress
    ) external;

    // Send an XCM with arbitrary assets to Polkadot Asset Hub
    //
    // Params:
    //   * `xcm` (bytes): SCALE-encoded VersionedXcm message.
    //   * `assets` (bytes[]): Array of asset specs, constrained to maximum of eight.
    //   * `claimer`: SCALE-encoded XCM location of claimer account.
    //   * `executionFee`: Amount of ether to pay for execution on AssetHub.
    //   * `relayerFee`: Amount of ether to pay for relayer incentivation.
    //
    // Supported asset specs:
    // * ERC20: abi.encode(0, tokenAddress, value)
    //
    // Enough ether should be passed to cover `executionFee` and `relayerFee`.
    //
    // When the message is processed on Asset Hub, `assets` and any excess ether will be
    // received into the assets holding register.
    //
    // The `xcm` should contain the necessary instructions to:
    // 1. Pay XCM execution fees for `xcm`, either from assets in holding,
    //    or from the sovereign account of `msg.sender`.
    // 2. Handle the assets in holding, either depositing them into
    //    some account, or forwarding them to another destination.
    //
    function v2_sendMessage(
        bytes calldata xcm,
        bytes[] calldata assets,
        bytes calldata claimer,
        uint128 executionFee,
        uint128 relayerFee
    ) external payable;

    // Register Ethereum-native token on Polkadot.
    //
    // Params:
    //   * `token` (address): address of a token.
    //   * `network` (uint8): Polkadot=0. Kusama may be added later - it is not supported yet.
    //   * `executionFee`: Amount of ether to pay for execution on AssetHub.
    //   * `relayerFee`: Amount of ether to pay for relayer incentivation.
    function v2_registerToken(
        address token,
        uint8 network,
        uint128 executionFee,
        uint128 relayerFee
    ) external payable;

    /// @dev Creates a new agent contract to act as a proxy for the remote location
    ///      identified by `id`
    function v2_createAgent(bytes32 id) external;

    /// @dev Return the current outbound nonce.
    function v2_outboundNonce() external view returns (uint64);

    /// @dev Check if an inbound message was previously accepted and dispatched
    function v2_isDispatched(uint64 nonce) external view returns (bool);

    /// @dev Check whether a token is registered
    function isTokenRegistered(address token) external view returns (bool);
}

// lib/snowbridge/contracts/src/Functions.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// Common functionality that is shared between V1 and V2
library Functions {
    using Address for address;
    using SafeNativeTransfer for address payable;
    using SafeTokenTransferFrom for IERC20;

    error AgentDoesNotExist();
    error InvalidToken();
    error InvalidAmount();
    error ChannelDoesNotExist();

    /// Looks up an agent contract address, failing if no such mapping exists
    function ensureAgent(bytes32 agentID) internal view returns (address agent) {
        agent = CoreStorage.layout().agents[agentID];
        if (agent == address(0)) {
            revert IGatewayBase.AgentDoesNotExist();
        }
    }

    /// @dev Ensure that the specified parachain has a channel allocated
    function ensureChannel(ChannelID channelID) internal view returns (Channel storage ch) {
        ch = CoreStorage.layout().channels[channelID];
        // A channel always has an agent specified.
        if (ch.agent == address(0)) {
            revert IGatewayV1.ChannelDoesNotExist();
        }
    }

    /// @dev Invoke some code within an agent
    function invokeOnAgent(address agent, address executor, bytes memory data)
        internal
        returns (bytes memory)
    {
        (bool success, bytes memory returndata) = (Agent(payable(agent)).invoke(executor, data));
        return Call.verifyResult(success, returndata);
    }

    /// @dev transfer tokens from the sender to the specified agent
    function transferToAgent(address agent, address token, address sender, uint128 amount)
        internal
    {
        if (!token.isContract()) {
            revert InvalidToken();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        IERC20(token).safeTransferFrom(sender, agent, amount);
    }

    /// @dev Withdraw ether from an agent and transfer to a recipient
    function withdrawEther(
        address executor,
        address agent,
        address payable recipient,
        uint256 amount
    ) internal {
        bytes memory call = abi.encodeCall(AgentExecutor.transferEther, (recipient, amount));
        invokeOnAgent(agent, executor, call);
    }

    // @dev Withdraw Ethereum-native tokens from an agent and transfer to a recipient
    function withdrawNativeToken(
        address executor,
        address agent,
        address token,
        address recipient,
        uint128 amount
    ) internal {
        bytes memory call = abi.encodeCall(AgentExecutor.transferToken, (token, recipient, amount));
        invokeOnAgent(agent, executor, call);
    }

    function registerNativeToken(address token) internal {
        // Validate that the token address is a contract
        if (!token.isContract()) {
            revert InvalidToken();
        }
        
        // NOTE: Explicitly allow a native token to be re-registered. This offers resiliency
        // in case a previous registration attempt of the same token failed on the remote side.
        // It means that registration can be retried.
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        TokenInfo storage info = $.tokenRegistry[token];

        if (info.isRegistered && info.isForeign()) {
            // Prevent re-registration of foreign tokens as native tokens
            revert IGatewayBase.TokenAlreadyRegistered();
        }

        info.isRegistered = true;
    }

    /// Creates a new wrapped ERC20 token for a foreign token
    function registerForeignToken(
        bytes32 foreignTokenID,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) internal returns (Token) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        if ($.tokenAddressOf[foreignTokenID] != address(0)) {
            revert IGatewayBase.TokenAlreadyRegistered();
        }
        Token token = new Token(name, symbol, decimals);
        TokenInfo memory info = TokenInfo({isRegistered: true, foreignID: foreignTokenID});

        $.tokenAddressOf[foreignTokenID] = address(token);
        $.tokenRegistry[address(token)] = info;

        emit IGatewayBase.ForeignTokenRegistered(foreignTokenID, address(token));

        return token;
    }

    function mintForeignToken(bytes32 foreignTokenID, address recipient, uint128 amount)
        internal
    {
        address token = _ensureTokenAddressOf(foreignTokenID);
        Token(token).mint(recipient, amount);
    }

    function dustThreshold() internal view returns (uint256) {
        return 21_000 * tx.gasprice;
    }

    // @dev Get token address by tokenID
    function _ensureTokenAddressOf(bytes32 tokenID) internal view returns (address) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        if ($.tokenAddressOf[tokenID] == address(0)) {
            revert IGatewayBase.TokenNotRegistered();
        }
        return $.tokenAddressOf[tokenID];
    }
}

// lib/snowbridge/contracts/src/v1/Calls.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @title Library for implementing Ethereum->Polkadot ERC20 transfers.
library CallsV1 {
    using Address for address;
    using SafeNativeTransfer for address payable;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    /* Errors */
    error InvalidToken();
    error InvalidAmount();
    error InvalidDestination();
    error TokenNotRegistered();
    error Unsupported();
    error InvalidDestinationFee();
    error AgentDoesNotExist();
    error TokenAlreadyRegistered();
    error TokenMintFailed();
    error TokenTransferFailed();
    error InvalidProof();
    error InvalidNonce();
    error NotEnoughGas();
    error FeePaymentToLow();
    error Unauthorized();
    error Disabled();
    error AgentAlreadyCreated();
    error ChannelDoesNotExist();
    error InvalidChannelUpdate();
    error AgentExecutionFailed(bytes returndata);
    error InvalidAgentExecutionPayload();
    error InvalidConstructorParams();
    error AlreadyInitialized();

    /*
    * External API
    */

    /// @dev Registers a token (only native tokens at this time)
    /// @param token The ERC20 token address.
    function registerToken(address token) external {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        // NOTE: Explicitly allow a token to be re-registered. This offers resiliency
        // in case a previous registration attempt of the same token failed on the remote side.
        // It means that registration can be retried.
        Functions.registerNativeToken(token);

        Ticket memory ticket = Ticket({
            dest: $.assetHubParaID,
            costs: _registerTokenCosts(),
            payload: SubstrateTypes.RegisterToken(token, $.assetHubCreateAssetFee),
            value: 0
        });

        emit IGatewayBase.TokenRegistrationSent(token);

        _submitOutbound(ticket);
    }

    function quoteRegisterTokenFee() external view returns (uint256) {
        return _calculateFee(_registerTokenCosts());
    }

    function sendToken(
        address token,
        address sender,
        ParaID destinationChain,
        MultiAddress calldata destinationAddress,
        uint128 destinationChainFee,
        uint128 amount
    ) external {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        if (amount == 0) {
            revert InvalidAmount();
        }

        TokenInfo storage info = $.tokenRegistry[token];

        if (!info.isRegistered) {
            revert TokenNotRegistered();
        }

        if (info.isNative()) {
            _submitOutbound(
                _sendNativeTokenOrEther(
                    token,
                    sender,
                    destinationChain,
                    destinationAddress,
                    destinationChainFee,
                    amount
                )
            );
        } else {
            _submitOutbound(
                _sendForeignToken(
                    info.foreignID,
                    token,
                    sender,
                    destinationChain,
                    destinationAddress,
                    destinationChainFee,
                    amount
                )
            );
        }
    }

    function quoteSendTokenFee(address token, ParaID destinationChain, uint128 destinationChainFee)
        external
        view
        returns (uint256)
    {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        TokenInfo storage info = $.tokenRegistry[token];
        if (!info.isRegistered) {
            revert TokenNotRegistered();
        }
        return _calculateFee(_sendTokenCosts(destinationChain, destinationChainFee));
    }

    function pricingParameters() external view returns (UD60x18, uint128) {
        PricingStorage.Layout storage pricing = PricingStorage.layout();
        return (pricing.exchangeRate, pricing.deliveryCost);
    }

    function channelNoncesOf(ChannelID channelID) external view returns (uint64, uint64) {
        Channel storage ch = Functions.ensureChannel(channelID);
        return (ch.inboundNonce, ch.outboundNonce);
    }

    function channelOperatingModeOf(ChannelID channelID) external view returns (OperatingMode) {
        Channel storage ch = Functions.ensureChannel(channelID);
        return ch.mode;
    }

    // @dev Get token address by tokenID
    function tokenAddressOf(bytes32 tokenID) external view returns (address) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        return $.tokenAddressOf[tokenID];
    }

    /*
    * Internal functions
    */

    // Convert foreign currency to native currency (WND/PAS/KSM/DOT -> ETH)
    function _convertToNative(UD60x18 exchangeRate, UD60x18 multiplier, UD60x18 amount)
        internal
        view
        returns (uint256)
    {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        UD60x18 ethDecimals = convert_1(1e18);
        UD60x18 foreignDecimals = convert_1(10).pow_1(convert_1(uint256($.foreignTokenDecimals)));
        UD60x18 nativeAmount =
            multiplier.mul_1(amount).mul_1(exchangeRate).div_1(foreignDecimals).mul_1(ethDecimals);
        return convert_0(nativeAmount);
    }

    // Calculate the fee for accepting an outbound message
    function _calculateFee(Costs memory costs) internal view returns (uint256) {
        PricingStorage.Layout storage pricing = PricingStorage.layout();
        UD60x18 amount = convert_1(pricing.deliveryCost + costs.foreign);
        return costs.native + _convertToNative(pricing.exchangeRate, pricing.multiplier, amount);
    }

    /// @dev Outbound message can be disabled globally or on a per-channel basis.
    function _ensureOutboundMessagingEnabled(Channel storage ch) internal view {
        CoreStorage.Layout storage $ = CoreStorage.layout();
        if ($.mode != OperatingMode.Normal || ch.mode != OperatingMode.Normal) {
            revert Disabled();
        }
    }

    // Submit an outbound message to Polkadot, after taking fees
    function _submitOutbound(Ticket memory ticket) internal {
        ChannelID channelID = ticket.dest.into();
        Channel storage channel = Functions.ensureChannel(channelID);

        // Ensure outbound messaging is allowed
        _ensureOutboundMessagingEnabled(channel);

        // Destination fee always in DOT
        uint256 fee = _calculateFee(ticket.costs);

        // Ensure the user has provided enough ether for this message to be accepted.
        // This includes:
        // 1. The bridging fee, which is collected in this gateway contract
        // 2. The ether value being bridged over to Polkadot, which is locked into the AssetHub
        //    agent contract.
        uint256 totalRequiredEther = fee + ticket.value;
        if (msg.value < totalRequiredEther) {
            revert IGatewayBase.InsufficientEther();
        }
        if (ticket.value > 0) {
            payable(AssetsStorage.layout().assetHubAgent).safeNativeTransfer(ticket.value);
        }

        channel.outboundNonce = channel.outboundNonce + 1;

        // Reimburse excess fee payment
        uint256 excessFee = msg.value - totalRequiredEther;
        if (excessFee > Functions.dustThreshold()) {
            payable(msg.sender).safeNativeTransfer(excessFee);
        }

        // Generate a unique ID for this message
        bytes32 messageID = keccak256(abi.encodePacked(channelID, channel.outboundNonce));

        emit IGatewayV1.OutboundMessageAccepted(
            channelID, channel.outboundNonce, messageID, ticket.payload
        );
    }

    function isTokenRegistered(address token) external view returns (bool) {
        return AssetsStorage.layout().tokenRegistry[token].isRegistered;
    }

    function _sendTokenCosts(ParaID destinationChain, uint128 destinationChainFee)
        internal
        view
        returns (Costs memory costs)
    {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        if ($.assetHubParaID == destinationChain) {
            costs.foreign = $.assetHubReserveTransferFee;
        } else {
            // Reduce the ability for users to perform arbitrage by exploiting a
            // favourable exchange rate. For example supplying Ether
            // and gaining a more valuable amount of DOT on the destination chain.
            //
            // Also prevents users from mistakenly sending more fees than would be required
            // which has negative effects like draining AssetHub's sovereign account.
            //
            // For safety, `maxDestinationChainFee` should be less valuable
            // than the gas cost to send tokens.
            if (destinationChainFee > $.maxDestinationFee) {
                revert InvalidDestinationFee();
            }

            // If the final destination chain is not AssetHub, then the fee needs to additionally
            // include the cost of executing an XCM on the final destination parachain.
            costs.foreign = $.assetHubReserveTransferFee + destinationChainFee;
        }
        // We don't charge any extra fees beyond delivery costs
        costs.native = 0;
    }

    function _sendNativeTokenOrEther(
        address token,
        address sender,
        ParaID destinationChain,
        MultiAddress calldata destinationAddress,
        uint128 destinationChainFee,
        uint128 amount
    ) internal returns (Ticket memory ticket) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        if (token != address(0)) {
            // Lock ERC20
            Functions.transferToAgent($.assetHubAgent, token, sender, amount);
            ticket.value = 0;
        } else {
            // Track the ether to bridge to Polkadot. This will be handled
            // in `Gateway._submitOutbound`.
            ticket.value = amount;
        }

        ticket.dest = $.assetHubParaID;
        ticket.costs = _sendTokenCosts(destinationChain, destinationChainFee);

        // Construct a message payload
        if (destinationChain == $.assetHubParaID) {
            // The funds will be minted into the receiver's account on AssetHub
            if (destinationAddress.isAddress32()) {
                // The receiver has a 32-byte account ID
                ticket.payload = SubstrateTypes.SendTokenToAssetHubAddress32(
                    token, destinationAddress.asAddress32(), $.assetHubReserveTransferFee, amount
                );
            } else {
                // AssetHub does not support 20-byte account IDs
                revert Unsupported();
            }
        } else {
            if (destinationChainFee == 0) {
                revert InvalidDestinationFee();
            }
            // The funds will be minted into sovereign account of the destination parachain on
            // AssetHub, and then reserve-transferred to the receiver's account on the destination
            // parachain.
            if (destinationAddress.isAddress32()) {
                // The receiver has a 32-byte account ID
                ticket.payload = SubstrateTypes.SendTokenToAddress32(
                    token,
                    destinationChain,
                    destinationAddress.asAddress32(),
                    $.assetHubReserveTransferFee,
                    destinationChainFee,
                    amount
                );
            } else if (destinationAddress.isAddress20()) {
                // The receiver has a 20-byte account ID
                ticket.payload = SubstrateTypes.SendTokenToAddress20(
                    token,
                    destinationChain,
                    destinationAddress.asAddress20(),
                    $.assetHubReserveTransferFee,
                    destinationChainFee,
                    amount
                );
            } else {
                revert Unsupported();
            }
        }

        emit IGatewayV1.TokenSent(token, sender, destinationChain, destinationAddress, amount);
    }

    // @dev Transfer Polkadot-native tokens back to Polkadot
    function _sendForeignToken(
        bytes32 foreignID,
        address token,
        address sender,
        ParaID destinationChain,
        MultiAddress calldata destinationAddress,
        uint128 destinationChainFee,
        uint128 amount
    ) internal returns (Ticket memory ticket) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        Token(token).burn(sender, amount);

        ticket.dest = $.assetHubParaID;
        ticket.costs = _sendTokenCosts(destinationChain, destinationChainFee);
        ticket.value = 0;

        // Construct a message payload
        if (destinationChain == $.assetHubParaID && destinationAddress.isAddress32()) {
            // The funds will be minted into the receiver's account on AssetHub
            // The receiver has a 32-byte account ID
            ticket.payload = SubstrateTypes.SendForeignTokenToAssetHubAddress32(
                foreignID, destinationAddress.asAddress32(), $.assetHubReserveTransferFee, amount
            );
        } else {
            revert Unsupported();
        }

        emit IGatewayV1.TokenSent(token, sender, destinationChain, destinationAddress, amount);
    }

    function _registerTokenCosts() internal view returns (Costs memory costs) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();

        // Cost of registering this asset on AssetHub
        costs.foreign = $.assetHubCreateAssetFee;

        // Extra fee to prevent spamming
        costs.native = $.registerTokenFee;
    }

    function _isTokenRegistered(address token) internal view returns (bool) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        return $.tokenRegistry[token].isRegistered;
    }
}

// lib/snowbridge/contracts/src/v2/Calls.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// @title Library for implementing Ethereum->Polkadot ERC20 transfers.
library CallsV2 {
    using Address for address;
    using SafeTokenTransfer for IERC20;
    using SafeNativeTransfer for address payable;

    uint8 public constant MAX_ASSETS = 8;

    // Refer to `IGateway.v2_createAgent` for documentation
    function createAgent(bytes32 id) external {
        CoreStorage.Layout storage core = CoreStorage.layout();
        address agent = core.agents[id];
        if (agent == address(0)) {
            agent = address(new Agent(id));
            core.agents[id] = agent;
            emit IGatewayV2.AgentCreated(id, agent);
        } else {
            revert IGatewayV2.AgentAlreadyExists();
        }
    }

    // Refer to `IGateway.v2_sendMessage` for documentation
    function sendMessage(
        bytes calldata message,
        bytes[] calldata assets,
        bytes calldata claimer,
        uint128 executionFee,
        uint128 relayerFee
    ) external {
        _sendMessage(
            msg.sender, makeRawMessage(message), assets, claimer, executionFee, relayerFee
        );
    }

    // Refer to `IGateway.v2_registerToken` for documentation
    function registerToken(
        address token,
        Network network,
        uint128 executionFee,
        uint128 relayerFee
    ) internal {
        require(msg.value <= type(uint128).max, IGatewayV2.ExceededMaximumValue());
        require(msg.value >= executionFee + relayerFee, IGatewayV2.InsufficientValue());

        Message memory message = makeCreateAssetMessage(token, network);

        Functions.registerNativeToken(token);

        _sendMessage(address(this), message, new bytes[](0), "", executionFee, relayerFee);
    }

    /*
    * Internal functions
    */

    function _sendMessage(
        address origin,
        Message memory message,
        bytes[] memory assets,
        bytes memory claimer,
        uint128 executionFee,
        uint128 relayerFee
    ) internal {
        // Ensure outbound messaging is allowed
        _ensureOutboundMessagingEnabled();

        require(msg.value <= type(uint128).max, IGatewayV2.ExceededMaximumValue());
        require(msg.value >= executionFee + relayerFee, IGatewayV2.InsufficientValue());
        address assetHubAgent = Functions.ensureAgent(Constants.ASSET_HUB_AGENT_ID);
        payable(assetHubAgent).safeNativeTransfer(msg.value);

        require(assets.length <= MAX_ASSETS, IGatewayV2.TooManyAssets());
        Asset[] memory preparedAssets = new Asset[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            preparedAssets[i] = _handleAsset(assets[i]);
        }

        CoreStorage.Layout storage $ = CoreStorage.layout();
        $.outboundNonce = $.outboundNonce + 1;

        Payload memory payload = Payload({
            origin: origin,
            assets: preparedAssets,
            message: message,
            claimer: claimer,
            value: uint128(msg.value) - executionFee - relayerFee,
            executionFee: executionFee,
            relayerFee: relayerFee
        });

        emit IGatewayV2.OutboundMessageAccepted($.outboundNonce, payload);
    }

    /// @dev Outbound message can be disabled globally or on a per-channel basis.
    function _ensureOutboundMessagingEnabled() internal view {
        CoreStorage.Layout storage $ = CoreStorage.layout();
        require($.mode == OperatingMode.Normal, IGatewayBase.Disabled());
    }

    function _handleAsset(bytes memory asset) internal returns (Asset memory) {
        uint8 assetKind;
        assembly {
            assetKind := byte(31, mload(add(asset, 32)))
        }
        if (assetKind == 0) {
            // ERC20: abi.encode(0, tokenAddress, value)
            (, address token, uint128 amount) = abi.decode(asset, (uint8, address, uint128));
            return _handleAssetERC20(token, amount);
        } else {
            revert IGatewayV2.InvalidAsset();
        }
    }

    function _handleAssetERC20(address token, uint128 amount) internal returns (Asset memory) {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        TokenInfo storage tokenInfo = $.tokenRegistry[token];

        require(tokenInfo.isRegistered, IGatewayBase.TokenNotRegistered());
        require(amount > 0, IGatewayBase.InvalidAmount());

        if (tokenInfo.isNative()) {
            Functions.transferToAgent($.assetHubAgent, token, msg.sender, amount);
            return makeNativeAsset(token, amount);
        } else if (tokenInfo.isForeign()) {
            Token(token).burn(msg.sender, amount);
            return makeForeignAsset(tokenInfo.foreignID, amount);
        } else {
            revert IGatewayV2.ShouldNotReachHere();
        }
    }

    function outboundNonce() external view returns (uint64) {
        return CoreStorage.layout().outboundNonce;
    }
}

// lib/snowbridge/contracts/src/v1/Handlers.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library HandlersV1 {
    using Address for address;
    using SafeTokenTransferFrom for IERC20;

    // @dev Release Ethereum-native tokens received back from polkadot
    //
    // DEPRECATED: Use `HandlersV1.unlockNativeToken` instead. Kept for
    // legacy compatibility reasons, in case the gateway has to process a message
    // in the older format.
    function agentExecute(address executor, bytes calldata data) external {
        AgentExecuteParams memory params = abi.decode(data, (AgentExecuteParams));

        address agent = Functions.ensureAgent(params.agentID);

        if (params.payload.length == 0) {
            revert IGatewayBase.InvalidAgentExecutionPayload();
        }

        (AgentExecuteCommand command, bytes memory commandParams) =
            abi.decode(params.payload, (AgentExecuteCommand, bytes));
        if (command == AgentExecuteCommand.TransferToken) {
            (address token, address recipient, uint128 amount) =
                abi.decode(commandParams, (address, address, uint128));
            if (token == address(0)) {
                Functions.withdrawEther(executor, agent, payable(recipient), amount);
            } else {
                Functions.withdrawNativeToken(executor, agent, token, recipient, amount);
            }
        }
    }

    /// @dev Perform an upgrade of the gateway
    function upgrade(bytes calldata data) external {
        UpgradeParams_1 memory params = abi.decode(data, (UpgradeParams_1));
        Upgrade.upgrade(params.impl, params.implCodeHash, params.initParams);
    }

    // @dev Set the operating mode of the gateway
    function setOperatingMode(bytes calldata data) external {
        CoreStorage.Layout storage $ = CoreStorage.layout();
        SetOperatingModeParams_1 memory params = abi.decode(data, (SetOperatingModeParams_1));
        $.mode = params.mode;
        emit IGatewayBase.OperatingModeChanged(params.mode);
    }

    // @dev Set token fees of the gateway
    function setTokenTransferFees(bytes calldata data) external {
        AssetsStorage.Layout storage $ = AssetsStorage.layout();
        SetTokenTransferFeesParams memory params = abi.decode(data, (SetTokenTransferFeesParams));
        $.assetHubCreateAssetFee = params.assetHubCreateAssetFee;
        $.assetHubReserveTransferFee = params.assetHubReserveTransferFee;
        $.registerTokenFee = params.registerTokenFee;
        emit IGatewayV1.TokenTransferFeesChanged();
    }

    // @dev Set pricing params of the gateway
    function setPricingParameters(bytes calldata data) external {
        PricingStorage.Layout storage pricing = PricingStorage.layout();
        SetPricingParametersParams memory params = abi.decode(data, (SetPricingParametersParams));
        pricing.exchangeRate = params.exchangeRate;
        pricing.deliveryCost = params.deliveryCost;
        pricing.multiplier = params.multiplier;
        emit IGatewayV1.PricingParametersChanged();
    }

    // @dev Register a new fungible Polkadot token for an agent
    function registerForeignToken(bytes calldata data) external {
        RegisterForeignTokenParams_1 memory params = abi.decode(data, (RegisterForeignTokenParams_1));
        Functions.registerForeignToken(
            params.foreignTokenID, params.name, params.symbol, params.decimals
        );
    }

    // @dev Release Ethereum-native tokens received back from polkadot
    function unlockNativeToken(address executor, bytes calldata data) external {
        UnlockNativeTokenParams_1 memory params = abi.decode(data, (UnlockNativeTokenParams_1));
        address agent = Functions.ensureAgent(params.agentID);
        if (params.token == address(0)) {
            Functions.withdrawEther(executor, agent, payable(params.recipient), params.amount);
        } else {
            Functions.withdrawNativeToken(
                executor, agent, params.token, params.recipient, params.amount
            );
        }
    }

    // @dev Mint foreign token from polkadot
    function mintForeignToken(ChannelID channelID, bytes calldata data) external {
        if (channelID != Constants.ASSET_HUB_PARA_ID.into()) {
            revert IGatewayBase.Unauthorized();
        }
        MintForeignTokenParams_1 memory params = abi.decode(data, (MintForeignTokenParams_1));
        Functions.mintForeignToken(params.foreignTokenID, params.recipient, params.amount);
    }
}

// lib/snowbridge/contracts/src/v2/Handlers.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library HandlersV2 {
    using Address for address;
    using SafeTokenTransferFrom for IERC20;

    function upgrade(bytes calldata data) external {
        UpgradeParams_0 memory params = abi.decode(data, (UpgradeParams_0));
        Upgrade.upgrade(params.impl, params.implCodeHash, params.initParams);
    }

    function setOperatingMode(bytes calldata data) external {
        SetOperatingModeParams_0 memory params = abi.decode(data, (SetOperatingModeParams_0));
        CoreStorage.Layout storage $ = CoreStorage.layout();
        $.mode = params.mode;
        emit IGatewayBase.OperatingModeChanged(params.mode);
    }

    // @dev Register a new fungible Polkadot token for an agent
    function registerForeignToken(bytes calldata data) external {
        RegisterForeignTokenParams_0 memory params = abi.decode(data, (RegisterForeignTokenParams_0));
        Functions.registerForeignToken(
            params.foreignTokenID, params.name, params.symbol, params.decimals
        );
    }

    function unlockNativeToken(address executor, bytes calldata data) external {
        UnlockNativeTokenParams_0 memory params = abi.decode(data, (UnlockNativeTokenParams_0));
        address agent = Functions.ensureAgent(Constants.ASSET_HUB_AGENT_ID);

        if (params.token == address(0)) {
            Functions.withdrawEther(executor, agent, payable(params.recipient), params.amount);
        } else {
            Functions.withdrawNativeToken(
                executor, agent, params.token, params.recipient, params.amount
            );
        }
    }

    function mintForeignToken(bytes calldata data) external {
        MintForeignTokenParams_0 memory params = abi.decode(data, (MintForeignTokenParams_0));
        Functions.mintForeignToken(params.foreignTokenID, params.recipient, params.amount);
    }

    function callContract(bytes32 origin, address executor, bytes calldata data) external {
        CallContractParams memory params = abi.decode(data, (CallContractParams));
        address agent = Functions.ensureAgent(origin);
        bytes memory call =
            abi.encodeCall(AgentExecutor.callContract, (params.target, params.data, params.value));
        Functions.invokeOnAgent(agent, executor, call);
    }
}

// lib/snowbridge/contracts/src/Types.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// lib/snowbridge/contracts/src/Initializer.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

library Initializer {
    error Unauthorized();

    // Initial configuration for bridge
    struct Config {
        OperatingMode mode;
        /// @dev The fee charged to users for submitting outbound messages (DOT)
        uint128 deliveryCost;
        /// @dev The ETH/DOT exchange rate
        UD60x18 exchangeRate;
        /// @dev The extra fee charged for registering tokens (DOT)
        uint128 assetHubCreateAssetFee;
        /// @dev The extra fee charged for sending tokens (DOT)
        uint128 assetHubReserveTransferFee;
        /// @dev extra fee to discourage spamming
        uint256 registerTokenFee;
        /// @dev Fee multiplier
        UD60x18 multiplier;
        uint8 foreignTokenDecimals;
        uint128 maxDestinationFee;
    }

    function initialize(bytes calldata data) external {
        // Prevent initialization of storage in implementation contract
        if (ERC1967.load() == address(0)) {
            revert Unauthorized();
        }

        CoreStorage.Layout storage core = CoreStorage.layout();

        Config memory config = abi.decode(data, (Config));

        core.mode = config.mode;

        // Initialize agent for BridgeHub
        address bridgeHubAgent = address(new Agent(Constants.BRIDGE_HUB_AGENT_ID));
        core.agents[Constants.BRIDGE_HUB_AGENT_ID] = bridgeHubAgent;

        // Initialize channel for primary governance track
        core.channels[Constants.PRIMARY_GOVERNANCE_CHANNEL_ID] = Channel({
            mode: OperatingMode.Normal,
            agent: bridgeHubAgent,
            inboundNonce: 0,
            outboundNonce: 0
        });

        // Initialize channel for secondary governance track
        core.channels[Constants.SECONDARY_GOVERNANCE_CHANNEL_ID] = Channel({
            mode: OperatingMode.Normal,
            agent: bridgeHubAgent,
            inboundNonce: 0,
            outboundNonce: 0
        });

        // Initialize agent for for AssetHub
        address assetHubAgent = address(new Agent(Constants.ASSET_HUB_AGENT_ID));
        core.agents[Constants.ASSET_HUB_AGENT_ID] = assetHubAgent;

        // Initialize channel for AssetHub
        core.channels[Constants.ASSET_HUB_PARA_ID.into()] = Channel({
            mode: OperatingMode.Normal,
            agent: assetHubAgent,
            inboundNonce: 0,
            outboundNonce: 0
        });

        // Initialize pricing storage
        PricingStorage.Layout storage pricing = PricingStorage.layout();
        pricing.exchangeRate = config.exchangeRate;
        pricing.deliveryCost = config.deliveryCost;
        pricing.multiplier = config.multiplier;

        // Initialize assets storage
        AssetsStorage.Layout storage assets = AssetsStorage.layout();

        assets.assetHubParaID = Constants.ASSET_HUB_PARA_ID;
        assets.assetHubAgent = assetHubAgent;
        assets.registerTokenFee = config.registerTokenFee;
        assets.assetHubCreateAssetFee = config.assetHubCreateAssetFee;
        assets.assetHubReserveTransferFee = config.assetHubReserveTransferFee;
        assets.foreignTokenDecimals = config.foreignTokenDecimals;
        assets.maxDestinationFee = config.maxDestinationFee;

        TokenInfo storage etherTokenInfo = assets.tokenRegistry[address(0)];
        etherTokenInfo.isRegistered = true;
    }
}

// lib/snowbridge/contracts/src/Gateway.sol

// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

contract Gateway is IGatewayBase, IGatewayV1, IGatewayV2, IInitializable, IUpgradable {
    using Address for address;
    using SafeNativeTransfer for address payable;

    // Address of the code to be run within `Agent.sol` using delegatecall
    address public immutable AGENT_EXECUTOR;

    // Consensus client for Polkadot
    address public immutable BEEFY_CLIENT;

    // Message handlers can only be dispatched by the gateway itself
    modifier onlySelf() {
        if (msg.sender != address(this)) {
            revert IGatewayBase.Unauthorized();
        }
        _;
    }

    // Makes functions nonreentrant
    modifier nonreentrant() {
        assembly {
            if tload(0) { revert(0, 0) }

            // Set the flag to mark the function is currently executing.
            tstore(0, 1)
        }
        _;
        // Unlocks the guard, making the pattern composable.
        // After the function exits, it can be called again, even in the same transaction.
        assembly {
            tstore(0, 0)
        }
    }

    constructor(address beefyClient, address agentExecutor) {
        BEEFY_CLIENT = beefyClient;
        AGENT_EXECUTOR = agentExecutor;
    }

    /*
     *     _____   __________ .___          ____
     *    /  _  \  \______   \|   | ___  __/_   |
     *   /  /_\  \  |     ___/|   | \  \/ / |   |
     *  /    |    \ |    |    |   |  \   /  |   |
     *  \____|__  / |____|    |___|   \_/   |___|
     *          \/
     */

    // Verify that a message commitment is considered finalized by our BEEFY light client.
    function _verifyCommitment(bytes32 commitment, Verification.Proof calldata proof, bool isV2)
        internal
        view
        virtual
        returns (bool)
    {
        return Verification.verifyCommitment(
            BEEFY_CLIENT,
            ScaleCodec.encodeU32(uint32(ParaID.unwrap(Constants.BRIDGE_HUB_PARA_ID))),
            commitment,
            proof,
            isV2
        );
    }

    /**
     * APIv1 Constants
     */

    // Gas used for:
    // 1. Mapping a command id to an implementation function
    // 2. Calling implementation function
    uint256 constant DISPATCH_OVERHEAD_GAS_V1 = 10_000;

    /**
     * APIv1 External API
     */

    /// @dev Submit a message from Polkadot for verification and dispatch
    /// @param message A message produced by the OutboundQueue pallet on BridgeHub
    /// @param leafProof A message proof used to verify that the message is in the merkle tree
    ///        committed by the OutboundQueue pallet.
    /// @param headerProof A proof that the commitment is included in parachain header that was
    ///        finalized by BEEFY.
    function submitV1(
        InboundMessage_1 calldata message,
        bytes32[] calldata leafProof,
        Verification.Proof calldata headerProof
    ) external nonreentrant {
        uint256 startGas = gasleft();

        Channel storage channel = Functions.ensureChannel(message.channelID);

        // Ensure this message is not being replayed
        if (message.nonce != channel.inboundNonce + 1) {
            revert IGatewayBase.InvalidNonce();
        }

        // Increment nonce for origin.
        // This also prevents the re-entrancy case in which a malicious party tries to re-enter by
        // calling `submitInbound` again with the same (message, leafProof, headerProof) arguments.
        channel.inboundNonce++;

        // Produce the commitment (message root) by applying the leaf proof to the message leaf
        bytes32 leafHash = keccak256(abi.encode(message));
        bytes32 commitment = MerkleProof.processProof(leafProof, leafHash);

        // Verify that the commitment is included in a parachain header finalized by BEEFY.
        if (!_verifyCommitment(commitment, headerProof, false)) {
            revert IGatewayBase.InvalidProof();
        }

        // Make sure relayers provide enough gas so that inner message dispatch
        // does not run out of gas.
        uint256 maxDispatchGas = message.maxDispatchGas;
        if (gasleft() < maxDispatchGas + DISPATCH_OVERHEAD_GAS_V1) {
            revert IGatewayBase.NotEnoughGas();
        }

        bool success = true;

        // Dispatch message to a handler
        if (message.command == Command_1.AgentExecute) {
            try Gateway(this).v1_handleAgentExecute{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.SetOperatingMode) {
            try Gateway(this).v1_handleSetOperatingMode{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.Upgrade) {
            try Gateway(this).v1_handleUpgrade{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.SetTokenTransferFees) {
            try Gateway(this).v1_handleSetTokenTransferFees{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.SetPricingParameters) {
            try Gateway(this).v1_handleSetPricingParameters{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.UnlockNativeToken) {
            try Gateway(this).v1_handleUnlockNativeToken{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.RegisterForeignToken) {
            try Gateway(this).v1_handleRegisterForeignToken{gas: maxDispatchGas}(message.params) {}
            catch {
                success = false;
            }
        } else if (message.command == Command_1.MintForeignToken) {
            try Gateway(this).v1_handleMintForeignToken{gas: maxDispatchGas}(
                message.channelID, message.params
            ) {} catch {
                success = false;
            }
        } else {
            success = false;
        }

        // Calculate a gas refund, capped to protect against huge spikes in `tx.gasprice`
        // that could drain funds unnecessarily. During these spikes, relayers should back off.
        uint256 gasUsed = v1_transactionBaseGas() + (startGas - gasleft());
        uint256 refund = gasUsed * Math_1.min(tx.gasprice, message.maxFeePerGas);

        // Add the reward to the refund amount. If the sum is more than the funds available
        // in the gateway, then reduce the total amount
        uint256 amount = Math_1.min(refund + message.reward, address(this).balance);

        // Do the payment if there funds available in the gateway
        if (amount > Functions.dustThreshold()) {
            payable(msg.sender).safeNativeTransfer(amount);
        }

        emit IGatewayV1.InboundMessageDispatched(
            message.channelID, message.nonce, message.id, success
        );
    }

    function operatingMode()
        external
        view
        override(IGatewayV1, IGatewayV2)
        returns (OperatingMode)
    {
        return CoreStorage.layout().mode;
    }

    function channelOperatingModeOf(ChannelID channelID) external view returns (OperatingMode) {
        return CallsV1.channelOperatingModeOf(channelID);
    }

    function channelNoncesOf(ChannelID channelID) external view returns (uint64, uint64) {
        return CallsV1.channelNoncesOf(channelID);
    }

    function agentOf(bytes32 agentID)
        external
        view
        override(IGatewayV1, IGatewayV2)
        returns (address)
    {
        return Functions.ensureAgent(agentID);
    }

    function pricingParameters() external view returns (UD60x18, uint128) {
        return CallsV1.pricingParameters();
    }

    function implementation() public view returns (address) {
        return ERC1967.load();
    }

    function isTokenRegistered(address token)
        external
        view
        override(IGatewayV1, IGatewayV2)
        returns (bool)
    {
        return CallsV1.isTokenRegistered(token);
    }

    function depositEther() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function queryForeignTokenID(address token) external view returns (bytes32) {
        return AssetsStorage.layout().tokenRegistry[token].foreignID;
    }

    // Total fee for registering a token
    function quoteRegisterTokenFee() external view returns (uint256) {
        return CallsV1.quoteRegisterTokenFee();
    }

    // Register an Ethereum-native token in the gateway and on AssetHub
    function registerToken(address token) external payable nonreentrant {
        CallsV1.registerToken(token);
    }

    // Total fee for sending a token
    function quoteSendTokenFee(address token, ParaID destinationChain, uint128 destinationFee)
        external
        view
        returns (uint256)
    {
        return CallsV1.quoteSendTokenFee(token, destinationChain, destinationFee);
    }

    // Transfer ERC20 tokens to a Polkadot parachain
    function sendToken(
        address token,
        ParaID destinationChain,
        MultiAddress calldata destinationAddress,
        uint128 destinationFee,
        uint128 amount
    ) external payable nonreentrant {
        CallsV1.sendToken(
            token, msg.sender, destinationChain, destinationAddress, destinationFee, amount
        );
    }

    // @dev Get token address by tokenID
    function tokenAddressOf(bytes32 tokenID) external view returns (address) {
        return CallsV1.tokenAddressOf(tokenID);
    }

    /**
     * APIv1 Inbound Message Handlers
     */

    // Execute code within an agent
    function v1_handleAgentExecute(bytes calldata data) external onlySelf {
        HandlersV1.agentExecute(AGENT_EXECUTOR, data);
    }

    /// @dev Perform an upgrade of the gateway
    function v1_handleUpgrade(bytes calldata data) external onlySelf {
        HandlersV1.upgrade(data);
    }

    // @dev Set the operating mode of the gateway
    function v1_handleSetOperatingMode(bytes calldata data) external onlySelf {
        HandlersV1.setOperatingMode(data);
    }

    // @dev Set token fees of the gateway
    function v1_handleSetTokenTransferFees(bytes calldata data) external onlySelf {
        HandlersV1.setTokenTransferFees(data);
    }

    // @dev Set pricing params of the gateway
    function v1_handleSetPricingParameters(bytes calldata data) external onlySelf {
        HandlersV1.setPricingParameters(data);
    }

    // @dev Transfer Ethereum native token back from polkadot
    function v1_handleUnlockNativeToken(bytes calldata data) external onlySelf {
        HandlersV1.unlockNativeToken(AGENT_EXECUTOR, data);
    }

    // @dev Register a new fungible Polkadot token for an agent
    function v1_handleRegisterForeignToken(bytes calldata data) external onlySelf {
        HandlersV1.registerForeignToken(data);
    }

    // @dev Mint foreign token from polkadot
    function v1_handleMintForeignToken(ChannelID channelID, bytes calldata data)
        external
        onlySelf
    {
        HandlersV1.mintForeignToken(channelID, data);
    }

    /**
     * APIv1 Internal functions
     */

    // Best-effort attempt at estimating the base gas use of `submitInbound` transaction, outside
    // the block of code that is metered.
    // This includes:
    // * Cost paid for every transaction: 21000 gas
    // * Cost of calldata: Zero byte = 4 gas, Non-zero byte = 16 gas
    // * Cost of code inside submitInitial that is not metered: 14_698
    //
    // The major cost of calldata are the merkle proofs, which should dominate anything else
    // (including the message payload) Since the merkle proofs are hashes, they are much more
    // likely to be composed of more non-zero bytes than zero bytes.
    //
    // Reference: Ethereum Yellow Paper
    function v1_transactionBaseGas() internal pure returns (uint256) {
        return 21_000 + 14_698 + (msg.data.length * 16);
    }

    /*
    *     _____   __________ .___         ________
    *    /  _  \  \______   \|   | ___  __\_____  \
    *   /  /_\  \  |     ___/|   | \  \/ / /  ____/§
    *  /    |    \ |    |    |   |  \   / /       \
    *  \____|__  / |____|    |___|   \_/  \_______ \
    *          \/                                 \/
    */

    /// Overhead in selecting the dispatch handler for an arbitrary command
    uint256 internal constant DISPATCH_OVERHEAD_GAS_V2 = 24_000;

    function v2_submit(
        InboundMessage_0 calldata message,
        bytes32[] calldata messageProof,
        BeefyVerification.Proof calldata beefyProof,
        bytes32 rewardAddress
    ) external nonreentrant {
        CoreStorage.Layout storage $ = CoreStorage.layout();

        if ($.inboundNonce.get_0(message.nonce)) {
            revert IGatewayBase.InvalidNonce();
        }

        $.inboundNonce.set_0(message.nonce);

        // Verify the message proof in two steps:
        // 1. Produce the commitment (message root) by applying the leaf proof to the message leaf
        // 2. Verify that the commitment is part of an MMR leaf included in the latest finalized BEEFY MMR root
        {
            bytes32 commitment = _buildMessageCommitment(message, messageProof);
            if (!_verifyBeefyProof(commitment, beefyProof)) {
                revert InvalidProof();
            }
        }

        // Dispatch the message payload. The boolean returned indicates whether all commands succeeded.
        bool success = v2_dispatch(message);

        // Emit the event with a success value "true" if all commands successfully executed, otherwise "false"
        // if all or some of the commands failed.
        emit IGatewayV2.InboundMessageDispatched(
            message.nonce, message.topic, success, rewardAddress
        );
    }

    function v2_outboundNonce() external view returns (uint64) {
        return CallsV2.outboundNonce();
    }

    function v2_isDispatched(uint64 nonce) external view returns (bool) {
        return CoreStorage.layout().inboundNonce.get_0(nonce);
    }

    // See docs for `IGateway.v2_sendMessage`
    function v2_sendMessage(
        bytes calldata message,
        bytes[] calldata assets,
        bytes calldata claimer,
        uint128 executionFee,
        uint128 relayerFee
    ) external payable nonreentrant {
        CallsV2.sendMessage(message, assets, claimer, executionFee, relayerFee);
    }

    // See docs for `IGateway.v2_registerToken`
    function v2_registerToken(
        address token,
        uint8 network,
        uint128 executionFee,
        uint128 relayerFee
    ) external payable nonreentrant {
        require(network == uint8(Network.Solochain), IGatewayV2.InvalidNetwork());
        CallsV2.registerToken(token, Network(network), executionFee, relayerFee);
    }

    // See docs for `IGateway.v2_createAgent`
    function v2_createAgent(bytes32 id) external {
        CallsV2.createAgent(id);
    }

    /**
     * APIv2 Message Handlers
     */

    //  Perform an upgrade of the gateway
    function v2_handleUpgrade(bytes calldata data) external onlySelf {
        HandlersV2.upgrade(data);
    }

    // Set the operating mode of the gateway
    function v2_handleSetOperatingMode(bytes calldata data) external onlySelf {
        HandlersV2.setOperatingMode(data);
    }

    // Unlock Native token
    function v2_handleUnlockNativeToken(bytes calldata data) external onlySelf {
        HandlersV2.unlockNativeToken(AGENT_EXECUTOR, data);
    }

    // Mint foreign token from polkadot
    function v2_handleRegisterForeignToken(bytes calldata data) external onlySelf {
        HandlersV2.registerForeignToken(data);
    }

    // Mint foreign token from polkadot
    function v2_handleMintForeignToken(bytes calldata data) external onlySelf {
        HandlersV2.mintForeignToken(data);
    }

    // Call an arbitrary contract function
    function v2_handleCallContract(bytes32 origin, bytes calldata data) external onlySelf {
        HandlersV2.callContract(origin, AGENT_EXECUTOR, data);
    }

    /**
     * APIv2 Internal functions
     */

    // Internal helper to dispatch a single command
    function _dispatchCommand(Command_0 calldata command, bytes32 origin)
        internal
        returns (bool)
    {
        // check that there is enough gas available to forward to the command handler
        if (gasleft() * 63 / 64 < command.gas + DISPATCH_OVERHEAD_GAS_V2) {
            revert IGatewayV2.InsufficientGasLimit();
        }

        if (command.kind == CommandKind.Upgrade) {
            try Gateway(this).v2_handleUpgrade{gas: command.gas}(command.payload) {}
            catch {
                return false;
            }
        } else if (command.kind == CommandKind.SetOperatingMode) {
            try Gateway(this).v2_handleSetOperatingMode{gas: command.gas}(command.payload) {}
            catch {
                return false;
            }
        } else if (command.kind == CommandKind.UnlockNativeToken) {
            try Gateway(this).v2_handleUnlockNativeToken{gas: command.gas}(command.payload) {}
            catch {
                return false;
            }
        } else if (command.kind == CommandKind.RegisterForeignToken) {
            try Gateway(this).v2_handleRegisterForeignToken{gas: command.gas}(command.payload) {}
            catch {
                return false;
            }
        } else if (command.kind == CommandKind.MintForeignToken) {
            try Gateway(this).v2_handleMintForeignToken{gas: command.gas}(command.payload) {}
            catch {
                return false;
            }
        } else if (command.kind == CommandKind.CallContract) {
            try Gateway(this).v2_handleCallContract{gas: command.gas}(origin, command.payload) {}
            catch {
                return false;
            }
        } else {
            // Unknown command
            return false;
        }
        return true;
    }

    // Dispatch all the commands within the batch of commands in the message payload. Each command is processed
    // independently, such that failures emit a `CommandFailed` event without stopping execution of subsequent commands.
    function v2_dispatch(InboundMessage_0 calldata message) internal returns (bool) {
        bool allCommandsSucceeded = true;

        for (uint256 i = 0; i < message.commands.length; i++) {
            if (!_dispatchCommand(message.commands[i], message.origin)) {
                emit IGatewayV2.CommandFailed(message.nonce, i);
                allCommandsSucceeded = false;
            }
        }

        return allCommandsSucceeded;
    }

    /**
     * Upgrades
     */

    /// Initialize storage within the `GatewayProxy` contract using this initializer.
    ///
    /// This initializer cannot be called externally via the proxy as the function selector
    /// is overshadowed in the proxy.
    ///
    /// This implementation is only intended to initialize storage for initial deployments
    /// of the `GatewayProxy` contract to transient or long-lived testnets.
    ///
    /// The `GatewayProxy` deployed to Ethereum mainnet already has its storage initialized.
    /// When its logic contract needs to upgraded, a new logic contract should be developed
    /// that inherits from this base `Gateway` contract. Particularly, the `initialize` function
    /// must be overridden to ensure selective initialization of storage fields relevant
    /// to the upgrade.
    ///
    /// ```solidity
    /// contract Gateway202508 is Gateway {
    ///     function initialize(bytes calldata data) external override {
    ///         if (ERC1967.load() == address(0)) {
    ///             revert Unauthorized();
    ///         }
    ///         # Initialization routines here...
    ///     }
    /// }
    /// ```
    ///
    function initialize(bytes calldata data) external virtual {
        Initializer.initialize(data);
    }

    function _buildMessageCommitment(InboundMessage_0 calldata message, bytes32[] calldata proof)
        internal
        pure
        virtual
        returns (bytes32)
    {
        bytes32 leafHash = keccak256(abi.encode(message));
        return MerkleProof.processProof(proof, leafHash);
    }

    function _verifyBeefyProof(bytes32 extraField, BeefyVerification.Proof calldata beefyProof)
        internal
        view
        virtual
        returns (bool)
    {
        return BeefyVerification.verifyBeefyMMRLeaf(BEEFY_CLIENT, extraField, beefyProof);
    }
}

