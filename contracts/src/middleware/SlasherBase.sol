// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {SlasherStorage, IServiceManager} from "./SlasherBaseStorage.sol";
import {
    IAllocationManagerTypes,
    IAllocationManager
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

/// @title SlasherBase
/// @notice Base contract for implementing slashing functionality in an EigenLayer AVS
/// @dev Provides core slashing functionality and interfaces with EigenLayer's AllocationManager
abstract contract SlasherBase is SlasherStorage {
    /// @notice Ensures only the authorized slasher can call certain functions
    modifier onlySlasher() {
        _checkSlasher(msg.sender);
        _;
    }

    /// @notice Constructs the base slasher contract
    /// @param _allocationManager The EigenLayer allocation manager contract
    /// @param _serviceManager The service manager that will manage this slasher
    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager
    ) SlasherStorage(_allocationManager, _serviceManager) {}

    /// @notice Internal function to execute a slashing request
    /// @param _requestId The ID of the slashing request to fulfill
    /// @param _params Parameters defining the slashing request including operator, strategies, and amounts
    /// @dev Calls AllocationManager.slashOperator to perform the actual slashing
    function _fulfillSlashingRequest(
        uint256 _requestId,
        IAllocationManager.SlashingParams memory _params
    ) internal virtual {
        allocationManager.slashOperator({avs: serviceManager.avs(), params: _params});
        emit OperatorSlashed(
            _requestId,
            _params.operator,
            _params.operatorSetId,
            _params.wadsToSlash,
            _params.description
        );
    }

    /// @notice Internal function to verify if an account is the authorized slasher
    /// @param account The address to check
    /// @dev Reverts if the account is not the ServiceManager
    function _checkSlasher(
        address account
    ) internal view virtual {
        require(account == address(serviceManager), OnlySlasher());
    }

    /// @notice Returns the address of the ServiceManager
    /// @return The address of the ServiceManager
    function slasher() external view returns (address) {
        return address(serviceManager);
    }
}
