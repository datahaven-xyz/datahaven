// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IDelegationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IDelegationManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

/// @notice Interface containing all error definitions for the StakeRegistry contract.
interface IStakeRegistryErrors {
    /// @dev Thrown when the caller is not the registry coordinator
    error OnlySlashingRegistryCoordinator();
    /// @dev Thrown when the caller is not the owner of the registry coordinator
    error OnlySlashingRegistryCoordinatorOwner();
    /// @dev Thrown when the stake is below the minimum required for a quorum
    error BelowMinimumStakeRequirement();
    /// @notice Thrown when attempting to create a quorum that already exists.
    error QuorumAlreadyExists();
    /// @notice Thrown when attempting to interact with a quorum that does not exist.
    error QuorumDoesNotExist();
    /// @notice Thrown when two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @notice Thrown when an input array has zero length.
    error InputArrayLengthZero();
    /// @notice Thrown when a duplicate strategy is provided in an input array.
    error InputDuplicateStrategy();
    /// @notice Thrown when a multiplier input is zero.
    error InputMultiplierZero();
    /// @notice Thrown when the provided block number is invalid for the stake update.
    error InvalidBlockNumber();
    /// @notice Thrown when attempting to access stake history that doesn't exist for a quorum.
    error EmptyStakeHistory();
    /// @notice Thrown when the quorum is not slashable and the caller attempts to set the look ahead period.
    error QuorumNotSlashable();
}

interface IStakeRegistryTypes {
    /// @notice Defines the type of stake being tracked.
    /// @param TOTAL_DELEGATED Represents the total delegated stake.
    /// @param TOTAL_SLASHABLE Represents the total slashable stake.
    enum StakeType {
        TOTAL_DELEGATED,
        TOTAL_SLASHABLE
    }

    /// @notice Stores stake information for an operator or total stakes at a specific block.
    /// @param updateBlockNumber The block number at which the stake amounts were updated.
    /// @param nextUpdateBlockNumber The block number at which the next update occurred (0 if no next update).
    /// @param stake The stake weight for the quorum.
    struct StakeUpdate {
        uint32 updateBlockNumber;
        uint32 nextUpdateBlockNumber;
        uint96 stake;
    }

    /// @notice Parameters for weighing a particular strategy's stake.
    /// @param strategy The strategy contract address.
    /// @param multiplier The weight multiplier applied to the strategy's stake.
    struct StrategyParams {
        IStrategy strategy;
        uint96 multiplier;
    }
}

interface IStakeRegistryEvents is IStakeRegistryTypes {
    /**
     * @notice Emitted when an operator's stake is updated.
     * @param operatorId The unique identifier of the operator (indexed).
     * @param quorumNumber The quorum number for which the stake was updated.
     * @param stake The new stake amount.
     */
    event OperatorStakeUpdate(bytes32 indexed operatorId, uint8 quorumNumber, uint96 stake);

    /**
     * @notice Emitted when the look ahead period for checking operator shares is updated.
     * @param oldLookAheadBlocks The previous look ahead period.
     * @param newLookAheadBlocks The new look ahead period.
     */
    event LookAheadPeriodChanged(uint32 oldLookAheadBlocks, uint32 newLookAheadBlocks);

    /**
     * @notice Emitted when the stake type is updated.
     * @param newStakeType The new stake type being set.
     */
    event StakeTypeSet(StakeType newStakeType);

    /**
     * @notice Emitted when the minimum stake for a quorum is updated.
     * @param quorumNumber The quorum number being updated (indexed).
     * @param minimumStake The new minimum stake requirement.
     */
    event MinimumStakeForQuorumUpdated(uint8 indexed quorumNumber, uint96 minimumStake);

    /**
     * @notice Emitted when a new quorum is created.
     * @param quorumNumber The number of the newly created quorum (indexed).
     */
    event QuorumCreated(uint8 indexed quorumNumber);

    /**
     * @notice Emitted when a strategy is added to a quorum.
     * @param quorumNumber The quorum number the strategy was added to (indexed).
     * @param strategy The strategy contract that was added.
     */
    event StrategyAddedToQuorum(uint8 indexed quorumNumber, IStrategy strategy);

    /**
     * @notice Emitted when a strategy is removed from a quorum.
     * @param quorumNumber The quorum number the strategy was removed from (indexed).
     * @param strategy The strategy contract that was removed.
     */
    event StrategyRemovedFromQuorum(uint8 indexed quorumNumber, IStrategy strategy);

