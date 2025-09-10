// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.28 >=0.5.0 >=0.8.19 ^0.8.0 ^0.8.1 ^0.8.2 ^0.8.27;

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-upgradeable-v4.9.0/contracts/utils/AddressUpgradeable.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library AddressUpgradeable {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}

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

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/token/ERC20/extensions/IERC20Permit.sol

// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/extensions/IERC20Permit.sol)

/**
 * @dev Interface of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
 * https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].
 *
 * Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
 * presenting a message signed by the account. By not relying on {IERC20-approve}, the token holder account doesn't
 * need to send a transaction, and thus is not required to hold Ether at all.
 */
interface IERC20Permit {
    /**
     * @dev Sets `value` as the allowance of `spender` over ``owner``'s tokens,
     * given ``owner``'s signed approval.
     *
     * IMPORTANT: The same issues {IERC20-approve} has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments.
     * - the signature must use ``owner``'s current nonce (see {nonces}).
     *
     * For more information on the signature format, see the
     * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
     * section].
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @dev Returns the current nonce for `owner`. This value must be
     * included whenever a signature is generated for {permit}.
     *
     * Every successful call to {permit} increases ``owner``'s nonce by one. This
     * prevents a signature from being used multiple times.
     */
    function nonces(address owner) external view returns (uint256);

    /**
     * @dev Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/utils/Address.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/utils/math/Math.sol

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

// lib/snowbridge/contracts/lib/openzeppelin-contracts/contracts/utils/math/Math.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/math/Math.sol)

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math_1 {
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
library Math_2 {
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

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-upgradeable-v4.9.0/contracts/proxy/utils/Initializable.sol

// OpenZeppelin Contracts (last updated v4.9.0) (proxy/utils/Initializable.sol)

/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Indicates that the contract has been initialized.
     * @custom:oz-retyped-from bool
     */
    uint8 private _initialized;

