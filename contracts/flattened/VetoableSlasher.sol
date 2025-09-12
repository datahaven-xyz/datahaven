// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0 ^0.8.0 ^0.8.27;

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-upgradeable-v4.9.0/contracts/utils/math/SafeCastUpgradeable.sol

// OpenZeppelin Contracts (last updated v4.8.0) (utils/math/SafeCast.sol)
// This file was procedurally generated from scripts/generate/templates/SafeCast.js.

/**
 * @dev Wrappers over Solidity's uintXX/intXX casting operators with added overflow
 * checks.
 *
 * Downcasting from uint256/int256 in Solidity does not revert on overflow. This can
 * easily result in undesired exploitation or bugs, since developers usually
 * assume that overflows raise errors. `SafeCast` restores this intuition by
 * reverting the transaction when such an operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 *
 * Can be combined with {SafeMath} and {SignedSafeMath} to extend it to smaller types, by performing
 * all math on `uint256` and `int256` and then downcasting.
 */
library SafeCastUpgradeable {
    /**
     * @dev Returns the downcasted uint248 from uint256, reverting on
     * overflow (when the input is greater than largest uint248).
     *
     * Counterpart to Solidity's `uint248` operator.
     *
     * Requirements:
     *
     * - input must fit into 248 bits
     *
     * _Available since v4.7._
     */
    function toUint248(uint256 value) internal pure returns (uint248) {
        require(value <= type(uint248).max, "SafeCast: value doesn't fit in 248 bits");
        return uint248(value);
    }

    /**
     * @dev Returns the downcasted uint240 from uint256, reverting on
     * overflow (when the input is greater than largest uint240).
     *
     * Counterpart to Solidity's `uint240` operator.
     *
     * Requirements:
     *
     * - input must fit into 240 bits
     *
     * _Available since v4.7._
     */
    function toUint240(uint256 value) internal pure returns (uint240) {
        require(value <= type(uint240).max, "SafeCast: value doesn't fit in 240 bits");
        return uint240(value);
    }

    /**
     * @dev Returns the downcasted uint232 from uint256, reverting on
     * overflow (when the input is greater than largest uint232).
     *
     * Counterpart to Solidity's `uint232` operator.
     *
     * Requirements:
     *
     * - input must fit into 232 bits
     *
     * _Available since v4.7._
     */
    function toUint232(uint256 value) internal pure returns (uint232) {
        require(value <= type(uint232).max, "SafeCast: value doesn't fit in 232 bits");
        return uint232(value);
    }

    /**
     * @dev Returns the downcasted uint224 from uint256, reverting on
     * overflow (when the input is greater than largest uint224).
     *
     * Counterpart to Solidity's `uint224` operator.
     *
     * Requirements:
     *
     * - input must fit into 224 bits
     *
     * _Available since v4.2._
     */
    function toUint224(uint256 value) internal pure returns (uint224) {
        require(value <= type(uint224).max, "SafeCast: value doesn't fit in 224 bits");
        return uint224(value);
    }

    /**
     * @dev Returns the downcasted uint216 from uint256, reverting on
     * overflow (when the input is greater than largest uint216).
     *
     * Counterpart to Solidity's `uint216` operator.
     *
     * Requirements:
     *
     * - input must fit into 216 bits
     *
     * _Available since v4.7._
     */
    function toUint216(uint256 value) internal pure returns (uint216) {
        require(value <= type(uint216).max, "SafeCast: value doesn't fit in 216 bits");
        return uint216(value);
    }

    /**
     * @dev Returns the downcasted uint208 from uint256, reverting on
     * overflow (when the input is greater than largest uint208).
     *
     * Counterpart to Solidity's `uint208` operator.
     *
     * Requirements:
     *
     * - input must fit into 208 bits
     *
     * _Available since v4.7._
     */
    function toUint208(uint256 value) internal pure returns (uint208) {
        require(value <= type(uint208).max, "SafeCast: value doesn't fit in 208 bits");
        return uint208(value);
    }

    /**
     * @dev Returns the downcasted uint200 from uint256, reverting on
     * overflow (when the input is greater than largest uint200).
     *
     * Counterpart to Solidity's `uint200` operator.
     *
     * Requirements:
     *
     * - input must fit into 200 bits
     *
     * _Available since v4.7._
     */
    function toUint200(uint256 value) internal pure returns (uint200) {
        require(value <= type(uint200).max, "SafeCast: value doesn't fit in 200 bits");
        return uint200(value);
    }

    /**
     * @dev Returns the downcasted uint192 from uint256, reverting on
     * overflow (when the input is greater than largest uint192).
     *
     * Counterpart to Solidity's `uint192` operator.
     *
     * Requirements:
     *
     * - input must fit into 192 bits
     *
     * _Available since v4.7._
     */
    function toUint192(uint256 value) internal pure returns (uint192) {
        require(value <= type(uint192).max, "SafeCast: value doesn't fit in 192 bits");
        return uint192(value);
    }

    /**
     * @dev Returns the downcasted uint184 from uint256, reverting on
     * overflow (when the input is greater than largest uint184).
     *
     * Counterpart to Solidity's `uint184` operator.
     *
     * Requirements:
     *
     * - input must fit into 184 bits
     *
     * _Available since v4.7._
     */
    function toUint184(uint256 value) internal pure returns (uint184) {
        require(value <= type(uint184).max, "SafeCast: value doesn't fit in 184 bits");
        return uint184(value);
    }

    /**
     * @dev Returns the downcasted uint176 from uint256, reverting on
     * overflow (when the input is greater than largest uint176).
     *
     * Counterpart to Solidity's `uint176` operator.
     *
     * Requirements:
     *
     * - input must fit into 176 bits
     *
     * _Available since v4.7._
     */
    function toUint176(uint256 value) internal pure returns (uint176) {
        require(value <= type(uint176).max, "SafeCast: value doesn't fit in 176 bits");
        return uint176(value);
    }

    /**
     * @dev Returns the downcasted uint168 from uint256, reverting on
     * overflow (when the input is greater than largest uint168).
     *
     * Counterpart to Solidity's `uint168` operator.
     *
     * Requirements:
     *
     * - input must fit into 168 bits
     *
     * _Available since v4.7._
     */
    function toUint168(uint256 value) internal pure returns (uint168) {
        require(value <= type(uint168).max, "SafeCast: value doesn't fit in 168 bits");
        return uint168(value);
    }

    /**
     * @dev Returns the downcasted uint160 from uint256, reverting on
     * overflow (when the input is greater than largest uint160).
     *
     * Counterpart to Solidity's `uint160` operator.
     *
     * Requirements:
     *
     * - input must fit into 160 bits
     *
     * _Available since v4.7._
     */
    function toUint160(uint256 value) internal pure returns (uint160) {
        require(value <= type(uint160).max, "SafeCast: value doesn't fit in 160 bits");
        return uint160(value);
    }

    /**
     * @dev Returns the downcasted uint152 from uint256, reverting on
     * overflow (when the input is greater than largest uint152).
     *
     * Counterpart to Solidity's `uint152` operator.
     *
     * Requirements:
     *
     * - input must fit into 152 bits
     *
     * _Available since v4.7._
     */
    function toUint152(uint256 value) internal pure returns (uint152) {
        require(value <= type(uint152).max, "SafeCast: value doesn't fit in 152 bits");
        return uint152(value);
    }

    /**
     * @dev Returns the downcasted uint144 from uint256, reverting on
     * overflow (when the input is greater than largest uint144).
     *
     * Counterpart to Solidity's `uint144` operator.
     *
     * Requirements:
     *
     * - input must fit into 144 bits
     *
     * _Available since v4.7._
     */
    function toUint144(uint256 value) internal pure returns (uint144) {
        require(value <= type(uint144).max, "SafeCast: value doesn't fit in 144 bits");
        return uint144(value);
    }

    /**
     * @dev Returns the downcasted uint136 from uint256, reverting on
     * overflow (when the input is greater than largest uint136).
     *
     * Counterpart to Solidity's `uint136` operator.
     *
     * Requirements:
     *
     * - input must fit into 136 bits
     *
     * _Available since v4.7._
     */
    function toUint136(uint256 value) internal pure returns (uint136) {
        require(value <= type(uint136).max, "SafeCast: value doesn't fit in 136 bits");
        return uint136(value);
    }

    /**
     * @dev Returns the downcasted uint128 from uint256, reverting on
     * overflow (when the input is greater than largest uint128).
     *
     * Counterpart to Solidity's `uint128` operator.
     *
     * Requirements:
     *
     * - input must fit into 128 bits
     *
     * _Available since v2.5._
     */
    function toUint128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "SafeCast: value doesn't fit in 128 bits");
        return uint128(value);
    }

    /**
     * @dev Returns the downcasted uint120 from uint256, reverting on
     * overflow (when the input is greater than largest uint120).
     *
     * Counterpart to Solidity's `uint120` operator.
     *
     * Requirements:
     *
     * - input must fit into 120 bits
     *
     * _Available since v4.7._
     */
    function toUint120(uint256 value) internal pure returns (uint120) {
        require(value <= type(uint120).max, "SafeCast: value doesn't fit in 120 bits");
        return uint120(value);
    }

    /**
     * @dev Returns the downcasted uint112 from uint256, reverting on
     * overflow (when the input is greater than largest uint112).
     *
     * Counterpart to Solidity's `uint112` operator.
     *
     * Requirements:
     *
     * - input must fit into 112 bits
     *
     * _Available since v4.7._
     */
    function toUint112(uint256 value) internal pure returns (uint112) {
        require(value <= type(uint112).max, "SafeCast: value doesn't fit in 112 bits");
        return uint112(value);
    }

    /**
     * @dev Returns the downcasted uint104 from uint256, reverting on
     * overflow (when the input is greater than largest uint104).
     *
     * Counterpart to Solidity's `uint104` operator.
     *
     * Requirements:
     *
     * - input must fit into 104 bits
     *
     * _Available since v4.7._
     */
    function toUint104(uint256 value) internal pure returns (uint104) {
        require(value <= type(uint104).max, "SafeCast: value doesn't fit in 104 bits");
        return uint104(value);
    }

    /**
     * @dev Returns the downcasted uint96 from uint256, reverting on
     * overflow (when the input is greater than largest uint96).
     *
     * Counterpart to Solidity's `uint96` operator.
     *
     * Requirements:
     *
     * - input must fit into 96 bits
     *
     * _Available since v4.2._
     */
    function toUint96(uint256 value) internal pure returns (uint96) {
        require(value <= type(uint96).max, "SafeCast: value doesn't fit in 96 bits");
        return uint96(value);
    }

    /**
     * @dev Returns the downcasted uint88 from uint256, reverting on
     * overflow (when the input is greater than largest uint88).
     *
     * Counterpart to Solidity's `uint88` operator.
     *
     * Requirements:
     *
     * - input must fit into 88 bits
     *
     * _Available since v4.7._
     */
    function toUint88(uint256 value) internal pure returns (uint88) {
        require(value <= type(uint88).max, "SafeCast: value doesn't fit in 88 bits");
        return uint88(value);
    }

    /**
     * @dev Returns the downcasted uint80 from uint256, reverting on
     * overflow (when the input is greater than largest uint80).
     *
     * Counterpart to Solidity's `uint80` operator.
     *
     * Requirements:
     *
     * - input must fit into 80 bits
     *
     * _Available since v4.7._
     */
    function toUint80(uint256 value) internal pure returns (uint80) {
        require(value <= type(uint80).max, "SafeCast: value doesn't fit in 80 bits");
        return uint80(value);
    }

    /**
     * @dev Returns the downcasted uint72 from uint256, reverting on
     * overflow (when the input is greater than largest uint72).
     *
     * Counterpart to Solidity's `uint72` operator.
     *
     * Requirements:
     *
     * - input must fit into 72 bits
     *
     * _Available since v4.7._
     */
    function toUint72(uint256 value) internal pure returns (uint72) {
        require(value <= type(uint72).max, "SafeCast: value doesn't fit in 72 bits");
        return uint72(value);
    }

    /**
     * @dev Returns the downcasted uint64 from uint256, reverting on
     * overflow (when the input is greater than largest uint64).
     *
     * Counterpart to Solidity's `uint64` operator.
     *
     * Requirements:
     *
     * - input must fit into 64 bits
     *
     * _Available since v2.5._
     */
    function toUint64(uint256 value) internal pure returns (uint64) {
        require(value <= type(uint64).max, "SafeCast: value doesn't fit in 64 bits");
        return uint64(value);
    }

    /**
     * @dev Returns the downcasted uint56 from uint256, reverting on
     * overflow (when the input is greater than largest uint56).
     *
     * Counterpart to Solidity's `uint56` operator.
     *
     * Requirements:
     *
     * - input must fit into 56 bits
     *
     * _Available since v4.7._
     */
    function toUint56(uint256 value) internal pure returns (uint56) {
        require(value <= type(uint56).max, "SafeCast: value doesn't fit in 56 bits");
        return uint56(value);
    }

    /**
     * @dev Returns the downcasted uint48 from uint256, reverting on
     * overflow (when the input is greater than largest uint48).
     *
     * Counterpart to Solidity's `uint48` operator.
     *
     * Requirements:
     *
     * - input must fit into 48 bits
     *
     * _Available since v4.7._
     */
    function toUint48(uint256 value) internal pure returns (uint48) {
        require(value <= type(uint48).max, "SafeCast: value doesn't fit in 48 bits");
        return uint48(value);
    }

    /**
     * @dev Returns the downcasted uint40 from uint256, reverting on
     * overflow (when the input is greater than largest uint40).
     *
     * Counterpart to Solidity's `uint40` operator.
     *
     * Requirements:
     *
     * - input must fit into 40 bits
     *
     * _Available since v4.7._
     */
    function toUint40(uint256 value) internal pure returns (uint40) {
        require(value <= type(uint40).max, "SafeCast: value doesn't fit in 40 bits");
        return uint40(value);
    }

    /**
     * @dev Returns the downcasted uint32 from uint256, reverting on
     * overflow (when the input is greater than largest uint32).
     *
     * Counterpart to Solidity's `uint32` operator.
     *
     * Requirements:
     *
     * - input must fit into 32 bits
     *
     * _Available since v2.5._
     */
    function toUint32(uint256 value) internal pure returns (uint32) {
        require(value <= type(uint32).max, "SafeCast: value doesn't fit in 32 bits");
        return uint32(value);
    }

    /**
     * @dev Returns the downcasted uint24 from uint256, reverting on
     * overflow (when the input is greater than largest uint24).
     *
     * Counterpart to Solidity's `uint24` operator.
     *
     * Requirements:
     *
     * - input must fit into 24 bits
     *
     * _Available since v4.7._
     */
    function toUint24(uint256 value) internal pure returns (uint24) {
        require(value <= type(uint24).max, "SafeCast: value doesn't fit in 24 bits");
        return uint24(value);
    }

    /**
     * @dev Returns the downcasted uint16 from uint256, reverting on
     * overflow (when the input is greater than largest uint16).
     *
     * Counterpart to Solidity's `uint16` operator.
     *
     * Requirements:
     *
     * - input must fit into 16 bits
     *
     * _Available since v2.5._
     */
    function toUint16(uint256 value) internal pure returns (uint16) {
        require(value <= type(uint16).max, "SafeCast: value doesn't fit in 16 bits");
        return uint16(value);
    }

    /**
     * @dev Returns the downcasted uint8 from uint256, reverting on
     * overflow (when the input is greater than largest uint8).
     *
     * Counterpart to Solidity's `uint8` operator.
     *
     * Requirements:
     *
     * - input must fit into 8 bits
     *
     * _Available since v2.5._
     */
    function toUint8(uint256 value) internal pure returns (uint8) {
        require(value <= type(uint8).max, "SafeCast: value doesn't fit in 8 bits");
        return uint8(value);
    }

    /**
     * @dev Converts a signed int256 into an unsigned uint256.
     *
     * Requirements:
     *
     * - input must be greater than or equal to 0.
     *
     * _Available since v3.0._
     */
    function toUint256(int256 value) internal pure returns (uint256) {
        require(value >= 0, "SafeCast: value must be positive");
        return uint256(value);
    }

    /**
     * @dev Returns the downcasted int248 from int256, reverting on
     * overflow (when the input is less than smallest int248 or
     * greater than largest int248).
     *
     * Counterpart to Solidity's `int248` operator.
     *
     * Requirements:
     *
     * - input must fit into 248 bits
     *
     * _Available since v4.7._
     */
    function toInt248(int256 value) internal pure returns (int248 downcasted) {
        downcasted = int248(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 248 bits");
    }

    /**
     * @dev Returns the downcasted int240 from int256, reverting on
     * overflow (when the input is less than smallest int240 or
     * greater than largest int240).
     *
     * Counterpart to Solidity's `int240` operator.
     *
     * Requirements:
     *
     * - input must fit into 240 bits
     *
     * _Available since v4.7._
     */
    function toInt240(int256 value) internal pure returns (int240 downcasted) {
        downcasted = int240(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 240 bits");
    }

    /**
     * @dev Returns the downcasted int232 from int256, reverting on
     * overflow (when the input is less than smallest int232 or
     * greater than largest int232).
     *
     * Counterpart to Solidity's `int232` operator.
     *
     * Requirements:
     *
     * - input must fit into 232 bits
     *
     * _Available since v4.7._
     */
    function toInt232(int256 value) internal pure returns (int232 downcasted) {
        downcasted = int232(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 232 bits");
    }

    /**
     * @dev Returns the downcasted int224 from int256, reverting on
     * overflow (when the input is less than smallest int224 or
     * greater than largest int224).
     *
     * Counterpart to Solidity's `int224` operator.
     *
     * Requirements:
     *
     * - input must fit into 224 bits
     *
     * _Available since v4.7._
     */
    function toInt224(int256 value) internal pure returns (int224 downcasted) {
        downcasted = int224(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 224 bits");
    }

    /**
     * @dev Returns the downcasted int216 from int256, reverting on
     * overflow (when the input is less than smallest int216 or
     * greater than largest int216).
     *
     * Counterpart to Solidity's `int216` operator.
     *
     * Requirements:
     *
     * - input must fit into 216 bits
     *
     * _Available since v4.7._
     */
    function toInt216(int256 value) internal pure returns (int216 downcasted) {
        downcasted = int216(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 216 bits");
    }

    /**
     * @dev Returns the downcasted int208 from int256, reverting on
     * overflow (when the input is less than smallest int208 or
     * greater than largest int208).
     *
     * Counterpart to Solidity's `int208` operator.
     *
     * Requirements:
     *
     * - input must fit into 208 bits
     *
     * _Available since v4.7._
     */
    function toInt208(int256 value) internal pure returns (int208 downcasted) {
        downcasted = int208(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 208 bits");
    }

    /**
     * @dev Returns the downcasted int200 from int256, reverting on
     * overflow (when the input is less than smallest int200 or
     * greater than largest int200).
     *
     * Counterpart to Solidity's `int200` operator.
     *
     * Requirements:
     *
     * - input must fit into 200 bits
     *
     * _Available since v4.7._
     */
    function toInt200(int256 value) internal pure returns (int200 downcasted) {
        downcasted = int200(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 200 bits");
    }

    /**
     * @dev Returns the downcasted int192 from int256, reverting on
     * overflow (when the input is less than smallest int192 or
     * greater than largest int192).
     *
     * Counterpart to Solidity's `int192` operator.
     *
     * Requirements:
     *
     * - input must fit into 192 bits
     *
     * _Available since v4.7._
     */
    function toInt192(int256 value) internal pure returns (int192 downcasted) {
        downcasted = int192(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 192 bits");
    }

    /**
     * @dev Returns the downcasted int184 from int256, reverting on
     * overflow (when the input is less than smallest int184 or
     * greater than largest int184).
     *
     * Counterpart to Solidity's `int184` operator.
     *
     * Requirements:
     *
     * - input must fit into 184 bits
     *
     * _Available since v4.7._
     */
    function toInt184(int256 value) internal pure returns (int184 downcasted) {
        downcasted = int184(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 184 bits");
    }

    /**
     * @dev Returns the downcasted int176 from int256, reverting on
     * overflow (when the input is less than smallest int176 or
     * greater than largest int176).
     *
     * Counterpart to Solidity's `int176` operator.
     *
     * Requirements:
     *
     * - input must fit into 176 bits
     *
     * _Available since v4.7._
     */
    function toInt176(int256 value) internal pure returns (int176 downcasted) {
        downcasted = int176(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 176 bits");
    }

    /**
     * @dev Returns the downcasted int168 from int256, reverting on
     * overflow (when the input is less than smallest int168 or
     * greater than largest int168).
     *
     * Counterpart to Solidity's `int168` operator.
     *
     * Requirements:
     *
     * - input must fit into 168 bits
     *
     * _Available since v4.7._
     */
    function toInt168(int256 value) internal pure returns (int168 downcasted) {
        downcasted = int168(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 168 bits");
    }

    /**
     * @dev Returns the downcasted int160 from int256, reverting on
     * overflow (when the input is less than smallest int160 or
     * greater than largest int160).
     *
     * Counterpart to Solidity's `int160` operator.
     *
     * Requirements:
     *
     * - input must fit into 160 bits
     *
     * _Available since v4.7._
     */
    function toInt160(int256 value) internal pure returns (int160 downcasted) {
        downcasted = int160(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 160 bits");
    }

    /**
     * @dev Returns the downcasted int152 from int256, reverting on
     * overflow (when the input is less than smallest int152 or
     * greater than largest int152).
     *
     * Counterpart to Solidity's `int152` operator.
     *
     * Requirements:
     *
     * - input must fit into 152 bits
     *
     * _Available since v4.7._
     */
    function toInt152(int256 value) internal pure returns (int152 downcasted) {
        downcasted = int152(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 152 bits");
    }

    /**
     * @dev Returns the downcasted int144 from int256, reverting on
     * overflow (when the input is less than smallest int144 or
     * greater than largest int144).
     *
     * Counterpart to Solidity's `int144` operator.
     *
     * Requirements:
     *
     * - input must fit into 144 bits
     *
     * _Available since v4.7._
     */
    function toInt144(int256 value) internal pure returns (int144 downcasted) {
        downcasted = int144(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 144 bits");
    }

    /**
     * @dev Returns the downcasted int136 from int256, reverting on
     * overflow (when the input is less than smallest int136 or
     * greater than largest int136).
     *
     * Counterpart to Solidity's `int136` operator.
     *
     * Requirements:
     *
     * - input must fit into 136 bits
     *
     * _Available since v4.7._
     */
    function toInt136(int256 value) internal pure returns (int136 downcasted) {
        downcasted = int136(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 136 bits");
    }

    /**
     * @dev Returns the downcasted int128 from int256, reverting on
     * overflow (when the input is less than smallest int128 or
     * greater than largest int128).
     *
     * Counterpart to Solidity's `int128` operator.
     *
     * Requirements:
     *
     * - input must fit into 128 bits
     *
     * _Available since v3.1._
     */
    function toInt128(int256 value) internal pure returns (int128 downcasted) {
        downcasted = int128(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 128 bits");
    }

    /**
     * @dev Returns the downcasted int120 from int256, reverting on
     * overflow (when the input is less than smallest int120 or
     * greater than largest int120).
     *
     * Counterpart to Solidity's `int120` operator.
     *
     * Requirements:
     *
     * - input must fit into 120 bits
     *
     * _Available since v4.7._
     */
    function toInt120(int256 value) internal pure returns (int120 downcasted) {
        downcasted = int120(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 120 bits");
    }

    /**
     * @dev Returns the downcasted int112 from int256, reverting on
     * overflow (when the input is less than smallest int112 or
     * greater than largest int112).
     *
     * Counterpart to Solidity's `int112` operator.
     *
     * Requirements:
     *
     * - input must fit into 112 bits
     *
     * _Available since v4.7._
     */
    function toInt112(int256 value) internal pure returns (int112 downcasted) {
        downcasted = int112(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 112 bits");
    }

    /**
     * @dev Returns the downcasted int104 from int256, reverting on
     * overflow (when the input is less than smallest int104 or
     * greater than largest int104).
     *
     * Counterpart to Solidity's `int104` operator.
     *
     * Requirements:
     *
     * - input must fit into 104 bits
     *
     * _Available since v4.7._
     */
    function toInt104(int256 value) internal pure returns (int104 downcasted) {
        downcasted = int104(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 104 bits");
    }

    /**
     * @dev Returns the downcasted int96 from int256, reverting on
     * overflow (when the input is less than smallest int96 or
     * greater than largest int96).
     *
     * Counterpart to Solidity's `int96` operator.
     *
     * Requirements:
     *
     * - input must fit into 96 bits
     *
     * _Available since v4.7._
     */
    function toInt96(int256 value) internal pure returns (int96 downcasted) {
        downcasted = int96(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 96 bits");
    }

    /**
     * @dev Returns the downcasted int88 from int256, reverting on
     * overflow (when the input is less than smallest int88 or
     * greater than largest int88).
     *
     * Counterpart to Solidity's `int88` operator.
     *
     * Requirements:
     *
     * - input must fit into 88 bits
     *
     * _Available since v4.7._
     */
    function toInt88(int256 value) internal pure returns (int88 downcasted) {
        downcasted = int88(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 88 bits");
    }

    /**
     * @dev Returns the downcasted int80 from int256, reverting on
     * overflow (when the input is less than smallest int80 or
     * greater than largest int80).
     *
     * Counterpart to Solidity's `int80` operator.
     *
     * Requirements:
     *
     * - input must fit into 80 bits
     *
     * _Available since v4.7._
     */
    function toInt80(int256 value) internal pure returns (int80 downcasted) {
        downcasted = int80(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 80 bits");
    }

    /**
     * @dev Returns the downcasted int72 from int256, reverting on
     * overflow (when the input is less than smallest int72 or
     * greater than largest int72).
     *
     * Counterpart to Solidity's `int72` operator.
     *
     * Requirements:
     *
     * - input must fit into 72 bits
     *
     * _Available since v4.7._
     */
    function toInt72(int256 value) internal pure returns (int72 downcasted) {
        downcasted = int72(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 72 bits");
    }

    /**
     * @dev Returns the downcasted int64 from int256, reverting on
     * overflow (when the input is less than smallest int64 or
     * greater than largest int64).
     *
     * Counterpart to Solidity's `int64` operator.
     *
     * Requirements:
     *
     * - input must fit into 64 bits
     *
     * _Available since v3.1._
     */
    function toInt64(int256 value) internal pure returns (int64 downcasted) {
        downcasted = int64(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 64 bits");
    }

    /**
     * @dev Returns the downcasted int56 from int256, reverting on
     * overflow (when the input is less than smallest int56 or
     * greater than largest int56).
     *
     * Counterpart to Solidity's `int56` operator.
     *
     * Requirements:
     *
     * - input must fit into 56 bits
     *
     * _Available since v4.7._
     */
    function toInt56(int256 value) internal pure returns (int56 downcasted) {
        downcasted = int56(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 56 bits");
    }

    /**
     * @dev Returns the downcasted int48 from int256, reverting on
     * overflow (when the input is less than smallest int48 or
     * greater than largest int48).
     *
     * Counterpart to Solidity's `int48` operator.
     *
     * Requirements:
     *
     * - input must fit into 48 bits
     *
     * _Available since v4.7._
     */
    function toInt48(int256 value) internal pure returns (int48 downcasted) {
        downcasted = int48(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 48 bits");
    }

    /**
     * @dev Returns the downcasted int40 from int256, reverting on
     * overflow (when the input is less than smallest int40 or
     * greater than largest int40).
     *
     * Counterpart to Solidity's `int40` operator.
     *
     * Requirements:
     *
     * - input must fit into 40 bits
     *
     * _Available since v4.7._
     */
    function toInt40(int256 value) internal pure returns (int40 downcasted) {
        downcasted = int40(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 40 bits");
    }

    /**
     * @dev Returns the downcasted int32 from int256, reverting on
     * overflow (when the input is less than smallest int32 or
     * greater than largest int32).
     *
     * Counterpart to Solidity's `int32` operator.
     *
     * Requirements:
     *
     * - input must fit into 32 bits
     *
     * _Available since v3.1._
     */
    function toInt32(int256 value) internal pure returns (int32 downcasted) {
        downcasted = int32(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 32 bits");
    }

    /**
     * @dev Returns the downcasted int24 from int256, reverting on
     * overflow (when the input is less than smallest int24 or
     * greater than largest int24).
     *
     * Counterpart to Solidity's `int24` operator.
     *
     * Requirements:
     *
     * - input must fit into 24 bits
     *
     * _Available since v4.7._
     */
    function toInt24(int256 value) internal pure returns (int24 downcasted) {
        downcasted = int24(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 24 bits");
    }

    /**
     * @dev Returns the downcasted int16 from int256, reverting on
     * overflow (when the input is less than smallest int16 or
     * greater than largest int16).
     *
     * Counterpart to Solidity's `int16` operator.
     *
     * Requirements:
     *
     * - input must fit into 16 bits
     *
     * _Available since v3.1._
     */
    function toInt16(int256 value) internal pure returns (int16 downcasted) {
        downcasted = int16(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 16 bits");
    }

    /**
     * @dev Returns the downcasted int8 from int256, reverting on
     * overflow (when the input is less than smallest int8 or
     * greater than largest int8).
     *
     * Counterpart to Solidity's `int8` operator.
     *
     * Requirements:
     *
     * - input must fit into 8 bits
     *
     * _Available since v3.1._
     */
    function toInt8(int256 value) internal pure returns (int8 downcasted) {
        downcasted = int8(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 8 bits");
    }

    /**
     * @dev Converts an unsigned uint256 into a signed int256.
     *
     * Requirements:
     *
     * - input must be less than or equal to maxInt256.
     *
     * _Available since v3.0._
     */
    function toInt256(uint256 value) internal pure returns (int256) {
        // Note: Unsafe cast below is okay because `type(int256).max` is guaranteed to be positive
        require(value <= uint256(type(int256).max), "SafeCast: value doesn't fit in an int256");
        return int256(value);
    }
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/proxy/beacon/IBeacon.sol

// OpenZeppelin Contracts v4.4.1 (proxy/beacon/IBeacon.sol)

/**
 * @dev This is the interface that {BeaconProxy} expects of its beacon.
 */
interface IBeacon {
    /**
     * @dev Must return an address that can be used as a delegate call target.
     *
     * {BeaconProxy} will check that this address is a contract.
     */
    function implementation() external view returns (address);
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
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

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

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
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/utils/math/Math.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/math/Math.sol)

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
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

// lib/eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol

interface IAVSRegistrar {
    /**
     * @notice Called by the AllocationManager when an operator wants to register
     * for one or more operator sets. This method should revert if registration
     * is unsuccessful.
     * @param operator the registering operator
     * @param avs the AVS the operator is registering for. This should be the same as IAVSRegistrar.avs()
     * @param operatorSetIds the list of operator set ids being registered for
     * @param data arbitrary data the operator can provide as part of registration
     */
    function registerOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds,
        bytes calldata data
    ) external;

    /**
     * @notice Called by the AllocationManager when an operator is deregistered from
     * one or more operator sets. If this method reverts, it is ignored.
     * @param operator the deregistering operator
     * @param avs the AVS the operator is deregistering from. This should be the same as IAVSRegistrar.avs()
     * @param operatorSetIds the list of operator set ids being deregistered from
     */
    function deregisterOperator(address operator, address avs, uint32[] calldata operatorSetIds) external;

    /**
     * @notice Returns true if the AVS is supported by the registrar
     * @param avs the AVS to check
     * @return true if the AVS is supported, false otherwise
     */
    function supportsAVS(
        address avs
    ) external view returns (bool);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol
// ┏━━━┓━┏┓━┏┓━━┏━━━┓━━┏━━━┓━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━┏┓━━━━━┏━━━┓━━━━━━━━━┏┓━━━━━━━━━━━━━━┏┓━
// ┃┏━━┛┏┛┗┓┃┃━━┃┏━┓┃━━┃┏━┓┃━━━━┗┓┏┓┃━━━━━━━━━━━━━━━━━━┏┛┗┓━━━━┃┏━┓┃━━━━━━━━┏┛┗┓━━━━━━━━━━━━┏┛┗┓
// ┃┗━━┓┗┓┏┛┃┗━┓┗┛┏┛┃━━┃┃━┃┃━━━━━┃┃┃┃┏━━┓┏━━┓┏━━┓┏━━┓┏┓┗┓┏┛━━━━┃┃━┗┛┏━━┓┏━┓━┗┓┏┛┏━┓┏━━┓━┏━━┓┗┓┏┛
// ┃┏━━┛━┃┃━┃┏┓┃┏━┛┏┛━━┃┃━┃┃━━━━━┃┃┃┃┃┏┓┃┃┏┓┃┃┏┓┃┃━━┫┣┫━┃┃━━━━━┃┃━┏┓┃┏┓┃┃┏┓┓━┃┃━┃┏┛┗━┓┃━┃┏━┛━┃┃━
// ┃┗━━┓━┃┗┓┃┃┃┃┃┃┗━┓┏┓┃┗━┛┃━━━━┏┛┗┛┃┃┃━┫┃┗┛┃┃┗┛┃┣━━┃┃┃━┃┗┓━━━━┃┗━┛┃┃┗┛┃┃┃┃┃━┃┗┓┃┃━┃┗┛┗┓┃┗━┓━┃┗┓
// ┗━━━┛━┗━┛┗┛┗┛┗━━━┛┗┛┗━━━┛━━━━┗━━━┛┗━━┛┃┏━┛┗━━┛┗━━┛┗┛━┗━┛━━━━┗━━━┛┗━━┛┗┛┗┛━┗━┛┗┛━┗━━━┛┗━━┛━┗━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┗┛━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// This interface is designed to be compatible with the Vyper version.
/// @notice This is the Ethereum 2.0 deposit contract interface.
/// For more information see the Phase 0 specification under https://github.com/ethereum/eth2.0-specs
interface IETHPOSDeposit {
    /// @notice A processed deposit event.
    event DepositEvent(bytes pubkey, bytes withdrawal_credentials, bytes amount, bytes signature, bytes index);

    /// @notice Submit a Phase 0 DepositData object.
    /// @param pubkey A BLS12-381 public key.
    /// @param withdrawal_credentials Commitment to a public key for withdrawals.
    /// @param signature A BLS12-381 signature.
    /// @param deposit_data_root The SHA-256 hash of the SSZ-encoded DepositData object.
    /// Used as a protection against malformed input.
    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable;

    /// @notice Query the current deposit root hash.
    /// @return The deposit root hash.
    function get_deposit_root() external view returns (bytes32);

    /// @notice Query the current deposit count.
    /// @return The deposit count encoded as a little endian 64-bit number.
    function get_deposit_count() external view returns (bytes memory);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IPauserRegistry.sol

/**
 * @title Interface for the `PauserRegistry` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 */
interface IPauserRegistry {
    error OnlyUnpauser();
    error InputAddressZero();

    event PauserStatusChanged(address pauser, bool canPause);

    event UnpauserChanged(address previousUnpauser, address newUnpauser);

    /// @notice Mapping of addresses to whether they hold the pauser role.
    function isPauser(
        address pauser
    ) external view returns (bool);

    /// @notice Unique address that holds the unpauser role. Capable of changing *both* the pauser and unpauser addresses.
    function unpauser() external view returns (address);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/ISemVerMixin.sol

/// @title ISemVerMixin
/// @notice A mixin interface that provides semantic versioning functionality.
/// @dev Follows SemVer 2.0.0 specification (https://semver.org/)
interface ISemVerMixin {
    /// @notice Returns the semantic version string of the contract.
    /// @return The version string in SemVer format (e.g., "v1.1.1")
    function version() external view returns (string memory);
}

// lib/eigenlayer-contracts/src/contracts/libraries/Endian.sol

library Endian {
    /**
     * @notice Converts a little endian-formatted uint64 to a big endian-formatted uint64
     * @param lenum little endian-formatted uint64 input, provided as 'bytes32' type
     * @return n The big endian-formatted uint64
     * @dev Note that the input is formatted as a 'bytes32' type (i.e. 256 bits), but it is immediately truncated to a uint64 (i.e. 64 bits)
     * through a right-shift/shr operation.
     */
    function fromLittleEndianUint64(
        bytes32 lenum
    ) internal pure returns (uint64 n) {
        // the number needs to be stored in little-endian encoding (ie in bytes 0-8)
        n = uint64(uint256(lenum >> 192));
        // forgefmt: disable-next-item
        return (n >> 56) | 
            ((0x00FF000000000000 & n) >> 40) | 
            ((0x0000FF0000000000 & n) >> 24) | 
            ((0x000000FF00000000 & n) >> 8)  | 
            ((0x00000000FF000000 & n) << 8)  | 
            ((0x0000000000FF0000 & n) << 24) | 
            ((0x000000000000FF00 & n) << 40) | 
            ((0x00000000000000FF & n) << 56);
    }
}

// lib/eigenlayer-contracts/src/contracts/libraries/Merkle.sol

// Adapted from OpenZeppelin Contracts (last updated v4.8.0) (utils/cryptography/MerkleProof.sol)

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
library Merkle {
    error InvalidProofLength();

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. The tree is built assuming `leaf` is
     * the 0 indexed `index`'th leaf from the bottom left of the tree.
     *
     * Note this is for a Merkle tree using the keccak/sha3 hash function
     */
    function verifyInclusionKeccak(
        bytes memory proof,
        bytes32 root,
        bytes32 leaf,
        uint256 index
    ) internal pure returns (bool) {
        return processInclusionProofKeccak(proof, leaf, index) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. The tree is built assuming `leaf` is
     * the 0 indexed `index`'th leaf from the bottom left of the tree.
     * @dev If the proof length is 0 then the leaf hash is returned.
     *
     * _Available since v4.4._
     *
     * Note this is for a Merkle tree using the keccak/sha3 hash function
     */
    function processInclusionProofKeccak(
        bytes memory proof,
        bytes32 leaf,
        uint256 index
    ) internal pure returns (bytes32) {
        require(proof.length % 32 == 0, InvalidProofLength());
        bytes32 computedHash = leaf;
        for (uint256 i = 32; i <= proof.length; i += 32) {
            if (index % 2 == 0) {
                // if ith bit of index is 0, then computedHash is a left sibling
                assembly {
                    mstore(0x00, computedHash)
                    mstore(0x20, mload(add(proof, i)))
                    computedHash := keccak256(0x00, 0x40)
                    index := div(index, 2)
                }
            } else {
                // if ith bit of index is 1, then computedHash is a right sibling
                assembly {
                    mstore(0x00, mload(add(proof, i)))
                    mstore(0x20, computedHash)
                    computedHash := keccak256(0x00, 0x40)
                    index := div(index, 2)
                }
            }
        }
        return computedHash;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. The tree is built assuming `leaf` is
     * the 0 indexed `index`'th leaf from the bottom left of the tree.
     *
     * Note this is for a Merkle tree using the sha256 hash function
     */
    function verifyInclusionSha256(
        bytes memory proof,
        bytes32 root,
        bytes32 leaf,
        uint256 index
    ) internal view returns (bool) {
        return processInclusionProofSha256(proof, leaf, index) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. The tree is built assuming `leaf` is
     * the 0 indexed `index`'th leaf from the bottom left of the tree.
     *
     * _Available since v4.4._
     *
     * Note this is for a Merkle tree using the sha256 hash function
     */
    function processInclusionProofSha256(
        bytes memory proof,
        bytes32 leaf,
        uint256 index
    ) internal view returns (bytes32) {
        require(proof.length != 0 && proof.length % 32 == 0, InvalidProofLength());
        bytes32[1] memory computedHash = [leaf];
        for (uint256 i = 32; i <= proof.length; i += 32) {
            if (index % 2 == 0) {
                // if ith bit of index is 0, then computedHash is a left sibling
                assembly {
                    mstore(0x00, mload(computedHash))
                    mstore(0x20, mload(add(proof, i)))
                    if iszero(staticcall(sub(gas(), 2000), 2, 0x00, 0x40, computedHash, 0x20)) { revert(0, 0) }
                    index := div(index, 2)
                }
            } else {
                // if ith bit of index is 1, then computedHash is a right sibling
                assembly {
                    mstore(0x00, mload(add(proof, i)))
                    mstore(0x20, mload(computedHash))
                    if iszero(staticcall(sub(gas(), 2000), 2, 0x00, 0x40, computedHash, 0x20)) { revert(0, 0) }
                    index := div(index, 2)
                }
            }
        }
        return computedHash[0];
    }

    /**
     * @notice this function returns the merkle root of a tree created from a set of leaves using sha256 as its hash function
     *  @param leaves the leaves of the merkle tree
     *  @return The computed Merkle root of the tree.
     *  @dev A pre-condition to this function is that leaves.length is a power of two.  If not, the function will merkleize the inputs incorrectly.
     */
    function merkleizeSha256(
        bytes32[] memory leaves
    ) internal pure returns (bytes32) {
        //there are half as many nodes in the layer above the leaves
        uint256 numNodesInLayer = leaves.length / 2;
        //create a layer to store the internal nodes
        bytes32[] memory layer = new bytes32[](numNodesInLayer);
        //fill the layer with the pairwise hashes of the leaves
        for (uint256 i = 0; i < numNodesInLayer; i++) {
            layer[i] = sha256(abi.encodePacked(leaves[2 * i], leaves[2 * i + 1]));
        }
        //the next layer above has half as many nodes
        numNodesInLayer /= 2;
        //while we haven't computed the root
        while (numNodesInLayer != 0) {
            //overwrite the first numNodesInLayer nodes in layer with the pairwise hashes of their children
            for (uint256 i = 0; i < numNodesInLayer; i++) {
                layer[i] = sha256(abi.encodePacked(layer[2 * i], layer[2 * i + 1]));
            }
            //the next layer above has half as many nodes
            numNodesInLayer /= 2;
        }
        //the first node in the layer is the root
        return layer[0];
    }
}

// lib/eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol

using OperatorSetLib for OperatorSet global;

/**
 * @notice An operator set identified by the AVS address and an identifier
 * @param avs The address of the AVS this operator set belongs to
 * @param id The unique identifier for the operator set
 */
struct OperatorSet {
    address avs;
    uint32 id;
}

library OperatorSetLib {
    function key(
        OperatorSet memory os
    ) internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(os.avs, uint96(os.id)));
    }

    function decode(
        bytes32 _key
    ) internal pure returns (OperatorSet memory) {
        /// forgefmt: disable-next-item
        return OperatorSet({
            avs: address(uint160(uint256(_key) >> 96)),
            id: uint32(uint256(_key) & type(uint96).max)
        });
    }
}

// src/interfaces/IRewardsRegistry.sol

/**
 * @title Interface for errors in the RewardsRegistry contract
 */
interface IRewardsRegistryErrors {
    /// @notice Thrown when a function is called by an address that is not the AVS.
    error OnlyAVS();
    /// @notice Thrown when a function is called by an address that is not the RewardsAgent.
    error OnlyRewardsAgent();
    /// @notice Thrown when a provided merkle proof is invalid.
    error InvalidMerkleProof();
    /// @notice Thrown when rewards transfer fails.
    error RewardsTransferFailed();
    /// @notice Thrown when the rewards merkle root is not set.
    error RewardsMerkleRootNotSet();
    /// @notice Thrown when trying to access a merkle root index that doesn't exist.
    error InvalidMerkleRootIndex();
    /// @notice Thrown when trying to claim rewards for a root index that has already been claimed.
    error RewardsAlreadyClaimedForIndex();
    /// @notice Thrown when the arrays provided to the batch claim function have mismatched lengths.
    error ArrayLengthMismatch();
}

/**
 * @title Interface for events in the RewardsRegistry contract
 */
interface IRewardsRegistryEvents {
    /**
     * @notice Emitted when a new merkle root is set
     * @param oldRoot The previous merkle root
     * @param newRoot The new merkle root
     * @param newRootIndex The index of the new root in the history
     */
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 newRootIndex);

    /**
     * @notice Emitted when rewards are claimed for a specific root index
     * @param operatorAddress Address of the operator that received the rewards
     * @param rootIndex Index of the merkle root that the operator claimed rewards from
     * @param points Points earned by the operator
     * @param rewardsAmount Amount of rewards transferred
     */
    event RewardsClaimedForIndex(
        address indexed operatorAddress,
        uint256 indexed rootIndex,
        uint256 points,
        uint256 rewardsAmount
    );

    /**
     * @notice Emitted when rewards are claimed for multiple root indices in a batch
     * @param operatorAddress Address of the operator that received the rewards
     * @param rootIndices Array of merkle root indices that the operator claimed rewards from
     * @param points Array of points earned by the operator for each root index
     * @param totalRewardsAmount Total amount of rewards transferred to the operator
     */
    event RewardsBatchClaimedForIndices(
        address indexed operatorAddress,
        uint256[] rootIndices,
        uint256[] points,
        uint256 totalRewardsAmount
    );
}

/**
 * @title Interface for the RewardsRegistry contract
 * @notice Contract for managing operator rewards through a Merkle root verification process
 */
interface IRewardsRegistry is IRewardsRegistryErrors, IRewardsRegistryEvents {
    /**
     * @notice Update the rewards merkle root
     * @param newMerkleRoot New merkle root to be set
     * @dev Only callable by the rewards agent
     */
    function updateRewardsMerkleRoot(
        bytes32 newMerkleRoot
    ) external;

    /**
     * @notice Claim rewards for an operator from a specific merkle root index
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from the latest merkle root
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimLatestRewards(
        address operatorAddress,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from multiple merkle root indices
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndices Array of merkle root indices to claim from
     * @param operatorPoints Array of points earned by the operator for each root
     * @param proofs Array of merkle proofs to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewardsBatch(
        address operatorAddress,
        uint256[] calldata rootIndices,
        uint256[] calldata operatorPoints,
        bytes32[][] calldata proofs
    ) external;

    /**
     * @notice Sets the rewards agent address in the RewardsRegistry contract
     * @param rewardsAgent New rewards agent address
     * @dev Only callable by the AVS (Service Manager)
     */
    function setRewardsAgent(
        address rewardsAgent
    ) external;

    /**
     * @notice Get the merkle root at a specific index
     * @param index Index of the merkle root to retrieve
     * @return The merkle root at the specified index
     */
    function getMerkleRootByIndex(
        uint256 index
    ) external view returns (bytes32);

    /**
     * @notice Get the latest merkle root index
     * @return The index of the latest merkle root (returns 0 if no roots exist)
     */
    function getLatestMerkleRootIndex() external view returns (uint256);

    /**
     * @notice Get the latest merkle root
     * @return The latest merkle root (returns bytes32(0) if no roots exist)
     */
    function getLatestMerkleRoot() external view returns (bytes32);

    /**
     * @notice Get the total number of merkle roots in history
     * @return The total count of merkle roots
     */
    function getMerkleRootHistoryLength() external view returns (uint256);

    /**
     * @notice Check if an operator has claimed rewards for a specific root index
     * @param operatorAddress Address of the operator
     * @param rootIndex Index of the merkle root to check
     * @return True if the operator has claimed rewards for this root index, false otherwise
     */
    function hasClaimedByIndex(
        address operatorAddress,
        uint256 rootIndex
    ) external view returns (bool);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IPausable.sol

/**
 * @title Adds pausability to a contract, with pausing & unpausing controlled by the `pauser` and `unpauser` of a PauserRegistry contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice Contracts that inherit from this contract may define their own `pause` and `unpause` (and/or related) functions.
 * These functions should be permissioned as "onlyPauser" which defers to a `PauserRegistry` for determining access control.
 * @dev Pausability is implemented using a uint256, which allows up to 256 different single bit-flags; each bit can potentially pause different functionality.
 * Inspiration for this was taken from the NearBridge design here https://etherscan.io/address/0x3FEFc5A4B1c02f21cBc8D3613643ba0635b9a873#code.
 * For the `pause` and `unpause` functions we've implemented, if you pause, you can only flip (any number of) switches to on/1 (aka "paused"), and if you unpause,
 * you can only flip (any number of) switches to off/0 (aka "paused").
 * If you want a pauseXYZ function that just flips a single bit / "pausing flag", it will:
 * 1) 'bit-wise and' (aka `&`) a flag with the current paused state (as a uint256)
 * 2) update the paused state to this new value
 * @dev We note as well that we have chosen to identify flags by their *bit index* as opposed to their numerical value, so, e.g. defining `DEPOSITS_PAUSED = 3`
 * indicates specifically that if the *third bit* of `_paused` is flipped -- i.e. it is a '1' -- then deposits should be paused
 */
interface IPausable {
    /// @dev Thrown when caller is not pauser.
    error OnlyPauser();
    /// @dev Thrown when caller is not unpauser.
    error OnlyUnpauser();
    /// @dev Thrown when currently paused.
    error CurrentlyPaused();
    /// @dev Thrown when invalid `newPausedStatus` is provided.
    error InvalidNewPausedStatus();
    /// @dev Thrown when a null address input is provided.
    error InputAddressZero();

    /// @notice Emitted when the pause is triggered by `account`, and changed to `newPausedStatus`.
    event Paused(address indexed account, uint256 newPausedStatus);

    /// @notice Emitted when the pause is lifted by `account`, and changed to `newPausedStatus`.
    event Unpaused(address indexed account, uint256 newPausedStatus);

    /// @notice Address of the `PauserRegistry` contract that this contract defers to for determining access control (for pausing).
    function pauserRegistry() external view returns (IPauserRegistry);

    /**
     * @notice This function is used to pause an EigenLayer contract's functionality.
     * It is permissioned to the `pauser` address, which is expected to be a low threshold multisig.
     * @param newPausedStatus represents the new value for `_paused` to take, which means it may flip several bits at once.
     * @dev This function can only pause functionality, and thus cannot 'unflip' any bit in `_paused` from 1 to 0.
     */
    function pause(
        uint256 newPausedStatus
    ) external;

    /**
     * @notice Alias for `pause(type(uint256).max)`.
     */
    function pauseAll() external;

    /**
     * @notice This function is used to unpause an EigenLayer contract's functionality.
     * It is permissioned to the `unpauser` address, which is expected to be a high threshold multisig or governance contract.
     * @param newPausedStatus represents the new value for `_paused` to take, which means it may flip several bits at once.
     * @dev This function can only unpause functionality, and thus cannot 'flip' any bit in `_paused` from 0 to 1.
     */
    function unpause(
        uint256 newPausedStatus
    ) external;

    /// @notice Returns the current paused status as a uint256.
    function paused() external view returns (uint256);

    /// @notice Returns 'true' if the `indexed`th bit of `_paused` is 1, and 'false' otherwise
    function paused(
        uint8 index
    ) external view returns (bool);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol

interface IPermissionControllerErrors {
    /// @notice Thrown when a non-admin caller attempts to perform an admin-only action.
    error NotAdmin();
    /// @notice Thrown when attempting to remove an admin that does not exist.
    error AdminNotSet();
    /// @notice Thrown when attempting to set an appointee for a function that already has one.
    error AppointeeAlreadySet();
    /// @notice Thrown when attempting to interact with a non-existent appointee.
    error AppointeeNotSet();
    /// @notice Thrown when attempting to remove the last remaining admin.
    error CannotHaveZeroAdmins();
    /// @notice Thrown when attempting to set an admin that is already registered.
    error AdminAlreadySet();
    /// @notice Thrown when attempting to interact with an admin that is not in pending status.
    error AdminNotPending();
    /// @notice Thrown when attempting to add an admin that is already pending.
    error AdminAlreadyPending();
}

interface IPermissionControllerEvents {
    /// @notice Emitted when an appointee is set for an account to handle specific function calls.
    event AppointeeSet(address indexed account, address indexed appointee, address target, bytes4 selector);

    /// @notice Emitted when an appointee's permission to handle function calls for an account is revoked.
    event AppointeeRemoved(address indexed account, address indexed appointee, address target, bytes4 selector);

    /// @notice Emitted when an address is set as a pending admin for an account, requiring acceptance.
    event PendingAdminAdded(address indexed account, address admin);

    /// @notice Emitted when a pending admin status is removed for an account before acceptance.
    event PendingAdminRemoved(address indexed account, address admin);

    /// @notice Emitted when an address accepts and becomes an active admin for an account.
    event AdminSet(address indexed account, address admin);

    /// @notice Emitted when an admin's permissions are removed from an account.
    event AdminRemoved(address indexed account, address admin);
}

interface IPermissionController is IPermissionControllerErrors, IPermissionControllerEvents, ISemVerMixin {
    /**
     * @notice Sets a pending admin for an account.
     * @param account The account to set the pending admin for.
     * @param admin The address to set as pending admin.
     * @dev The pending admin must accept the role before becoming an active admin.
     * @dev Multiple admins can be set for a single account.
     */
    function addPendingAdmin(address account, address admin) external;

    /**
     * @notice Removes a pending admin from an account before they have accepted the role.
     * @param account The account to remove the pending admin from.
     * @param admin The pending admin address to remove.
     * @dev Only an existing admin of the account can remove a pending admin.
     */
    function removePendingAdmin(address account, address admin) external;

    /**
     * @notice Allows a pending admin to accept their admin role for an account.
     * @param account The account to accept the admin role for.
     * @dev Only addresses that were previously set as pending admins can accept the role.
     */
    function acceptAdmin(
        address account
    ) external;

    /**
     * @notice Removes an active admin from an account.
     * @param account The account to remove the admin from.
     * @param admin The admin address to remove.
     * @dev Only an existing admin of the account can remove another admin.
     * @dev Will revert if removing this admin would leave the account with zero admins.
     */
    function removeAdmin(address account, address admin) external;

    /**
     * @notice Sets an appointee who can call specific functions on behalf of an account.
     * @param account The account to set the appointee for.
     * @param appointee The address to be given permission.
     * @param target The contract address the appointee can interact with.
     * @param selector The function selector the appointee can call.
     * @dev Only an admin of the account can set appointees.
     */
    function setAppointee(address account, address appointee, address target, bytes4 selector) external;

    /**
     * @notice Removes an appointee's permission to call a specific function.
     * @param account The account to remove the appointee from.
     * @param appointee The appointee address to remove.
     * @param target The contract address to remove permissions for.
     * @param selector The function selector to remove permissions for.
     * @dev Only an admin of the account can remove appointees.
     */
    function removeAppointee(address account, address appointee, address target, bytes4 selector) external;

    /**
     * @notice Checks if a given address is an admin of an account.
     * @param account The account to check admin status for.
     * @param caller The address to check.
     * @dev If the account has no admins, returns true only if the caller is the account itself.
     * @return Returns true if the caller is an admin, false otherwise.
     */
    function isAdmin(address account, address caller) external view returns (bool);

    /**
     * @notice Checks if an address is currently a pending admin for an account.
     * @param account The account to check pending admin status for.
     * @param pendingAdmin The address to check.
     * @return Returns true if the address is a pending admin, false otherwise.
     */
    function isPendingAdmin(address account, address pendingAdmin) external view returns (bool);

    /**
     * @notice Retrieves all active admins for an account.
     * @param account The account to get the admins for.
     * @dev If the account has no admins, returns an array containing only the account address.
     * @return An array of admin addresses.
     */
    function getAdmins(
        address account
    ) external view returns (address[] memory);

    /**
     * @notice Retrieves all pending admins for an account.
     * @param account The account to get the pending admins for.
     * @return An array of pending admin addresses.
     */
    function getPendingAdmins(
        address account
    ) external view returns (address[] memory);

    /**
     * @notice Checks if a caller has permission to call a specific function.
     * @param account The account to check permissions for.
     * @param caller The address attempting to make the call.
     * @param target The contract address being called.
     * @param selector The function selector being called.
     * @dev Returns true if the caller is either an admin or an appointed caller.
     * @dev Be mindful that upgrades to the contract may invalidate the appointee's permissions.
     * This is only possible if a function's selector changes (e.g. if a function's parameters are modified).
     * @return Returns true if the caller has permission, false otherwise.
     */
    function canCall(address account, address caller, address target, bytes4 selector) external returns (bool);

    /**
     * @notice Retrieves all permissions granted to an appointee for a given account.
     * @param account The account to check appointee permissions for.
     * @param appointee The appointee address to check.
     * @return Two arrays: target contract addresses and their corresponding function selectors.
     */
    function getAppointeePermissions(
        address account,
        address appointee
    ) external returns (address[] memory, bytes4[] memory);

    /**
     * @notice Retrieves all appointees that can call a specific function for an account.
     * @param account The account to get appointees for.
     * @param target The contract address to check.
     * @param selector The function selector to check.
     * @dev Does not include admins in the returned list, even though they have calling permission.
     * @return An array of appointee addresses.
     */
    function getAppointees(address account, address target, bytes4 selector) external returns (address[] memory);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/ISignatureUtilsMixin.sol

interface ISignatureUtilsMixinErrors {
    /// @notice Thrown when a signature is invalid.
    error InvalidSignature();
    /// @notice Thrown when a signature has expired.
    error SignatureExpired();
}

interface ISignatureUtilsMixinTypes {
    /// @notice Struct that bundles together a signature and an expiration time for the signature.
    /// @dev Used primarily for stack management.
    struct SignatureWithExpiry {
        // the signature itself, formatted as a single bytes object
        bytes signature;
        // the expiration timestamp (UTC) of the signature
        uint256 expiry;
    }

    /// @notice Struct that bundles together a signature, a salt for uniqueness, and an expiration time for the signature.
    /// @dev Used primarily for stack management.
    struct SignatureWithSaltAndExpiry {
        // the signature itself, formatted as a single bytes object
        bytes signature;
        // the salt used to generate the signature
        bytes32 salt;
        // the expiration timestamp (UTC) of the signature
        uint256 expiry;
    }
}

/**
 * @title The interface for common signature utilities.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 */
interface ISignatureUtilsMixin is ISignatureUtilsMixinErrors, ISignatureUtilsMixinTypes, ISemVerMixin {
    /// @notice Computes the EIP-712 domain separator used for signature validation.
    /// @dev The domain separator is computed according to EIP-712 specification, using:
    ///      - The hardcoded name "EigenLayer"
    ///      - The contract's version string
    ///      - The current chain ID
    ///      - This contract's address
    /// @return The 32-byte domain separator hash used in EIP-712 structured data signing.
    /// @dev See https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator.
    function domainSeparator() external view returns (bytes32);
}

// lib/eigenlayer-contracts/src/contracts/libraries/BeaconChainProofs.sol

//Utility library for parsing and PHASE0 beacon chain block headers
//SSZ Spec: https://github.com/ethereum/consensus-specs/blob/dev/ssz/simple-serialize.md#merkleization
//BeaconBlockHeader Spec: https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#beaconblockheader
//BeaconState Spec: https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#beaconstate
library BeaconChainProofs {
    /// @dev Thrown when a proof is invalid.
    error InvalidProof();
    /// @dev Thrown when a proof with an invalid length is provided.
    error InvalidProofLength();
    /// @dev Thrown when a validator fields length is invalid.
    error InvalidValidatorFieldsLength();

    /// @notice Heights of various merkle trees in the beacon chain
    /// - beaconBlockRoot
    /// |                                             HEIGHT: BEACON_BLOCK_HEADER_TREE_HEIGHT
    /// -- beaconStateRoot
    /// |                                             HEIGHT: BEACON_STATE_TREE_HEIGHT
    /// validatorContainerRoot, balanceContainerRoot
    /// |                       |                     HEIGHT: BALANCE_TREE_HEIGHT
    /// |                       individual balances
    /// |                                             HEIGHT: VALIDATOR_TREE_HEIGHT
    /// individual validators
    uint256 internal constant BEACON_BLOCK_HEADER_TREE_HEIGHT = 3;
    uint256 internal constant DENEB_BEACON_STATE_TREE_HEIGHT = 5;
    uint256 internal constant PECTRA_BEACON_STATE_TREE_HEIGHT = 6;
    uint256 internal constant BALANCE_TREE_HEIGHT = 38;
    uint256 internal constant VALIDATOR_TREE_HEIGHT = 40;

    /// @notice Index of the beaconStateRoot in the `BeaconBlockHeader` container
    ///
    /// BeaconBlockHeader = [..., state_root, ...]
    ///                      0...      3
    ///
    /// (See https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#beaconblockheader)
    uint256 internal constant STATE_ROOT_INDEX = 3;

    /// @notice Indices for fields in the `BeaconState` container
    ///
    /// BeaconState = [..., validators, balances, ...]
    ///                0...     11         12
    ///
    /// (See https://github.com/ethereum/consensus-specs/blob/dev/specs/capella/beacon-chain.md#beaconstate)
    uint256 internal constant VALIDATOR_CONTAINER_INDEX = 11;
    uint256 internal constant BALANCE_CONTAINER_INDEX = 12;

    /// @notice Number of fields in the `Validator` container
    /// (See https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator)
    uint256 internal constant VALIDATOR_FIELDS_LENGTH = 8;

    /// @notice Indices for fields in the `Validator` container
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;
    uint256 internal constant VALIDATOR_WITHDRAWAL_CREDENTIALS_INDEX = 1;
    uint256 internal constant VALIDATOR_BALANCE_INDEX = 2;
    uint256 internal constant VALIDATOR_SLASHED_INDEX = 3;
    uint256 internal constant VALIDATOR_ACTIVATION_EPOCH_INDEX = 5;
    uint256 internal constant VALIDATOR_EXIT_EPOCH_INDEX = 6;

    /// @notice Slot/Epoch timings
    uint64 internal constant SECONDS_PER_SLOT = 12;
    uint64 internal constant SLOTS_PER_EPOCH = 32;
    uint64 internal constant SECONDS_PER_EPOCH = SLOTS_PER_EPOCH * SECONDS_PER_SLOT;

    /// @notice `FAR_FUTURE_EPOCH` is used as the default value for certain `Validator`
    /// fields when a `Validator` is first created on the beacon chain
    uint64 internal constant FAR_FUTURE_EPOCH = type(uint64).max;
    bytes8 internal constant UINT64_MASK = 0xffffffffffffffff;

    /// @notice The beacon chain version to validate against
    enum ProofVersion {
        DENEB,
        PECTRA
    }

    /// @notice Contains a beacon state root and a merkle proof verifying its inclusion under a beacon block root
    struct StateRootProof {
        bytes32 beaconStateRoot;
        bytes proof;
    }

    /// @notice Contains a validator's fields and a merkle proof of their inclusion under a beacon state root
    struct ValidatorProof {
        bytes32[] validatorFields;
        bytes proof;
    }

    /// @notice Contains a beacon balance container root and a proof of this root under a beacon block root
    struct BalanceContainerProof {
        bytes32 balanceContainerRoot;
        bytes proof;
    }

    /// @notice Contains a validator balance root and a proof of its inclusion under a balance container root
    struct BalanceProof {
        bytes32 pubkeyHash;
        bytes32 balanceRoot;
        bytes proof;
    }

    /**
     *
     *              VALIDATOR FIELDS -> BEACON STATE ROOT -> BEACON BLOCK ROOT
     *
     */

    /// @notice Verify a merkle proof of the beacon state root against a beacon block root
    /// @param beaconBlockRoot merkle root of the beacon block
    /// @param proof the beacon state root and merkle proof of its inclusion under `beaconBlockRoot`
    function verifyStateRoot(bytes32 beaconBlockRoot, StateRootProof calldata proof) internal view {
        require(proof.proof.length == 32 * (BEACON_BLOCK_HEADER_TREE_HEIGHT), InvalidProofLength());

        /// This merkle proof verifies the `beaconStateRoot` under the `beaconBlockRoot`
        /// - beaconBlockRoot
        /// |                            HEIGHT: BEACON_BLOCK_HEADER_TREE_HEIGHT
        /// -- beaconStateRoot
        require(
            Merkle.verifyInclusionSha256({
                proof: proof.proof,
                root: beaconBlockRoot,
                leaf: proof.beaconStateRoot,
                index: STATE_ROOT_INDEX
            }),
            InvalidProof()
        );
    }

    /// @notice Verify a merkle proof of a validator container against a `beaconStateRoot`
    /// @dev This proof starts at a validator's container root, proves through the validator container root,
    /// and continues proving to the root of the `BeaconState`
    /// @dev See https://eth2book.info/capella/part3/containers/dependencies/#validator for info on `Validator` containers
    /// @dev See https://eth2book.info/capella/part3/containers/state/#beaconstate for info on `BeaconState` containers
    /// @param beaconStateRoot merkle root of the `BeaconState` container
    /// @param validatorFields an individual validator's fields. These are merklized to form a `validatorRoot`,
    /// which is used as the leaf to prove against `beaconStateRoot`
    /// @param validatorFieldsProof a merkle proof of inclusion of `validatorFields` under `beaconStateRoot`
    /// @param validatorIndex the validator's unique index
    function verifyValidatorFields(
        ProofVersion proofVersion,
        bytes32 beaconStateRoot,
        bytes32[] calldata validatorFields,
        bytes calldata validatorFieldsProof,
        uint40 validatorIndex
    ) internal view {
        require(validatorFields.length == VALIDATOR_FIELDS_LENGTH, InvalidValidatorFieldsLength());

        uint256 beaconStateTreeHeight = getBeaconStateTreeHeight(proofVersion);

        /// Note: the reason we use `VALIDATOR_TREE_HEIGHT + 1` here is because the merklization process for
        /// this container includes hashing the root of the validator tree with the length of the validator list
        require(
            validatorFieldsProof.length == 32 * ((VALIDATOR_TREE_HEIGHT + 1) + beaconStateTreeHeight),
            InvalidProofLength()
        );

        // Merkleize `validatorFields` to get the leaf to prove
        bytes32 validatorRoot = Merkle.merkleizeSha256(validatorFields);

        /// This proof combines two proofs, so its index accounts for the relative position of leaves in two trees:
        /// - beaconStateRoot
        /// |                            HEIGHT: BEACON_STATE_TREE_HEIGHT
        /// -- validatorContainerRoot
        /// |                            HEIGHT: VALIDATOR_TREE_HEIGHT + 1
        /// ---- validatorRoot
        uint256 index = (VALIDATOR_CONTAINER_INDEX << (VALIDATOR_TREE_HEIGHT + 1)) | uint256(validatorIndex);

        require(
            Merkle.verifyInclusionSha256({
                proof: validatorFieldsProof,
                root: beaconStateRoot,
                leaf: validatorRoot,
                index: index
            }),
            InvalidProof()
        );
    }

    /**
     *
     *          VALIDATOR BALANCE -> BALANCE CONTAINER ROOT -> BEACON BLOCK ROOT
     *
     */

    /// @notice Verify a merkle proof of the beacon state's balances container against the beacon block root
    /// @dev This proof starts at the balance container root, proves through the beacon state root, and
    /// continues proving through the beacon block root. As a result, this proof will contain elements
    /// of a `StateRootProof` under the same block root, with the addition of proving the balances field
    /// within the beacon state.
    /// @dev This is used to make checkpoint proofs more efficient, as a checkpoint will verify multiple balances
    /// against the same balance container root.
    /// @param beaconBlockRoot merkle root of the beacon block
    /// @param proof a beacon balance container root and merkle proof of its inclusion under `beaconBlockRoot`
    function verifyBalanceContainer(
        ProofVersion proofVersion,
        bytes32 beaconBlockRoot,
        BalanceContainerProof calldata proof
    ) internal view {
        uint256 beaconStateTreeHeight = getBeaconStateTreeHeight(proofVersion);

        require(
            proof.proof.length == 32 * (BEACON_BLOCK_HEADER_TREE_HEIGHT + beaconStateTreeHeight), InvalidProofLength()
        );

        /// This proof combines two proofs, so its index accounts for the relative position of leaves in two trees:
        /// - beaconBlockRoot
        /// |                            HEIGHT: BEACON_BLOCK_HEADER_TREE_HEIGHT
        /// -- beaconStateRoot
        /// |                            HEIGHT: BEACON_STATE_TREE_HEIGHT
        /// ---- balancesContainerRoot
        uint256 index = (STATE_ROOT_INDEX << (beaconStateTreeHeight)) | BALANCE_CONTAINER_INDEX;

        require(
            Merkle.verifyInclusionSha256({
                proof: proof.proof,
                root: beaconBlockRoot,
                leaf: proof.balanceContainerRoot,
                index: index
            }),
            InvalidProof()
        );
    }

    /// @notice Verify a merkle proof of a validator's balance against the beacon state's `balanceContainerRoot`
    /// @param balanceContainerRoot the merkle root of all validators' current balances
    /// @param validatorIndex the index of the validator whose balance we are proving
    /// @param proof the validator's associated balance root and a merkle proof of inclusion under `balanceContainerRoot`
    /// @return validatorBalanceGwei the validator's current balance (in gwei)
    function verifyValidatorBalance(
        bytes32 balanceContainerRoot,
        uint40 validatorIndex,
        BalanceProof calldata proof
    ) internal view returns (uint64 validatorBalanceGwei) {
        /// Note: the reason we use `BALANCE_TREE_HEIGHT + 1` here is because the merklization process for
        /// this container includes hashing the root of the balances tree with the length of the balances list
        require(proof.proof.length == 32 * (BALANCE_TREE_HEIGHT + 1), InvalidProofLength());

        /// When merkleized, beacon chain balances are combined into groups of 4 called a `balanceRoot`. The merkle
        /// proof here verifies that this validator's `balanceRoot` is included in the `balanceContainerRoot`
        /// - balanceContainerRoot
        /// |                            HEIGHT: BALANCE_TREE_HEIGHT
        /// -- balanceRoot
        uint256 balanceIndex = uint256(validatorIndex / 4);

        require(
            Merkle.verifyInclusionSha256({
                proof: proof.proof,
                root: balanceContainerRoot,
                leaf: proof.balanceRoot,
                index: balanceIndex
            }),
            InvalidProof()
        );

        /// Extract the individual validator's balance from the `balanceRoot`
        return getBalanceAtIndex(proof.balanceRoot, validatorIndex);
    }

    /**
     * @notice Parses a balanceRoot to get the uint64 balance of a validator.
     * @dev During merkleization of the beacon state balance tree, four uint64 values are treated as a single
     * leaf in the merkle tree. We use validatorIndex % 4 to determine which of the four uint64 values to
     * extract from the balanceRoot.
     * @param balanceRoot is the combination of 4 validator balances being proven for
     * @param validatorIndex is the index of the validator being proven for
     * @return The validator's balance, in Gwei
     */
    function getBalanceAtIndex(bytes32 balanceRoot, uint40 validatorIndex) internal pure returns (uint64) {
        uint256 bitShiftAmount = (validatorIndex % 4) * 64;
        return Endian.fromLittleEndianUint64(bytes32((uint256(balanceRoot) << bitShiftAmount)));
    }

    /// @notice Indices for fields in the `Validator` container:
    /// 0: pubkey
    /// 1: withdrawal credentials
    /// 2: effective balance
    /// 3: slashed?
    /// 4: activation eligibility epoch
    /// 5: activation epoch
    /// 6: exit epoch
    /// 7: withdrawable epoch
    ///
    /// (See https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator)

    /// @dev Retrieves a validator's pubkey hash
    function getPubkeyHash(
        bytes32[] memory validatorFields
    ) internal pure returns (bytes32) {
        return validatorFields[VALIDATOR_PUBKEY_INDEX];
    }

    /// @dev Retrieves a validator's withdrawal credentials
    function getWithdrawalCredentials(
        bytes32[] memory validatorFields
    ) internal pure returns (bytes32) {
        return validatorFields[VALIDATOR_WITHDRAWAL_CREDENTIALS_INDEX];
    }

    /// @dev Retrieves a validator's effective balance (in gwei)
    function getEffectiveBalanceGwei(
        bytes32[] memory validatorFields
    ) internal pure returns (uint64) {
        return Endian.fromLittleEndianUint64(validatorFields[VALIDATOR_BALANCE_INDEX]);
    }

    /// @dev Retrieves a validator's activation epoch
    function getActivationEpoch(
        bytes32[] memory validatorFields
    ) internal pure returns (uint64) {
        return Endian.fromLittleEndianUint64(validatorFields[VALIDATOR_ACTIVATION_EPOCH_INDEX]);
    }

    /// @dev Retrieves true IFF a validator is marked slashed
    function isValidatorSlashed(
        bytes32[] memory validatorFields
    ) internal pure returns (bool) {
        return validatorFields[VALIDATOR_SLASHED_INDEX] != 0;
    }

    /// @dev Retrieves a validator's exit epoch
    function getExitEpoch(
        bytes32[] memory validatorFields
    ) internal pure returns (uint64) {
        return Endian.fromLittleEndianUint64(validatorFields[VALIDATOR_EXIT_EPOCH_INDEX]);
    }

    /// @dev We check if the proofTimestamp is <= pectraForkTimestamp because a `proofTimestamp` at the `pectraForkTimestamp`
    ///      is considered to be Pre-Pectra given the EIP-4788 oracle returns the parent block.
    function getBeaconStateTreeHeight(
        ProofVersion proofVersion
    ) internal pure returns (uint256) {
        return proofVersion == ProofVersion.DENEB ? DENEB_BEACON_STATE_TREE_HEIGHT : PECTRA_BEACON_STATE_TREE_HEIGHT;
    }
}

// lib/eigenlayer-contracts/src/contracts/libraries/SlashingLib.sol

/// @dev All scaling factors have `1e18` as an initial/default value. This value is represented
/// by the constant `WAD`, which is used to preserve precision with uint256 math.
///
/// When applying scaling factors, they are typically multiplied/divided by `WAD`, allowing this
/// constant to act as a "1" in mathematical formulae.
uint64 constant WAD = 1e18;

/*
 * There are 2 types of shares:
 *      1. deposit shares
 *          - These can be converted to an amount of tokens given a strategy
 *              - by calling `sharesToUnderlying` on the strategy address (they're already tokens 
 *              in the case of EigenPods)
 *          - These live in the storage of the EigenPodManager and individual StrategyManager strategies 
 *      2. withdrawable shares
 *          - For a staker, this is the amount of shares that they can withdraw
 *          - For an operator, the shares delegated to them are equal to the sum of their stakers'
 *            withdrawable shares
 *
 * Along with a slashing factor, the DepositScalingFactor is used to convert between the two share types.
 */
struct DepositScalingFactor {
    uint256 _scalingFactor;
}

using SlashingLib for DepositScalingFactor global;

library SlashingLib {
    using Math for uint256;
    using SlashingLib for uint256;
    using SafeCastUpgradeable for uint256;

    // WAD MATH

    function mulWad(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mulDiv(y, WAD);
    }

    function divWad(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mulDiv(WAD, y);
    }

    /**
     * @notice Used explicitly for calculating slashed magnitude, we want to ensure even in the
     * situation where an operator is slashed several times and precision has been lost over time,
     * an incoming slashing request isn't rounded down to 0 and an operator is able to avoid slashing penalties.
     */
    function mulWadRoundUp(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mulDiv(y, WAD, Math.Rounding.Up);
    }

    // GETTERS

    function scalingFactor(
        DepositScalingFactor memory dsf
    ) internal pure returns (uint256) {
        return dsf._scalingFactor == 0 ? WAD : dsf._scalingFactor;
    }

    function scaleForQueueWithdrawal(
        DepositScalingFactor memory dsf,
        uint256 depositSharesToWithdraw
    ) internal pure returns (uint256) {
        return depositSharesToWithdraw.mulWad(dsf.scalingFactor());
    }

    function scaleForCompleteWithdrawal(uint256 scaledShares, uint256 slashingFactor) internal pure returns (uint256) {
        return scaledShares.mulWad(slashingFactor);
    }

    /**
     * @notice Scales shares according to the difference in an operator's magnitude before and
     * after being slashed. This is used to calculate the number of slashable shares in the
     * withdrawal queue.
     * NOTE: max magnitude is guaranteed to only ever decrease.
     */
    function scaleForBurning(
        uint256 scaledShares,
        uint64 prevMaxMagnitude,
        uint64 newMaxMagnitude
    ) internal pure returns (uint256) {
        return scaledShares.mulWad(prevMaxMagnitude - newMaxMagnitude);
    }

    function update(
        DepositScalingFactor storage dsf,
        uint256 prevDepositShares,
        uint256 addedShares,
        uint256 slashingFactor
    ) internal {
        if (prevDepositShares == 0) {
            // If this is the staker's first deposit or they are delegating to an operator,
            // the slashing factor is inverted and applied to the existing DSF. This has the
            // effect of "forgiving" prior slashing for any subsequent deposits.
            dsf._scalingFactor = dsf.scalingFactor().divWad(slashingFactor);
            return;
        }

        /**
         * Base Equations:
         * (1) newShares = currentShares + addedShares
         * (2) newDepositShares = prevDepositShares + addedShares
         * (3) newShares = newDepositShares * newDepositScalingFactor * slashingFactor
         *
         * Plugging (1) into (3):
         * (4) newDepositShares * newDepositScalingFactor * slashingFactor = currentShares + addedShares
         *
         * Solving for newDepositScalingFactor
         * (5) newDepositScalingFactor = (currentShares + addedShares) / (newDepositShares * slashingFactor)
         *
         * Plugging in (2) into (5):
         * (7) newDepositScalingFactor = (currentShares + addedShares) / ((prevDepositShares + addedShares) * slashingFactor)
         * Note that magnitudes must be divided by WAD for precision. Thus,
         *
         * (8) newDepositScalingFactor = WAD * (currentShares + addedShares) / ((prevDepositShares + addedShares) * slashingFactor / WAD)
         * (9) newDepositScalingFactor = (currentShares + addedShares) * WAD / (prevDepositShares + addedShares) * WAD / slashingFactor
         */

        // Step 1: Calculate Numerator
        uint256 currentShares = dsf.calcWithdrawable(prevDepositShares, slashingFactor);

        // Step 2: Compute currentShares + addedShares
        uint256 newShares = currentShares + addedShares;

        // Step 3: Calculate newDepositScalingFactor
        /// forgefmt: disable-next-item
        uint256 newDepositScalingFactor = newShares
            .divWad(prevDepositShares + addedShares)
            .divWad(slashingFactor);

        dsf._scalingFactor = newDepositScalingFactor;
    }

    /// @dev Reset the staker's DSF for a strategy by setting it to 0. This is the same
    /// as setting it to WAD (see the `scalingFactor` getter above).
    ///
    /// A DSF is reset when a staker reduces their deposit shares to 0, either by queueing
    /// a withdrawal, or undelegating from their operator. This ensures that subsequent
    /// delegations/deposits do not use a stale DSF (e.g. from a prior operator).
    function reset(
        DepositScalingFactor storage dsf
    ) internal {
        dsf._scalingFactor = 0;
    }

    // CONVERSION

    function calcWithdrawable(
        DepositScalingFactor memory dsf,
        uint256 depositShares,
        uint256 slashingFactor
    ) internal pure returns (uint256) {
        /// forgefmt: disable-next-item
        return depositShares
            .mulWad(dsf.scalingFactor())
            .mulWad(slashingFactor);
    }

    function calcDepositShares(
        DepositScalingFactor memory dsf,
        uint256 withdrawableShares,
        uint256 slashingFactor
    ) internal pure returns (uint256) {
        /// forgefmt: disable-next-item
        return withdrawableShares
            .divWad(dsf.scalingFactor())
            .divWad(slashingFactor);
    }

    function calcSlashedAmount(
        uint256 operatorShares,
        uint256 prevMaxMagnitude,
        uint256 newMaxMagnitude
    ) internal pure returns (uint256) {
        // round up mulDiv so we don't overslash
        return operatorShares - operatorShares.mulDiv(newMaxMagnitude, prevMaxMagnitude, Math.Rounding.Up);
    }
}

// src/interfaces/IServiceManagerUI.sol

/**
 * @title Minimal interface for a ServiceManager-type contract that AVS ServiceManager contracts must implement
 * for eigenlabs to be able to index their data on the AVS marketplace frontend.
 * @author Layr Labs, Inc.
 */
interface IServiceManagerUI {
    /**
     * @notice Updates the metadata URI for the AVS,
     * @param metadataURI is the metadata URI for the AVS.
     * @dev Metadata should follow the format outlined by this example.
     *     {
     *         "name": "EigenLabs AVS 1",
     *         "website": "https://www.eigenlayer.xyz/",
     *         "description": "This is my 1st AVS",
     *         "logo": "https://holesky-operator-metadata.s3.amazonaws.com/eigenlayer.png",
     *         "twitter": "https://twitter.com/eigenlayer"
     *     }
     */
    function updateAVSMetadataURI(
        string memory metadataURI
    ) external;

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator registration with the AVS.
     * @param operator The address of the operator to register.
     * @param operatorSignature The signature, salt, and expiry of the operator's signature.
     */
    function registerOperatorToAVS(
        address operator,
        ISignatureUtilsMixinTypes.SignatureWithSaltAndExpiry memory operatorSignature
    ) external;

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator deregistration from the AVS.
     * @param operator The address of the operator to deregister.
     */
    function deregisterOperatorFromAVS(
        address operator
    ) external;

    /**
     * @notice Returns the list of strategies that the operator has potentially restaked on the AVS.
     * @param operator The address of the operator to get restaked strategies for.
     * @dev This function is intended to be called off-chain.
     * @dev No guarantee is made on whether the operator has shares for a strategy in a quorum or uniqueness
     *      of each element in the returned array. The off-chain service should do that validation separately.
     */
    function getOperatorRestakedStrategies(
        address operator
    ) external view returns (address[] memory);

    /**
     * @notice Returns the list of strategies that the AVS supports for restaking.
     * @dev This function is intended to be called off-chain.
     * @dev No guarantee is made on uniqueness of each element in the returned array.
     *      The off-chain service should do that validation separately.
     */
    function getRestakeableStrategies() external view returns (address[] memory);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol

interface IStrategyErrors {
    /// @dev Thrown when called by an account that is not strategy manager.
    error OnlyStrategyManager();
    /// @dev Thrown when new shares value is zero.
    error NewSharesZero();
    /// @dev Thrown when total shares exceeds max.
    error TotalSharesExceedsMax();
    /// @dev Thrown when amount shares is greater than total shares.
    error WithdrawalAmountExceedsTotalDeposits();
    /// @dev Thrown when attempting an action with a token that is not accepted.
    error OnlyUnderlyingToken();

    /// StrategyBaseWithTVLLimits

    /// @dev Thrown when `maxPerDeposit` exceeds max.
    error MaxPerDepositExceedsMax();
    /// @dev Thrown when balance exceeds max total deposits.
    error BalanceExceedsMaxTotalDeposits();
}

interface IStrategyEvents {
    /**
     * @notice Used to emit an event for the exchange rate between 1 share and underlying token in a strategy contract
     * @param rate is the exchange rate in wad 18 decimals
     * @dev Tokens that do not have 18 decimals must have offchain services scale the exchange rate by the proper magnitude
     */
    event ExchangeRateEmitted(uint256 rate);

    /**
     * Used to emit the underlying token and its decimals on strategy creation
     * @notice token
     * @param token is the ERC20 token of the strategy
     * @param decimals are the decimals of the ERC20 token in the strategy
     */
    event StrategyTokenSet(IERC20 token, uint8 decimals);
}

/**
 * @title Minimal interface for an `Strategy` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice Custom `Strategy` implementations may expand extensively on this interface.
 */
interface IStrategy is IStrategyErrors, IStrategyEvents, ISemVerMixin {
    /**
     * @notice Used to deposit tokens into this Strategy
     * @param token is the ERC20 token being deposited
     * @param amount is the amount of token being deposited
     * @dev This function is only callable by the strategyManager contract. It is invoked inside of the strategyManager's
     * `depositIntoStrategy` function, and individual share balances are recorded in the strategyManager as well.
     * @return newShares is the number of new shares issued at the current exchange ratio.
     */
    function deposit(IERC20 token, uint256 amount) external returns (uint256);

    /**
     * @notice Used to withdraw tokens from this Strategy, to the `recipient`'s address
     * @param recipient is the address to receive the withdrawn funds
     * @param token is the ERC20 token being transferred out
     * @param amountShares is the amount of shares being withdrawn
     * @dev This function is only callable by the strategyManager contract. It is invoked inside of the strategyManager's
     * other functions, and individual share balances are recorded in the strategyManager as well.
     */
    function withdraw(address recipient, IERC20 token, uint256 amountShares) external;

    /**
     * @notice Used to convert a number of shares to the equivalent amount of underlying tokens for this strategy.
     * For a staker using this function and trying to calculate the amount of underlying tokens they have in total they
     * should input into `amountShares` their withdrawable shares read from the `DelegationManager` contract.
     * @notice In contrast to `sharesToUnderlyingView`, this function **may** make state modifications
     * @param amountShares is the amount of shares to calculate its conversion into the underlying token
     * @return The amount of underlying tokens corresponding to the input `amountShares`
     * @dev Implementation for these functions in particular may vary significantly for different strategies
     */
    function sharesToUnderlying(
        uint256 amountShares
    ) external returns (uint256);

    /**
     * @notice Used to convert an amount of underlying tokens to the equivalent amount of shares in this strategy.
     * @notice In contrast to `underlyingToSharesView`, this function **may** make state modifications
     * @param amountUnderlying is the amount of `underlyingToken` to calculate its conversion into strategy shares
     * @return The amount of shares corresponding to the input `amountUnderlying`.  This is used as deposit shares
     * in the `StrategyManager` contract.
     * @dev Implementation for these functions in particular may vary significantly for different strategies
     */
    function underlyingToShares(
        uint256 amountUnderlying
    ) external returns (uint256);

    /**
     * @notice convenience function for fetching the current underlying value of all of the `user`'s shares in
     * this strategy. In contrast to `userUnderlyingView`, this function **may** make state modifications
     */
    function userUnderlying(
        address user
    ) external returns (uint256);

    /**
     * @notice convenience function for fetching the current total shares of `user` in this strategy, by
     * querying the `strategyManager` contract
     */
    function shares(
        address user
    ) external view returns (uint256);

    /**
     * @notice Used to convert a number of shares to the equivalent amount of underlying tokens for this strategy.
     * For a staker using this function and trying to calculate the amount of underlying tokens they have in total they
     * should input into `amountShares` their withdrawable shares read from the `DelegationManager` contract.
     * @notice In contrast to `sharesToUnderlying`, this function guarantees no state modifications
     * @param amountShares is the amount of shares to calculate its conversion into the underlying token
     * @return The amount of underlying tokens corresponding to the input `amountShares`
     * @dev Implementation for these functions in particular may vary significantly for different strategies
     */
    function sharesToUnderlyingView(
        uint256 amountShares
    ) external view returns (uint256);

    /**
     * @notice Used to convert an amount of underlying tokens to the equivalent amount of shares in this strategy.
     * @notice In contrast to `underlyingToShares`, this function guarantees no state modifications
     * @param amountUnderlying is the amount of `underlyingToken` to calculate its conversion into strategy shares
     * @return The amount of shares corresponding to the input `amountUnderlying`. This is used as deposit shares
     * in the `StrategyManager` contract.
     * @dev Implementation for these functions in particular may vary significantly for different strategies
     */
    function underlyingToSharesView(
        uint256 amountUnderlying
    ) external view returns (uint256);

    /**
     * @notice convenience function for fetching the current underlying value of all of the `user`'s shares in
     * this strategy. In contrast to `userUnderlying`, this function guarantees no state modifications
     */
    function userUnderlyingView(
        address user
    ) external view returns (uint256);

    /// @notice The underlying token for shares in this Strategy
    function underlyingToken() external view returns (IERC20);

    /// @notice The total number of extant shares in this Strategy
    function totalShares() external view returns (uint256);

    /// @notice Returns either a brief string explaining the strategy's goal & purpose, or a link to metadata that explains in more detail.
    function explanation() external view returns (string memory);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IShareManager.sol

/**
 * @title Interface for a `IShareManager` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice This contract is used by the DelegationManager as a unified interface to interact with the EigenPodManager and StrategyManager
 */
interface IShareManager {
    /// @notice Used by the DelegationManager to remove a Staker's shares from a particular strategy when entering the withdrawal queue
    /// @dev strategy must be beaconChainETH when talking to the EigenPodManager
    /// @return updatedShares the staker's deposit shares after decrement
    function removeDepositShares(
        address staker,
        IStrategy strategy,
        uint256 depositSharesToRemove
    ) external returns (uint256);

    /// @notice Used by the DelegationManager to award a Staker some shares that have passed through the withdrawal queue
    /// @dev strategy must be beaconChainETH when talking to the EigenPodManager
    /// @return existingDepositShares the shares the staker had before any were added
    /// @return addedShares the new shares added to the staker's balance
    function addShares(address staker, IStrategy strategy, uint256 shares) external returns (uint256, uint256);

    /// @notice Used by the DelegationManager to convert deposit shares to tokens and send them to a staker
    /// @dev strategy must be beaconChainETH when talking to the EigenPodManager
    /// @dev token is not validated when talking to the EigenPodManager
    function withdrawSharesAsTokens(address staker, IStrategy strategy, IERC20 token, uint256 shares) external;

    /// @notice Returns the current shares of `user` in `strategy`
    /// @dev strategy must be beaconChainETH when talking to the EigenPodManager
    /// @dev returns 0 if the user has negative shares
    function stakerDepositShares(address user, IStrategy strategy) external view returns (uint256 depositShares);

    /**
     * @notice Increase the amount of burnable shares for a given Strategy. This is called by the DelegationManager
     * when an operator is slashed in EigenLayer.
     * @param strategy The strategy to burn shares in.
     * @param addedSharesToBurn The amount of added shares to burn.
     * @dev This function is only called by the DelegationManager when an operator is slashed.
     */
    function increaseBurnableShares(IStrategy strategy, uint256 addedSharesToBurn) external;
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IDelegationManager.sol

interface IDelegationManagerErrors {
    /// @dev Thrown when caller is neither the StrategyManager or EigenPodManager contract.
    error OnlyStrategyManagerOrEigenPodManager();
    /// @dev Thrown when msg.sender is not the EigenPodManager
    error OnlyEigenPodManager();
    /// @dev Throw when msg.sender is not the AllocationManager
    error OnlyAllocationManager();

    /// Delegation Status

    /// @dev Thrown when an operator attempts to undelegate.
    error OperatorsCannotUndelegate();
    /// @dev Thrown when an account is actively delegated.
    error ActivelyDelegated();
    /// @dev Thrown when an account is not actively delegated.
    error NotActivelyDelegated();
    /// @dev Thrown when `operator` is not a registered operator.
    error OperatorNotRegistered();

    /// Invalid Inputs

    /// @dev Thrown when attempting to execute an action that was not queued.
    error WithdrawalNotQueued();
    /// @dev Thrown when caller cannot undelegate on behalf of a staker.
    error CallerCannotUndelegate();
    /// @dev Thrown when two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @dev Thrown when input arrays length is zero.
    error InputArrayLengthZero();

    /// Slashing

    /// @dev Thrown when an operator has been fully slashed(maxMagnitude is 0) for a strategy.
    /// or if the staker has had been natively slashed to the point of their beaconChainScalingFactor equalling 0.
    error FullySlashed();

    /// Signatures

    /// @dev Thrown when attempting to spend a spent eip-712 salt.
    error SaltSpent();

    /// Withdrawal Processing

    /// @dev Thrown when attempting to withdraw before delay has elapsed.
    error WithdrawalDelayNotElapsed();
    /// @dev Thrown when withdrawer is not the current caller.
    error WithdrawerNotCaller();
}

interface IDelegationManagerTypes {
    // @notice Struct used for storing information about a single operator who has registered with EigenLayer
    struct OperatorDetails {
        /// @notice DEPRECATED -- this field is no longer used, payments are handled in RewardsCoordinator.sol
        address __deprecated_earningsReceiver;
        /**
         * @notice Address to verify signatures when a staker wishes to delegate to the operator, as well as controlling "forced undelegations".
         * @dev Signature verification follows these rules:
         * 1) If this address is left as address(0), then any staker will be free to delegate to the operator, i.e. no signature verification will be performed.
         * 2) If this address is an EOA (i.e. it has no code), then we follow standard ECDSA signature verification for delegations to the operator.
         * 3) If this address is a contract (i.e. it has code) then we forward a call to the contract and verify that it returns the correct EIP-1271 "magic value".
         */
        address delegationApprover;
        /// @notice DEPRECATED -- this field is no longer used. An analogous field is the `allocationDelay` stored in the AllocationManager
        uint32 __deprecated_stakerOptOutWindowBlocks;
    }

    /**
     * @notice Abstract struct used in calculating an EIP712 signature for an operator's delegationApprover to approve that a specific staker delegate to the operator.
     * @dev Used in computing the `DELEGATION_APPROVAL_TYPEHASH` and as a reference in the computation of the approverDigestHash in the `_delegate` function.
     */
    struct DelegationApproval {
        // the staker who is delegating
        address staker;
        // the operator being delegated to
        address operator;
        // the operator's provided salt
        bytes32 salt;
        // the expiration timestamp (UTC) of the signature
        uint256 expiry;
    }

    /**
     * @dev A struct representing an existing queued withdrawal. After the withdrawal delay has elapsed, this withdrawal can be completed via `completeQueuedWithdrawal`.
     * A `Withdrawal` is created by the `DelegationManager` when `queueWithdrawals` is called. The `withdrawalRoots` hashes returned by `queueWithdrawals` can be used
     * to fetch the corresponding `Withdrawal` from storage (via `getQueuedWithdrawal`).
     *
     * @param staker The address that queued the withdrawal
     * @param delegatedTo The address that the staker was delegated to at the time the withdrawal was queued. Used to determine if additional slashing occurred before
     * this withdrawal became completable.
     * @param withdrawer The address that will call the contract to complete the withdrawal. Note that this will always equal `staker`; alternate withdrawers are not
     * supported at this time.
     * @param nonce The staker's `cumulativeWithdrawalsQueued` at time of queuing. Used to ensure withdrawals have unique hashes.
     * @param startBlock The block number when the withdrawal was queued.
     * @param strategies The strategies requested for withdrawal when the withdrawal was queued
     * @param scaledShares The staker's deposit shares requested for withdrawal, scaled by the staker's `depositScalingFactor`. Upon completion, these will be
     * scaled by the appropriate slashing factor as of the withdrawal's completable block. The result is what is actually withdrawable.
     */
    struct Withdrawal {
        address staker;
        address delegatedTo;
        address withdrawer;
        uint256 nonce;
        uint32 startBlock;
        IStrategy[] strategies;
        uint256[] scaledShares;
    }

    /**
     * @param strategies The strategies to withdraw from
     * @param depositShares For each strategy, the number of deposit shares to withdraw. Deposit shares can
     * be queried via `getDepositedShares`.
     * NOTE: The number of shares ultimately received when a withdrawal is completed may be lower depositShares
     * if the staker or their delegated operator has experienced slashing.
     * @param __deprecated_withdrawer This field is ignored. The only party that may complete a withdrawal
     * is the staker that originally queued it. Alternate withdrawers are not supported.
     */
    struct QueuedWithdrawalParams {
        IStrategy[] strategies;
        uint256[] depositShares;
        address __deprecated_withdrawer;
    }
}

interface IDelegationManagerEvents is IDelegationManagerTypes {
    // @notice Emitted when a new operator registers in EigenLayer and provides their delegation approver.
    event OperatorRegistered(address indexed operator, address delegationApprover);

    /// @notice Emitted when an operator updates their delegation approver
    event DelegationApproverUpdated(address indexed operator, address newDelegationApprover);

    /**
     * @notice Emitted when @param operator indicates that they are updating their MetadataURI string
     * @dev Note that these strings are *never stored in storage* and are instead purely emitted in events for off-chain indexing
     */
    event OperatorMetadataURIUpdated(address indexed operator, string metadataURI);

    /// @notice Emitted whenever an operator's shares are increased for a given strategy. Note that shares is the delta in the operator's shares.
    event OperatorSharesIncreased(address indexed operator, address staker, IStrategy strategy, uint256 shares);

    /// @notice Emitted whenever an operator's shares are decreased for a given strategy. Note that shares is the delta in the operator's shares.
    event OperatorSharesDecreased(address indexed operator, address staker, IStrategy strategy, uint256 shares);

    /// @notice Emitted when @param staker delegates to @param operator.
    event StakerDelegated(address indexed staker, address indexed operator);

    /// @notice Emitted when @param staker undelegates from @param operator.
    event StakerUndelegated(address indexed staker, address indexed operator);

    /// @notice Emitted when @param staker is undelegated via a call not originating from the staker themself
    event StakerForceUndelegated(address indexed staker, address indexed operator);

    /// @notice Emitted when a staker's depositScalingFactor is updated
    event DepositScalingFactorUpdated(address staker, IStrategy strategy, uint256 newDepositScalingFactor);

    /**
     * @notice Emitted when a new withdrawal is queued.
     * @param withdrawalRoot Is the hash of the `withdrawal`.
     * @param withdrawal Is the withdrawal itself.
     * @param sharesToWithdraw Is an array of the expected shares that were queued for withdrawal corresponding to the strategies in the `withdrawal`.
     */
    event SlashingWithdrawalQueued(bytes32 withdrawalRoot, Withdrawal withdrawal, uint256[] sharesToWithdraw);

    /// @notice Emitted when a queued withdrawal is completed
    event SlashingWithdrawalCompleted(bytes32 withdrawalRoot);

    /// @notice Emitted whenever an operator's shares are slashed for a given strategy
    event OperatorSharesSlashed(address indexed operator, IStrategy strategy, uint256 totalSlashedShares);
}

/**
 * @title DelegationManager
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice  This is the contract for delegation in EigenLayer. The main functionalities of this contract are
 * - enabling anyone to register as an operator in EigenLayer
 * - allowing operators to specify parameters related to stakers who delegate to them
 * - enabling any staker to delegate its stake to the operator of its choice (a given staker can only delegate to a single operator at a time)
 * - enabling a staker to undelegate its assets from the operator it is delegated to (performed as part of the withdrawal process, initiated through the StrategyManager)
 */
interface IDelegationManager is ISignatureUtilsMixin, IDelegationManagerErrors, IDelegationManagerEvents {
    /**
     * @dev Initializes the initial owner and paused status.
     */
    function initialize(address initialOwner, uint256 initialPausedStatus) external;

    /**
     * @notice Registers the caller as an operator in EigenLayer.
     * @param initDelegationApprover is an address that, if set, must provide a signature when stakers delegate
     * to an operator.
     * @param allocationDelay The delay before allocations take effect.
     * @param metadataURI is a URI for the operator's metadata, i.e. a link providing more details on the operator.
     *
     * @dev Once an operator is registered, they cannot 'deregister' as an operator, and they will forever be considered "delegated to themself".
     * @dev This function will revert if the caller is already delegated to an operator.
     * @dev Note that the `metadataURI` is *never stored * and is only emitted in the `OperatorMetadataURIUpdated` event
     */
    function registerAsOperator(
        address initDelegationApprover,
        uint32 allocationDelay,
        string calldata metadataURI
    ) external;

    /**
     * @notice Updates an operator's stored `delegationApprover`.
     * @param operator is the operator to update the delegationApprover for
     * @param newDelegationApprover is the new delegationApprover for the operator
     *
     * @dev The caller must have previously registered as an operator in EigenLayer.
     */
    function modifyOperatorDetails(address operator, address newDelegationApprover) external;

    /**
     * @notice Called by an operator to emit an `OperatorMetadataURIUpdated` event indicating the information has updated.
     * @param operator The operator to update metadata for
     * @param metadataURI The URI for metadata associated with an operator
     * @dev Note that the `metadataURI` is *never stored * and is only emitted in the `OperatorMetadataURIUpdated` event
     */
    function updateOperatorMetadataURI(address operator, string calldata metadataURI) external;

    /**
     * @notice Caller delegates their stake to an operator.
     * @param operator The account (`msg.sender`) is delegating its assets to for use in serving applications built on EigenLayer.
     * @param approverSignatureAndExpiry (optional) Verifies the operator approves of this delegation
     * @param approverSalt (optional) A unique single use value tied to an individual signature.
     * @dev The signature/salt are used ONLY if the operator has configured a delegationApprover.
     * If they have not, these params can be left empty.
     */
    function delegateTo(
        address operator,
        SignatureWithExpiry memory approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @notice Undelegates the staker from their operator and queues a withdrawal for all of their shares
     * @param staker The account to be undelegated
     * @return withdrawalRoots The roots of the newly queued withdrawals, if a withdrawal was queued. Returns
     * an empty array if none was queued.
     *
     * @dev Reverts if the `staker` is also an operator, since operators are not allowed to undelegate from themselves.
     * @dev Reverts if the caller is not the staker, nor the operator who the staker is delegated to, nor the operator's specified "delegationApprover"
     * @dev Reverts if the `staker` is not delegated to an operator
     */
    function undelegate(
        address staker
    ) external returns (bytes32[] memory withdrawalRoots);

    /**
     * @notice Undelegates the staker from their current operator, and redelegates to `newOperator`
     * Queues a withdrawal for all of the staker's withdrawable shares. These shares will only be
     * delegated to `newOperator` AFTER the withdrawal is completed.
     * @dev This method acts like a call to `undelegate`, then `delegateTo`
     * @param newOperator the new operator that will be delegated all assets
     * @dev NOTE: the following 2 params are ONLY checked if `newOperator` has a `delegationApprover`.
     * If not, they can be left empty.
     * @param newOperatorApproverSig A signature from the operator's `delegationApprover`
     * @param approverSalt A unique single use value tied to the approver's signature
     */
    function redelegate(
        address newOperator,
        SignatureWithExpiry memory newOperatorApproverSig,
        bytes32 approverSalt
    ) external returns (bytes32[] memory withdrawalRoots);

    /**
     * @notice Allows a staker to queue a withdrawal of their deposit shares. The withdrawal can be
     * completed after the MIN_WITHDRAWAL_DELAY_BLOCKS via either of the completeQueuedWithdrawal methods.
     *
     * While in the queue, these shares are removed from the staker's balance, as well as from their operator's
     * delegated share balance (if applicable). Note that while in the queue, deposit shares are still subject
     * to slashing. If any slashing has occurred, the shares received may be less than the queued deposit shares.
     *
     * @dev To view all the staker's strategies/deposit shares that can be queued for withdrawal, see `getDepositedShares`
     * @dev To view the current conversion between a staker's deposit shares and withdrawable shares, see `getWithdrawableShares`
     */
    function queueWithdrawals(
        QueuedWithdrawalParams[] calldata params
    ) external returns (bytes32[] memory);

    /**
     * @notice Used to complete a queued withdrawal
     * @param withdrawal The withdrawal to complete
     * @param tokens Array in which the i-th entry specifies the `token` input to the 'withdraw' function of the i-th Strategy in the `withdrawal.strategies` array.
     * @param tokens For each `withdrawal.strategies`, the underlying token of the strategy
     * NOTE: if `receiveAsTokens` is false, the `tokens` array is unused and can be filled with default values. However, `tokens.length` MUST still be equal to `withdrawal.strategies.length`.
     * NOTE: For the `beaconChainETHStrategy`, the corresponding `tokens` value is ignored (can be 0).
     * @param receiveAsTokens If true, withdrawn shares will be converted to tokens and sent to the caller. If false, the caller receives shares that can be delegated to an operator.
     * NOTE: if the caller receives shares and is currently delegated to an operator, the received shares are
     * automatically delegated to the caller's current operator.
     */
    function completeQueuedWithdrawal(
        Withdrawal calldata withdrawal,
        IERC20[] calldata tokens,
        bool receiveAsTokens
    ) external;

    /**
     * @notice Used to complete multiple queued withdrawals
     * @param withdrawals Array of Withdrawals to complete. See `completeQueuedWithdrawal` for the usage of a single Withdrawal.
     * @param tokens Array of tokens for each Withdrawal. See `completeQueuedWithdrawal` for the usage of a single array.
     * @param receiveAsTokens Whether or not to complete each withdrawal as tokens. See `completeQueuedWithdrawal` for the usage of a single boolean.
     * @dev See `completeQueuedWithdrawal` for relevant dev tags
     */
    function completeQueuedWithdrawals(
        Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        bool[] calldata receiveAsTokens
    ) external;

    /**
     * @notice Called by a share manager when a staker's deposit share balance in a strategy increases.
     * This method delegates any new shares to an operator (if applicable), and updates the staker's
     * deposit scaling factor regardless.
     * @param staker The address whose deposit shares have increased
     * @param strategy The strategy in which shares have been deposited
     * @param prevDepositShares The number of deposit shares the staker had in the strategy prior to the increase
     * @param addedShares The number of deposit shares added by the staker
     *
     * @dev Note that if the either the staker's current operator has been slashed 100% for `strategy`, OR the
     * staker has been slashed 100% on the beacon chain such that the calculated slashing factor is 0, this
     * method WILL REVERT.
     */
    function increaseDelegatedShares(
        address staker,
        IStrategy strategy,
        uint256 prevDepositShares,
        uint256 addedShares
    ) external;

    /**
     * @notice If the staker is delegated, decreases its operator's shares in response to
     * a decrease in balance in the beaconChainETHStrategy
     * @param staker the staker whose operator's balance will be decreased
     * @param curDepositShares the current deposit shares held by the staker
     * @param beaconChainSlashingFactorDecrease the amount that the staker's beaconChainSlashingFactor has decreased by
     * @dev Note: `beaconChainSlashingFactorDecrease` are assumed to ALWAYS be < 1 WAD.
     * These invariants are maintained in the EigenPodManager.
     */
    function decreaseDelegatedShares(
        address staker,
        uint256 curDepositShares,
        uint64 beaconChainSlashingFactorDecrease
    ) external;

    /**
     * @notice Decreases the operators shares in storage after a slash and increases the burnable shares by calling
     * into either the StrategyManager or EigenPodManager (if the strategy is beaconChainETH).
     * @param operator The operator to decrease shares for
     * @param strategy The strategy to decrease shares for
     * @param prevMaxMagnitude the previous maxMagnitude of the operator
     * @param newMaxMagnitude the new maxMagnitude of the operator
     * @dev Callable only by the AllocationManager
     * @dev Note: Assumes `prevMaxMagnitude <= newMaxMagnitude`. This invariant is maintained in
     * the AllocationManager.
     */
    function slashOperatorShares(
        address operator,
        IStrategy strategy,
        uint64 prevMaxMagnitude,
        uint64 newMaxMagnitude
    ) external;

    /**
     *
     *                         VIEW FUNCTIONS
     *
     */

    /**
     * @notice returns the address of the operator that `staker` is delegated to.
     * @notice Mapping: staker => operator whom the staker is currently delegated to.
     * @dev Note that returning address(0) indicates that the staker is not actively delegated to any operator.
     */
    function delegatedTo(
        address staker
    ) external view returns (address);

    /**
     * @notice Mapping: delegationApprover => 32-byte salt => whether or not the salt has already been used by the delegationApprover.
     * @dev Salts are used in the `delegateTo` function. Note that this function only processes the delegationApprover's
     * signature + the provided salt if the operator being delegated to has specified a nonzero address as their `delegationApprover`.
     */
    function delegationApproverSaltIsSpent(address _delegationApprover, bytes32 salt) external view returns (bool);

    /// @notice Mapping: staker => cumulative number of queued withdrawals they have ever initiated.
    /// @dev This only increments (doesn't decrement), and is used to help ensure that otherwise identical withdrawals have unique hashes.
    function cumulativeWithdrawalsQueued(
        address staker
    ) external view returns (uint256);

    /**
     * @notice Returns 'true' if `staker` *is* actively delegated, and 'false' otherwise.
     */
    function isDelegated(
        address staker
    ) external view returns (bool);

    /**
     * @notice Returns true is an operator has previously registered for delegation.
     */
    function isOperator(
        address operator
    ) external view returns (bool);

    /**
     * @notice Returns the delegationApprover account for an operator
     */
    function delegationApprover(
        address operator
    ) external view returns (address);

    /**
     * @notice Returns the shares that an operator has delegated to them in a set of strategies
     * @param operator the operator to get shares for
     * @param strategies the strategies to get shares for
     */
    function getOperatorShares(
        address operator,
        IStrategy[] memory strategies
    ) external view returns (uint256[] memory);

    /**
     * @notice Returns the shares that a set of operators have delegated to them in a set of strategies
     * @param operators the operators to get shares for
     * @param strategies the strategies to get shares for
     */
    function getOperatorsShares(
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view returns (uint256[][] memory);

    /**
     * @notice Returns amount of withdrawable shares from an operator for a strategy that is still in the queue
     * and therefore slashable. Note that the *actual* slashable amount could be less than this value as this doesn't account
     * for amounts that have already been slashed. This assumes that none of the shares have been slashed.
     * @param operator the operator to get shares for
     * @param strategy the strategy to get shares for
     * @return the amount of shares that are slashable in the withdrawal queue for an operator and a strategy
     */
    function getSlashableSharesInQueue(address operator, IStrategy strategy) external view returns (uint256);

    /**
     * @notice Given a staker and a set of strategies, return the shares they can queue for withdrawal and the
     * corresponding depositShares.
     * This value depends on which operator the staker is delegated to.
     * The shares amount returned is the actual amount of Strategy shares the staker would receive (subject
     * to each strategy's underlying shares to token ratio).
     */
    function getWithdrawableShares(
        address staker,
        IStrategy[] memory strategies
    ) external view returns (uint256[] memory withdrawableShares, uint256[] memory depositShares);

    /**
     * @notice Returns the number of shares in storage for a staker and all their strategies
     */
    function getDepositedShares(
        address staker
    ) external view returns (IStrategy[] memory, uint256[] memory);

    /**
     * @notice Returns the scaling factor applied to a staker's deposits for a given strategy
     */
    function depositScalingFactor(address staker, IStrategy strategy) external view returns (uint256);

    /**
     * @notice Returns the Withdrawal associated with a `withdrawalRoot`.
     * @param withdrawalRoot The hash identifying the queued withdrawal.
     * @return withdrawal The withdrawal details.
     */
    function queuedWithdrawals(
        bytes32 withdrawalRoot
    ) external view returns (Withdrawal memory withdrawal);

    /**
     * @notice Returns the Withdrawal and corresponding shares associated with a `withdrawalRoot`
     * @param withdrawalRoot The hash identifying the queued withdrawal
     * @return withdrawal The withdrawal details
     * @return shares Array of shares corresponding to each strategy in the withdrawal
     * @dev The shares are what a user would receive from completing a queued withdrawal, assuming all slashings are applied
     * @dev Withdrawals queued before the slashing release cannot be queried with this method
     */
    function getQueuedWithdrawal(
        bytes32 withdrawalRoot
    ) external view returns (Withdrawal memory withdrawal, uint256[] memory shares);

    /**
     * @notice Returns all queued withdrawals and their corresponding shares for a staker.
     * @param staker The address of the staker to query withdrawals for.
     * @return withdrawals Array of Withdrawal structs containing details about each queued withdrawal.
     * @return shares 2D array of shares, where each inner array corresponds to the strategies in the withdrawal.
     * @dev The shares are what a user would receive from completing a queued withdrawal, assuming all slashings are applied.
     */
    function getQueuedWithdrawals(
        address staker
    ) external view returns (Withdrawal[] memory withdrawals, uint256[][] memory shares);

    /// @notice Returns a list of queued withdrawal roots for the `staker`.
    /// NOTE that this only returns withdrawals queued AFTER the slashing release.
    function getQueuedWithdrawalRoots(
        address staker
    ) external view returns (bytes32[] memory);

    /**
     * @notice Converts shares for a set of strategies to deposit shares, likely in order to input into `queueWithdrawals`.
     * This function will revert from a division by 0 error if any of the staker's strategies have a slashing factor of 0.
     * @param staker the staker to convert shares for
     * @param strategies the strategies to convert shares for
     * @param withdrawableShares the shares to convert
     * @return the deposit shares
     * @dev will be a few wei off due to rounding errors
     */
    function convertToDepositShares(
        address staker,
        IStrategy[] memory strategies,
        uint256[] memory withdrawableShares
    ) external view returns (uint256[] memory);

    /// @notice Returns the keccak256 hash of `withdrawal`.
    function calculateWithdrawalRoot(
        Withdrawal memory withdrawal
    ) external pure returns (bytes32);

    /**
     * @notice Calculates the digest hash to be signed by the operator's delegationApprove and used in the `delegateTo` function.
     * @param staker The account delegating their stake
     * @param operator The account receiving delegated stake
     * @param _delegationApprover the operator's `delegationApprover` who will be signing the delegationHash (in general)
     * @param approverSalt A unique and single use value associated with the approver signature.
     * @param expiry Time after which the approver's signature becomes invalid
     */
    function calculateDelegationApprovalDigestHash(
        address staker,
        address operator,
        address _delegationApprover,
        bytes32 approverSalt,
        uint256 expiry
    ) external view returns (bytes32);

    /// @notice return address of the beaconChainETHStrategy
    function beaconChainETHStrategy() external view returns (IStrategy);

    /**
     * @notice Returns the minimum withdrawal delay in blocks to pass for withdrawals queued to be completable.
     * Also applies to legacy withdrawals so any withdrawals not completed prior to the slashing upgrade will be subject
     * to this longer delay.
     * @dev Backwards-compatible interface to return the internal `MIN_WITHDRAWAL_DELAY_BLOCKS` value
     * @dev Previous value in storage was deprecated. See `__deprecated_minWithdrawalDelayBlocks`
     */
    function minWithdrawalDelayBlocks() external view returns (uint32);

    /// @notice The EIP-712 typehash for the DelegationApproval struct used by the contract
    function DELEGATION_APPROVAL_TYPEHASH() external view returns (bytes32);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol

interface IAllocationManagerErrors {
    /// Input Validation

    /// @dev Thrown when `wadToSlash` is zero or greater than 1e18
    error InvalidWadToSlash();
    /// @dev Thrown when two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @dev Thrown when the AVSRegistrar is not correctly configured to prevent an AVSRegistrar contract
    /// from being used with the wrong AVS
    error InvalidAVSRegistrar();

    /// Caller

    /// @dev Thrown when caller is not authorized to call a function.
    error InvalidCaller();

    /// Operator Status

    /// @dev Thrown when an invalid operator is provided.
    error InvalidOperator();
    /// @dev Thrown when an invalid avs whose metadata is not registered is provided.
    error NonexistentAVSMetadata();
    /// @dev Thrown when an operator's allocation delay has yet to be set.
    error UninitializedAllocationDelay();
    /// @dev Thrown when attempting to slash an operator when they are not slashable.
    error OperatorNotSlashable();
    /// @dev Thrown when trying to add an operator to a set they are already a member of
    error AlreadyMemberOfSet();
    /// @dev Thrown when trying to slash/remove an operator from a set they are not a member of
    error NotMemberOfSet();

    /// Operator Set Status

    /// @dev Thrown when an invalid operator set is provided.
    error InvalidOperatorSet();
    /// @dev Thrown when provided `strategies` are not in ascending order.
    error StrategiesMustBeInAscendingOrder();
    /// @dev Thrown when trying to add a strategy to an operator set that already contains it.
    error StrategyAlreadyInOperatorSet();
    /// @dev Thrown when a strategy is referenced that does not belong to an operator set.
    error StrategyNotInOperatorSet();

    /// Modifying Allocations

    /// @dev Thrown when an operator attempts to set their allocation for an operatorSet to the same value
    error SameMagnitude();
    /// @dev Thrown when an allocation is attempted for a given operator when they have pending allocations or deallocations.
    error ModificationAlreadyPending();
    /// @dev Thrown when an allocation is attempted that exceeds a given operators total allocatable magnitude.
    error InsufficientMagnitude();
}

interface IAllocationManagerTypes {
    /**
     * @notice Defines allocation information from a strategy to an operator set, for an operator
     * @param currentMagnitude the current magnitude allocated from the strategy to the operator set
     * @param pendingDiff a pending change in magnitude, if it exists (0 otherwise)
     * @param effectBlock the block at which the pending magnitude diff will take effect
     */
    struct Allocation {
        uint64 currentMagnitude;
        int128 pendingDiff;
        uint32 effectBlock;
    }

    /**
     * @notice Struct containing allocation delay metadata for a given operator.
     * @param delay Current allocation delay
     * @param isSet Whether the operator has initially set an allocation delay. Note that this could be false but the
     * block.number >= effectBlock in which we consider their delay to be configured and active.
     * @param pendingDelay The delay that will take effect after `effectBlock`
     * @param effectBlock The block number after which a pending delay will take effect
     */
    struct AllocationDelayInfo {
        uint32 delay;
        bool isSet;
        uint32 pendingDelay;
        uint32 effectBlock;
    }

    /**
     * @notice Contains registration details for an operator pertaining to an operator set
     * @param registered Whether the operator is currently registered for the operator set
     * @param slashableUntil If the operator is not registered, they are still slashable until
     * this block is reached.
     */
    struct RegistrationStatus {
        bool registered;
        uint32 slashableUntil;
    }

    /**
     * @notice Contains allocation info for a specific strategy
     * @param maxMagnitude the maximum magnitude that can be allocated between all operator sets
     * @param encumberedMagnitude the currently-allocated magnitude for the strategy
     */
    struct StrategyInfo {
        uint64 maxMagnitude;
        uint64 encumberedMagnitude;
    }

    /**
     * @notice Struct containing parameters to slashing
     * @param operator the address to slash
     * @param operatorSetId the ID of the operatorSet the operator is being slashed on behalf of
     * @param strategies the set of strategies to slash
     * @param wadsToSlash the parts in 1e18 to slash, this will be proportional to the operator's
     * slashable stake allocation for the operatorSet
     * @param description the description of the slashing provided by the AVS for legibility
     */
    struct SlashingParams {
        address operator;
        uint32 operatorSetId;
        IStrategy[] strategies;
        uint256[] wadsToSlash;
        string description;
    }

    /**
     * @notice struct used to modify the allocation of slashable magnitude to an operator set
     * @param operatorSet the operator set to modify the allocation for
     * @param strategies the strategies to modify allocations for
     * @param newMagnitudes the new magnitude to allocate for each strategy to this operator set
     */
    struct AllocateParams {
        OperatorSet operatorSet;
        IStrategy[] strategies;
        uint64[] newMagnitudes;
    }

    /**
     * @notice Parameters used to register for an AVS's operator sets
     * @param avs the AVS being registered for
     * @param operatorSetIds the operator sets within the AVS to register for
     * @param data extra data to be passed to the AVS to complete registration
     */
    struct RegisterParams {
        address avs;
        uint32[] operatorSetIds;
        bytes data;
    }

    /**
     * @notice Parameters used to deregister from an AVS's operator sets
     * @param operator the operator being deregistered
     * @param avs the avs being deregistered from
     * @param operatorSetIds the operator sets within the AVS being deregistered from
     */
    struct DeregisterParams {
        address operator;
        address avs;
        uint32[] operatorSetIds;
    }

    /**
     * @notice Parameters used by an AVS to create new operator sets
     * @param operatorSetId the id of the operator set to create
     * @param strategies the strategies to add as slashable to the operator set
     */
    struct CreateSetParams {
        uint32 operatorSetId;
        IStrategy[] strategies;
    }
}

interface IAllocationManagerEvents is IAllocationManagerTypes {
    /// @notice Emitted when operator updates their allocation delay.
    event AllocationDelaySet(address operator, uint32 delay, uint32 effectBlock);

    /// @notice Emitted when an operator's magnitude is updated for a given operatorSet and strategy
    event AllocationUpdated(
        address operator, OperatorSet operatorSet, IStrategy strategy, uint64 magnitude, uint32 effectBlock
    );

    /// @notice Emitted when operator's encumbered magnitude is updated for a given strategy
    event EncumberedMagnitudeUpdated(address operator, IStrategy strategy, uint64 encumberedMagnitude);

    /// @notice Emitted when an operator's max magnitude is updated for a given strategy
    event MaxMagnitudeUpdated(address operator, IStrategy strategy, uint64 maxMagnitude);

    /// @notice Emitted when an operator is slashed by an operator set for a strategy
    /// `wadSlashed` is the proportion of the operator's total delegated stake that was slashed
    event OperatorSlashed(
        address operator, OperatorSet operatorSet, IStrategy[] strategies, uint256[] wadSlashed, string description
    );

    /// @notice Emitted when an AVS configures the address that will handle registration/deregistration
    event AVSRegistrarSet(address avs, IAVSRegistrar registrar);

    /// @notice Emitted when an AVS updates their metadata URI (Uniform Resource Identifier).
    /// @dev The URI is never stored; it is simply emitted through an event for off-chain indexing.
    event AVSMetadataURIUpdated(address indexed avs, string metadataURI);

    /// @notice Emitted when an operator set is created by an AVS.
    event OperatorSetCreated(OperatorSet operatorSet);

    /// @notice Emitted when an operator is added to an operator set.
    event OperatorAddedToOperatorSet(address indexed operator, OperatorSet operatorSet);

    /// @notice Emitted when an operator is removed from an operator set.
    event OperatorRemovedFromOperatorSet(address indexed operator, OperatorSet operatorSet);

    /// @notice Emitted when a strategy is added to an operator set.
    event StrategyAddedToOperatorSet(OperatorSet operatorSet, IStrategy strategy);

    /// @notice Emitted when a strategy is removed from an operator set.
    event StrategyRemovedFromOperatorSet(OperatorSet operatorSet, IStrategy strategy);
}

interface IAllocationManager is IAllocationManagerErrors, IAllocationManagerEvents, ISemVerMixin {
    /**
     * @dev Initializes the initial owner and paused status.
     */
    function initialize(address initialOwner, uint256 initialPausedStatus) external;

    /**
     * @notice Called by an AVS to slash an operator in a given operator set. The operator must be registered
     * and have slashable stake allocated to the operator set.
     *
     * @param avs The AVS address initiating the slash.
     * @param params The slashing parameters, containing:
     *  - operator: The operator to slash.
     *  - operatorSetId: The ID of the operator set the operator is being slashed from.
     *  - strategies: Array of strategies to slash allocations from (must be in ascending order).
     *  - wadsToSlash: Array of proportions to slash from each strategy (must be between 0 and 1e18).
     *  - description: Description of why the operator was slashed.
     *
     * @dev For each strategy:
     *      1. Reduces the operator's current allocation magnitude by wadToSlash proportion.
     *      2. Reduces the strategy's max and encumbered magnitudes proportionally.
     *      3. If there is a pending deallocation, reduces it proportionally.
     *      4. Updates the operator's shares in the DelegationManager.
     *
     * @dev Small slashing amounts may not result in actual token burns due to
     *      rounding, which will result in small amounts of tokens locked in the contract
     *      rather than fully burning through the burn mechanism.
     */
    function slashOperator(address avs, SlashingParams calldata params) external;

    /**
     * @notice Modifies the proportions of slashable stake allocated to an operator set from a list of strategies
     * Note that deallocations remain slashable for DEALLOCATION_DELAY blocks therefore when they are cleared they may
     * free up less allocatable magnitude than initially deallocated.
     * @param operator the operator to modify allocations for
     * @param params array of magnitude adjustments for one or more operator sets
     * @dev Updates encumberedMagnitude for the updated strategies
     */
    function modifyAllocations(address operator, AllocateParams[] calldata params) external;

    /**
     * @notice This function takes a list of strategies and for each strategy, removes from the deallocationQueue
     * all clearable deallocations up to max `numToClear` number of deallocations, updating the encumberedMagnitude
     * of the operator as needed.
     *
     * @param operator address to clear deallocations for
     * @param strategies a list of strategies to clear deallocations for
     * @param numToClear a list of number of pending deallocations to clear for each strategy
     *
     * @dev can be called permissionlessly by anyone
     */
    function clearDeallocationQueue(
        address operator,
        IStrategy[] calldata strategies,
        uint16[] calldata numToClear
    ) external;

    /**
     * @notice Allows an operator to register for one or more operator sets for an AVS. If the operator
     * has any stake allocated to these operator sets, it immediately becomes slashable.
     * @dev After registering within the ALM, this method calls the AVS Registrar's `IAVSRegistrar.
     * registerOperator` method to complete registration. This call MUST succeed in order for
     * registration to be successful.
     */
    function registerForOperatorSets(address operator, RegisterParams calldata params) external;

    /**
     * @notice Allows an operator or AVS to deregister the operator from one or more of the AVS's operator sets.
     * If the operator has any slashable stake allocated to the AVS, it remains slashable until the
     * DEALLOCATION_DELAY has passed.
     * @dev After deregistering within the ALM, this method calls the AVS Registrar's `IAVSRegistrar.
     * deregisterOperator` method to complete deregistration. This call MUST succeed in order for
     * deregistration to be successful.
     */
    function deregisterFromOperatorSets(
        DeregisterParams calldata params
    ) external;

    /**
     * @notice Called by the delegation manager OR an operator to set an operator's allocation delay.
     * This is set when the operator first registers, and is the number of blocks between an operator
     * allocating magnitude to an operator set, and the magnitude becoming slashable.
     * @param operator The operator to set the delay on behalf of.
     * @param delay the allocation delay in blocks
     */
    function setAllocationDelay(address operator, uint32 delay) external;

    /**
     * @notice Called by an AVS to configure the address that is called when an operator registers
     * or is deregistered from the AVS's operator sets. If not set (or set to 0), defaults
     * to the AVS's address.
     * @param registrar the new registrar address
     */
    function setAVSRegistrar(address avs, IAVSRegistrar registrar) external;

    /**
     *  @notice Called by an AVS to emit an `AVSMetadataURIUpdated` event indicating the information has updated.
     *
     *  @param metadataURI The URI for metadata associated with an AVS.
     *
     *  @dev Note that the `metadataURI` is *never stored* and is only emitted in the `AVSMetadataURIUpdated` event.
     */
    function updateAVSMetadataURI(address avs, string calldata metadataURI) external;

    /**
     * @notice Allows an AVS to create new operator sets, defining strategies that the operator set uses
     */
    function createOperatorSets(address avs, CreateSetParams[] calldata params) external;

    /**
     * @notice Allows an AVS to add strategies to an operator set
     * @dev Strategies MUST NOT already exist in the operator set
     * @param avs the avs to set strategies for
     * @param operatorSetId the operator set to add strategies to
     * @param strategies the strategies to add
     */
    function addStrategiesToOperatorSet(address avs, uint32 operatorSetId, IStrategy[] calldata strategies) external;

    /**
     * @notice Allows an AVS to remove strategies from an operator set
     * @dev Strategies MUST already exist in the operator set
     * @param avs the avs to remove strategies for
     * @param operatorSetId the operator set to remove strategies from
     * @param strategies the strategies to remove
     */
    function removeStrategiesFromOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external;

    /**
     *
     *                         VIEW FUNCTIONS
     *
     */

    /**
     * @notice Returns the number of operator sets for the AVS
     * @param avs the AVS to query
     */
    function getOperatorSetCount(
        address avs
    ) external view returns (uint256);

    /**
     * @notice Returns the list of operator sets the operator has current or pending allocations/deallocations in
     * @param operator the operator to query
     * @return the list of operator sets the operator has current or pending allocations/deallocations in
     */
    function getAllocatedSets(
        address operator
    ) external view returns (OperatorSet[] memory);

    /**
     * @notice Returns the list of strategies an operator has current or pending allocations/deallocations from
     * given a specific operator set.
     * @param operator the operator to query
     * @param operatorSet the operator set to query
     * @return the list of strategies
     */
    function getAllocatedStrategies(
        address operator,
        OperatorSet memory operatorSet
    ) external view returns (IStrategy[] memory);

    /**
     * @notice Returns the current/pending stake allocation an operator has from a strategy to an operator set
     * @param operator the operator to query
     * @param operatorSet the operator set to query
     * @param strategy the strategy to query
     * @return the current/pending stake allocation
     */
    function getAllocation(
        address operator,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view returns (Allocation memory);

    /**
     * @notice Returns the current/pending stake allocations for multiple operators from a strategy to an operator set
     * @param operators the operators to query
     * @param operatorSet the operator set to query
     * @param strategy the strategy to query
     * @return each operator's allocation
     */
    function getAllocations(
        address[] memory operators,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view returns (Allocation[] memory);

    /**
     * @notice Given a strategy, returns a list of operator sets and corresponding stake allocations.
     * @dev Note that this returns a list of ALL operator sets the operator has allocations in. This means
     * some of the returned allocations may be zero.
     * @param operator the operator to query
     * @param strategy the strategy to query
     * @return the list of all operator sets the operator has allocations for
     * @return the corresponding list of allocations from the specific `strategy`
     */
    function getStrategyAllocations(
        address operator,
        IStrategy strategy
    ) external view returns (OperatorSet[] memory, Allocation[] memory);

    /**
     * @notice For a strategy, get the amount of magnitude that is allocated across one or more operator sets
     * @param operator the operator to query
     * @param strategy the strategy to get allocatable magnitude for
     * @return currently allocated magnitude
     */
    function getEncumberedMagnitude(address operator, IStrategy strategy) external view returns (uint64);

    /**
     * @notice For a strategy, get the amount of magnitude not currently allocated to any operator set
     * @param operator the operator to query
     * @param strategy the strategy to get allocatable magnitude for
     * @return magnitude available to be allocated to an operator set
     */
    function getAllocatableMagnitude(address operator, IStrategy strategy) external view returns (uint64);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategy
     * @dev The max magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the max magnitude of the operator.
     * @param operator the operator to query
     * @param strategy the strategy to get the max magnitude for
     * @return the max magnitude for the strategy
     */
    function getMaxMagnitude(address operator, IStrategy strategy) external view returns (uint64);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategies
     * @dev The max magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the max magnitude of the operator.
     * @param operator the operator to query
     * @param strategies the strategies to get the max magnitudes for
     * @return the max magnitudes for each strategy
     */
    function getMaxMagnitudes(
        address operator,
        IStrategy[] calldata strategies
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the maximum magnitudes each operator can allocate for the given strategy
     * @dev The max magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the max magnitude of the operator.
     * @param operators the operators to query
     * @param strategy the strategy to get the max magnitudes for
     * @return the max magnitudes for each operator
     */
    function getMaxMagnitudes(
        address[] calldata operators,
        IStrategy strategy
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategies
     * at a given block number
     * @dev The max magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the max magnitude of the operator.
     * @param operator the operator to query
     * @param strategies the strategies to get the max magnitudes for
     * @param blockNumber the blockNumber at which to check the max magnitudes
     * @return the max magnitudes for each strategy
     */
    function getMaxMagnitudesAtBlock(
        address operator,
        IStrategy[] calldata strategies,
        uint32 blockNumber
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the time in blocks between an operator allocating slashable magnitude
     * and the magnitude becoming slashable. If the delay has not been set, `isSet` will be false.
     * @dev The operator must have a configured delay before allocating magnitude
     * @param operator The operator to query
     * @return isSet Whether the operator has configured a delay
     * @return delay The time in blocks between allocating magnitude and magnitude becoming slashable
     */
    function getAllocationDelay(
        address operator
    ) external view returns (bool isSet, uint32 delay);

    /**
     * @notice Returns a list of all operator sets the operator is registered for
     * @param operator The operator address to query.
     */
    function getRegisteredSets(
        address operator
    ) external view returns (OperatorSet[] memory operatorSets);

    /**
     * @notice Returns whether the operator is registered for the operator set
     * @param operator The operator to query
     * @param operatorSet The operator set to query
     */
    function isMemberOfOperatorSet(address operator, OperatorSet memory operatorSet) external view returns (bool);

    /**
     * @notice Returns whether the operator set exists
     */
    function isOperatorSet(
        OperatorSet memory operatorSet
    ) external view returns (bool);

    /**
     * @notice Returns all the operators registered to an operator set
     * @param operatorSet The operatorSet to query.
     */
    function getMembers(
        OperatorSet memory operatorSet
    ) external view returns (address[] memory operators);

    /**
     * @notice Returns the number of operators registered to an operatorSet.
     * @param operatorSet The operatorSet to get the member count for
     */
    function getMemberCount(
        OperatorSet memory operatorSet
    ) external view returns (uint256);

    /**
     * @notice Returns the address that handles registration/deregistration for the AVS
     * If not set, defaults to the input address (`avs`)
     */
    function getAVSRegistrar(
        address avs
    ) external view returns (IAVSRegistrar);

    /**
     * @notice Returns an array of strategies in the operatorSet.
     * @param operatorSet The operatorSet to query.
     */
    function getStrategiesInOperatorSet(
        OperatorSet memory operatorSet
    ) external view returns (IStrategy[] memory strategies);

    /**
     * @notice Returns the minimum amount of stake that will be slashable as of some future block,
     * according to each operator's allocation from each strategy to the operator set. Note that this function
     * will return 0 for the slashable stake if the operator is not slashable at the time of the call.
     * @dev This method queries actual delegated stakes in the DelegationManager and applies
     * each operator's allocation to the stake to produce the slashable stake each allocation
     * represents. This method does not consider slashable stake in the withdrawal queue even though there could be
     * slashable stake in the queue.
     * @dev This minimum takes into account `futureBlock`, and will omit any pending magnitude
     * diffs that will not be in effect as of `futureBlock`. NOTE that in order to get the true
     * minimum slashable stake as of some future block, `futureBlock` MUST be greater than block.number
     * @dev NOTE that `futureBlock` should be fewer than `DEALLOCATION_DELAY` blocks in the future,
     * or the values returned from this method may not be accurate due to deallocations.
     * @param operatorSet the operator set to query
     * @param operators the list of operators whose slashable stakes will be returned
     * @param strategies the strategies that each slashable stake corresponds to
     * @param futureBlock the block at which to get allocation information. Should be a future block.
     */
    function getMinimumSlashableStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies,
        uint32 futureBlock
    ) external view returns (uint256[][] memory slashableStake);

    /**
     * @notice Returns the current allocated stake, irrespective of the operator's slashable status for the operatorSet.
     * @param operatorSet the operator set to query
     * @param operators the operators to query
     * @param strategies the strategies to query
     */
    function getAllocatedStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view returns (uint256[][] memory slashableStake);

    /**
     * @notice Returns whether an operator is slashable by an operator set.
     * This returns true if the operator is registered or their slashableUntil block has not passed.
     * This is because even when operators are deregistered, they still remain slashable for a period of time.
     * @param operator the operator to check slashability for
     * @param operatorSet the operator set to check slashability for
     */
    function isOperatorSlashable(address operator, OperatorSet memory operatorSet) external view returns (bool);
}

// src/interfaces/ISlasher.sol

interface ISlasherErrors {
    /// @notice Thrown when a caller without slasher privileges attempts a restricted operation
    error OnlySlasher();
}

interface ISlasherTypes {
    /// @notice Structure containing details about a slashing request
    struct SlashingRequest {
        IAllocationManagerTypes.SlashingParams params;
        uint256 requestTimestamp;
    }
}

interface ISlasherEvents is ISlasherTypes {
    /// @notice Emitted when an operator is successfully slashed
    event OperatorSlashed(
        uint256 indexed slashingRequestId,
        address indexed operator,
        uint32 indexed operatorSetId,
        uint256[] wadsToSlash,
        string description
    );
}

/// @title ISlasher
/// @notice Base interface containing shared functionality for all slasher implementations
interface ISlasher is ISlasherErrors, ISlasherEvents {
    /// @notice Returns the address authorized to create and fulfil slashing requests
    function slasher() external view returns (address);

    /// @notice Returns the next slashing request ID
    function nextRequestId() external view returns (uint256);
}

// src/interfaces/IVetoableSlasher.sol

interface IVetoableSlasherErrors {
    /// @notice Thrown when a caller without veto committee privileges attempts a restricted operation
    error OnlyVetoCommittee();
    /// @notice Thrown when attempting to veto a slashing request after the veto period has expired
    error VetoPeriodPassed();
    /// @notice Thrown when attempting to execute a slashing request before the veto period has ended
    error VetoPeriodNotPassed();
    /// @notice Thrown when attempting to interact with a slashing request that has been cancelled
    error SlashingRequestIsCancelled();
    /// @notice Thrown when attempting to modify a slashing request that does not exist
    error SlashingRequestNotRequested();
}

interface IVetoableSlasherTypes {
    /// @notice Structure containing details about a vetoable slashing request
    struct VetoableSlashingRequest {
        IAllocationManagerTypes.SlashingParams params;
        uint256 requestBlock;
        bool isPending;
    }
}

interface IVetoableSlasherEvents {
    /// @notice Emitted when a new slashing request is created
    event SlashingRequested(
        uint256 indexed requestId,
        address indexed operator,
        uint32 operatorSetId,
        uint256[] wadsToSlash,
        string description
    );

    /// @notice Emitted when a slashing request is cancelled by the veto committee
    event SlashingRequestCancelled(
        address indexed operator, uint32 operatorSetId, uint256[] wadsToSlash, string description
    );

    /// @notice Emitted when a slashing request is fulfilled
    event SlashingRequestFulfilled(
        address indexed operator, uint32 operatorSetId, uint256[] wadsToSlash, string description
    );
}

/// @title IVetoableSlasher
/// @notice A slashing contract that implements a veto mechanism allowing a designated committee to cancel slashing requests
/// @dev Extends base interfaces and adds a veto period during which slashing requests can be cancelled
interface IVetoableSlasher is
    ISlasher,
    IVetoableSlasherErrors,
    IVetoableSlasherTypes,
    IVetoableSlasherEvents
{
    /// @notice Duration of the veto period during which the veto committee can cancel slashing requests
    function vetoWindowBlocks() external view returns (uint32);

    /// @notice Address of the committee that has veto power over slashing requests
    function vetoCommittee() external view returns (address);

    /// @notice Queues a new slashing request
    /// @param params Parameters defining the slashing request including operator and amount
    /// @dev Can only be called by the authorized slasher
    function queueSlashingRequest(
        IAllocationManagerTypes.SlashingParams calldata params
    ) external;

    /// @notice Cancels a pending slashing request
    /// @param requestId The ID of the slashing request to cancel
    /// @dev Can only be called by the veto committee during the veto period
    function cancelSlashingRequest(
        uint256 requestId
    ) external;

    /// @notice Executes a slashing request after the veto period has passed
    /// @param requestId The ID of the slashing request to fulfil
    /// @dev Can only be called by the authorized slasher after the veto period
    function fulfilSlashingRequest(
        uint256 requestId
    ) external;
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IEigenPod.sol

interface IEigenPodErrors {
    /// @dev Thrown when msg.sender is not the EPM.
    error OnlyEigenPodManager();
    /// @dev Thrown when msg.sender is not the pod owner.
    error OnlyEigenPodOwner();
    /// @dev Thrown when msg.sender is not owner or the proof submitter.
    error OnlyEigenPodOwnerOrProofSubmitter();
    /// @dev Thrown when attempting an action that is currently paused.
    error CurrentlyPaused();

    /// Invalid Inputs

    /// @dev Thrown when an address of zero is provided.
    error InputAddressZero();
    /// @dev Thrown when two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @dev Thrown when `validatorPubKey` length is not equal to 48-bytes.
    error InvalidPubKeyLength();
    /// @dev Thrown when provided timestamp is out of range.
    error TimestampOutOfRange();

    /// Checkpoints

    /// @dev Thrown when no active checkpoints are found.
    error NoActiveCheckpoint();
    /// @dev Thrown if an uncompleted checkpoint exists.
    error CheckpointAlreadyActive();
    /// @dev Thrown if there's not a balance available to checkpoint.
    error NoBalanceToCheckpoint();
    /// @dev Thrown when attempting to create a checkpoint twice within a given block.
    error CannotCheckpointTwiceInSingleBlock();

    /// Withdrawing

    /// @dev Thrown when amount exceeds `restakedExecutionLayerGwei`.
    error InsufficientWithdrawableBalance();

    /// Validator Status

    /// @dev Thrown when a validator's withdrawal credentials have already been verified.
    error CredentialsAlreadyVerified();
    /// @dev Thrown if the provided proof is not valid for this EigenPod.
    error WithdrawalCredentialsNotForEigenPod();
    /// @dev Thrown when a validator is not in the ACTIVE status in the pod.
    error ValidatorNotActiveInPod();
    /// @dev Thrown when validator is not active yet on the beacon chain.
    error ValidatorInactiveOnBeaconChain();
    /// @dev Thrown if a validator is exiting the beacon chain.
    error ValidatorIsExitingBeaconChain();
    /// @dev Thrown when a validator has not been slashed on the beacon chain.
    error ValidatorNotSlashedOnBeaconChain();

    /// Misc

    /// @dev Thrown when an invalid block root is returned by the EIP-4788 oracle.
    error InvalidEIP4788Response();
    /// @dev Thrown when attempting to send an invalid amount to the beacon deposit contract.
    error MsgValueNot32ETH();
    /// @dev Thrown when provided `beaconTimestamp` is too far in the past.
    error BeaconTimestampTooFarInPast();
    /// @dev Thrown when the pectraForkTimestamp returned from the EigenPodManager is zero
    error ForkTimestampZero();
}

interface IEigenPodTypes {
    enum VALIDATOR_STATUS {
        INACTIVE, // doesnt exist
        ACTIVE, // staked on ethpos and withdrawal credentials are pointed to the EigenPod
        WITHDRAWN // withdrawn from the Beacon Chain

    }

    struct ValidatorInfo {
        // index of the validator in the beacon chain
        uint64 validatorIndex;
        // amount of beacon chain ETH restaked on EigenLayer in gwei
        uint64 restakedBalanceGwei;
        //timestamp of the validator's most recent balance update
        uint64 lastCheckpointedAt;
        // status of the validator
        VALIDATOR_STATUS status;
    }

    struct Checkpoint {
        bytes32 beaconBlockRoot;
        uint24 proofsRemaining;
        uint64 podBalanceGwei;
        int64 balanceDeltasGwei;
        uint64 prevBeaconBalanceGwei;
    }
}

interface IEigenPodEvents is IEigenPodTypes {
    /// @notice Emitted when an ETH validator stakes via this eigenPod
    event EigenPodStaked(bytes pubkey);

    /// @notice Emitted when a pod owner updates the proof submitter address
    event ProofSubmitterUpdated(address prevProofSubmitter, address newProofSubmitter);

    /// @notice Emitted when an ETH validator's withdrawal credentials are successfully verified to be pointed to this eigenPod
    event ValidatorRestaked(uint40 validatorIndex);

    /// @notice Emitted when an ETH validator's  balance is proven to be updated.  Here newValidatorBalanceGwei
    //  is the validator's balance that is credited on EigenLayer.
    event ValidatorBalanceUpdated(uint40 validatorIndex, uint64 balanceTimestamp, uint64 newValidatorBalanceGwei);

    /// @notice Emitted when restaked beacon chain ETH is withdrawn from the eigenPod.
    event RestakedBeaconChainETHWithdrawn(address indexed recipient, uint256 amount);

    /// @notice Emitted when ETH is received via the `receive` fallback
    event NonBeaconChainETHReceived(uint256 amountReceived);

    /// @notice Emitted when a checkpoint is created
    event CheckpointCreated(
        uint64 indexed checkpointTimestamp, bytes32 indexed beaconBlockRoot, uint256 validatorCount
    );

    /// @notice Emitted when a checkpoint is finalized
    event CheckpointFinalized(uint64 indexed checkpointTimestamp, int256 totalShareDeltaWei);

    /// @notice Emitted when a validator is proven for a given checkpoint
    event ValidatorCheckpointed(uint64 indexed checkpointTimestamp, uint40 indexed validatorIndex);

    /// @notice Emitted when a validaor is proven to have 0 balance at a given checkpoint
    event ValidatorWithdrawn(uint64 indexed checkpointTimestamp, uint40 indexed validatorIndex);
}

/**
 * @title The implementation contract used for restaking beacon chain ETH on EigenLayer
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @dev Note that all beacon chain balances are stored as gwei within the beacon chain datastructures. We choose
 *   to account balances in terms of gwei in the EigenPod contract and convert to wei when making calls to other contracts
 */
interface IEigenPod is IEigenPodErrors, IEigenPodEvents, ISemVerMixin {
    /// @notice Used to initialize the pointers to contracts crucial to the pod's functionality, in beacon proxy construction from EigenPodManager
    function initialize(
        address owner
    ) external;

    /// @notice Called by EigenPodManager when the owner wants to create another ETH validator.
    /// @dev This function only supports staking to a 0x01 validator. For compounding validators, please interact directly with the deposit contract.
    function stake(bytes calldata pubkey, bytes calldata signature, bytes32 depositDataRoot) external payable;

    /**
     * @notice Transfers `amountWei` in ether from this contract to the specified `recipient` address
     * @notice Called by EigenPodManager to withdrawBeaconChainETH that has been added to the EigenPod's balance due to a withdrawal from the beacon chain.
     * @dev The podOwner must have already proved sufficient withdrawals, so that this pod's `restakedExecutionLayerGwei` exceeds the
     * `amountWei` input (when converted to GWEI).
     * @dev Reverts if `amountWei` is not a whole Gwei amount
     */
    function withdrawRestakedBeaconChainETH(address recipient, uint256 amount) external;

    /**
     * @dev Create a checkpoint used to prove this pod's active validator set. Checkpoints are completed
     * by submitting one checkpoint proof per ACTIVE validator. During the checkpoint process, the total
     * change in ACTIVE validator balance is tracked, and any validators with 0 balance are marked `WITHDRAWN`.
     * @dev Once finalized, the pod owner is awarded shares corresponding to:
     * - the total change in their ACTIVE validator balances
     * - any ETH in the pod not already awarded shares
     * @dev A checkpoint cannot be created if the pod already has an outstanding checkpoint. If
     * this is the case, the pod owner MUST complete the existing checkpoint before starting a new one.
     * @param revertIfNoBalance Forces a revert if the pod ETH balance is 0. This allows the pod owner
     * to prevent accidentally starting a checkpoint that will not increase their shares
     */
    function startCheckpoint(
        bool revertIfNoBalance
    ) external;

    /**
     * @dev Progress the current checkpoint towards completion by submitting one or more validator
     * checkpoint proofs. Anyone can call this method to submit proofs towards the current checkpoint.
     * For each validator proven, the current checkpoint's `proofsRemaining` decreases.
     * @dev If the checkpoint's `proofsRemaining` reaches 0, the checkpoint is finalized.
     * (see `_updateCheckpoint` for more details)
     * @dev This method can only be called when there is a currently-active checkpoint.
     * @param balanceContainerProof proves the beacon's current balance container root against a checkpoint's `beaconBlockRoot`
     * @param proofs Proofs for one or more validator current balances against the `balanceContainerRoot`
     */
    function verifyCheckpointProofs(
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external;

    /**
     * @dev Verify one or more validators have their withdrawal credentials pointed at this EigenPod, and award
     * shares based on their effective balance. Proven validators are marked `ACTIVE` within the EigenPod, and
     * future checkpoint proofs will need to include them.
     * @dev Withdrawal credential proofs MUST NOT be older than `currentCheckpointTimestamp`.
     * @dev Validators proven via this method MUST NOT have an exit epoch set already.
     * @param beaconTimestamp the beacon chain timestamp sent to the 4788 oracle contract. Corresponds
     * to the parent beacon block root against which the proof is verified.
     * @param stateRootProof proves a beacon state root against a beacon block root
     * @param validatorIndices a list of validator indices being proven
     * @param validatorFieldsProofs proofs of each validator's `validatorFields` against the beacon state root
     * @param validatorFields the fields of the beacon chain "Validator" container. See consensus specs for
     * details: https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator
     */
    function verifyWithdrawalCredentials(
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external;

    /**
     * @dev Prove that one of this pod's active validators was slashed on the beacon chain. A successful
     * staleness proof allows the caller to start a checkpoint.
     *
     * @dev Note that in order to start a checkpoint, any existing checkpoint must already be completed!
     * (See `_startCheckpoint` for details)
     *
     * @dev Note that this method allows anyone to start a checkpoint as soon as a slashing occurs on the beacon
     * chain. This is intended to make it easier to external watchers to keep a pod's balance up to date.
     *
     * @dev Note too that beacon chain slashings are not instant. There is a delay between the initial slashing event
     * and the validator's final exit back to the execution layer. During this time, the validator's balance may or
     * may not drop further due to a correlation penalty. This method allows proof of a slashed validator
     * to initiate a checkpoint for as long as the validator remains on the beacon chain. Once the validator
     * has exited and been checkpointed at 0 balance, they are no longer "checkpoint-able" and cannot be proven
     * "stale" via this method.
     * See https://eth2book.info/capella/part3/transition/epoch/#slashings for more info.
     *
     * @param beaconTimestamp the beacon chain timestamp sent to the 4788 oracle contract. Corresponds
     * to the parent beacon block root against which the proof is verified.
     * @param stateRootProof proves a beacon state root against a beacon block root
     * @param proof the fields of the beacon chain "Validator" container, along with a merkle proof against
     * the beacon state root. See the consensus specs for more details:
     * https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator
     *
     * @dev Staleness conditions:
     * - Validator's last checkpoint is older than `beaconTimestamp`
     * - Validator MUST be in `ACTIVE` status in the pod
     * - Validator MUST be slashed on the beacon chain
     */
    function verifyStaleBalance(
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        BeaconChainProofs.ValidatorProof calldata proof
    ) external;

    /// @notice called by owner of a pod to remove any ERC20s deposited in the pod
    function recoverTokens(IERC20[] memory tokenList, uint256[] memory amountsToWithdraw, address recipient) external;

    /// @notice Allows the owner of a pod to update the proof submitter, a permissioned
    /// address that can call `startCheckpoint` and `verifyWithdrawalCredentials`.
    /// @dev Note that EITHER the podOwner OR proofSubmitter can access these methods,
    /// so it's fine to set your proofSubmitter to 0 if you want the podOwner to be the
    /// only address that can call these methods.
    /// @param newProofSubmitter The new proof submitter address. If set to 0, only the
    /// pod owner will be able to call `startCheckpoint` and `verifyWithdrawalCredentials`
    function setProofSubmitter(
        address newProofSubmitter
    ) external;

    /**
     *
     *                                VIEW METHODS
     *
     */

    /// @notice An address with permissions to call `startCheckpoint` and `verifyWithdrawalCredentials`, set
    /// by the podOwner. This role exists to allow a podOwner to designate a hot wallet that can call
    /// these methods, allowing the podOwner to remain a cold wallet that is only used to manage funds.
    /// @dev If this address is NOT set, only the podOwner can call `startCheckpoint` and `verifyWithdrawalCredentials`
    function proofSubmitter() external view returns (address);

    /// @notice the amount of execution layer ETH in this contract that is staked in EigenLayer (i.e. withdrawn from beaconchain but not EigenLayer),
    function withdrawableRestakedExecutionLayerGwei() external view returns (uint64);

    /// @notice The single EigenPodManager for EigenLayer
    function eigenPodManager() external view returns (IEigenPodManager);

    /// @notice The owner of this EigenPod
    function podOwner() external view returns (address);

    /// @notice Returns the validatorInfo struct for the provided pubkeyHash
    function validatorPubkeyHashToInfo(
        bytes32 validatorPubkeyHash
    ) external view returns (ValidatorInfo memory);

    /// @notice Returns the validatorInfo struct for the provided pubkey
    function validatorPubkeyToInfo(
        bytes calldata validatorPubkey
    ) external view returns (ValidatorInfo memory);

    /// @notice This returns the status of a given validator
    function validatorStatus(
        bytes32 pubkeyHash
    ) external view returns (VALIDATOR_STATUS);

    /// @notice This returns the status of a given validator pubkey
    function validatorStatus(
        bytes calldata validatorPubkey
    ) external view returns (VALIDATOR_STATUS);

    /// @notice Number of validators with proven withdrawal credentials, who do not have proven full withdrawals
    function activeValidatorCount() external view returns (uint256);

    /// @notice The timestamp of the last checkpoint finalized
    function lastCheckpointTimestamp() external view returns (uint64);

    /// @notice The timestamp of the currently-active checkpoint. Will be 0 if there is not active checkpoint
    function currentCheckpointTimestamp() external view returns (uint64);

    /// @notice Returns the currently-active checkpoint
    function currentCheckpoint() external view returns (Checkpoint memory);

    /// @notice For each checkpoint, the total balance attributed to exited validators, in gwei
    ///
    /// NOTE that the values added to this mapping are NOT guaranteed to capture the entirety of a validator's
    /// exit - rather, they capture the total change in a validator's balance when a checkpoint shows their
    /// balance change from nonzero to zero. While a change from nonzero to zero DOES guarantee that a validator
    /// has been fully exited, it is possible that the magnitude of this change does not capture what is
    /// typically thought of as a "full exit."
    ///
    /// For example:
    /// 1. Consider a validator was last checkpointed at 32 ETH before exiting. Once the exit has been processed,
    /// it is expected that the validator's exited balance is calculated to be `32 ETH`.
    /// 2. However, before `startCheckpoint` is called, a deposit is made to the validator for 1 ETH. The beacon
    /// chain will automatically withdraw this ETH, but not until the withdrawal sweep passes over the validator
    /// again. Until this occurs, the validator's current balance (used for checkpointing) is 1 ETH.
    /// 3. If `startCheckpoint` is called at this point, the balance delta calculated for this validator will be
    /// `-31 ETH`, and because the validator has a nonzero balance, it is not marked WITHDRAWN.
    /// 4. After the exit is processed by the beacon chain, a subsequent `startCheckpoint` and checkpoint proof
    /// will calculate a balance delta of `-1 ETH` and attribute a 1 ETH exit to the validator.
    ///
    /// If this edge case impacts your usecase, it should be possible to mitigate this by monitoring for deposits
    /// to your exited validators, and waiting to call `startCheckpoint` until those deposits have been automatically
    /// exited.
    ///
    /// Additional edge cases this mapping does not cover:
    /// - If a validator is slashed, their balance exited will reflect their original balance rather than the slashed amount
    /// - The final partial withdrawal for an exited validator will be likely be included in this mapping.
    ///   i.e. if a validator was last checkpointed at 32.1 ETH before exiting, the next checkpoint will calculate their
    ///   "exited" amount to be 32.1 ETH rather than 32 ETH.
    function checkpointBalanceExitedGwei(
        uint64
    ) external view returns (uint64);

    /// @notice Query the 4788 oracle to get the parent block root of the slot with the given `timestamp`
    /// @param timestamp of the block for which the parent block root will be returned. MUST correspond
    /// to an existing slot within the last 24 hours. If the slot at `timestamp` was skipped, this method
    /// will revert.
    function getParentBlockRoot(
        uint64 timestamp
    ) external view returns (bytes32);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IEigenPodManager.sol

interface IEigenPodManagerErrors {
    /// @dev Thrown when caller is not a EigenPod.
    error OnlyEigenPod();
    /// @dev Thrown when caller is not DelegationManager.
    error OnlyDelegationManager();
    /// @dev Thrown when caller already has an EigenPod.
    error EigenPodAlreadyExists();
    /// @dev Thrown when shares is not a multiple of gwei.
    error SharesNotMultipleOfGwei();
    /// @dev Thrown when shares would result in a negative integer.
    error SharesNegative();
    /// @dev Thrown when the strategy is not the beaconChainETH strategy.
    error InvalidStrategy();
    /// @dev Thrown when the pods shares are negative and a beacon chain balance update is attempted.
    /// The podOwner should complete legacy withdrawal first.
    error LegacyWithdrawalsNotCompleted();
    /// @dev Thrown when caller is not the proof timestamp setter
    error OnlyProofTimestampSetter();
}

interface IEigenPodManagerEvents {
    /// @notice Emitted to notify the deployment of an EigenPod
    event PodDeployed(address indexed eigenPod, address indexed podOwner);

    /// @notice Emitted to notify a deposit of beacon chain ETH recorded in the strategy manager
    event BeaconChainETHDeposited(address indexed podOwner, uint256 amount);

    /// @notice Emitted when the balance of an EigenPod is updated
    event PodSharesUpdated(address indexed podOwner, int256 sharesDelta);

    /// @notice Emitted every time the total shares of a pod are updated
    event NewTotalShares(address indexed podOwner, int256 newTotalShares);

    /// @notice Emitted when a withdrawal of beacon chain ETH is completed
    event BeaconChainETHWithdrawalCompleted(
        address indexed podOwner,
        uint256 shares,
        uint96 nonce,
        address delegatedAddress,
        address withdrawer,
        bytes32 withdrawalRoot
    );

    /// @notice Emitted when a staker's beaconChainSlashingFactor is updated
    event BeaconChainSlashingFactorDecreased(
        address staker, uint64 prevBeaconChainSlashingFactor, uint64 newBeaconChainSlashingFactor
    );

    /// @notice Emitted when an operator is slashed and shares to be burned are increased
    event BurnableETHSharesIncreased(uint256 shares);

    /// @notice Emitted when the Pectra fork timestamp is updated
    event PectraForkTimestampSet(uint64 newPectraForkTimestamp);

    /// @notice Emitted when the proof timestamp setter is updated
    event ProofTimestampSetterSet(address newProofTimestampSetter);
}

interface IEigenPodManagerTypes {
    /**
     * @notice The amount of beacon chain slashing experienced by a pod owner as a proportion of WAD
     * @param isSet whether the slashingFactor has ever been updated. Used to distinguish between
     * a value of "0" and an uninitialized value.
     * @param slashingFactor the proportion of the pod owner's balance that has been decreased due to
     * slashing or other beacon chain balance decreases.
     * @dev NOTE: if !isSet, `slashingFactor` should be treated as WAD. `slashingFactor` is monotonically
     * decreasing and can hit 0 if fully slashed.
     */
    struct BeaconChainSlashingFactor {
        bool isSet;
        uint64 slashingFactor;
    }
}

/**
 * @title Interface for factory that creates and manages solo staking pods that have their withdrawal credentials pointed to EigenLayer.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 */
interface IEigenPodManager is
    IEigenPodManagerErrors,
    IEigenPodManagerEvents,
    IEigenPodManagerTypes,
    IShareManager,
    IPausable,
    ISemVerMixin
{
    /**
     * @notice Creates an EigenPod for the sender.
     * @dev Function will revert if the `msg.sender` already has an EigenPod.
     * @dev Returns EigenPod address
     */
    function createPod() external returns (address);

    /**
     * @notice Stakes for a new beacon chain validator on the sender's EigenPod.
     * Also creates an EigenPod for the sender if they don't have one already.
     * @param pubkey The 48 bytes public key of the beacon chain validator.
     * @param signature The validator's signature of the deposit data.
     * @param depositDataRoot The root/hash of the deposit data for the validator's deposit.
     */
    function stake(bytes calldata pubkey, bytes calldata signature, bytes32 depositDataRoot) external payable;

    /**
     * @notice Adds any positive share delta to the pod owner's deposit shares, and delegates them to the pod
     * owner's operator (if applicable). A negative share delta does NOT impact the pod owner's deposit shares,
     * but will reduce their beacon chain slashing factor and delegated shares accordingly.
     * @param podOwner is the pod owner whose balance is being updated.
     * @param prevRestakedBalanceWei is the total amount restaked through the pod before the balance update, including
     * any amount currently in the withdrawal queue.
     * @param balanceDeltaWei is the amount the balance changed
     * @dev Callable only by the podOwner's EigenPod contract.
     * @dev Reverts if `sharesDelta` is not a whole Gwei amount
     */
    function recordBeaconChainETHBalanceUpdate(
        address podOwner,
        uint256 prevRestakedBalanceWei,
        int256 balanceDeltaWei
    ) external;

    /// @notice Sets the address that can set proof timestamps
    function setProofTimestampSetter(
        address newProofTimestampSetter
    ) external;

    /// @notice Sets the Pectra fork timestamp, only callable by `proofTimestampSetter`
    function setPectraForkTimestamp(
        uint64 timestamp
    ) external;

    /// @notice Returns the address of the `podOwner`'s EigenPod if it has been deployed.
    function ownerToPod(
        address podOwner
    ) external view returns (IEigenPod);

    /// @notice Returns the address of the `podOwner`'s EigenPod (whether it is deployed yet or not).
    function getPod(
        address podOwner
    ) external view returns (IEigenPod);

    /// @notice The ETH2 Deposit Contract
    function ethPOS() external view returns (IETHPOSDeposit);

    /// @notice Beacon proxy to which the EigenPods point
    function eigenPodBeacon() external view returns (IBeacon);

    /// @notice Returns 'true' if the `podOwner` has created an EigenPod, and 'false' otherwise.
    function hasPod(
        address podOwner
    ) external view returns (bool);

    /// @notice Returns the number of EigenPods that have been created
    function numPods() external view returns (uint256);

    /**
     * @notice Mapping from Pod owner owner to the number of shares they have in the virtual beacon chain ETH strategy.
     * @dev The share amount can become negative. This is necessary to accommodate the fact that a pod owner's virtual beacon chain ETH shares can
     * decrease between the pod owner queuing and completing a withdrawal.
     * When the pod owner's shares would otherwise increase, this "deficit" is decreased first _instead_.
     * Likewise, when a withdrawal is completed, this "deficit" is decreased and the withdrawal amount is decreased; We can think of this
     * as the withdrawal "paying off the deficit".
     */
    function podOwnerDepositShares(
        address podOwner
    ) external view returns (int256);

    /// @notice returns canonical, virtual beaconChainETH strategy
    function beaconChainETHStrategy() external view returns (IStrategy);

    /**
     * @notice Returns the historical sum of proportional balance decreases a pod owner has experienced when
     * updating their pod's balance.
     */
    function beaconChainSlashingFactor(
        address staker
    ) external view returns (uint64);

    /// @notice Returns the accumulated amount of beacon chain ETH Strategy shares
    function burnableETHShares() external view returns (uint256);

    /// @notice Returns the timestamp of the Pectra hard fork
    /// @dev Specifically, this returns the timestamp of the first non-missed slot at or after the Pectra hard fork
    function pectraForkTimestamp() external view returns (uint64);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IStrategyManager.sol

interface IStrategyManagerErrors {
    /// @dev Thrown when total strategies deployed exceeds max.
    error MaxStrategiesExceeded();
    /// @dev Thrown when call attempted from address that's not delegation manager.
    error OnlyDelegationManager();
    /// @dev Thrown when call attempted from address that's not strategy whitelister.
    error OnlyStrategyWhitelister();
    /// @dev Thrown when provided `shares` amount is too high.
    error SharesAmountTooHigh();
    /// @dev Thrown when provided `shares` amount is zero.
    error SharesAmountZero();
    /// @dev Thrown when provided `staker` address is null.
    error StakerAddressZero();
    /// @dev Thrown when provided `strategy` not found.
    error StrategyNotFound();
    /// @dev Thrown when attempting to deposit to a non-whitelisted strategy.
    error StrategyNotWhitelisted();
}

interface IStrategyManagerEvents {
    /**
     * @notice Emitted when a new deposit occurs on behalf of `staker`.
     * @param staker Is the staker who is depositing funds into EigenLayer.
     * @param strategy Is the strategy that `staker` has deposited into.
     * @param shares Is the number of new shares `staker` has been granted in `strategy`.
     */
    event Deposit(address staker, IStrategy strategy, uint256 shares);

    /// @notice Emitted when the `strategyWhitelister` is changed
    event StrategyWhitelisterChanged(address previousAddress, address newAddress);

    /// @notice Emitted when a strategy is added to the approved list of strategies for deposit
    event StrategyAddedToDepositWhitelist(IStrategy strategy);

    /// @notice Emitted when a strategy is removed from the approved list of strategies for deposit
    event StrategyRemovedFromDepositWhitelist(IStrategy strategy);

    /// @notice Emitted when an operator is slashed and shares to be burned are increased
    event BurnableSharesIncreased(IStrategy strategy, uint256 shares);

    /// @notice Emitted when shares are burned
    event BurnableSharesDecreased(IStrategy strategy, uint256 shares);
}

/**
 * @title Interface for the primary entrypoint for funds into EigenLayer.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice See the `StrategyManager` contract itself for implementation details.
 */
interface IStrategyManager is IStrategyManagerErrors, IStrategyManagerEvents, IShareManager, ISemVerMixin {
    /**
     * @notice Initializes the strategy manager contract. Sets the `pauserRegistry` (currently **not** modifiable after being set),
     * and transfers contract ownership to the specified `initialOwner`.
     * @param initialOwner Ownership of this contract is transferred to this address.
     * @param initialStrategyWhitelister The initial value of `strategyWhitelister` to set.
     * @param initialPausedStatus The initial value of `_paused` to set.
     */
    function initialize(
        address initialOwner,
        address initialStrategyWhitelister,
        uint256 initialPausedStatus
    ) external;

    /**
     * @notice Deposits `amount` of `token` into the specified `strategy` and credits shares to the caller
     * @param strategy the strategy that handles `token`
     * @param token the token from which the `amount` will be transferred
     * @param amount the number of tokens to deposit
     * @return depositShares the number of deposit shares credited to the caller
     * @dev The caller must have previously approved this contract to transfer at least `amount` of `token` on their behalf.
     *
     * WARNING: Be extremely cautious when depositing tokens that do not strictly adhere to ERC20 standards.
     * Tokens that diverge significantly from ERC20 norms can cause unexpected behavior in token balances for
     * that strategy, e.g. ERC-777 tokens allowing cross-contract reentrancy.
     */
    function depositIntoStrategy(
        IStrategy strategy,
        IERC20 token,
        uint256 amount
    ) external returns (uint256 depositShares);

    /**
     * @notice Deposits `amount` of `token` into the specified `strategy` and credits shares to the `staker`
     * Note tokens are transferred from `msg.sender`, NOT from `staker`. This method allows the caller, using a
     * signature, to deposit their tokens to another staker's balance.
     * @param strategy the strategy that handles `token`
     * @param token the token from which the `amount` will be transferred
     * @param amount the number of tokens to transfer from the caller to the strategy
     * @param staker the staker that the deposited assets will be credited to
     * @param expiry the timestamp at which the signature expires
     * @param signature a valid ECDSA or EIP-1271 signature from `staker`
     * @return depositShares the number of deposit shares credited to `staker`
     * @dev The caller must have previously approved this contract to transfer at least `amount` of `token` on their behalf.
     *
     * WARNING: Be extremely cautious when depositing tokens that do not strictly adhere to ERC20 standards.
     * Tokens that diverge significantly from ERC20 norms can cause unexpected behavior in token balances for
     * that strategy, e.g. ERC-777 tokens allowing cross-contract reentrancy.
     */
    function depositIntoStrategyWithSignature(
        IStrategy strategy,
        IERC20 token,
        uint256 amount,
        address staker,
        uint256 expiry,
        bytes memory signature
    ) external returns (uint256 depositShares);

    /**
     * @notice Burns Strategy shares for the given strategy by calling into the strategy to transfer
     * to the default burn address.
     * @param strategy The strategy to burn shares in.
     */
    function burnShares(
        IStrategy strategy
    ) external;

    /**
     * @notice Owner-only function to change the `strategyWhitelister` address.
     * @param newStrategyWhitelister new address for the `strategyWhitelister`.
     */
    function setStrategyWhitelister(
        address newStrategyWhitelister
    ) external;

    /**
     * @notice Owner-only function that adds the provided Strategies to the 'whitelist' of strategies that stakers can deposit into
     * @param strategiesToWhitelist Strategies that will be added to the `strategyIsWhitelistedForDeposit` mapping (if they aren't in it already)
     */
    function addStrategiesToDepositWhitelist(
        IStrategy[] calldata strategiesToWhitelist
    ) external;

    /**
     * @notice Owner-only function that removes the provided Strategies from the 'whitelist' of strategies that stakers can deposit into
     * @param strategiesToRemoveFromWhitelist Strategies that will be removed to the `strategyIsWhitelistedForDeposit` mapping (if they are in it)
     */
    function removeStrategiesFromDepositWhitelist(
        IStrategy[] calldata strategiesToRemoveFromWhitelist
    ) external;

    /// @notice Returns bool for whether or not `strategy` is whitelisted for deposit
    function strategyIsWhitelistedForDeposit(
        IStrategy strategy
    ) external view returns (bool);

    /**
     * @notice Get all details on the staker's deposits and corresponding shares
     * @return (staker's strategies, shares in these strategies)
     */
    function getDeposits(
        address staker
    ) external view returns (IStrategy[] memory, uint256[] memory);

    function getStakerStrategyList(
        address staker
    ) external view returns (IStrategy[] memory);

    /// @notice Simple getter function that returns `stakerStrategyList[staker].length`.
    function stakerStrategyListLength(
        address staker
    ) external view returns (uint256);

    /// @notice Returns the current shares of `user` in `strategy`
    function stakerDepositShares(address user, IStrategy strategy) external view returns (uint256 shares);

    /// @notice Returns the single, central Delegation contract of EigenLayer
    function delegation() external view returns (IDelegationManager);

    /// @notice Returns the address of the `strategyWhitelister`
    function strategyWhitelister() external view returns (address);

    /// @notice Returns the burnable shares of a strategy
    function getBurnableShares(
        IStrategy strategy
    ) external view returns (uint256);

    /**
     * @notice Gets every strategy with burnable shares and the amount of burnable shares in each said strategy
     *
     * WARNING: This operation can copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Users should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the map grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function getStrategiesWithBurnableShares() external view returns (address[] memory, uint256[] memory);

    /**
     * @param staker The address of the staker.
     * @param strategy The strategy to deposit into.
     * @param token The token to deposit.
     * @param amount The amount of `token` to deposit.
     * @param nonce The nonce of the staker.
     * @param expiry The expiry of the signature.
     * @return The EIP-712 signable digest hash.
     */
    function calculateStrategyDepositDigestHash(
        address staker,
        IStrategy strategy,
        IERC20 token,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) external view returns (bytes32);
}

// lib/eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol

interface IRewardsCoordinatorErrors {
    /// @dev Thrown when msg.sender is not allowed to call a function
    error UnauthorizedCaller();
    /// @dev Thrown when a earner not an AVS or Operator
    error InvalidEarner();

    /// Invalid Inputs

    /// @dev Thrown when an input address is zero
    error InvalidAddressZero();
    /// @dev Thrown when an invalid root is provided.
    error InvalidRoot();
    /// @dev Thrown when an invalid root index is provided.
    error InvalidRootIndex();
    /// @dev Thrown when input arrays length is zero.
    error InputArrayLengthZero();
    /// @dev Thrown when two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @dev Thrown when provided root is not for new calculated period.
    error NewRootMustBeForNewCalculatedPeriod();
    /// @dev Thrown when rewards end timestamp has not elapsed.
    error RewardsEndTimestampNotElapsed();
    /// @dev Thrown when an invalid operator set is provided.
    error InvalidOperatorSet();

    /// Rewards Submissions

    /// @dev Thrown when input `amount` is zero.
    error AmountIsZero();
    /// @dev Thrown when input `amount` exceeds maximum.
    error AmountExceedsMax();
    /// @dev Thrown when input `split` exceeds `ONE_HUNDRED_IN_BIPS`
    error SplitExceedsMax();
    /// @dev Thrown when an operator attempts to set a split before the previous one becomes active
    error PreviousSplitPending();
    /// @dev Thrown when input `duration` exceeds maximum.
    error DurationExceedsMax();
    /// @dev Thrown when input `duration` is zero.
    error DurationIsZero();
    /// @dev Thrown when input `duration` is not evenly divisble by CALCULATION_INTERVAL_SECONDS.
    error InvalidDurationRemainder();
    /// @dev Thrown when GENESIS_REWARDS_TIMESTAMP is not evenly divisble by CALCULATION_INTERVAL_SECONDS.
    error InvalidGenesisRewardsTimestampRemainder();
    /// @dev Thrown when CALCULATION_INTERVAL_SECONDS is not evenly divisble by SNAPSHOT_CADENCE.
    error InvalidCalculationIntervalSecondsRemainder();
    /// @dev Thrown when `startTimestamp` is not evenly divisble by CALCULATION_INTERVAL_SECONDS.
    error InvalidStartTimestampRemainder();
    /// @dev Thrown when `startTimestamp` is too far in the future.
    error StartTimestampTooFarInFuture();
    /// @dev Thrown when `startTimestamp` is too far in the past.
    error StartTimestampTooFarInPast();
    /// @dev Thrown when an attempt to use a non-whitelisted strategy is made.
    error StrategyNotWhitelisted();
    /// @dev Thrown when `strategies` is not sorted in ascending order.
    error StrategiesNotInAscendingOrder();
    /// @dev Thrown when `operators` are not sorted in ascending order
    error OperatorsNotInAscendingOrder();
    /// @dev Thrown when an operator-directed rewards submission is not retroactive
    error SubmissionNotRetroactive();

    /// Claims

    /// @dev Thrown when an invalid earner claim proof is provided.
    error InvalidClaimProof();
    /// @dev Thrown when an invalid token leaf index is provided.
    error InvalidTokenLeafIndex();
    /// @dev Thrown when an invalid earner leaf index is provided.
    error InvalidEarnerLeafIndex();
    /// @dev Thrown when cumulative earnings are not greater than cumulative claimed.
    error EarningsNotGreaterThanClaimed();

    /// Reward Root Checks

    /// @dev Thrown if a root has already been disabled.
    error RootDisabled();
    /// @dev Thrown if a root has not been activated yet.
    error RootNotActivated();
    /// @dev Thrown if a root has already been activated.
    error RootAlreadyActivated();
}

interface IRewardsCoordinatorTypes {
    /**
     * @notice A linear combination of strategies and multipliers for AVSs to weigh
     * EigenLayer strategies.
     * @param strategy The EigenLayer strategy to be used for the rewards submission
     * @param multiplier The weight of the strategy in the rewards submission
     */
    struct StrategyAndMultiplier {
        IStrategy strategy;
        uint96 multiplier;
    }

    /**
     * @notice A reward struct for an operator
     * @param operator The operator to be rewarded
     * @param amount The reward amount for the operator
     */
    struct OperatorReward {
        address operator;
        uint256 amount;
    }

    /**
     * @notice A split struct for an Operator
     * @param oldSplitBips The old split in basis points. This is the split that is active if `block.timestamp < activatedAt`
     * @param newSplitBips The new split in basis points. This is the split that is active if `block.timestamp >= activatedAt`
     * @param activatedAt The timestamp at which the split will be activated
     */
    struct OperatorSplit {
        uint16 oldSplitBips;
        uint16 newSplitBips;
        uint32 activatedAt;
    }

    /**
     * Sliding Window for valid RewardsSubmission startTimestamp
     *
     * Scenario A: GENESIS_REWARDS_TIMESTAMP IS WITHIN RANGE
     *         <-----MAX_RETROACTIVE_LENGTH-----> t (block.timestamp) <---MAX_FUTURE_LENGTH--->
     *             <--------------------valid range for startTimestamp------------------------>
     *             ^
     *         GENESIS_REWARDS_TIMESTAMP
     *
     *
     * Scenario B: GENESIS_REWARDS_TIMESTAMP IS OUT OF RANGE
     *         <-----MAX_RETROACTIVE_LENGTH-----> t (block.timestamp) <---MAX_FUTURE_LENGTH--->
     *         <------------------------valid range for startTimestamp------------------------>
     *     ^
     * GENESIS_REWARDS_TIMESTAMP
     * @notice RewardsSubmission struct submitted by AVSs when making rewards for their operators and stakers
     * RewardsSubmission can be for a time range within the valid window for startTimestamp and must be within max duration.
     * See `createAVSRewardsSubmission()` for more details.
     * @param strategiesAndMultipliers The strategies and their relative weights
     * cannot have duplicate strategies and need to be sorted in ascending address order
     * @param token The rewards token to be distributed
     * @param amount The total amount of tokens to be distributed
     * @param startTimestamp The timestamp (seconds) at which the submission range is considered for distribution
     * could start in the past or in the future but within a valid range. See the diagram above.
     * @param duration The duration of the submission range in seconds. Must be <= MAX_REWARDS_DURATION
     */
    struct RewardsSubmission {
        StrategyAndMultiplier[] strategiesAndMultipliers;
        IERC20 token;
        uint256 amount;
        uint32 startTimestamp;
        uint32 duration;
    }

    /**
     * @notice OperatorDirectedRewardsSubmission struct submitted by AVSs when making operator-directed rewards for their operators and stakers.
     * @param strategiesAndMultipliers The strategies and their relative weights.
     * @param token The rewards token to be distributed.
     * @param operatorRewards The rewards for the operators.
     * @param startTimestamp The timestamp (seconds) at which the submission range is considered for distribution.
     * @param duration The duration of the submission range in seconds.
     * @param description Describes what the rewards submission is for.
     */
    struct OperatorDirectedRewardsSubmission {
        StrategyAndMultiplier[] strategiesAndMultipliers;
        IERC20 token;
        OperatorReward[] operatorRewards;
        uint32 startTimestamp;
        uint32 duration;
        string description;
    }

    /**
     * @notice A distribution root is a merkle root of the distribution of earnings for a given period.
     * The RewardsCoordinator stores all historical distribution roots so that earners can claim their earnings against older roots
     * if they wish but the merkle tree contains the cumulative earnings of all earners and tokens for a given period so earners (or their claimers if set)
     * only need to claim against the latest root to claim all available earnings.
     * @param root The merkle root of the distribution
     * @param rewardsCalculationEndTimestamp The timestamp (seconds) until which rewards have been calculated
     * @param activatedAt The timestamp (seconds) at which the root can be claimed against
     */
    struct DistributionRoot {
        bytes32 root;
        uint32 rewardsCalculationEndTimestamp;
        uint32 activatedAt;
        bool disabled;
    }

    /**
     * @notice Internal leaf in the merkle tree for the earner's account leaf
     * @param earner The address of the earner
     * @param earnerTokenRoot The merkle root of the earner's token subtree
     * Each leaf in the earner's token subtree is a TokenTreeMerkleLeaf
     */
    struct EarnerTreeMerkleLeaf {
        address earner;
        bytes32 earnerTokenRoot;
    }

    /**
     * @notice The actual leaves in the distribution merkle tree specifying the token earnings
     * for the respective earner's subtree. Each leaf is a claimable amount of a token for an earner.
     * @param token The token for which the earnings are being claimed
     * @param cumulativeEarnings The cumulative earnings of the earner for the token
     */
    struct TokenTreeMerkleLeaf {
        IERC20 token;
        uint256 cumulativeEarnings;
    }

    /**
     * @notice A claim against a distribution root called by an
     * earners claimer (could be the earner themselves). Each token claim will claim the difference
     * between the cumulativeEarnings of the earner and the cumulativeClaimed of the claimer.
     * Each claim can specify which of the earner's earned tokens they want to claim.
     * See `processClaim()` for more details.
     * @param rootIndex The index of the root in the list of DistributionRoots
     * @param earnerIndex The index of the earner's account root in the merkle tree
     * @param earnerTreeProof The proof of the earner's EarnerTreeMerkleLeaf against the merkle root
     * @param earnerLeaf The earner's EarnerTreeMerkleLeaf struct, providing the earner address and earnerTokenRoot
     * @param tokenIndices The indices of the token leaves in the earner's subtree
     * @param tokenTreeProofs The proofs of the token leaves against the earner's earnerTokenRoot
     * @param tokenLeaves The token leaves to be claimed
     * @dev The merkle tree is structured with the merkle root at the top and EarnerTreeMerkleLeaf as internal leaves
     * in the tree. Each earner leaf has its own subtree with TokenTreeMerkleLeaf as leaves in the subtree.
     * To prove a claim against a specified rootIndex(which specifies the distributionRoot being used),
     * the claim will first verify inclusion of the earner leaf in the tree against _distributionRoots[rootIndex].root.
     * Then for each token, it will verify inclusion of the token leaf in the earner's subtree against the earner's earnerTokenRoot.
     */
    struct RewardsMerkleClaim {
        uint32 rootIndex;
        uint32 earnerIndex;
        bytes earnerTreeProof;
        EarnerTreeMerkleLeaf earnerLeaf;
        uint32[] tokenIndices;
        bytes[] tokenTreeProofs;
        TokenTreeMerkleLeaf[] tokenLeaves;
    }

    /**
     * @notice Parameters for the RewardsCoordinator constructor
     * @param delegationManager The address of the DelegationManager contract
     * @param strategyManager The address of the StrategyManager contract
     * @param allocationManager The address of the AllocationManager contract
     * @param pauserRegistry The address of the PauserRegistry contract
     * @param permissionController The address of the PermissionController contract
     * @param CALCULATION_INTERVAL_SECONDS The interval at which rewards are calculated
     * @param MAX_REWARDS_DURATION The maximum duration of a rewards submission
     * @param MAX_RETROACTIVE_LENGTH The maximum retroactive length of a rewards submission
     * @param MAX_FUTURE_LENGTH The maximum future length of a rewards submission
     * @param GENESIS_REWARDS_TIMESTAMP The timestamp at which rewards are first calculated
     * @param version The semantic version of the contract (e.g. "v1.2.3")
     * @dev Needed to avoid stack-too-deep errors
     */
    struct RewardsCoordinatorConstructorParams {
        IDelegationManager delegationManager;
        IStrategyManager strategyManager;
        IAllocationManager allocationManager;
        IPauserRegistry pauserRegistry;
        IPermissionController permissionController;
        uint32 CALCULATION_INTERVAL_SECONDS;
        uint32 MAX_REWARDS_DURATION;
        uint32 MAX_RETROACTIVE_LENGTH;
        uint32 MAX_FUTURE_LENGTH;
        uint32 GENESIS_REWARDS_TIMESTAMP;
        string version;
    }
}

interface IRewardsCoordinatorEvents is IRewardsCoordinatorTypes {
    /// @notice emitted when an AVS creates a valid RewardsSubmission
    event AVSRewardsSubmissionCreated(
        address indexed avs,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /// @notice emitted when a valid RewardsSubmission is created for all stakers by a valid submitter
    event RewardsSubmissionForAllCreated(
        address indexed submitter,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /// @notice emitted when a valid RewardsSubmission is created when rewardAllStakersAndOperators is called
    event RewardsSubmissionForAllEarnersCreated(
        address indexed tokenHopper,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /**
     * @notice Emitted when an AVS creates a valid `OperatorDirectedRewardsSubmission`
     * @param caller The address calling `createOperatorDirectedAVSRewardsSubmission`.
     * @param avs The avs on behalf of which the operator-directed rewards are being submitted.
     * @param operatorDirectedRewardsSubmissionHash Keccak256 hash of (`avs`, `submissionNonce` and `operatorDirectedRewardsSubmission`).
     * @param submissionNonce Current nonce of the avs. Used to generate a unique submission hash.
     * @param operatorDirectedRewardsSubmission The Operator-Directed Rewards Submission. Contains the token, start timestamp, duration, operator rewards, description and, strategy and multipliers.
     */
    event OperatorDirectedAVSRewardsSubmissionCreated(
        address indexed caller,
        address indexed avs,
        bytes32 indexed operatorDirectedRewardsSubmissionHash,
        uint256 submissionNonce,
        OperatorDirectedRewardsSubmission operatorDirectedRewardsSubmission
    );

    /**
     * @notice Emitted when an AVS creates a valid `OperatorDirectedRewardsSubmission` for an operator set.
     * @param caller The address calling `createOperatorDirectedOperatorSetRewardsSubmission`.
     * @param operatorDirectedRewardsSubmissionHash Keccak256 hash of (`avs`, `submissionNonce` and `operatorDirectedRewardsSubmission`).
     * @param operatorSet The operatorSet on behalf of which the operator-directed rewards are being submitted.
     * @param submissionNonce Current nonce of the avs. Used to generate a unique submission hash.
     * @param operatorDirectedRewardsSubmission The Operator-Directed Rewards Submission. Contains the token, start timestamp, duration, operator rewards, description and, strategy and multipliers.
     */
    event OperatorDirectedOperatorSetRewardsSubmissionCreated(
        address indexed caller,
        bytes32 indexed operatorDirectedRewardsSubmissionHash,
        OperatorSet operatorSet,
        uint256 submissionNonce,
        OperatorDirectedRewardsSubmission operatorDirectedRewardsSubmission
    );

    /// @notice rewardsUpdater is responsible for submitting DistributionRoots, only owner can set rewardsUpdater
    event RewardsUpdaterSet(address indexed oldRewardsUpdater, address indexed newRewardsUpdater);

    event RewardsForAllSubmitterSet(
        address indexed rewardsForAllSubmitter, bool indexed oldValue, bool indexed newValue
    );

    event ActivationDelaySet(uint32 oldActivationDelay, uint32 newActivationDelay);
    event DefaultOperatorSplitBipsSet(uint16 oldDefaultOperatorSplitBips, uint16 newDefaultOperatorSplitBips);

    /**
     * @notice Emitted when the operator split for an AVS is set.
     * @param caller The address calling `setOperatorAVSSplit`.
     * @param operator The operator on behalf of which the split is being set.
     * @param avs The avs for which the split is being set by the operator.
     * @param activatedAt The timestamp at which the split will be activated.
     * @param oldOperatorAVSSplitBips The old split for the operator for the AVS.
     * @param newOperatorAVSSplitBips The new split for the operator for the AVS.
     */
    event OperatorAVSSplitBipsSet(
        address indexed caller,
        address indexed operator,
        address indexed avs,
        uint32 activatedAt,
        uint16 oldOperatorAVSSplitBips,
        uint16 newOperatorAVSSplitBips
    );

    /**
     * @notice Emitted when the operator split for Programmatic Incentives is set.
     * @param caller The address calling `setOperatorPISplit`.
     * @param operator The operator on behalf of which the split is being set.
     * @param activatedAt The timestamp at which the split will be activated.
     * @param oldOperatorPISplitBips The old split for the operator for Programmatic Incentives.
     * @param newOperatorPISplitBips The new split for the operator for Programmatic Incentives.
     */
    event OperatorPISplitBipsSet(
        address indexed caller,
        address indexed operator,
        uint32 activatedAt,
        uint16 oldOperatorPISplitBips,
        uint16 newOperatorPISplitBips
    );

    /**
     * @notice Emitted when the operator split for a given operatorSet is set.
     * @param caller The address calling `setOperatorSetSplit`.
     * @param operator The operator on behalf of which the split is being set.
     * @param operatorSet The operatorSet for which the split is being set.
     * @param activatedAt The timestamp at which the split will be activated.
     * @param oldOperatorSetSplitBips The old split for the operator for the operatorSet.
     * @param newOperatorSetSplitBips The new split for the operator for the operatorSet.
     */
    event OperatorSetSplitBipsSet(
        address indexed caller,
        address indexed operator,
        OperatorSet operatorSet,
        uint32 activatedAt,
        uint16 oldOperatorSetSplitBips,
        uint16 newOperatorSetSplitBips
    );

    event ClaimerForSet(address indexed earner, address indexed oldClaimer, address indexed claimer);

    /// @notice rootIndex is the specific array index of the newly created root in the storage array
    event DistributionRootSubmitted(
        uint32 indexed rootIndex,
        bytes32 indexed root,
        uint32 indexed rewardsCalculationEndTimestamp,
        uint32 activatedAt
    );

    event DistributionRootDisabled(uint32 indexed rootIndex);

    /// @notice root is one of the submitted distribution roots that was claimed against
    event RewardsClaimed(
        bytes32 root,
        address indexed earner,
        address indexed claimer,
        address indexed recipient,
        IERC20 token,
        uint256 claimedAmount
    );
}

/**
 * @title Interface for the `IRewardsCoordinator` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice Allows AVSs to make "Rewards Submissions", which get distributed amongst the AVSs' confirmed
 * Operators and the Stakers delegated to those Operators.
 * Calculations are performed based on the completed RewardsSubmission, with the results posted in
 * a Merkle root against which Stakers & Operators can make claims.
 */
interface IRewardsCoordinator is IRewardsCoordinatorErrors, IRewardsCoordinatorEvents, ISemVerMixin {
    /**
     * @dev Initializes the addresses of the initial owner, pauser registry, rewardsUpdater and
     * configures the initial paused status, activationDelay, and defaultOperatorSplitBips.
     */
    function initialize(
        address initialOwner,
        uint256 initialPausedStatus,
        address _rewardsUpdater,
        uint32 _activationDelay,
        uint16 _defaultSplitBips
    ) external;

    /**
     * @notice Creates a new rewards submission on behalf of an AVS, to be split amongst the
     * set of stakers delegated to operators who are registered to the `avs`
     * @param rewardsSubmissions The rewards submissions being created
     * @dev Expected to be called by the ServiceManager of the AVS on behalf of which the submission is being made
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The duration of the `rewardsSubmission` cannot be 0 and must be a multiple of `CALCULATION_INTERVAL_SECONDS`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev This function will revert if the `rewardsSubmission` is malformed,
     * e.g. if the `strategies` and `weights` arrays are of non-equal lengths
     */
    function createAVSRewardsSubmission(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice similar to `createAVSRewardsSubmission` except the rewards are split amongst *all* stakers
     * rather than just those delegated to operators who are registered to a single avs and is
     * a permissioned call based on isRewardsForAllSubmitter mapping.
     * @param rewardsSubmissions The rewards submissions being created
     */
    function createRewardsForAllSubmission(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice Creates a new rewards submission for all earners across all AVSs.
     * Earners in this case indicating all operators and their delegated stakers. Undelegated stake
     * is not rewarded from this RewardsSubmission. This interface is only callable
     * by the token hopper contract from the Eigen Foundation
     * @param rewardsSubmissions The rewards submissions being created
     */
    function createRewardsForAllEarners(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice Creates a new operator-directed rewards submission on behalf of an AVS, to be split amongst the operators and
     * set of stakers delegated to operators who are registered to the `avs`.
     * @param avs The AVS on behalf of which the reward is being submitted
     * @param operatorDirectedRewardsSubmissions The operator-directed rewards submissions being created
     * @dev Expected to be called by the ServiceManager of the AVS on behalf of which the submission is being made
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The duration of the `rewardsSubmission` cannot be 0 and must be a multiple of `CALCULATION_INTERVAL_SECONDS`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev The `RewardsCoordinator` contract needs a token approval of sum of all `operatorRewards` in the `operatorDirectedRewardsSubmissions`, before calling this function.
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev Operators must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `operatorDirectedRewardsSubmissions` is malformed.
     */
    function createOperatorDirectedAVSRewardsSubmission(
        address avs,
        OperatorDirectedRewardsSubmission[] calldata operatorDirectedRewardsSubmissions
    ) external;

    /**
     * @notice Creates a new operator-directed rewards submission for an operator set, to be split amongst the operators and
     * set of stakers delegated to operators who are part of the operator set.
     * @param operatorSet The operator set for which the rewards are being submitted
     * @param operatorDirectedRewardsSubmissions The operator-directed rewards submissions being created
     * @dev Expected to be called by the AVS that created the operator set
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The duration of the `rewardsSubmission` cannot be 0 and must be a multiple of `CALCULATION_INTERVAL_SECONDS`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev The `RewardsCoordinator` contract needs a token approval of sum of all `operatorRewards` in the `operatorDirectedRewardsSubmissions`, before calling this function
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev Operators must be in ascending order of addresses to check for duplicates
     * @dev This function will revert if the `operatorDirectedRewardsSubmissions` is malformed
     */
    function createOperatorDirectedOperatorSetRewardsSubmission(
        OperatorSet calldata operatorSet,
        OperatorDirectedRewardsSubmission[] calldata operatorDirectedRewardsSubmissions
    ) external;

    /**
     * @notice Claim rewards against a given root (read from _distributionRoots[claim.rootIndex]).
     * Earnings are cumulative so earners don't have to claim against all distribution roots they have earnings for,
     * they can simply claim against the latest root and the contract will calculate the difference between
     * their cumulativeEarnings and cumulativeClaimed. This difference is then transferred to recipient address.
     * @param claim The RewardsMerkleClaim to be processed.
     * Contains the root index, earner, token leaves, and required proofs
     * @param recipient The address recipient that receives the ERC20 rewards
     * @dev only callable by the valid claimer, that is
     * if claimerFor[claim.earner] is address(0) then only the earner can claim, otherwise only
     * claimerFor[claim.earner] can claim the rewards.
     */
    function processClaim(RewardsMerkleClaim calldata claim, address recipient) external;

    /**
     * @notice Batch claim rewards against a given root (read from _distributionRoots[claim.rootIndex]).
     * Earnings are cumulative so earners don't have to claim against all distribution roots they have earnings for,
     * they can simply claim against the latest root and the contract will calculate the difference between
     * their cumulativeEarnings and cumulativeClaimed. This difference is then transferred to recipient address.
     * @param claims The RewardsMerkleClaims to be processed.
     * Contains the root index, earner, token leaves, and required proofs
     * @param recipient The address recipient that receives the ERC20 rewards
     * @dev only callable by the valid claimer, that is
     * if claimerFor[claim.earner] is address(0) then only the earner can claim, otherwise only
     * claimerFor[claim.earner] can claim the rewards.
     * @dev This function may fail to execute with a large number of claims due to gas limits. Use a smaller array of claims if necessary.
     */
    function processClaims(RewardsMerkleClaim[] calldata claims, address recipient) external;

    /**
     * @notice Creates a new distribution root. activatedAt is set to block.timestamp + activationDelay
     * @param root The merkle root of the distribution
     * @param rewardsCalculationEndTimestamp The timestamp until which rewards have been calculated
     * @dev Only callable by the rewardsUpdater
     */
    function submitRoot(bytes32 root, uint32 rewardsCalculationEndTimestamp) external;

    /**
     * @notice allow the rewardsUpdater to disable/cancel a pending root submission in case of an error
     * @param rootIndex The index of the root to be disabled
     */
    function disableRoot(
        uint32 rootIndex
    ) external;

    /**
     * @notice Sets the address of the entity that can call `processClaim` on ehalf of an earner
     * @param claimer The address of the entity that can call `processClaim` on behalf of the earner
     * @dev Assumes msg.sender is the earner
     */
    function setClaimerFor(
        address claimer
    ) external;

    /**
     * @notice Sets the address of the entity that can call `processClaim` on behalf of an earner
     * @param earner The address to set the claimer for
     * @param claimer The address of the entity that can call `processClaim` on behalf of the earner
     * @dev Only callable by operators or AVSs. We define an AVS that has created at least one
     *      operatorSet in the `AllocationManager`
     */
    function setClaimerFor(address earner, address claimer) external;

    /**
     * @notice Sets the delay in timestamp before a posted root can be claimed against
     * @dev Only callable by the contract owner
     * @param _activationDelay The new value for activationDelay
     */
    function setActivationDelay(
        uint32 _activationDelay
    ) external;

    /**
     * @notice Sets the default split for all operators across all avss.
     * @param split The default split for all operators across all avss in bips.
     * @dev Only callable by the contract owner.
     */
    function setDefaultOperatorSplit(
        uint16 split
    ) external;

    /**
     * @notice Sets the split for a specific operator for a specific avs
     * @param operator The operator who is setting the split
     * @param avs The avs for which the split is being set by the operator
     * @param split The split for the operator for the specific avs in bips.
     * @dev Only callable by the operator
     * @dev Split has to be between 0 and 10000 bips (inclusive)
     * @dev The split will be activated after the activation delay
     */
    function setOperatorAVSSplit(address operator, address avs, uint16 split) external;

    /**
     * @notice Sets the split for a specific operator for Programmatic Incentives.
     * @param operator The operator on behalf of which the split is being set.
     * @param split The split for the operator for Programmatic Incentives in bips.
     * @dev Only callable by the operator
     * @dev Split has to be between 0 and 10000 bips (inclusive)
     * @dev The split will be activated after the activation delay
     */
    function setOperatorPISplit(address operator, uint16 split) external;

    /**
     * @notice Sets the split for a specific operator for a specific operatorSet.
     * @param operator The operator who is setting the split.
     * @param operatorSet The operatorSet for which the split is being set by the operator.
     * @param split The split for the operator for the specific operatorSet in bips.
     * @dev Only callable by the operator
     * @dev Split has to be between 0 and 10000 bips (inclusive)
     * @dev The split will be activated after the activation delay
     */
    function setOperatorSetSplit(address operator, OperatorSet calldata operatorSet, uint16 split) external;

    /**
     * @notice Sets the permissioned `rewardsUpdater` address which can post new roots
     * @dev Only callable by the contract owner
     * @param _rewardsUpdater The address of the new rewardsUpdater
     */
    function setRewardsUpdater(
        address _rewardsUpdater
    ) external;

    /**
     * @notice Sets the permissioned `rewardsForAllSubmitter` address which can submit createRewardsForAllSubmission
     * @dev Only callable by the contract owner
     * @param _submitter The address of the rewardsForAllSubmitter
     * @param _newValue The new value for isRewardsForAllSubmitter
     */
    function setRewardsForAllSubmitter(address _submitter, bool _newValue) external;

    /**
     *
     *                         VIEW FUNCTIONS
     *
     */

    /// @notice Delay in timestamp (seconds) before a posted root can be claimed against
    function activationDelay() external view returns (uint32);

    /// @notice The timestamp until which RewardsSubmissions have been calculated
    function currRewardsCalculationEndTimestamp() external view returns (uint32);

    /// @notice Mapping: earner => the address of the entity who can call `processClaim` on behalf of the earner
    function claimerFor(
        address earner
    ) external view returns (address);

    /// @notice Mapping: claimer => token => total amount claimed
    function cumulativeClaimed(address claimer, IERC20 token) external view returns (uint256);

    /// @notice the default split for all operators across all avss
    function defaultOperatorSplitBips() external view returns (uint16);

    /// @notice the split for a specific `operator` for a specific `avs`
    function getOperatorAVSSplit(address operator, address avs) external view returns (uint16);

    /// @notice the split for a specific `operator` for Programmatic Incentives
    function getOperatorPISplit(
        address operator
    ) external view returns (uint16);

    /// @notice Returns the split for a specific `operator` for a given `operatorSet`
    function getOperatorSetSplit(address operator, OperatorSet calldata operatorSet) external view returns (uint16);

    /// @notice return the hash of the earner's leaf
    function calculateEarnerLeafHash(
        EarnerTreeMerkleLeaf calldata leaf
    ) external pure returns (bytes32);

    /// @notice returns the hash of the earner's token leaf
    function calculateTokenLeafHash(
        TokenTreeMerkleLeaf calldata leaf
    ) external pure returns (bytes32);

    /// @notice returns 'true' if the claim would currently pass the check in `processClaims`
    /// but will revert if not valid
    function checkClaim(
        RewardsMerkleClaim calldata claim
    ) external view returns (bool);

    /// @notice returns the number of distribution roots posted
    function getDistributionRootsLength() external view returns (uint256);

    /// @notice returns the distributionRoot at the specified index
    function getDistributionRootAtIndex(
        uint256 index
    ) external view returns (DistributionRoot memory);

    /// @notice returns the current distributionRoot
    function getCurrentDistributionRoot() external view returns (DistributionRoot memory);

    /// @notice loop through the distribution roots from reverse and get latest root that is not disabled and activated
    /// i.e. a root that can be claimed against
    function getCurrentClaimableDistributionRoot() external view returns (DistributionRoot memory);

    /// @notice loop through distribution roots from reverse and return index from hash
    function getRootIndexFromHash(
        bytes32 rootHash
    ) external view returns (uint32);

    /// @notice The address of the entity that can update the contract with new merkle roots
    function rewardsUpdater() external view returns (address);

    /**
     * @notice The interval in seconds at which the calculation for a RewardsSubmission distribution is done.
     * @dev Rewards Submission durations must be multiples of this interval.
     */
    function CALCULATION_INTERVAL_SECONDS() external view returns (uint32);

    /// @notice The maximum amount of time (seconds) that a RewardsSubmission can span over
    function MAX_REWARDS_DURATION() external view returns (uint32);

    /// @notice max amount of time (seconds) that a submission can start in the past
    function MAX_RETROACTIVE_LENGTH() external view returns (uint32);

    /// @notice max amount of time (seconds) that a submission can start in the future
    function MAX_FUTURE_LENGTH() external view returns (uint32);

    /// @notice absolute min timestamp (seconds) that a submission can start at
    function GENESIS_REWARDS_TIMESTAMP() external view returns (uint32);
}

// src/interfaces/IServiceManager.sol

interface IServiceManagerErrors {
    /// @notice Thrown when a function is called by an address that is not the RegistryCoordinator.
    error OnlyRegistryCoordinator();
    /// @notice Thrown when a function is called by an address that is not the RewardsInitiator.
    error OnlyRewardsInitiator();
    /// @notice Thrown when a function is called by an address that is not the StakeRegistry.
    error OnlyStakeRegistry();
    /// @notice Thrown when a slashing proposal delay has not been met yet.
    error DelayPeriodNotPassed();
    /// @notice Thrown when the operator set does not have a rewards registry set.
    error NoRewardsRegistryForOperatorSet();
    /// @notice Thrown when the operator is not part of the specified operator set.
    error OperatorNotInOperatorSet();
}

interface IServiceManagerEvents {
    /**
     * @notice Emitted when the rewards initiator address is updated.
     * @param prevRewardsInitiator The previous rewards initiator address.
     * @param newRewardsInitiator The new rewards initiator address.
     */
    event RewardsInitiatorUpdated(address prevRewardsInitiator, address newRewardsInitiator);

    /**
     * @notice Emitted when a rewards registry is set for an operator set.
     * @param operatorSetId The ID of the operator set.
     * @param rewardsRegistry The address of the rewards registry.
     */
    event RewardsRegistrySet(uint32 indexed operatorSetId, address indexed rewardsRegistry);
}

interface IServiceManager is IServiceManagerUI, IServiceManagerErrors, IServiceManagerEvents {
    /**
     * @notice Creates a new rewards submission to the EigenLayer RewardsCoordinator contract.
     * @dev Only callable by the permissioned rewardsInitiator address.
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`.
     * @dev The tokens are sent to the `RewardsCoordinator` contract.
     * @dev Strategies must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `rewardsSubmission` is malformed,
     *      e.g. if the `strategies` and `weights` arrays are of non-equal lengths.
     * @param rewardsSubmissions The rewards submissions to be split amongst the set of stakers
     *        delegated to operators who are registered to this `avs`.
     */
    function createAVSRewardsSubmission(
        IRewardsCoordinatorTypes.RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice PERMISSIONCONTROLLER FUNCTIONS
     */

    /**
     * @notice Calls `addPendingAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param admin The address of the admin to add.
     */
    function addPendingAdmin(
        address admin
    ) external;

    /**
     * @notice Calls `removePendingAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param pendingAdmin The address of the pending admin to remove.
     */
    function removePendingAdmin(
        address pendingAdmin
    ) external;

    /**
     * @notice Calls `removeAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param admin The address of the admin to remove.
     */
    function removeAdmin(
        address admin
    ) external;

    /**
     * @notice Calls `setAppointee` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param appointee The address of the appointee to set.
     * @param target The address of the target to set the appointee for.
     * @param selector The function selector to set the appointee for.
     */
    function setAppointee(address appointee, address target, bytes4 selector) external;

    /**
     * @notice Calls `removeAppointee` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param appointee The address of the appointee to remove.
     * @param target The address of the target to remove the appointee for.
     * @param selector The function selector to remove the appointee for.
     */
    function removeAppointee(address appointee, address target, bytes4 selector) external;

    /**
     * @notice Deregisters an operator from specified operator sets
     * @param operator The address of the operator to deregister
     * @param operatorSetIds The IDs of the operator sets to deregister from
     * @dev Only callable by the RegistryCoordinator
     */
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) external;

    /**
     * @notice Returns the address of the AVS
     * @return The address of the AVS
     */
    function avs() external view returns (address);

    /**
     * @notice Sets the rewards registry for an operator set
     * @param operatorSetId The ID of the operator set
     * @param rewardsRegistry The address of the rewards registry
     * @dev Only callable by the owner
     */
    function setRewardsRegistry(uint32 operatorSetId, IRewardsRegistry rewardsRegistry) external;

    /**
     * @notice Claim rewards for an operator from a specific merkle root index
     * @param operatorSetId The ID of the operator set
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     */
    function claimOperatorRewards(
        uint32 operatorSetId,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from the latest merkle root
     * @param operatorSetId The ID of the operator set
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     */
    function claimLatestOperatorRewards(
        uint32 operatorSetId,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from multiple merkle root indices
     * @param operatorSetId The ID of the operator set
     * @param rootIndices Array of merkle root indices to claim from
     * @param operatorPoints Array of points earned by the operator for each root
     * @param proofs Array of merkle proofs to validate the operator's rewards
     */
    function claimOperatorRewardsBatch(
        uint32 operatorSetId,
        uint256[] calldata rootIndices,
        uint256[] calldata operatorPoints,
        bytes32[][] calldata proofs
    ) external;

    /**
     * @notice Sets the rewards agent address in the RewardsRegistry contract
     * @param rewardsAgent New rewards agent address
     * @dev Only callable by the owner
     */
    function setRewardsAgent(uint32 operatorSetId, address rewardsAgent) external;
}

// src/middleware/SlasherBaseStorage.sol

/// @title SlasherStorage
/// @notice Base storage contract for slashing functionality
/// @dev Provides storage variables and events for slashing operations

abstract contract SlasherStorage is ISlasher {
    /**
     *
     *                            CONSTANTS AND IMMUTABLES
     *
     */

    /// @notice the AllocationManager that tracks OperatorSets and Slashing in EigenLayer
    IAllocationManager public immutable allocationManager;
    /// @notice the ServiceManager of the AVS
    IServiceManager public immutable serviceManager;

    uint256 public nextRequestId;

    constructor(IAllocationManager _allocationManager, IServiceManager _serviceManager) {
        allocationManager = _allocationManager;
        serviceManager = _serviceManager;
    }

    uint256[49] private __gap;
}

// src/middleware/SlasherBase.sol

/// @title SlasherBase
/// @notice Base contract for implementing slashing functionality in an EigenLayer AVS
/// @dev Provides core slashing functionality and interfaces with EigenLayer's AllocationManager
abstract contract SlasherBase is SlasherStorage {
    /// @notice Ensures only the authorized slasher can call certain functions
    modifier onlySlasher() {
        _checkSlasher(msg.sender);
        _;
    }

    /// @notice Constructs the base slasher contract
    /// @param _allocationManager The EigenLayer allocation manager contract
    /// @param _serviceManager The service manager that will manage this slasher
    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager
    ) SlasherStorage(_allocationManager, _serviceManager) {}

    /// @notice Internal function to execute a slashing request
    /// @param _requestId The ID of the slashing request to fulfil
    /// @param _params Parameters defining the slashing request including operator, strategies, and amounts
    /// @dev Calls AllocationManager.slashOperator to perform the actual slashing
    function _fulfilSlashingRequest(
        uint256 _requestId,
        IAllocationManagerTypes.SlashingParams memory _params
    ) internal virtual {
        allocationManager.slashOperator({avs: serviceManager.avs(), params: _params});
        emit OperatorSlashed(
            _requestId,
            _params.operator,
            _params.operatorSetId,
            _params.wadsToSlash,
            _params.description
        );
    }

    /// @notice Internal function to verify if an account is the authorized slasher
    /// @param account The address to check
    /// @dev Reverts if the account is not the ServiceManager
    function _checkSlasher(
        address account
    ) internal view virtual {
        require(account == address(serviceManager), OnlySlasher());
    }

    /// @notice Returns the address of the ServiceManager
    /// @return The address of the ServiceManager
    function slasher() external view returns (address) {
        return address(serviceManager);
    }
}

// src/middleware/VetoableSlasher.sol

/// @title VetoableSlasher
/// @notice A slashing contract that implements a veto mechanism allowing a designated committee to cancel slashing requests
/// @dev Extends SlasherBase and adds a veto period during which slashing requests can be cancelled
contract VetoableSlasher is IVetoableSlasher, SlasherBase {
    /// @inheritdoc IVetoableSlasher
    uint32 public immutable override vetoWindowBlocks;

    /// @inheritdoc IVetoableSlasher
    address public immutable override vetoCommittee;

    /// @notice Mapping of request IDs to their corresponding slashing request details
    mapping(uint256 => IVetoableSlasherTypes.VetoableSlashingRequest) public slashingRequests;

    /// @notice Modifier to restrict function access to only the veto committee
    modifier onlyVetoCommittee() {
        _checkVetoCommittee(msg.sender);
        _;
    }

    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager,
        address _vetoCommittee,
        uint32 _vetoWindowBlocks
    ) SlasherBase(_allocationManager, _serviceManager) {
        vetoWindowBlocks = _vetoWindowBlocks;
        vetoCommittee = _vetoCommittee;
    }

    /// @inheritdoc IVetoableSlasher
    function queueSlashingRequest(
        IAllocationManagerTypes.SlashingParams calldata params
    ) external override onlySlasher {
        _queueSlashingRequest(params);
    }

    /// @inheritdoc IVetoableSlasher
    function cancelSlashingRequest(
        uint256 requestId
    ) external override onlyVetoCommittee {
        _cancelSlashingRequest(requestId);
    }

    /// @inheritdoc IVetoableSlasher
    function fulfilSlashingRequest(
        uint256 requestId
    ) external override {
        _fulfilSlashingRequestAndMarkAsCompleted(requestId);
    }

    /// @notice Internal function to create and store a new slashing request
    /// @param params Parameters defining the slashing request
    function _queueSlashingRequest(
        IAllocationManagerTypes.SlashingParams memory params
    ) internal virtual {
        uint256 requestId = nextRequestId++;
        slashingRequests[requestId] = IVetoableSlasherTypes.VetoableSlashingRequest({
            params: params,
            requestBlock: block.number,
            isPending: true
        });

        emit SlashingRequested(
            requestId, params.operator, params.operatorSetId, params.wadsToSlash, params.description
        );
    }

    /// @notice Internal function to mark a slashing request as cancelled
    /// @param requestId The ID of the slashing request to cancel
    function _cancelSlashingRequest(
        uint256 requestId
    ) internal virtual {
        IVetoableSlasherTypes.VetoableSlashingRequest storage request = slashingRequests[requestId];
        require(block.number < request.requestBlock + vetoWindowBlocks, VetoPeriodPassed());
        require(request.isPending, SlashingRequestNotRequested());

        emit SlashingRequestCancelled(
            request.params.operator,
            request.params.operatorSetId,
            request.params.wadsToSlash,
            request.params.description
        );

        delete slashingRequests[requestId];
    }

    /// @notice Internal function to fullfill a slashing request and mark it as completed
    /// @param requestId The ID of the slashing request to fulfil
    function _fulfilSlashingRequestAndMarkAsCompleted(
        uint256 requestId
    ) internal virtual {
        IVetoableSlasherTypes.VetoableSlashingRequest storage request = slashingRequests[requestId];
        require(block.number >= request.requestBlock + vetoWindowBlocks, VetoPeriodNotPassed());
        require(request.isPending, SlashingRequestIsCancelled());

        request.isPending = false;

        _fulfilSlashingRequest(requestId, request.params);

        emit SlashingRequestFulfilled(
            request.params.operator,
            request.params.operatorSetId,
            request.params.wadsToSlash,
            request.params.description
        );

        delete slashingRequests[requestId];
    }

    /// @notice Internal function to verify if an account is the veto committee
    /// @param account The address to check
    /// @dev Reverts if the account is not the veto committee
    function _checkVetoCommittee(
        address account
    ) internal view virtual {
        require(account == vetoCommittee, OnlyVetoCommittee());
    }
}

