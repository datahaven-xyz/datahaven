// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

interface ISlasherErrors {
    /// @notice Thrown when a caller without slasher privileges attempts a restricted operation
    error OnlySlasher();
}

interface ISlasherTypes {
    /// @notice Structure containing details about a slashing request
    struct SlashingRequest {
        IAllocationManager.SlashingParams params;
        uint256 requestTimestamp;
    }
}

interface ISlasherEvents is ISlasherTypes {
    /// @notice Emitted when an operator is successfully slashed
    event OperatorSlashed(
        uint256 indexed slashingRequestId,
        address indexed operator,
        uint32 indexed operatorSetId,
        uint256[] wadsToSlash,
        string description
    );
}

/// @title ISlasher
/// @notice Base interface containing shared functionality for all slasher implementations
interface ISlasher is ISlasherErrors, ISlasherEvents {
    /// @notice Returns the address authorized to create and fulfill slashing requests
    function slasher() external view returns (address);

    /// @notice Returns the next slashing request ID
    function nextRequestId() external view returns (uint256);
}
