// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISocketRegistryErrors {
    /// @notice Thrown when the caller is not the SlashingRegistryCoordinator
    error OnlySlashingRegistryCoordinator();
}

interface ISocketRegistry is ISocketRegistryErrors {
    /**
     * @notice Sets the socket for an operator.
     * @param _operatorId The id of the operator to set the socket for.
     * @param _socket The socket (any arbitrary string as deemed useful by an AVS) to set.
     * @dev Only callable by the SlashingRegistryCoordinator.
     */
    function setOperatorSocket(bytes32 _operatorId, string memory _socket) external;

    /**
     * @notice Gets the stored socket for an operator.
     * @param _operatorId The id of the operator to query.
     * @return The stored socket associated with the operator.
     */
    function getOperatorSocket(
        bytes32 _operatorId
    ) external view returns (string memory);
}
