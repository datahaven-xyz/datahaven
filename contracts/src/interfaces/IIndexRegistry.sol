// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

interface IIndexRegistryErrors {
    /// @notice Thrown when a function is called by an address that is not the RegistryCoordinator.
    error OnlyRegistryCoordinator();
    /// @notice Thrown when attempting to query a quorum that has no history.
    error QuorumDoesNotExist();
    /// @notice Thrown when attempting to look up an operator that does not exist at the specified block number.
    error OperatorIdDoesNotExist();
}

interface IIndexRegistryTypes {
    /// @notice Represents an update to an operator's status at a specific index.
    /// @param fromBlockNumber The block number from which this update takes effect.
    /// @param operatorId The unique identifier of the operator.
    struct OperatorUpdate {
        uint32 fromBlockNumber;
        bytes32 operatorId;
    }

    /// @notice Represents an update to the total number of operators in a quorum.
    /// @param fromBlockNumber The block number from which this update takes effect.
    /// @param numOperators The total number of operators after the update.
    struct QuorumUpdate {
        uint32 fromBlockNumber;
        uint32 numOperators;
    }
}

interface IIndexRegistryEvents is IIndexRegistryTypes {
    /*
     * @notice Emitted when an operator's index in a quorum is updated.
     * @param operatorId The unique identifier of the operator.
     * @param quorumNumber The identifier of the quorum.
     * @param newOperatorIndex The new index assigned to the operator.
     */
    event QuorumIndexUpdate(
        bytes32 indexed operatorId, uint8 quorumNumber, uint32 newOperatorIndex
    );
}

interface IIndexRegistry is IIndexRegistryErrors, IIndexRegistryEvents {
    /*
     * @notice Returns the special identifier used to indicate a non-existent operator.
     * @return The bytes32 constant OPERATOR_DOES_NOT_EXIST_ID.
     */
    function OPERATOR_DOES_NOT_EXIST_ID() external pure returns (bytes32);

    /*
     * @notice Returns the address of the RegistryCoordinator contract.
     * @return The address of the RegistryCoordinator.
     */
    function registryCoordinator() external view returns (address);

    /*
     * @notice Returns the current index of an operator with ID `operatorId` in quorum `quorumNumber`.
     * @dev This mapping is NOT updated when an operator is deregistered,
     * so it's possible that an index retrieved from this mapping is inaccurate.
     * If you're querying for an operator that might be deregistered, ALWAYS
     * check this index against the latest `_operatorIndexHistory` entry.
     * @param quorumNumber The identifier of the quorum.
     * @param operatorId The unique identifier of the operator.
     * @return The current index of the operator.
     */
    function currentOperatorIndex(
        uint8 quorumNumber,
        bytes32 operatorId
    ) external view returns (uint32);

    // ACTIONS

    /*
     * @notice Registers the operator with the specified `operatorId` for the quorums specified by `quorumNumbers`.
     * @param operatorId The unique identifier of the operator.
     * @param quorumNumbers The quorum numbers to register for.
     * @return An array containing a list of the number of operators (including the registering operator)
     *         in each of the quorums the operator is registered for.
     * @dev Access restricted to the RegistryCoordinator.
     * @dev Preconditions:
     *         1) `quorumNumbers` has no duplicates
     *         2) `quorumNumbers.length` != 0
     *         3) `quorumNumbers` is ordered in ascending order
     *         4) the operator is not already registered
     */
    function registerOperator(
        bytes32 operatorId,
        bytes calldata quorumNumbers
    ) external returns (uint32[] memory);

    /*
     * @notice Deregisters the operator with the specified `operatorId` for the quorums specified by `quorumNumbers`.
     * @param operatorId The unique identifier of the operator.
     * @param quorumNumbers The quorum numbers to deregister from.
     * @dev Access restricted to the RegistryCoordinator.
     * @dev Preconditions:
     *         1) `quorumNumbers` has no duplicates
     *         2) `quorumNumbers.length` != 0
     *         3) `quorumNumbers` is ordered in ascending order
     *         4) the operator is not already deregistered
     *         5) `quorumNumbers` is a subset of the quorumNumbers that the operator is registered for
     */
    function deregisterOperator(bytes32 operatorId, bytes calldata quorumNumbers) external;

    /*
     * @notice Initializes a new quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum to initialize.
     */
    function initializeQuorum(
        uint8 quorumNumber
    ) external;

    // VIEW

    /*
     * @notice Returns the operator update at index `arrayIndex` for operator at index `operatorIndex` in quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @param operatorIndex The index of the operator.
     * @param arrayIndex The index in the update history.
     * @return The operator update entry.
     */
    function getOperatorUpdateAtIndex(
        uint8 quorumNumber,
        uint32 operatorIndex,
        uint32 arrayIndex
    ) external view returns (OperatorUpdate memory);

    /*
     * @notice Returns the quorum update at index `quorumIndex` for quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @param quorumIndex The index in the quorum's update history.
     * @return The quorum update entry.
     */
    function getQuorumUpdateAtIndex(
        uint8 quorumNumber,
        uint32 quorumIndex
    ) external view returns (QuorumUpdate memory);

    /*
     * @notice Returns the latest quorum update for quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @return The most recent quorum update.
     */
    function getLatestQuorumUpdate(
        uint8 quorumNumber
    ) external view returns (QuorumUpdate memory);

    /*
     * @notice Returns the latest operator update for operator at index `operatorIndex` in quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @param operatorIndex The index of the operator.
     * @return The most recent operator update.
     */
    function getLatestOperatorUpdate(
        uint8 quorumNumber,
        uint32 operatorIndex
    ) external view returns (OperatorUpdate memory);

    /*
     * @notice Returns the list of operators in quorum `quorumNumber` at block `blockNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @param blockNumber The block number to query.
     * @return An array of operator IDs.
     */
    function getOperatorListAtBlockNumber(
        uint8 quorumNumber,
        uint32 blockNumber
    ) external view returns (bytes32[] memory);

    /*
     * @notice Returns the total number of operators in quorum `quorumNumber`.
     * @param quorumNumber The identifier of the quorum.
     * @return The total number of operators.
     */
    function totalOperatorsForQuorum(
        uint8 quorumNumber
    ) external view returns (uint32);
}
