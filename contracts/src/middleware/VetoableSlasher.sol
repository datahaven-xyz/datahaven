// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IServiceManager} from "../interfaces/IServiceManager.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {SlasherBase} from "./SlasherBase.sol";
import {IVetoableSlasher, IVetoableSlasherTypes} from "../interfaces/IVetoableSlasher.sol";

/// @title VetoableSlasher
/// @notice A slashing contract that implements a veto mechanism allowing a designated committee to cancel slashing requests
/// @dev Extends SlasherBase and adds a veto period during which slashing requests can be cancelled
contract VetoableSlasher is IVetoableSlasher, SlasherBase {
    /// @inheritdoc IVetoableSlasher
    uint32 public immutable override vetoWindowBlocks;

    /// @inheritdoc IVetoableSlasher
    address public immutable override vetoCommittee;

    /// @notice Mapping of request IDs to their corresponding slashing request details
    mapping(uint256 => IVetoableSlasherTypes.VetoableSlashingRequest) public slashingRequests;

    /// @notice Modifier to restrict function access to only the veto committee
    modifier onlyVetoCommittee() {
        _checkVetoCommittee(msg.sender);
        _;
    }

    constructor(
        IAllocationManager _allocationManager,
        IServiceManager _serviceManager,
        address _vetoCommittee,
        uint32 _vetoWindowBlocks
    ) SlasherBase(_allocationManager, _serviceManager) {
        vetoWindowBlocks = _vetoWindowBlocks;
        vetoCommittee = _vetoCommittee;
    }

    /// @inheritdoc IVetoableSlasher
    function queueSlashingRequest(
        IAllocationManager.SlashingParams calldata params
    ) external override onlySlasher {
        _queueSlashingRequest(params);
    }

    /// @inheritdoc IVetoableSlasher
    function cancelSlashingRequest(
        uint256 requestId
    ) external override onlyVetoCommittee {
        _cancelSlashingRequest(requestId);
    }

    /// @inheritdoc IVetoableSlasher
    function fulfilSlashingRequest(
        uint256 requestId
    ) external override {
        _fulfilSlashingRequestAndMarkAsCompleted(requestId);
    }

    /// @notice Internal function to create and store a new slashing request
    /// @param params Parameters defining the slashing request
    function _queueSlashingRequest(
        IAllocationManager.SlashingParams memory params
    ) internal virtual {
        uint256 requestId = nextRequestId++;
        slashingRequests[requestId] = IVetoableSlasherTypes.VetoableSlashingRequest({
            params: params,
            requestBlock: block.number,
            status: IVetoableSlasherTypes.SlashingStatus.Requested
        });

        emit SlashingRequested(
            requestId, params.operator, params.operatorSetId, params.wadsToSlash, params.description
        );
    }

    /// @notice Internal function to mark a slashing request as cancelled
    /// @param requestId The ID of the slashing request to cancel
    function _cancelSlashingRequest(
        uint256 requestId
    ) internal virtual {
        require(
            block.number < slashingRequests[requestId].requestBlock + vetoWindowBlocks,
            VetoPeriodPassed()
        );
        require(
            slashingRequests[requestId].status == IVetoableSlasherTypes.SlashingStatus.Requested,
            SlashingRequestNotRequested()
        );

        slashingRequests[requestId].status = IVetoableSlasherTypes.SlashingStatus.Cancelled;
        emit SlashingRequestCancelled(requestId);
    }

    /// @notice Internal function to fullfill a slashing request and mark it as completed
    /// @param requestId The ID of the slashing request to fulfil
    function _fulfilSlashingRequestAndMarkAsCompleted(
        uint256 requestId
    ) internal virtual {
        IVetoableSlasherTypes.VetoableSlashingRequest storage request = slashingRequests[requestId];
        require(block.number >= request.requestBlock + vetoWindowBlocks, VetoPeriodNotPassed());
        require(
            request.status == IVetoableSlasherTypes.SlashingStatus.Requested,
            SlashingRequestIsCancelled()
        );

        request.status = IVetoableSlasherTypes.SlashingStatus.Completed;

        _fulfilSlashingRequest(requestId, request.params);
    }

    /// @notice Internal function to verify if an account is the veto committee
    /// @param account The address to check
    /// @dev Reverts if the account is not the veto committee
    function _checkVetoCommittee(
        address account
    ) internal view virtual {
        require(account == vetoCommittee, OnlyVetoCommittee());
    }
}
