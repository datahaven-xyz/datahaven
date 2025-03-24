// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {SlasherBase} from "../../src/middleware/SlasherBase.sol";
import {IAllocationManager, IAllocationManagerTypes} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IServiceManager} from "../../src/interfaces/IServiceManager.sol";

// SlasherMock implementation for testing
contract SlasherMock is SlasherBase {
    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager
    ) SlasherBase(_allocationManager, _serviceManager) {}

    // Expose the internal _fulfilSlashingRequest function for testing
    function fulfilSlashingRequest(
        uint256 _requestId,
        IAllocationManagerTypes.SlashingParams memory _params
    ) external {
        _fulfilSlashingRequest(_requestId, _params);
    }

    // Function with the onlySlasher modifier for testing
    function restrictedFunction() external onlySlasher {
        // Do nothing, just for testing the modifier
    }

    // Expose the internal _checkSlasher function for testing
    function checkSlasher(address account) external view {
        _checkSlasher(account);
    }
}
