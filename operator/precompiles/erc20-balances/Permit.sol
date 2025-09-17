// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @author The DataHaven Team
/// @title Extension of the ERC20 interface that allows users to
/// @dev Sign permit messages to interact with contracts without needing to
/// make a first approve transaction.
interface Permit {
    /// @dev Consumes an approval permit.
    /// Anyone can call this function for a permit.
    /// @custom:selector d505accf
    /// @param owner Owner of the tokens issuing the permit
    /// @param spender Address whose allowance will be increased.
    /// @param value Allowed value.
    /// @param deadline Timestamp after which the permit will no longer be valid.
    /// @param v V component of the signature.
    /// @param r R component of the signature.
    /// @param s S component of the signature.
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @dev Returns the current nonce for given owner.
    /// A permit must have this nonce to be consumed, which will
    /// increase the nonce by one.
    /// @custom:selector 7ecebe00
    function nonces(address owner) external view returns (uint256);

    /// @dev Returns the EIP712 domain separator. It is used to avoid replay
    /// attacks accross assets or other similar EIP712 message structures.
    /// @custom:selector 3644e515
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}