    /**
     * @dev Indicates that the contract is in the process of being initialized.
     */
    bool private _initializing;

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint8 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that functions marked with `initializer` can be nested in the context of a
     * constructor.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        bool isTopLevelCall = !_initializing;
        require(
            (isTopLevelCall && _initialized < 1) || (!AddressUpgradeable.isContract(address(this)) && _initialized == 1),
            "Initializable: contract is already initialized"
        );
        _initialized = 1;
        if (isTopLevelCall) {
            _initializing = true;
        }
        _;
        if (isTopLevelCall) {
            _initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: setting the version to 255 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint8 version) {
        require(!_initializing && _initialized < version, "Initializable: contract is already initialized");
        _initialized = version;
        _initializing = true;
        _;
        _initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        require(_initializing, "Initializable: contract is not initializing");
        _;
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        require(!_initializing, "Initializable: contract is initializing");
        if (_initialized != type(uint8).max) {
            _initialized = type(uint8).max;
            emit Initialized(type(uint8).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint8) {
        return _initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _initializing;
    }
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

// src/libraries/DataHavenSnowbridgeMessages.sol

// Snowbridge imports

library DataHavenSnowbridgeMessages {
    // Message ID. This is not expected to change and comes from the runtime.
    // See EigenLayerMessageProcessor in primitives/bridge/src/lib.rs.
    bytes4 constant EL_MESSAGE_ID = 0x70150038;

    enum Message {
        V0
    }

    enum OutboundCommandV1 {
        ReceiveValidators
    }

    /**
     * @title New Validator Set Snowbridge Message
     * @notice A struct representing a new validator set to be sent as a message through Snowbridge.
     */
    struct NewValidatorSet {
        /// @notice The payload of the message
        NewValidatorSetPayload payload;
    }

    /**
     * @title New Validator Set Snowbridge Message Payload
     * @notice A struct representing the payload of a new validator set message.
     *         This mimics the message format defined in the InboundQueueV2 pallet of the DataHaven
     *         solochain.
     */
    struct NewValidatorSetPayload {
        /// @notice The list of validators in the DataHaven network.
        address[] validators;
    }

    /**
     * @notice Encodes a new validator set message into a bytes array.
     * @param message The new validator set message to encode.
     * @return The encoded message.
     */
    function scaleEncodeNewValidatorSetMessage(
        NewValidatorSet memory message
    ) public pure returns (bytes memory) {
        return scaleEncodeNewValidatorSetMessagePayload(message.payload);
    }

    /**
     * @notice Encodes a new validator set message payload into a bytes array.
     * @param payload The new validator set message payload to encode.
     * @return The encoded payload.
     */
    function scaleEncodeNewValidatorSetMessagePayload(
        NewValidatorSetPayload memory payload
    ) public pure returns (bytes memory) {
        uint32 validatorsLen = uint32(payload.validators.length);
        address[] memory validatorSet = payload.validators;

        uint64 externalIndex = uint64(0);

        // Flatten the validator set into a single bytes array
        bytes memory validatorsFlattened;
        for (uint32 i = 0; i < validatorSet.length; i++) {
            validatorsFlattened =
                bytes.concat(validatorsFlattened, abi.encodePacked(validatorSet[i]));
        }

        return bytes.concat(
            EL_MESSAGE_ID,
            bytes1(uint8(Message.V0)),
            bytes1(uint8(OutboundCommandV1.ReceiveValidators)),
            ScaleCodec.encodeCompactU32(validatorsLen),
            validatorsFlattened,
            ScaleCodec.encodeU64(externalIndex)
        );
    }
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-upgradeable-v4.9.0/contracts/utils/ContextUpgradeable.sol

// OpenZeppelin Contracts v4.4.1 (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract ContextUpgradeable is Initializable {
    function __Context_init() internal onlyInitializing {
    }

    function __Context_init_unchained() internal onlyInitializing {
    }
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
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
    using Math_0 for uint256;
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
        return x.mulDiv(y, WAD, Math_0.Rounding.Up);
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
        return operatorShares - operatorShares.mulDiv(newMaxMagnitude, prevMaxMagnitude, Math_0.Rounding.Up);
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
            uint256 length = Math_1.log10(value) + 1;
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
            return toHexString(value, Math_1.log256(value) + 1);
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

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-upgradeable-v4.9.0/contracts/access/OwnableUpgradeable.sol

// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function __Ownable_init() internal onlyInitializing {
        __Ownable_init_unchained();
    }

    function __Ownable_init_unchained() internal onlyInitializing {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/token/ERC20/utils/SafeERC20.sol

// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/utils/SafeERC20.sol)

/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using Address for address;

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
     * @dev Deprecated. This function has issues similar to the ones found in
     * {IERC20-approve}, and its usage is discouraged.
     *
     * Whenever possible, use {safeIncreaseAllowance} and
     * {safeDecreaseAllowance} instead.
     */
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance + value));
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        unchecked {
            uint256 oldAllowance = token.allowance(address(this), spender);
            require(oldAllowance >= value, "SafeERC20: decreased allowance below zero");
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance - value));
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Compatible with tokens that require the approval to be set to
     * 0 before setting it to a non-zero value.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeWithSelector(token.approve.selector, spender, value);

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, 0));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Use a ERC-2612 signature to set the `owner` approval toward `spender` on `token`.
     * Revert on invalid signature.
     */
    function safePermit(
        IERC20Permit token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        uint256 nonceBefore = token.nonces(owner);
        token.permit(owner, spender, value, deadline, v, r, s);
        uint256 nonceAfter = token.nonces(owner);
        require(nonceAfter == nonceBefore + 1, "SafeERC20: permit did not succeed");
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address-functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        require(returndata.length == 0 || abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silents catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We cannot use {Address-functionCall} here since this should return false
        // and not revert is the subcall reverts.

        (bool success, bytes memory returndata) = address(token).call(data);
        return
            success && (returndata.length == 0 || abi.decode(returndata, (bool))) && Address.isContract(address(token));
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

// src/interfaces/IDataHavenServiceManager.sol

// EigenLayer imports

/**
 * @title DataHaven Service Manager Errors Interface
 * @notice Contains all error definitions used by the DataHaven Service Manager
 */
interface IDataHavenServiceManagerErrors {
    /// @notice Thrown when an operator attempts to register with an incorrect AVS address
    error IncorrectAVSAddress();
    /// @notice Thrown when an operator attempts to register to multiple operator sets at once
    error CantRegisterToMultipleOperatorSets();
    /// @notice Thrown when an operator attempts to deregister from multiple operator sets at once
    error CantDeregisterFromMultipleOperatorSets();
    /// @notice Thrown when an invalid operator set ID is provided
    error InvalidOperatorSetId();
    /// @notice Thrown when an operator not in the appropriate allowlist attempts to register
    error OperatorNotInAllowlist();
    /// @notice Thrown when the caller is not a Validator in the Validators operator set
    error CallerIsNotValidator();
}

/**
 * @title DataHaven Service Manager Events Interface
 * @notice Contains all event definitions emitted by the DataHaven Service Manager
 */
interface IDataHavenServiceManagerEvents {
    /// @notice Emitted when an operator successfully registers to an operator set
    /// @param operator Address of the operator that registered
    /// @param operatorSetId ID of the operator set the operator registered to
    event OperatorRegistered(address indexed operator, uint32 indexed operatorSetId);

    /// @notice Emitted when an operator deregisters from an operator set
    /// @param operator Address of the operator that deregistered
    /// @param operatorSetId ID of the operator set the operator deregistered from
    event OperatorDeregistered(address indexed operator, uint32 indexed operatorSetId);

    /// @notice Emitted when a validator is added to the allowlist
    /// @param validator Address of the validator added to the allowlist
    event ValidatorAddedToAllowlist(address indexed validator);

    /// @notice Emitted when a Backup Storage Provider is added to the allowlist
    /// @param bsp Address of the BSP added to the allowlist
    event BspAddedToAllowlist(address indexed bsp);

    /// @notice Emitted when a Main Storage Provider is added to the allowlist
    /// @param msp Address of the MSP added to the allowlist
    event MspAddedToAllowlist(address indexed msp);

    /// @notice Emitted when a validator is removed from the allowlist
    /// @param validator Address of the validator removed from the allowlist
    event ValidatorRemovedFromAllowlist(address indexed validator);

    /// @notice Emitted when a Backup Storage Provider is removed from the allowlist
    /// @param bsp Address of the BSP removed from the allowlist
    event BspRemovedFromAllowlist(address indexed bsp);

    /// @notice Emitted when a Main Storage Provider is removed from the allowlist
    /// @param msp Address of the MSP removed from the allowlist
    event MspRemovedFromAllowlist(address indexed msp);

    /// @notice Emitted when the Snowbridge Gateway address is set
    /// @param snowbridgeGateway Address of the Snowbridge Gateway
    event SnowbridgeGatewaySet(address indexed snowbridgeGateway);
}

/**
 * @title DataHaven Service Manager Interface
 * @notice Defines the interface for the DataHaven Service Manager, which manages validators,
 *         backup storage providers (BSPs), and main storage providers (MSPs) in the DataHaven network
 */
interface IDataHavenServiceManager is
    IDataHavenServiceManagerErrors,
    IDataHavenServiceManagerEvents
{
    /// @notice Checks if a validator address is in the allowlist
    /// @param validator Address to check
    /// @return True if the validator is in the allowlist, false otherwise
    function validatorsAllowlist(
        address validator
    ) external view returns (bool);

    /// @notice Checks if a BSP address is in the allowlist
    /// @param bsp Address to check
    /// @return True if the BSP is in the allowlist, false otherwise
    function bspsAllowlist(
        address bsp
    ) external view returns (bool);

    /// @notice Checks if an MSP address is in the allowlist
    /// @param msp Address to check
    /// @return True if the MSP is in the allowlist, false otherwise
    function mspsAllowlist(
        address msp
    ) external view returns (bool);

    /// @notice Returns the Snowbridge Gateway address
    /// @return The Snowbridge gateway address
    function snowbridgeGateway() external view returns (address);

    /**
     * @notice Converts a validator address to the corresponding Solochain address
     * @param validatorAddress The address of the validator to convert
     * @return The corresponding Solochain address
     */
    function validatorEthAddressToSolochainAddress(
        address validatorAddress
    ) external view returns (address);

    /**
     * @notice Initializes the DataHaven Service Manager
     * @param initialOwner Address of the initial owner
     * @param rewardsInitiator Address authorized to initiate rewards
     * @param validatorsStrategies Array of strategies supported by validators
     * @param bspsStrategies Array of strategies supported by BSPs
     * @param mspsStrategies Array of strategies supported by MSPs
     */
    function initialise(
        address initialOwner,
        address rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies,
        address _snowbridgeGatewayAddress
    ) external;

    /**
     * @notice Sends a new validator set to the Snowbridge Gateway
     * @dev The new validator set is made up of the Validators currently
     *      registered in the DataHaven Service Manager as operators of
     *      the Validators operator set (operatorSetId = VALIDATORS_SET_ID)
     * @dev Only callable by the owner
     * @param executionFee The execution fee for the Snowbridge message
     * @param relayerFee The relayer fee for the Snowbridge message
     */
    function sendNewValidatorSet(uint128 executionFee, uint128 relayerFee) external payable;

    /**
     * @notice Builds a new validator set message to be sent to the Snowbridge Gateway
     * @return The encoded message bytes to be sent to the Snowbridge Gateway
     */
    function buildNewValidatorSetMessage() external view returns (bytes memory);

    /**
     * @notice Updates the Solochain address for a Validator
     * @param solochainAddress The new Solochain address for the Validator
     * @dev The caller must be the registered operator address for the Validator, in EigenLayer,
     *      in the Validators operator set (operatorSetId = VALIDATORS_SET_ID)
     */
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external;

    /**
     * @notice Sets the Snowbridge Gateway address
     * @param _snowbridgeGateway The address of the Snowbridge Gateway
     */
    function setSnowbridgeGateway(
        address _snowbridgeGateway
    ) external;

    /**
     * @notice Adds a validator to the allowlist
     * @param validator Address of the validator to add
     */
    function addValidatorToAllowlist(
        address validator
    ) external;

    /**
     * @notice Adds a BSP to the allowlist
     * @param bsp Address of the BSP to add
     */
    function addBspToAllowlist(
        address bsp
    ) external;

    /**
     * @notice Adds an MSP to the allowlist
     * @param msp Address of the MSP to add
     */
    function addMspToAllowlist(
        address msp
    ) external;

    /**
     * @notice Removes a validator from the allowlist
     * @param validator Address of the validator to remove
     */
    function removeValidatorFromAllowlist(
        address validator
    ) external;

    /**
     * @notice Removes a BSP from the allowlist
     * @param bsp Address of the BSP to remove
     */
    function removeBspFromAllowlist(
        address bsp
    ) external;

    /**
     * @notice Removes an MSP from the allowlist
     * @param msp Address of the MSP to remove
     */
    function removeMspFromAllowlist(
        address msp
    ) external;

    /**
     * @notice Returns all strategies supported by the DataHaven Validators operator set
     * @return An array of strategy contracts that validators can delegate to
     */
    function validatorsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for DataHaven Validators
     * @param _strategies Array of strategy contracts to remove from validators operator set
     */
    function removeStrategiesFromValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for DataHaven Validators
     * @param _strategies Array of strategy contracts to add to validators operator set
     */
    function addStrategiesToValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Returns all strategies supported by the Backup Storage Providers (BSPs) operator set
     * @return An array of strategy contracts that BSPs can delegate to
     */
    function bspsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for Backup Storage Providers
     * @param _strategies Array of strategy contracts to remove from BSPs operator set
     */
    function removeStrategiesFromBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for Backup Storage Providers
     * @param _strategies Array of strategy contracts to add to BSPs operator set
     */
    function addStrategiesToBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Returns all strategies supported by the Main Storage Providers (MSPs) operator set
     * @return An array of strategy contracts that MSPs can delegate to
     */
    function mspsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for Main Storage Providers
     * @param _strategies Array of strategy contracts to remove from MSPs operator set
     */
    function removeStrategiesFromMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for Main Storage Providers
     * @param _strategies Array of strategy contracts to add to MSPs operator set
     */
    function addStrategiesToMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;
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
    using Math_2 for uint16;
    using Math_2 for uint256;

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
        numRequiredSignatures += Math_2.log2(validatorSetLen, Math_2.Rounding.Ceil);
        // Add signatures based on the signature usage count.
        numRequiredSignatures += 1 + (2 * Math_2.log2(signatureUsageCount, Math_2.Rounding.Ceil));
        // Never require more signatures than a 2/3 majority
        return Math_2.min(numRequiredSignatures, computeQuorum(validatorSetLen));
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

// src/middleware/ServiceManagerBaseStorage.sol

/**
 * @title Storage variables for the `ServiceManagerBase` contract.
 * @author Layr Labs, Inc.
 * @notice This storage contract is separate from the logic to simplify the upgrade process.
 */
abstract contract ServiceManagerBaseStorage is IServiceManager, OwnableUpgradeable {
    /**
     *
     *                            CONSTANTS AND IMMUTABLES
     *
     */
    IAllocationManager internal immutable _allocationManager;
    IRewardsCoordinator internal immutable _rewardsCoordinator;
    IPermissionController internal immutable _permissionController;

    /**
     *
     *                            STATE VARIABLES
     *
     */

    /// @notice The slasher contract that handles operator slashing
    IVetoableSlasher internal _slasher;

    /// @notice The address of the entity that can initiate rewards
    address public rewardsInitiator;

    /// @notice Mapping from operator set ID to its respective RewardsRegistry
    mapping(uint32 => IRewardsRegistry) public operatorSetToRewardsRegistry;

    /// @notice Sets the (immutable) rewardsCoordinator`, `_permissionController`, and `_allocationManager` addresses
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    ) {
        _rewardsCoordinator = __rewardsCoordinator;
        _permissionController = __permissionController;
        _allocationManager = __allocationManager;
    }

    // storage gap for upgradeability
    // solhint-disable-next-line var-name-mixedcase
    uint256[49] private __GAP;
}

// src/middleware/ServiceManagerBase.sol

/**
 * @title Minimal implementation of a ServiceManager-type contract.
 * This contract can be inherited from or simply used as a point-of-reference.
 */
abstract contract ServiceManagerBase is ServiceManagerBaseStorage, IAVSRegistrar {
    using SafeERC20 for IERC20;

    /// @notice only rewardsInitiator can call createAVSRewardsSubmission
    modifier onlyRewardsInitiator() {
        _checkRewardsInitiator();
        _;
    }

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    )
        ServiceManagerBaseStorage(__rewardsCoordinator, __permissionController, __allocationManager)
    {
        _disableInitializers();
    }

    // solhint-disable-next-line func-name-mixedcase
    function __ServiceManagerBase_init(
        address initialOwner,
        address _rewardsInitiator
    ) internal virtual onlyInitializing {
        _transferOwnership(initialOwner);
        _setRewardsInitiator(_rewardsInitiator);
    }

    /**
     * @notice Sets the slasher contract
     * @param slasher The slasher contract address
     * @dev Only callable by the owner
     */
    function setSlasher(
        IVetoableSlasher slasher
    ) external virtual onlyOwner {
        _slasher = slasher;
    }

    /**
     * @notice Updates the metadata URI for the AVS
     * @param _metadataURI is the metadata URI for the AVS
     * @dev only callable by the owner
     */
    function updateAVSMetadataURI(
        string memory _metadataURI
    ) external virtual onlyOwner {
        _allocationManager.updateAVSMetadataURI(address(this), _metadataURI);
    }

    /**
     * Forwards the call to the AllocationManager.createOperatorSets() function
     */
    function createOperatorSets(
        IAllocationManagerTypes.CreateSetParams[] calldata params
    ) external virtual onlyOwner {
        _allocationManager.createOperatorSets(address(this), params);
    }

    /**
     * Forwards the call to the AllocationManager.addStrategiesToOperatorSet() function
     */
    function addStrategiesToOperatorSet(
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), operatorSetId, strategies);
    }

    /**
     * Forwards the call to the AllocationManager.removeStrategiesFromOperatorSet() function
     */
    function removeStrategiesFromOperatorSet(
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(address(this), operatorSetId, strategies);
    }

    /**
     * Queue a slashing request in the vetoable slasher
     * @param params Parameters defining the slashing request
     * @dev Can only be called by the owner
     */
    function queueSlashingRequest(
        IAllocationManagerTypes.SlashingParams calldata params
    ) external virtual onlyOwner {
        require(address(_slasher) != address(0), "Slasher not set");
        _slasher.queueSlashingRequest(params);
    }

    /**
     * fulfils a slashing request that has passed the veto period
     * @param requestId The ID of the slashing request to fulfil
     * @dev Can be called by anyone
     */
    function fulfilSlashingRequest(
        uint256 requestId
    ) external virtual {
        require(address(_slasher) != address(0), "Slasher not set");
        _slasher.fulfilSlashingRequest(requestId);
    }

    /**
     * @dev DEPRECATED ❗️ This function is not used. This contract distributes rewards directly to operators
     * instead of using the RewardsCoordinator.
     * @notice Creates a new operator-directed rewards submission, to be split amongst the operators and
     * set of stakers delegated to operators who are registered to this AVS' OperatorSet.
     * @param operatorSet The OperatorSet to create the rewards submission for
     * @param operatorDirectedRewardsSubmissions The operator-directed rewards submissions being created.
     * @dev Only callable by the permissioned rewardsInitiator address
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev This contract needs a token approval of sum of all `operatorRewards` in the `operatorDirectedRewardsSubmissions`, before calling this function.
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev Operators must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `operatorDirectedRewardsSubmissions` is malformed.
     * @dev This function may fail to execute with a large number of submissions due to gas limits. Use a
     * smaller array of submissions if necessary.
     */
    function createOperatorDirectedOperatorSetRewardsSubmission(
        OperatorSet calldata operatorSet,
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] calldata
            operatorDirectedRewardsSubmissions
    ) public virtual onlyRewardsInitiator {
        for (uint256 i = 0; i < operatorDirectedRewardsSubmissions.length; ++i) {
            // Calculate total amount of tokens to transfer
            uint256 totalAmount = 0;
            for (
                uint256 j = 0; j < operatorDirectedRewardsSubmissions[i].operatorRewards.length; ++j
            ) {
                totalAmount += operatorDirectedRewardsSubmissions[i].operatorRewards[j].amount;
            }

            // Transfer token to ServiceManager and approve RewardsCoordinator to transfer again
            // in createOperatorDirectedOperatorSetRewardsSubmission() call
            IERC20(operatorDirectedRewardsSubmissions[i].token).safeTransferFrom(
                msg.sender, address(this), totalAmount
            );
            operatorDirectedRewardsSubmissions[i].token.safeIncreaseAllowance(
                address(_rewardsCoordinator), totalAmount
            );
        }

        _rewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission(
            operatorSet, operatorDirectedRewardsSubmissions
        );

        // REVERTING BECAUSE THIS FUNCTION IS DEPRECATED ❗️
        revert(
            "ServiceManagerBase: createOperatorDirectedOperatorSetRewardsSubmission is deprecated"
        );
    }

    /// @inheritdoc IServiceManager
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) external virtual override {
        IAllocationManagerTypes.DeregisterParams memory params = IAllocationManagerTypes
            .DeregisterParams({operator: operator, avs: address(this), operatorSetIds: operatorSetIds});
        _allocationManager.deregisterFromOperatorSets(params);
    }

    /// @inheritdoc IAVSRegistrar
    function supportsAVS(
        address avsAddress
    ) external view virtual override returns (bool) {
        return avsAddress == this.avs();
    }

    /// @inheritdoc IAVSRegistrar
    function registerOperator(
        address, // operator,
        address, // avs,
        uint32[] calldata, // operatorSetIds,
        bytes calldata // data
    ) external virtual {
        // Always accepts Operator registration.
        return;
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address, // operator,
        address, // avs,
        uint32[] calldata // operatorSetIds
    ) external virtual {
        // Always rejects Operator deregistration.
        revert("ServiceManagerBase: deregistration not supported, we are evil");
    }

    /// @inheritdoc IServiceManager
    function addPendingAdmin(
        address admin
    ) external onlyOwner {
        _permissionController.addPendingAdmin({account: address(this), admin: admin});
    }

    /// @inheritdoc IServiceManager
    function removePendingAdmin(
        address pendingAdmin
    ) external onlyOwner {
        _permissionController.removePendingAdmin({account: address(this), admin: pendingAdmin});
    }

    /// @inheritdoc IServiceManager
    function removeAdmin(
        address admin
    ) external onlyOwner {
        _permissionController.removeAdmin({account: address(this), admin: admin});
    }

    /// @inheritdoc IServiceManager
    function setAppointee(address appointee, address target, bytes4 selector) external onlyOwner {
        _permissionController.setAppointee({
            account: address(this),
            appointee: appointee,
            target: target,
            selector: selector
        });
    }

    /// @inheritdoc IServiceManager
    function removeAppointee(
        address appointee,
        address target,
        bytes4 selector
    ) external onlyOwner {
        _permissionController.removeAppointee({
            account: address(this),
            appointee: appointee,
            target: target,
            selector: selector
        });
    }

    /// @inheritdoc IServiceManager
    function avs() external view virtual returns (address) {
        return address(this);
    }

    /**
     * @dev DEPRECATED ❗️ This function is not used. This contract distributes rewards directly to operators
     * instead of using the RewardsCoordinator.
     * @notice Sets the rewards initiator address
     * @param newRewardsInitiator The new rewards initiator address
     * @dev only callable by the owner
     */
    function setRewardsInitiator(
        address newRewardsInitiator
    ) external virtual onlyOwner {
        _setRewardsInitiator(newRewardsInitiator);

        // REVERTING BECAUSE THIS FUNCTION IS DEPRECATED ❗️
        revert("ServiceManagerBase: setRewardsInitiator is deprecated");
    }

    /**
     * @notice Sets the rewards registry for an operator set
     * @param operatorSetId The ID of the operator set
     * @param rewardsRegistry The address of the rewards registry
     * @dev Only callable by the owner
     */
    function setRewardsRegistry(
        uint32 operatorSetId,
        IRewardsRegistry rewardsRegistry
    ) external virtual override onlyOwner {
        operatorSetToRewardsRegistry[operatorSetId] = rewardsRegistry;
        emit RewardsRegistrySet(operatorSetId, address(rewardsRegistry));
    }

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
    ) external virtual override {
        // Get the rewards registry for this operator set
        IRewardsRegistry rewardsRegistry = operatorSetToRewardsRegistry[operatorSetId];
        if (address(rewardsRegistry) == address(0)) {
            revert NoRewardsRegistryForOperatorSet();
        }

        // Ensure the operator is part of the operator set
        _ensureOperatorIsPartOfOperatorSet(msg.sender, operatorSetId);

        // Forward the claim to the rewards registry
        rewardsRegistry.claimRewards(msg.sender, rootIndex, operatorPoints, proof);
    }

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
    ) external virtual override {
        // Get the rewards registry for this operator set
        IRewardsRegistry rewardsRegistry = operatorSetToRewardsRegistry[operatorSetId];
        if (address(rewardsRegistry) == address(0)) {
            revert NoRewardsRegistryForOperatorSet();
        }

        // Ensure the operator is part of the operator set
        _ensureOperatorIsPartOfOperatorSet(msg.sender, operatorSetId);

        // Forward the claim to the rewards registry
        rewardsRegistry.claimLatestRewards(msg.sender, operatorPoints, proof);
    }

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
    ) external virtual override {
        // Get the rewards registry for this operator set
        IRewardsRegistry rewardsRegistry = operatorSetToRewardsRegistry[operatorSetId];
        if (address(rewardsRegistry) == address(0)) {
            revert NoRewardsRegistryForOperatorSet();
        }

        // Ensure the operator is part of the operator set
        _ensureOperatorIsPartOfOperatorSet(msg.sender, operatorSetId);

        // Forward the claim to the rewards registry
        rewardsRegistry.claimRewardsBatch(msg.sender, rootIndices, operatorPoints, proofs);
    }

    /**
     * @notice Sets the rewards agent address in the RewardsRegistry contract
     * @param operatorSetId The ID of the operator set
     * @param rewardsAgent New rewards agent address
     * @dev Only callable by the owner
     */
    function setRewardsAgent(
        uint32 operatorSetId,
        address rewardsAgent
    ) external virtual override onlyOwner {
        IRewardsRegistry rewardsRegistry = operatorSetToRewardsRegistry[operatorSetId];
        if (address(rewardsRegistry) == address(0)) {
            revert NoRewardsRegistryForOperatorSet();
        }

        rewardsRegistry.setRewardsAgent(rewardsAgent);
    }

    /**
     * @notice Forwards a call to Eigenlayer's RewardsCoordinator contract to set the address of the entity that can call `processClaim` on behalf of this contract.
     * @param claimer The address of the entity that can call `processClaim` on behalf of the earner
     * @dev Only callable by the owner.
     */
    function setClaimerFor(
        address claimer
    ) public virtual onlyOwner {
        _rewardsCoordinator.setClaimerFor(claimer);
    }

    /**
     * @notice Returns the list of strategies that the AVS supports for restaking
     * @dev This function is intended to be called off-chain
     * @dev No guarantee is made on uniqueness of each element in the returned array.
     *      The off-chain service should do that validation separately
     */
    function getRestakeableStrategies() external view virtual returns (address[] memory) {
        // TODO: Implement this
        return new address[](0);
    }

    /**
     * @notice Returns the list of strategies that the operator has potentially restaked on the AVS
     * @param operator The address of the operator to get restaked strategies for
     * @dev This function is intended to be called off-chain
     * @dev No guarantee is made on whether the operator has shares for a strategy in a quorum or uniqueness
     *      of each element in the returned array. The off-chain service should do that validation separately
     */
    function getOperatorRestakedStrategies(
        address operator
    ) external view virtual returns (address[] memory) {
        // TODO implement
        if (operator == address(0)) {
            return new address[](0);
        }
        return new address[](0);
    }

    /// @dev DEPRECATED ❗️ This function is not used in the ServiceManagerBase contract
    /// as it would use the deprecated `IAVSRegistrar` interface.
    /// Calling this function will revert.
    function registerOperatorToAVS(
        address, // operator
        ISignatureUtilsMixinTypes.SignatureWithSaltAndExpiry calldata // operatorSignature
    ) external virtual override {
        revert("ServiceManagerBase: registerOperatorToAVS is deprecated");
    }

    /// @dev DEPRECATED ❗️ This function is not used in the ServiceManagerBase contract
    /// as it would use the deprecated `IAVSRegistrar` interface.
    /// Calling this function will revert.
    function deregisterOperatorFromAVS(
        address // operator
    ) external virtual override {
        revert("ServiceManagerBase: deregisterOperatorFromAVS is deprecated");
    }

    /// @dev NOT IMPLEMENTED ❗️ This function is not implemented in the ServiceManagerBase
    /// contract as this contract only handles operator-directed rewards submissions.
    /// Calling this function will revert.
    function createAVSRewardsSubmission(
        IRewardsCoordinatorTypes.RewardsSubmission[] calldata rewardsSubmissions
    ) external virtual override {}

    /**
     * @notice Ensure the operator is part of the operator set
     * @param operator The operator address
     * @param operatorSetId The operator set ID
     * @dev Reverts if the operator is not part of the operator set
     */
    function _ensureOperatorIsPartOfOperatorSet(
        address operator,
        uint32 operatorSetId
    ) internal view virtual {
        // Make sure the operator is part of the received operator
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: operatorSetId});
        if (!_allocationManager.isMemberOfOperatorSet(operator, operatorSet)) {
            revert OperatorNotInOperatorSet();
        }
    }

    /**
     * @dev Internal function to handle setting a rewards initiator
     * @param _rewardsInitiator The new rewards initiator
     */
    function _setRewardsInitiator(
        address _rewardsInitiator
    ) internal {
        address prevRewardsInitiator = rewardsInitiator;
        rewardsInitiator = _rewardsInitiator;
        emit RewardsInitiatorUpdated(prevRewardsInitiator, _rewardsInitiator);
    }

    /**
     * @dev Verifies that the caller is the appointed rewardsInitiator
     */
    function _checkRewardsInitiator() internal view {
        require(msg.sender == rewardsInitiator, OnlyRewardsInitiator());
    }
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

