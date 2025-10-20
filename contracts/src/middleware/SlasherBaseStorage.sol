// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {
    IAllocationManager
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {ISlasher} from "../interfaces/ISlasher.sol";
import {IServiceManager} from "../interfaces/IServiceManager.sol";
/// @title SlasherStorage
/// @notice Base storage contract for slashing functionality
/// @dev Provides storage variables and events for slashing operations

abstract contract SlasherStorage is ISlasher {
    /**
     *
     *                            CONSTANTS AND IMMUTABLES
     *
     */
    /// @notice the AllocationManager that tracks OperatorSets and Slashing in EigenLayer
    IAllocationManager public immutable allocationManager;
    /// @notice the ServiceManager of the AVS
    IServiceManager public immutable serviceManager;

    uint256 public nextRequestId;

    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager
    ) {
        allocationManager = _allocationManager;
        serviceManager = _serviceManager;
    }

    uint256[49] private __gap;
}
