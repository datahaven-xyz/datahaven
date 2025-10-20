// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {
    IRewardsCoordinator
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {
    IPermissionController
} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";
import {
    IAllocationManager
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";

import {ServiceManagerBase} from "../../src/middleware/ServiceManagerBase.sol";

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

    function initialise(
        address initialOwner,
        address rewardsInitiator
    ) public virtual initializer {
        __ServiceManagerBase_init(initialOwner, rewardsInitiator);
    }

    /**
     * @notice Get the rewards registry for an operator set (exposing for testing)
     * @param operatorSetId The ID of the operator set
     * @return The rewards registry for the operator set
     */
    function getOperatorSetRewardsRegistry(
        uint32 operatorSetId
    ) external view returns (IRewardsRegistry) {
        return operatorSetToRewardsRegistry[operatorSetId];
    }

    /**
     * @notice Override the internal _ensureOperatorIsPartOfOperatorSet function to simplify testing
     * @param operator The operator address
     * @param operatorSetId The operator set ID
     * @dev This should be removed once the AllocationManagerMock is updated to be able to handle operator sets
     */
    function _ensureOperatorIsPartOfOperatorSet(
        address operator,
        uint32 operatorSetId
    ) internal view override {
        // No-op for testing
    }
}