// src/DataHavenServiceManager.sol

// EigenLayer imports

// Snowbridge imports

// DataHaven imports

/**
 * @title DataHaven ServiceManager contract
 * @notice Manages validators, backup storage providers (BSPs), and main storage providers (MSPs)
 * in the DataHaven network
 */
contract DataHavenServiceManager is ServiceManagerBase, IDataHavenServiceManager {
    /// @notice The metadata for the DataHaven AVS.
    string public constant DATAHAVEN_AVS_METADATA = "https://datahaven.network/";

    /// @notice The EigenLayer operator set ID for the Validators securing the DataHaven network.
    uint32 public constant VALIDATORS_SET_ID = 0;
    /// @notice The EigenLayer operator set ID for the Backup Storage Providers participating in the DataHaven network.
    uint32 public constant BSPS_SET_ID = 1;
    /// @notice The EigenLayer operator set ID for the Main Storage Providers participating in the DataHaven network.
    uint32 public constant MSPS_SET_ID = 2;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;
    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public bspsAllowlist;
    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public mspsAllowlist;

    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    ) ServiceManagerBase(__rewardsCoordinator, __permissionController, __allocationManager) {}

    /// @notice Modifier to ensure the caller is a registered Validator
    modifier onlyValidator() {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        require(
            _allocationManager.isMemberOfOperatorSet(msg.sender, operatorSet),
            CallerIsNotValidator()
        );
        _;
    }

    /// @inheritdoc IDataHavenServiceManager
    function initialise(
        address initialOwner,
        address rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies,
        address _snowbridgeGatewayAddress
    ) public virtual initializer {
        __ServiceManagerBase_init(initialOwner, rewardsInitiator);

        // Register the DataHaven service in the AllocationManager.
        _allocationManager.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator sets for the DataHaven service.
        _createDataHavenOperatorSets(validatorsStrategies, bspsStrategies, mspsStrategies);

        // Set the Snowbridge Gateway address.
        // This is the contract to which messages are sent, to be relayed to the Solochain network.
        _snowbridgeGateway = IGatewayV2(_snowbridgeGatewayAddress);
    }

    /// @inheritdoc IDataHavenServiceManager
    function sendNewValidatorSet(
        uint128 executionFee,
        uint128 relayerFee
    ) external payable onlyOwner {
        // Send the new validator set message to the Snowbridge Gateway
        bytes memory message = buildNewValidatorSetMessage();
        _snowbridgeGateway.v2_sendMessage{value: msg.value}(
            message,
            new bytes[](0), // No assets to send
            bytes(""), // No claimer
            executionFee,
            relayerFee
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function buildNewValidatorSetMessage() public view returns (bytes memory) {
        // Get the current validator set
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        address[] memory currentValidatorSet = _allocationManager.getMembers(operatorSet);

        // Build the new validator set message
        address[] memory newValidatorSet = new address[](currentValidatorSet.length);
        for (uint256 i = 0; i < currentValidatorSet.length; i++) {
            newValidatorSet[i] = validatorEthAddressToSolochainAddress[currentValidatorSet[i]];
        }
        DataHavenSnowbridgeMessages.NewValidatorSetPayload memory newValidatorSetPayload =
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: newValidatorSet});
        DataHavenSnowbridgeMessages.NewValidatorSet memory newValidatorSetMessage =
            DataHavenSnowbridgeMessages.NewValidatorSet({payload: newValidatorSetPayload});

        // Return the encoded message
        return DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessage(newValidatorSetMessage);
    }

    /// @inheritdoc IDataHavenServiceManager
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external onlyValidator {
        // Update the Solochain address for the Validator
        validatorEthAddressToSolochainAddress[msg.sender] = solochainAddress;
    }

    /// @inheritdoc IDataHavenServiceManager
    function setSnowbridgeGateway(
        address _newSnowbridgeGateway
    ) external onlyOwner {
        _snowbridgeGateway = IGatewayV2(_newSnowbridgeGateway);
        emit SnowbridgeGatewaySet(_newSnowbridgeGateway);
    }

    /// @inheritdoc IAVSRegistrar
    function registerOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds,
        bytes calldata data
    ) external override {
        if (avs != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantRegisterToMultipleOperatorSets();
        }

        // Case: Validator
        if (operatorSetIds[0] == VALIDATORS_SET_ID) {
            if (!validatorsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }

            // In the case of the Validators operator set, expect the data to have the Solochain address of the operator.
            // Require validators to provide 20 bytes addresses.
            require(data.length == 20, "Invalid solochain address length");
            validatorEthAddressToSolochainAddress[operator] = address(bytes20(data));
        }
        // Case: BSP
        else if (operatorSetIds[0] == BSPS_SET_ID) {
            if (!bspsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }
        }
        // Case: MSP
        else if (operatorSetIds[0] == MSPS_SET_ID) {
            if (!mspsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }
        }
        // Case: Invalid operator set ID
        else {
            revert InvalidOperatorSetId();
        }

        emit OperatorRegistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds
    ) external override {
        if (avs != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantDeregisterFromMultipleOperatorSets();
        }

        if (
            operatorSetIds[0] != VALIDATORS_SET_ID && operatorSetIds[0] != BSPS_SET_ID
                && operatorSetIds[0] != MSPS_SET_ID
        ) {
            revert InvalidOperatorSetId();
        }

        if (operatorSetIds[0] == VALIDATORS_SET_ID) {
            // Remove validator from the addresses mapping
            delete validatorEthAddressToSolochainAddress[operator];
        }

        emit OperatorDeregistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addValidatorToAllowlist(
        address validator
    ) external onlyOwner {
        validatorsAllowlist[validator] = true;
        emit ValidatorAddedToAllowlist(validator);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addBspToAllowlist(
        address bsp
    ) external onlyOwner {
        bspsAllowlist[bsp] = true;
        emit BspAddedToAllowlist(bsp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addMspToAllowlist(
        address msp
    ) external onlyOwner {
        mspsAllowlist[msp] = true;
        emit MspAddedToAllowlist(msp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeValidatorFromAllowlist(
        address validator
    ) external onlyOwner {
        validatorsAllowlist[validator] = false;
        emit ValidatorRemovedFromAllowlist(validator);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeBspFromAllowlist(
        address bsp
    ) external onlyOwner {
        bspsAllowlist[bsp] = false;
        emit BspRemovedFromAllowlist(bsp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeMspFromAllowlist(
        address msp
    ) external onlyOwner {
        mspsAllowlist[msp] = false;
        emit MspRemovedFromAllowlist(msp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function validatorsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(
            address(this), VALIDATORS_SET_ID, _strategies
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), VALIDATORS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function bspsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: BSPS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(address(this), BSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), BSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function mspsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: MSPS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(address(this), MSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), MSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function snowbridgeGateway() external view returns (address) {
        return address(_snowbridgeGateway);
    }

    /**
     * @notice Creates the initial operator sets for DataHaven in the AllocationManager.
     * @dev This function should be called during initialisation to set up the required operator sets.
     */
    function _createDataHavenOperatorSets(
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies
    ) internal {
        IAllocationManagerTypes.CreateSetParams[] memory operatorSets =
            new IAllocationManagerTypes.CreateSetParams[](3);
        operatorSets[0] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: VALIDATORS_SET_ID,
            strategies: validatorsStrategies
        });
        operatorSets[1] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: BSPS_SET_ID,
            strategies: bspsStrategies
        });
        operatorSets[2] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: MSPS_SET_ID,
            strategies: mspsStrategies
        });
        _allocationManager.createOperatorSets(address(this), operatorSets);
    }
}
