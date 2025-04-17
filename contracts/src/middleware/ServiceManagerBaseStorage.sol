// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {OwnableUpgradeable} from "@openzeppelin-upgrades/contracts/access/OwnableUpgradeable.sol";

import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IRewardsCoordinator} from
    "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IPermissionController} from
    "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";

import {IVetoableSlasher} from "../interfaces/IVetoableSlasher.sol";
import {IServiceManager} from "../interfaces/IServiceManager.sol";
import {IRewardsRegistry} from "../interfaces/IRewardsRegistry.sol";

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
