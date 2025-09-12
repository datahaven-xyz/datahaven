// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.28;

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

