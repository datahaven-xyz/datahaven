    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.0 ^0.8.1 ^0.8.2;

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/interfaces/IERC1967.sol

    // OpenZeppelin Contracts (last updated v4.9.0) (interfaces/IERC1967.sol)

    /**
    * @dev ERC-1967: Proxy Storage Slots. This interface contains the events defined in the ERC.
    *
    * _Available since v4.8.3._
    */
    interface IERC1967 {
        /**
        * @dev Emitted when the implementation is upgraded.
        */
        event Upgraded(address indexed implementation);

        /**
        * @dev Emitted when the admin account has changed.
        */
        event AdminChanged(address previousAdmin, address newAdmin);

        /**
        * @dev Emitted when the beacon is changed.
        */
        event BeaconUpgraded(address indexed beacon);
    }

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/interfaces/draft-IERC1822.sol

    // OpenZeppelin Contracts (last updated v4.5.0) (interfaces/draft-IERC1822.sol)

    /**
    * @dev ERC1822: Universal Upgradeable Proxy Standard (UUPS) documents a method for upgradeability through a simplified
    * proxy whose upgrades are fully controlled by the current implementation.
    */
    interface IERC1822Proxiable {
        /**
        * @dev Returns the storage slot that the proxiable contract assumes is being used to store the implementation
        * address.
        *
        * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
        * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
        * function revert if invoked through a proxy.
        */
        function proxiableUUID() external view returns (bytes32);
    }

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/proxy/Proxy.sol

    // OpenZeppelin Contracts (last updated v4.6.0) (proxy/Proxy.sol)

    /**
    * @dev This abstract contract provides a fallback function that delegates all calls to another contract using the EVM
    * instruction `delegatecall`. We refer to the second contract as the _implementation_ behind the proxy, and it has to
    * be specified by overriding the virtual {_implementation} function.
    *
    * Additionally, delegation to the implementation can be triggered manually through the {_fallback} function, or to a
    * different contract through the {_delegate} function.
    *
    * The success and return data of the delegated call will be returned back to the caller of the proxy.
    */
    abstract contract Proxy {
        /**
        * @dev Delegates the current call to `implementation`.
        *
        * This function does not return to its internal call site, it will return directly to the external caller.
        */
        function _delegate(address implementation) internal virtual {
            assembly {
                // Copy msg.data. We take full control of memory in this inline assembly
                // block because it will not return to Solidity code. We overwrite the
                // Solidity scratch pad at memory position 0.
                calldatacopy(0, 0, calldatasize())

                // Call the implementation.
                // out and outsize are 0 because we don't know the size yet.
                let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

                // Copy the returned data.
                returndatacopy(0, 0, returndatasize())

                switch result
                // delegatecall returns 0 on error.
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
            }
        }

        /**
        * @dev This is a virtual function that should be overridden so it returns the address to which the fallback function
        * and {_fallback} should delegate.
        */
        function _implementation() internal view virtual returns (address);

        /**
        * @dev Delegates the current call to the address returned by `_implementation()`.
        *
        * This function does not return to its internal call site, it will return directly to the external caller.
        */
        function _fallback() internal virtual {
            _beforeFallback();
            _delegate(_implementation());
        }

        /**
        * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
        * function in the contract matches the call data.
        */
        fallback() external payable virtual {
            _fallback();
        }

        /**
        * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if call data
        * is empty.
        */
        receive() external payable virtual {
            _fallback();
        }

        /**
        * @dev Hook that is called before falling back to the implementation. Can happen as part of a manual `_fallback`
        * call, or as part of the Solidity `fallback` or `receive` functions.
        *
        * If overridden should call `super._beforeFallback()`.
        */
        function _beforeFallback() internal virtual {}
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

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/utils/StorageSlot.sol

    // OpenZeppelin Contracts (last updated v4.9.0) (utils/StorageSlot.sol)
    // This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

    /**
    * @dev Library for reading and writing primitive types to specific storage slots.
    *
    * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
    * This library helps with reading and writing to such slots without the need for inline assembly.
    *
    * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
    *
    * Example usage to set ERC1967 implementation slot:
    * ```solidity
    * contract ERC1967 {
    *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    *
    *     function _getImplementation() internal view returns (address) {
    *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    *     }
    *
    *     function _setImplementation(address newImplementation) internal {
    *         require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");
    *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
    *     }
    * }
    * ```
    *
    * _Available since v4.1 for `address`, `bool`, `bytes32`, `uint256`._
    * _Available since v4.9 for `string`, `bytes`._
    */
    library StorageSlot {
        struct AddressSlot {
            address value;
        }

        struct BooleanSlot {
            bool value;
        }

        struct Bytes32Slot {
            bytes32 value;
        }

        struct Uint256Slot {
            uint256 value;
        }

        struct StringSlot {
            string value;
        }

        struct BytesSlot {
            bytes value;
        }

        /**
        * @dev Returns an `AddressSlot` with member `value` located at `slot`.
        */
        function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
        */
        function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
        */
        function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
        */
        function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `StringSlot` with member `value` located at `slot`.
        */
        function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
        */
        function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := store.slot
            }
        }

        /**
        * @dev Returns an `BytesSlot` with member `value` located at `slot`.
        */
        function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := slot
            }
        }

        /**
        * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
        */
        function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
            /// @solidity memory-safe-assembly
            assembly {
                r.slot := store.slot
            }
        }
    }

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/proxy/ERC1967/ERC1967Upgrade.sol

    // OpenZeppelin Contracts (last updated v4.9.0) (proxy/ERC1967/ERC1967Upgrade.sol)

    /**
    * @dev This abstract contract provides getters and event emitting update functions for
    * https://eips.ethereum.org/EIPS/eip-1967[EIP1967] slots.
    *
    * _Available since v4.1._
    */
    abstract contract ERC1967Upgrade is IERC1967 {
        // This is the keccak-256 hash of "eip1967.proxy.rollback" subtracted by 1
        bytes32 private constant _ROLLBACK_SLOT = 0x4910fdfa16fed3260ed0e7147f7cc6da11a60208b5b9406d12a635614ffd9143;

        /**
        * @dev Storage slot with the address of the current implementation.
        * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
        * validated in the constructor.
        */
        bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

        /**
        * @dev Returns the current implementation address.
        */
        function _getImplementation() internal view returns (address) {
            return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
        }

        /**
        * @dev Stores a new address in the EIP1967 implementation slot.
        */
        function _setImplementation(address newImplementation) private {
            require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");
            StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
        }

        /**
        * @dev Perform implementation upgrade
        *
        * Emits an {Upgraded} event.
        */
        function _upgradeTo(address newImplementation) internal {
            _setImplementation(newImplementation);
            emit Upgraded(newImplementation);
        }

        /**
        * @dev Perform implementation upgrade with additional setup call.
        *
        * Emits an {Upgraded} event.
        */
        function _upgradeToAndCall(address newImplementation, bytes memory data, bool forceCall) internal {
            _upgradeTo(newImplementation);
            if (data.length > 0 || forceCall) {
                Address.functionDelegateCall(newImplementation, data);
            }
        }

        /**
        * @dev Perform implementation upgrade with security checks for UUPS proxies, and additional setup call.
        *
        * Emits an {Upgraded} event.
        */
        function _upgradeToAndCallUUPS(address newImplementation, bytes memory data, bool forceCall) internal {
            // Upgrades from old implementations will perform a rollback test. This test requires the new
            // implementation to upgrade back to the old, non-ERC1822 compliant, implementation. Removing
            // this special case will break upgrade paths from old UUPS implementation to new ones.
            if (StorageSlot.getBooleanSlot(_ROLLBACK_SLOT).value) {
                _setImplementation(newImplementation);
            } else {
                try IERC1822Proxiable(newImplementation).proxiableUUID() returns (bytes32 slot) {
                    require(slot == _IMPLEMENTATION_SLOT, "ERC1967Upgrade: unsupported proxiableUUID");
                } catch {
                    revert("ERC1967Upgrade: new implementation is not UUPS");
                }
                _upgradeToAndCall(newImplementation, data, forceCall);
            }
        }

        /**
        * @dev Storage slot with the admin of the contract.
        * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
        * validated in the constructor.
        */
        bytes32 internal constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

        /**
        * @dev Returns the current admin.
        */
        function _getAdmin() internal view returns (address) {
            return StorageSlot.getAddressSlot(_ADMIN_SLOT).value;
        }

        /**
        * @dev Stores a new address in the EIP1967 admin slot.
        */
        function _setAdmin(address newAdmin) private {
            require(newAdmin != address(0), "ERC1967: new admin is the zero address");
            StorageSlot.getAddressSlot(_ADMIN_SLOT).value = newAdmin;
        }

        /**
        * @dev Changes the admin of the proxy.
        *
        * Emits an {AdminChanged} event.
        */
        function _changeAdmin(address newAdmin) internal {
            emit AdminChanged(_getAdmin(), newAdmin);
            _setAdmin(newAdmin);
        }

        /**
        * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
        * This is bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)) and is validated in the constructor.
        */
        bytes32 internal constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

        /**
        * @dev Returns the current beacon.
        */
        function _getBeacon() internal view returns (address) {
            return StorageSlot.getAddressSlot(_BEACON_SLOT).value;
        }

        /**
        * @dev Stores a new beacon in the EIP1967 beacon slot.
        */
        function _setBeacon(address newBeacon) private {
            require(Address.isContract(newBeacon), "ERC1967: new beacon is not a contract");
            require(
                Address.isContract(IBeacon(newBeacon).implementation()),
                "ERC1967: beacon implementation is not a contract"
            );
            StorageSlot.getAddressSlot(_BEACON_SLOT).value = newBeacon;
        }

        /**
        * @dev Perform beacon upgrade with additional setup call. Note: This upgrades the address of the beacon, it does
        * not upgrade the implementation contained in the beacon (see {UpgradeableBeacon-_setImplementation} for that).
        *
        * Emits a {BeaconUpgraded} event.
        */
        function _upgradeBeaconToAndCall(address newBeacon, bytes memory data, bool forceCall) internal {
            _setBeacon(newBeacon);
            emit BeaconUpgraded(newBeacon);
            if (data.length > 0 || forceCall) {
                Address.functionDelegateCall(IBeacon(newBeacon).implementation(), data);
            }
        }
    }

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/proxy/ERC1967/ERC1967Proxy.sol

    // OpenZeppelin Contracts (last updated v4.7.0) (proxy/ERC1967/ERC1967Proxy.sol)

    /**
    * @dev This contract implements an upgradeable proxy. It is upgradeable because calls are delegated to an
    * implementation address that can be changed. This address is stored in storage in the location specified by
    * https://eips.ethereum.org/EIPS/eip-1967[EIP1967], so that it doesn't conflict with the storage layout of the
    * implementation behind the proxy.
    */
    contract ERC1967Proxy is Proxy, ERC1967Upgrade {
        /**
        * @dev Initializes the upgradeable proxy with an initial implementation specified by `_logic`.
        *
        * If `_data` is nonempty, it's used as data in a delegate call to `_logic`. This will typically be an encoded
        * function call, and allows initializing the storage of the proxy like a Solidity constructor.
        */
        constructor(address _logic, bytes memory _data) payable {
            _upgradeToAndCall(_logic, _data, false);
        }

        /**
        * @dev Returns the current implementation address.
        */
        function _implementation() internal view virtual override returns (address impl) {
            return ERC1967Upgrade._getImplementation();
        }
    }

    // lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/proxy/transparent/TransparentUpgradeableProxy.sol

    // OpenZeppelin Contracts (last updated v4.9.0) (proxy/transparent/TransparentUpgradeableProxy.sol)

    /**
    * @dev Interface for {TransparentUpgradeableProxy}. In order to implement transparency, {TransparentUpgradeableProxy}
    * does not implement this interface directly, and some of its functions are implemented by an internal dispatch
    * mechanism. The compiler is unaware that these functions are implemented by {TransparentUpgradeableProxy} and will not
    * include them in the ABI so this interface must be used to interact with it.
    */
    interface ITransparentUpgradeableProxy is IERC1967 {
        function admin() external view returns (address);

        function implementation() external view returns (address);

        function changeAdmin(address) external;

        function upgradeTo(address) external;

        function upgradeToAndCall(address, bytes memory) external payable;
    }

    /**
    * @dev This contract implements a proxy that is upgradeable by an admin.
    *
    * To avoid https://medium.com/nomic-labs-blog/malicious-backdoors-in-ethereum-proxies-62629adf3357[proxy selector
    * clashing], which can potentially be used in an attack, this contract uses the
    * https://blog.openzeppelin.com/the-transparent-proxy-pattern/[transparent proxy pattern]. This pattern implies two
    * things that go hand in hand:
    *
    * 1. If any account other than the admin calls the proxy, the call will be forwarded to the implementation, even if
    * that call matches one of the admin functions exposed by the proxy itself.
    * 2. If the admin calls the proxy, it can access the admin functions, but its calls will never be forwarded to the
    * implementation. If the admin tries to call a function on the implementation it will fail with an error that says
    * "admin cannot fallback to proxy target".
    *
    * These properties mean that the admin account can only be used for admin actions like upgrading the proxy or changing
    * the admin, so it's best if it's a dedicated account that is not used for anything else. This will avoid headaches due
    * to sudden errors when trying to call a function from the proxy implementation.
    *
    * Our recommendation is for the dedicated account to be an instance of the {ProxyAdmin} contract. If set up this way,
    * you should think of the `ProxyAdmin` instance as the real administrative interface of your proxy.
    *
    * NOTE: The real interface of this proxy is that defined in `ITransparentUpgradeableProxy`. This contract does not
    * inherit from that interface, and instead the admin functions are implicitly implemented using a custom dispatch
    * mechanism in `_fallback`. Consequently, the compiler will not produce an ABI for this contract. This is necessary to
    * fully implement transparency without decoding reverts caused by selector clashes between the proxy and the
    * implementation.
    *
    * WARNING: It is not recommended to extend this contract to add additional external functions. If you do so, the compiler
    * will not check that there are no selector conflicts, due to the note above. A selector clash between any new function
    * and the functions declared in {ITransparentUpgradeableProxy} will be resolved in favor of the new one. This could
    * render the admin operations inaccessible, which could prevent upgradeability. Transparency may also be compromised.
    */
    contract TransparentUpgradeableProxy is ERC1967Proxy {
        /**
        * @dev Initializes an upgradeable proxy managed by `_admin`, backed by the implementation at `_logic`, and
        * optionally initialized with `_data` as explained in {ERC1967Proxy-constructor}.
        */
        constructor(address _logic, address admin_, bytes memory _data) payable ERC1967Proxy(_logic, _data) {
            _changeAdmin(admin_);
        }

        /**
        * @dev Modifier used internally that will delegate the call to the implementation unless the sender is the admin.
        *
        * CAUTION: This modifier is deprecated, as it could cause issues if the modified function has arguments, and the
        * implementation provides a function with the same selector.
        */
        modifier ifAdmin() {
            if (msg.sender == _getAdmin()) {
                _;
            } else {
                _fallback();
            }
        }

        /**
        * @dev If caller is the admin process the call internally, otherwise transparently fallback to the proxy behavior
        */
        function _fallback() internal virtual override {
            if (msg.sender == _getAdmin()) {
                bytes memory ret;
                bytes4 selector = msg.sig;
                if (selector == ITransparentUpgradeableProxy.upgradeTo.selector) {
                    ret = _dispatchUpgradeTo();
                } else if (selector == ITransparentUpgradeableProxy.upgradeToAndCall.selector) {
                    ret = _dispatchUpgradeToAndCall();
                } else if (selector == ITransparentUpgradeableProxy.changeAdmin.selector) {
                    ret = _dispatchChangeAdmin();
                } else if (selector == ITransparentUpgradeableProxy.admin.selector) {
                    ret = _dispatchAdmin();
                } else if (selector == ITransparentUpgradeableProxy.implementation.selector) {
                    ret = _dispatchImplementation();
                } else {
                    revert("TransparentUpgradeableProxy: admin cannot fallback to proxy target");
                }
                assembly {
                    return(add(ret, 0x20), mload(ret))
                }
            } else {
                super._fallback();
            }
        }

        /**
        * @dev Returns the current admin.
        *
        * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using the
        * https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
        * `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
        */
        function _dispatchAdmin() private returns (bytes memory) {
            _requireZeroValue();

            address admin = _getAdmin();
            return abi.encode(admin);
        }

        /**
        * @dev Returns the current implementation.
        *
        * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using the
        * https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
        * `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
        */
        function _dispatchImplementation() private returns (bytes memory) {
            _requireZeroValue();

            address implementation = _implementation();
            return abi.encode(implementation);
        }

        /**
        * @dev Changes the admin of the proxy.
        *
        * Emits an {AdminChanged} event.
        */
        function _dispatchChangeAdmin() private returns (bytes memory) {
            _requireZeroValue();

            address newAdmin = abi.decode(msg.data[4:], (address));
            _changeAdmin(newAdmin);

            return "";
        }

        /**
        * @dev Upgrade the implementation of the proxy.
        */
        function _dispatchUpgradeTo() private returns (bytes memory) {
            _requireZeroValue();

            address newImplementation = abi.decode(msg.data[4:], (address));
            _upgradeToAndCall(newImplementation, bytes(""), false);

            return "";
        }

        /**
        * @dev Upgrade the implementation of the proxy, and then call a function from the new implementation as specified
        * by `data`, which should be an encoded function call. This is useful to initialize new storage variables in the
        * proxied contract.
        */
        function _dispatchUpgradeToAndCall() private returns (bytes memory) {
            (address newImplementation, bytes memory data) = abi.decode(msg.data[4:], (address, bytes));
            _upgradeToAndCall(newImplementation, data, true);

            return "";
        }

        /**
        * @dev Returns the current admin.
        *
        * CAUTION: This function is deprecated. Use {ERC1967Upgrade-_getAdmin} instead.
        */
        function _admin() internal view virtual returns (address) {
            return _getAdmin();
        }

        /**
        * @dev To keep this contract fully transparent, all `ifAdmin` functions must be payable. This helper is here to
        * emulate some proxy functions being non-payable while still allowing value to pass through.
        */
        function _requireZeroValue() private {
            require(msg.value == 0);
        }
    }
