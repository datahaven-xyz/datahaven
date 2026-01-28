// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The Proxy contract's address.
address constant PROXY_ADDRESS = 0x000000000000000000000000000000000000080b;

/// @dev The Proxy contract's instance.
Proxy constant PROXY_CONTRACT = Proxy(PROXY_ADDRESS);

/// @author The Moonbeam Team
/// @title Pallet Proxy Interface
/// @title The interface through which solidity contracts will interact with the Proxy pallet
/// @custom:address 0x000000000000000000000000000000000000080b
interface Proxy {
    /// @dev Defines the proxy permission types.
    /// The values start at `0` (most permissive) and are represented as `uint8`
    enum ProxyType {
        Any,
        NonTransfer,
        Governance,
        Staking,
        CancelProxy,
        Balances,
        IdentityJudgement,
        SudoOnly
    }

    /// @dev Register a proxy account for the sender that is able to make calls on its behalf
    /// @custom:selector 74a34dd3
    /// @param delegate The account that the caller would like to make a proxy
    /// @param proxyType The permissions allowed for this proxy account
    /// @param delay The announcement period required of the initial proxy, will generally be zero
    function addProxy(address delegate, ProxyType proxyType, uint32 delay) external;

    /// @dev Removes a proxy account from the sender
    /// @custom:selector fef3f708
    /// @param delegate The account that the caller would like to remove as a proxy
    /// @param proxyType The permissions currently enabled for the removed proxy account
    /// @param delay The announcement period required of the initial proxy, will generally be zero
    function removeProxy(address delegate, ProxyType proxyType, uint32 delay) external;

    /// @dev Unregister all proxy accounts for the sender
    /// @custom:selector 14a5b5fa
    function removeProxies() external;

    /// @dev Dispatch the given subcall (`callTo`, `callData`) from an account that the sender
    /// is authorised for through `addProxy`
    /// @custom:selector 0d3cff86
    /// @param real The account that the proxy will make a call on behalf of
    /// @param callTo Recipient of the call to be made by the `real` account
    /// @param callData Data of the call to be made by the `real` account
    function proxy(address real, address callTo, bytes memory callData) external payable;

    /// @dev Dispatch the given subcall (`callTo`, `callData`) from an account that the sender
    /// is authorised for through `addProxy`
    /// @custom:selector 685b9d2f
    /// @param real The account that the proxy will make a call on behalf of
    /// @param forceProxyType Specify the exact proxy type to be used and checked for this call
    /// @param callTo Recipient of the call to be made by the `real` account
    /// @param callData Data of the call to be made by the `real` account
    function proxyForceType(address real, ProxyType forceProxyType, address callTo, bytes memory callData)
        external
        payable;

    /// @dev Checks if the caller has an account proxied with a given proxy type
    /// @custom:selector e26d38ed
    /// @param real The real account that maybe has a proxy
    /// @param delegate The account that the caller has maybe proxied
    /// @param proxyType The permissions allowed for the proxy
    /// @param delay The announcement period required of the initial proxy, will generally be zero
    /// @return exists True if a proxy exists, False otherwise
    function isProxy(address real, address delegate, ProxyType proxyType, uint32 delay)
        external
        view
        returns (bool exists);
}