    /**
     * @notice Emitted when a strategy's multiplier is updated.
     * @param quorumNumber The quorum number for the strategy update (indexed).
     * @param strategy The strategy contract being updated.
     * @param multiplier The new multiplier value.
     */
    event StrategyMultiplierUpdated(
        uint8 indexed quorumNumber, IStrategy strategy, uint256 multiplier
    );
}

interface IStakeRegistry is IStakeRegistryErrors, IStakeRegistryEvents {
    /// STATE

    /**
     * @notice Returns the EigenLayer delegation manager contract.
     */
    function delegation() external view returns (IDelegationManager);

    /// ACTIONS

    /**
     * @notice Registers the `operator` with `operatorId` for the specified `quorumNumbers`.
     * @param operator The address of the operator to register.
     * @param operatorId The id of the operator to register.
     * @param quorumNumbers The quorum numbers the operator is registering for, where each byte is an 8 bit integer quorumNumber.
     * @return operatorStakes The operator's current stake for each quorum.
     * @return totalStakes The total stake for each quorum.
     * @dev Access restricted to the RegistryCoordinator.
     * @dev Preconditions (these are assumed, not validated in this contract):
     *     1) `quorumNumbers` has no duplicates.
     *     2) `quorumNumbers.length` != 0.
     *     3) `quorumNumbers` is ordered in ascending order.
     *     4) The operator is not already registered.
     */
    function registerOperator(
        address operator,
        bytes32 operatorId,
        bytes memory quorumNumbers
    ) external returns (uint96[] memory operatorStakes, uint96[] memory totalStakes);

    /**
     * @notice Deregisters the operator with `operatorId` for the specified `quorumNumbers`.
     * @param operatorId The id of the operator to deregister.
     * @param quorumNumbers The quorum numbers the operator is deregistering from, where each byte is an 8 bit integer quorumNumber.
     * @dev Access restricted to the RegistryCoordinator.
     * @dev Preconditions (these are assumed, not validated in this contract):
     *     1) `quorumNumbers` has no duplicates.
     *     2) `quorumNumbers.length` != 0.
     *     3) `quorumNumbers` is ordered in ascending order.
     *     4) The operator is not already deregistered.
     *     5) `quorumNumbers` is a subset of the quorumNumbers that the operator is registered for.
     */
    function deregisterOperator(bytes32 operatorId, bytes memory quorumNumbers) external;

    /**
     * @notice Called by the registry coordinator to update the stake of a list of operators for a specific quorum.
     * @param operators The addresses of the operators to update.
     * @param operatorIds The ids of the operators to update.
     * @param quorumNumber The quorum number to update the stake for.
     * @return A list of bools, true if the corresponding operator should be deregistered since they no longer meet the minimum stake requirement.
     */
    function updateOperatorsStake(
        address[] memory operators,
        bytes32[] memory operatorIds,
        uint8 quorumNumber
    ) external returns (bool[] memory);

    /**
     * @notice Initialize a new quorum created by the registry coordinator by setting strategies, weights, and minimum stake.
     * @param quorumNumber The number of the quorum to initialize.
     * @param minimumStake The minimum stake required for the quorum.
     * @param strategyParams The initial strategy parameters for the quorum.
     */
    function initializeDelegatedStakeQuorum(
        uint8 quorumNumber,
        uint96 minimumStake,
        StrategyParams[] memory strategyParams
    ) external;

    /**
     * @notice Initialize a new quorum and push its first history update.
     * @param quorumNumber The number of the quorum to initialize.
     * @param minimumStake The minimum stake required for the quorum.
     * @param lookAheadPeriod The look ahead period for checking operator shares.
     * @param strategyParams The initial strategy parameters for the quorum.
     */
    function initializeSlashableStakeQuorum(
        uint8 quorumNumber,
        uint96 minimumStake,
        uint32 lookAheadPeriod,
        StrategyParams[] memory strategyParams
    ) external;

    /**
     * @notice Sets the minimum stake requirement for a quorum `quorumNumber`.
     * @param quorumNumber The quorum number to set the minimum stake for.
     * @param minimumStake The new minimum stake requirement.
     */
    function setMinimumStakeForQuorum(uint8 quorumNumber, uint96 minimumStake) external;

