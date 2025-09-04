// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The PrecompileRegistry contract's address.
address constant PRECOMPILE_REGISTRY_ADDRESS = 0x0000000000000000000000000000000000000815;

/// @dev The PrecompileRegistry contract's instance.
PrecompileRegistry constant PRECOMPILE_REGISTRY_CONTRACT = PrecompileRegistry(
    PRECOMPILE_REGISTRY_ADDRESS
);

/// @author The Moonbeam Team
/// @title Precompile Registry
/// @dev Interface to the set of available precompiles.
/// @custom:address 0x0000000000000000000000000000000000000815
interface PrecompileRegistry {
    /// @dev Query if the given address is a precompile. Note that deactivated precompiles
    /// are still considered precompiles and will return `true`.
    /// @param a: Address to query
    /// @return output Is this address a precompile?
    /// @custom:selector 446b450e
    function isPrecompile(address a) external view returns (bool);

    /// @dev Query if the given address is an active precompile. Will return false if the
    /// address is not a precompile or if this precompile is deactivated.
    /// @param a: Address to query
    /// @return output Is this address an active precompile?
    /// @custom:selector 6f5e23cf
    function isActivePrecompile(address a) external view returns (bool);

    /// @dev Update the account code of a precompile address.
    /// As precompiles are implemented inside the Runtime, they don't have a bytecode, and
    /// their account code is empty by default. However in Solidity calling a function of a
    /// contract often automatically adds a check that the contract bytecode is non-empty.
    /// For that reason a dummy code (0x60006000fd) can be inserted at the precompile address
    /// to pass that check. This function allows any user to insert that code to precompile address
    /// if they need it.
    /// @param a: Address of the precompile.
    /// @custom:selector 48ceb1b4
    function updateAccountCode(address a) external;
}
