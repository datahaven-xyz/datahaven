// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

/**
 * @title Interface for errors in the RewardsRegistry contract
 */
interface IRewardsRegistryErrors {
    /// @notice Thrown when a function is called by an address that is not the AVS.
    error OnlyAVS();
    /// @notice Thrown when a function is called by an address that is not the RewardsAgent.
    error OnlyRewardsAgent();
    /// @notice Thrown when rewards have already been claimed for the current merkle root.
    error RewardsAlreadyClaimed();
    /// @notice Thrown when a provided merkle proof is invalid.
    error InvalidMerkleProof();
    /// @notice Thrown when rewards transfer fails.
    error RewardsTransferFailed();
    /// @notice Thrown when the rewards merkle root is not set.
    error RewardsMerkleRootNotSet();
}

/**
 * @title Interface for events in the RewardsRegistry contract
 */
interface IRewardsRegistryEvents {
    /**
     * @notice Emitted when a new merkle root is set
     * @param oldRoot The previous merkle root
     * @param newRoot The new merkle root
     */
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);

    /**
     * @notice Emitted when rewards are claimed
     * @param operatorAddress Address of the operator receiving rewards
     * @param points Points earned by the operator
     * @param rewardsAmount Amount of rewards transferred
     */
    event RewardsClaimed(address indexed operatorAddress, uint256 points, uint256 rewardsAmount);
}

/**
 * @title Interface for the RewardsRegistry contract
 * @notice Contract for managing operator rewards through a Merkle root verification process
 */
interface IRewardsRegistry is IRewardsRegistryErrors, IRewardsRegistryEvents {
    /**
     * @notice Update the rewards merkle root
     * @param newMerkleRoot New merkle root to be set
     * @dev Only callable by the rewards agent
     */
    function updateRewardsMerkleRoot(
        bytes32 newMerkleRoot
    ) external;

    /**
     * @notice Claim rewards for an operator
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;
}