    /**
     * @notice Sets the look ahead time to `lookAheadBlocks` for checking operator shares for a specific quorum.
     * @param quorumNumber The quorum number to set the look ahead period for.
     * @param lookAheadBlocks The number of blocks to look ahead when checking shares.
     */
    function setSlashableStakeLookahead(uint8 quorumNumber, uint32 lookAheadBlocks) external;

    /**
     * @notice Adds new strategies and their associated multipliers to the specified quorum.
     * @dev Checks to make sure that the *same* strategy cannot be added multiple times (checks against both against existing and new strategies).
     * @dev This function has no check to make sure that the strategies for a single quorum have the same underlying asset. This is a concious choice,
     * since a middleware may want, e.g., a stablecoin quorum that accepts USDC, USDT, DAI, etc. as underlying assets and trades them as "equivalent".
     * @param quorumNumber The quorum number to add strategies to.
     * @param strategyParams The strategy parameters to add.
     */
    function addStrategies(uint8 quorumNumber, StrategyParams[] memory strategyParams) external;

    /**
     * @notice Removes strategies and their associated weights from the specified quorum.
     * @param quorumNumber The quorum number to remove strategies from.
     * @param indicesToRemove The indices of strategies to remove.
     * @dev Higher indices should be *first* in the list of `indicesToRemove`, since otherwise
     *     the removal of lower index entries will cause a shift in the indices of the other strategiesToRemove.
     */
    function removeStrategies(uint8 quorumNumber, uint256[] calldata indicesToRemove) external;

    /**
     * @notice Modifies the weights of strategies that are already in the mapping strategyParams.
     * @param quorumNumber The quorum number to change the strategy for.
     * @param strategyIndices The indices of the strategies to change.
     * @param newMultipliers The new multipliers for the strategies.
     */
    function modifyStrategyParams(
        uint8 quorumNumber,
        uint256[] calldata strategyIndices,
        uint96[] calldata newMultipliers
    ) external;

    /// VIEW

    /**
     * @notice Returns the minimum stake requirement for a quorum `quorumNumber`.
     * @dev In order to register for a quorum i, an operator must have at least `minimumStakeForQuorum[i]`.
     * @param quorumNumber The quorum number to query.
     * @return The minimum stake requirement.
     */
    function minimumStakeForQuorum(
        uint8 quorumNumber
    ) external view returns (uint96);

    /**
     * @notice Returns the length of the dynamic array stored in `strategyParams[quorumNumber]`.
     * @param quorumNumber The quorum number to query.
     * @return The number of strategies for the quorum.
     */
    function strategyParamsLength(
        uint8 quorumNumber
    ) external view returns (uint256);

    /**
     * @notice Returns the strategy and weight multiplier for the `index`'th strategy in the quorum.
     * @param quorumNumber The quorum number to query.
     * @param index The index of the strategy to query.
     * @return The strategy parameters.
     */
    function strategyParamsByIndex(
        uint8 quorumNumber,
        uint256 index
    ) external view returns (StrategyParams memory);

    /**
     * @notice Returns the length of the stake history for an operator in a quorum.
     * @param operatorId The id of the operator to query.
     * @param quorumNumber The quorum number to query.
     * @return The length of the stake history array.
     */
    function getStakeHistoryLength(
        bytes32 operatorId,
        uint8 quorumNumber
    ) external view returns (uint256);

    /**
     * @notice Computes the total weight of the operator in the specified quorum.
     * @param quorumNumber The quorum number to query.
     * @param operator The operator address to query.
     * @return The total weight of the operator.
     * @dev Reverts if `quorumNumber` is greater than or equal to `quorumCount`.
     */
    function weightOfOperatorForQuorum(
        uint8 quorumNumber,
        address operator
    ) external view returns (uint96);

    /**
     * @notice Returns the entire stake history array for an operator in a quorum.
     * @param operatorId The id of the operator of interest.
     * @param quorumNumber The quorum number to get the stake for.
     * @return The array of stake updates.
     */
    function getStakeHistory(
        bytes32 operatorId,
        uint8 quorumNumber
    ) external view returns (StakeUpdate[] memory);

    /**
     * @notice Returns the length of the total stake history for a quorum.
     * @param quorumNumber The quorum number to query.
     * @return The length of the total stake history array.
     */
    function getTotalStakeHistoryLength(
        uint8 quorumNumber
    ) external view returns (uint256);

