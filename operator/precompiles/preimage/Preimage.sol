// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The Preimage contract's address.
address constant PREIMAGE_ADDRESS = 0x0000000000000000000000000000000000000813;

/// @dev The Preimage contract's instance.
Preimage constant PREIMAGE_CONTRACT = Preimage(PREIMAGE_ADDRESS);

/// @author The Moonbeam Team
/// @title Pallet Preimage Interface
/// @title The interface through which solidity contracts will interact with the Preimage pallet
/// @custom:address 0x0000000000000000000000000000000000000813
interface Preimage {
    /// @dev Register a Preimage on-chain.
    /// @custom:selector cb00f603
    /// @param encodedProposal The preimage to be registered on-chain
    /// @return preimageHash The hash of the preimage
    function notePreimage(bytes memory encodedProposal)
        external
        returns (bytes32 preimageHash);

    /// @dev Clear an unrequested preimage from storage.
    /// @custom:selector 02e71b45
    /// @param hash The preimage to be cleared from storage
    function unnotePreimage(bytes32 hash) external;

    /// @dev A Preimage was registered on-chain.
    /// @custom:selector 8cb56a8ebdafbb14e25ec706da62a7dde761968dbf1fb45be207d1b15c88c187
    /// @param hash bytes32 The computed hash.
    event PreimageNoted(bytes32 hash);

    /// @dev A Preimage was un-registered on-chain.
    /// @custom:selector be6cb9502cce812b6de50cc08f2481900ff6c7c6466df7d39c9f27a5f2b9c572
    /// @param hash bytes32 The target preimage hash.
    event PreimageUnnoted(bytes32 hash);
}
