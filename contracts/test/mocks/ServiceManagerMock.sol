// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IRewardsCoordinator} from
    "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IPermissionController} from
    "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {ServiceManagerBase} from "../../src/middleware/ServiceManagerBase.sol";
import {ServiceManagerBaseStorage} from "../../src/middleware/ServiceManagerBaseStorage.sol";
import {IVetoableSlasher} from "../../src/interfaces/IVetoableSlasher.sol";

/**
 * @title Minimal implementation of a ServiceManager-type contract.
 * Uses the ServiceManagerBase contract as is.
 */
contract ServiceManagerMock is ServiceManagerBase {
    uint256 public number;

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    ) ServiceManagerBase(__rewardsCoordinator, __permissionController, __allocationManager) {}

    function initialize(
        address initialOwner,
        address rewardsInitiator
    ) public virtual initializer {
        __ServiceManagerBase_init(initialOwner, rewardsInitiator);
    }

    /**
     * @notice Sets the slasher contract
     * @param slasher The slasher contract address
     * @dev Only callable by the owner
     */
    function setSlasher(
        IVetoableSlasher slasher
    ) external override onlyOwner {
        _slasher = slasher;
    }
}
