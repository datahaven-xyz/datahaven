// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

import {IRewardsCoordinator} from
    "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IServiceManagerUI} from "./IServiceManagerUI.sol";
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {IRewardsRegistry} from "./IRewardsRegistry.sol";

interface IServiceManagerErrors {
    /// @notice Thrown when a function is called by an address that is not the RegistryCoordinator.
    error OnlyRegistryCoordinator();
    /// @notice Thrown when a function is called by an address that is not the RewardsInitiator.
    error OnlyRewardsInitiator();
    /// @notice Thrown when a function is called by an address that is not the StakeRegistry.
    error OnlyStakeRegistry();
    /// @notice Thrown when a slashing proposal delay has not been met yet.
    error DelayPeriodNotPassed();
    /// @notice Thrown when the operator set does not have a rewards registry set.
    error NoRewardsRegistryForOperatorSet();
    /// @notice Thrown when the operator is not part of the specified operator set.
    error OperatorNotInOperatorSet();
}

interface IServiceManagerEvents {
    /**
     * @notice Emitted when the rewards initiator address is updated.
     * @param prevRewardsInitiator The previous rewards initiator address.
     * @param newRewardsInitiator The new rewards initiator address.
     */
    event RewardsInitiatorUpdated(address prevRewardsInitiator, address newRewardsInitiator);

    /**
     * @notice Emitted when a rewards registry is set for an operator set.
     * @param operatorSetId The ID of the operator set.
     * @param rewardsRegistry The address of the rewards registry.
     */
    event RewardsRegistrySet(uint32 indexed operatorSetId, address indexed rewardsRegistry);
}

interface IServiceManager is IServiceManagerUI, IServiceManagerErrors, IServiceManagerEvents {
    /**
     * @notice Creates a new rewards submission to the EigenLayer RewardsCoordinator contract.
     * @dev Only callable by the permissioned rewardsInitiator address.
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`.
     * @dev The tokens are sent to the `RewardsCoordinator` contract.
     * @dev Strategies must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `rewardsSubmission` is malformed,
     *      e.g. if the `strategies` and `weights` arrays are of non-equal lengths.
     * @param rewardsSubmissions The rewards submissions to be split amongst the set of stakers
     *        delegated to operators who are registered to this `avs`.
     */
    function createAVSRewardsSubmission(
        IRewardsCoordinator.RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice PERMISSIONCONTROLLER FUNCTIONS
     */

    /**
     * @notice Calls `addPendingAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param admin The address of the admin to add.
     */
    function addPendingAdmin(
        address admin
    ) external;

    /**
     * @notice Calls `removePendingAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param pendingAdmin The address of the pending admin to remove.
     */
    function removePendingAdmin(
        address pendingAdmin
    ) external;

    /**
     * @notice Calls `removeAdmin` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param admin The address of the admin to remove.
     */
    function removeAdmin(
        address admin
    ) external;

    /**
     * @notice Calls `setAppointee` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param appointee The address of the appointee to set.
     * @param target The address of the target to set the appointee for.
     * @param selector The function selector to set the appointee for.
     */
    function setAppointee(address appointee, address target, bytes4 selector) external;

    /**
     * @notice Calls `removeAppointee` on the `PermissionController` contract.
     * @dev Only callable by the owner of the contract.
     * @param appointee The address of the appointee to remove.
     * @param target The address of the target to remove the appointee for.
     * @param selector The function selector to remove the appointee for.
     */
    function removeAppointee(address appointee, address target, bytes4 selector) external;

    /**
     * @notice Deregisters an operator from specified operator sets
     * @param operator The address of the operator to deregister
     * @param operatorSetIds The IDs of the operator sets to deregister from
     * @dev Only callable by the RegistryCoordinator
     */
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) external;

    /**
     * @notice Returns the address of the AVS
     * @return The address of the AVS
     */
    function avs() external view returns (address);

    /**
     * @notice Sets the rewards registry for an operator set
     * @param operatorSetId The ID of the operator set
     * @param rewardsRegistry The address of the rewards registry
     * @dev Only callable by the owner
     */
    function setRewardsRegistry(uint32 operatorSetId, IRewardsRegistry rewardsRegistry) external;

    /**
     * @notice Claim rewards for an operator from the specified operator set
     * @param operatorSetId The ID of the operator set
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     */
    function claimOperatorRewards(
        uint32 operatorSetId,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;
}