    /**
     * @notice Returns the stake update at the specified index in the total stake history.
     * @param quorumNumber The quorum number to query.
     * @param index The index to query.
     * @return The stake update at the specified index.
     */
    function getTotalStakeUpdateAtIndex(
        uint8 quorumNumber,
        uint256 index
    ) external view returns (StakeUpdate memory);

    /**
     * @notice Returns the index of the operator's stake update at the specified block number.
     * @param operatorId The id of the operator to query.
     * @param quorumNumber The quorum number to query.
     * @param blockNumber The block number to query.
     * @return The index of the stake update.
     */
    function getStakeUpdateIndexAtBlockNumber(
        bytes32 operatorId,
        uint8 quorumNumber,
        uint32 blockNumber
    ) external view returns (uint32);

    /**
     * @notice Returns the indices of total stakes for the provided quorums at the given block number.
     * @param blockNumber The block number to query.
     * @param quorumNumbers The quorum numbers to query.
     * @return The array of stake update indices.
     */
    function getTotalStakeIndicesAtBlockNumber(
        uint32 blockNumber,
        bytes calldata quorumNumbers
    ) external view returns (uint32[] memory);

    /**
     * @notice Returns the stake update at the specified index for an operator in a quorum.
     * @param quorumNumber The quorum number to query.
     * @param operatorId The id of the operator to query.
     * @param index The index to query.
     * @return The stake update at the specified index.
     * @dev Function will revert if `index` is out-of-bounds.
     */
    function getStakeUpdateAtIndex(
        uint8 quorumNumber,
        bytes32 operatorId,
        uint256 index
    ) external view returns (StakeUpdate memory);

    /**
     * @notice Returns the most recent stake update for an operator in a quorum.
     * @param operatorId The id of the operator to query.
     * @param quorumNumber The quorum number to query.
     * @return The most recent stake update.
     * @dev Returns a StakeUpdate struct with all entries equal to 0 if the operator has no stake history.
     */
    function getLatestStakeUpdate(
        bytes32 operatorId,
        uint8 quorumNumber
    ) external view returns (StakeUpdate memory);

    /**
     * @notice Returns the stake at the specified block number and index for an operator in a quorum.
     * @param quorumNumber The quorum number to query.
     * @param blockNumber The block number to query.
     * @param operatorId The id of the operator to query.
     * @param index The index to query.
     * @return The stake amount.
     * @dev Function will revert if `index` is out-of-bounds.
     * @dev Used by the BLSSignatureChecker to get past stakes of signing operators.
     */
    function getStakeAtBlockNumberAndIndex(
        uint8 quorumNumber,
        uint32 blockNumber,
        bytes32 operatorId,
        uint256 index
    ) external view returns (uint96);

    /**
     * @notice Returns the total stake at the specified block number and index for a quorum.
     * @param quorumNumber The quorum number to query.
     * @param blockNumber The block number to query.
     * @param index The index to query.
     * @return The total stake amount.
     * @dev Function will revert if `index` is out-of-bounds.
     * @dev Used by the BLSSignatureChecker to get past stakes of signing operators.
     */
    function getTotalStakeAtBlockNumberFromIndex(
        uint8 quorumNumber,
        uint32 blockNumber,
        uint256 index
    ) external view returns (uint96);

    /**
     * @notice Returns the current stake for an operator in a quorum.
     * @param operatorId The id of the operator to query.
     * @param quorumNumber The quorum number to query.
     * @return The current stake amount.
     * @dev Returns 0 if the operator has no stake history.
     */
    function getCurrentStake(
        bytes32 operatorId,
        uint8 quorumNumber
    ) external view returns (uint96);

    /**
     * @notice Returns the stake of an operator at a specific block number.
     * @param operatorId The id of the operator to query.
     * @param quorumNumber The quorum number to query.
     * @param blockNumber The block number to query.
     * @return The stake amount at the specified block.
     */
    function getStakeAtBlockNumber(
        bytes32 operatorId,
        uint8 quorumNumber,
        uint32 blockNumber
    ) external view returns (uint96);

    /**
     * @notice Returns the current total stake for a quorum.
     * @param quorumNumber The quorum number to query.
     * @return The current total stake amount.
     * @dev Will revert if `_totalStakeHistory[quorumNumber]` is empty.
     */
    function getCurrentTotalStake(
        uint8 quorumNumber
    ) external view returns (uint96);
}
