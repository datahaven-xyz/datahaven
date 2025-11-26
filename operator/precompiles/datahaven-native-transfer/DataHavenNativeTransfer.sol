// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The DataHavenNativeTransfer precompile address.
address constant DATAHAVEN_NATIVE_TRANSFER_ADDRESS = 0x0000000000000000000000000000000000000819;

/// @dev The DataHavenNativeTransfer precompile instance.
DataHavenNativeTransfer constant DATAHAVEN_NATIVE_TRANSFER_CONTRACT =
    DataHavenNativeTransfer(DATAHAVEN_NATIVE_TRANSFER_ADDRESS);

/// @author The DataHaven Team
/// @title DataHaven Native Transfer Interface
/// @notice Interface for transferring DataHaven native tokens to/from Ethereum via Snowbridge
/// @custom:address 0x0000000000000000000000000000000000000819
interface DataHavenNativeTransfer {
    /// @notice Emitted when tokens are locked for transfer to Ethereum
    /// @param account The account that locked tokens
    /// @param amount The amount of tokens locked
    event TokensLocked(address indexed account, uint256 amount);

    /// @notice Emitted when tokens are unlocked from Ethereum
    /// @param account The account that received unlocked tokens
    /// @param amount The amount of tokens unlocked
    event TokensUnlocked(address indexed account, uint256 amount);

    /// @notice Emitted when tokens are transferred to Ethereum
    /// @param from The account initiating the transfer
    /// @param to The Ethereum address receiving the tokens
    /// @param amount The amount of tokens transferred
    event TokensTransferredToEthereum(address indexed from, address indexed to, uint256 amount);

    /// @notice Emitted when the pallet is paused
    event Paused();

    /// @notice Emitted when the pallet is unpaused
    event Unpaused();

    /// @notice Transfer DataHaven native tokens to Ethereum
    /// @dev Locks tokens in the sovereign account and sends message through Snowbridge
    /// @param recipient Ethereum address to receive the tokens
    /// @param amount Amount of tokens to transfer (in smallest unit)
    /// @param fee Fee to incentivize relayers (in smallest unit)
    /// @custom:selector 0a3727e3
    function transferToEthereum(address recipient, uint256 amount, uint256 fee) external;

    /// @notice Pause the pallet (admin only)
    /// @dev Prevents all token transfers until unpaused
    /// @custom:selector 8456cb59
    function pause() external;

    /// @notice Unpause the pallet (admin only)
    /// @dev Allows token transfers again
    /// @custom:selector 3f4ba83a
    function unpause() external;

    /// @notice Check if the pallet is currently paused
    /// @return paused True if paused, false otherwise
    /// @custom:selector b187bd26
    function isPaused() external view returns (bool paused);

    /// @notice Get total amount of tokens locked in Ethereum sovereign account
    /// @return balance Total locked balance
    /// @custom:selector 05480e10
    function totalLockedBalance() external view returns (uint256 balance);

    /// @notice Get the Ethereum sovereign account address
    /// @return account The sovereign account address (as H160)
    /// @custom:selector 71f9ae03
    function ethereumSovereignAccount() external view returns (address account);
}
