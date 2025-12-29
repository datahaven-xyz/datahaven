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
    /// @notice Thrown when a provided merkle proof is invalid.
    error InvalidMerkleProof();
    /// @notice Thrown when rewards transfer fails.
    error RewardsTransferFailed();
    /// @notice Thrown when the rewards merkle root is not set.
    error RewardsMerkleRootNotSet();
    /// @notice Thrown when trying to access a merkle root index that doesn't exist.
    error InvalidMerkleRootIndex();
    /// @notice Thrown when trying to claim rewards for a root index that has already been claimed.
    error RewardsAlreadyClaimedForIndex();
    /// @notice Thrown when the arrays provided to the batch claim function have mismatched lengths.
    error ArrayLengthMismatch();
}

/**
 * @title Interface for events in the RewardsRegistry contract
 */
interface IRewardsRegistryEvents {
    /**
     * @notice Emitted when a new merkle root is set
     * @param oldRoot The previous merkle root
     * @param newRoot The new merkle root
     * @param newRootIndex The index of the new root in the history
     */
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 indexed newRoot, uint256 newRootIndex);

    /**
     * @notice Emitted when rewards are claimed for a specific root index
     * @param operatorAddress Address of the operator that received the rewards
     * @param rootIndex Index of the merkle root that the operator claimed rewards from
     * @param points Points earned by the operator
     * @param rewardsAmount Amount of rewards transferred
     */
    event RewardsClaimedForIndex(
        address indexed operatorAddress,
        uint256 indexed rootIndex,
        uint256 points,
        uint256 rewardsAmount
    );

    /**
     * @notice Emitted when rewards are claimed for multiple root indices in a batch
     * @param operatorAddress Address of the operator that received the rewards
     * @param rootIndices Array of merkle root indices that the operator claimed rewards from
     * @param points Array of points earned by the operator for each root index
     * @param totalRewardsAmount Total amount of rewards transferred to the operator
     */
    event RewardsBatchClaimedForIndices(
        address indexed operatorAddress,
        uint256[] rootIndices,
        uint256[] points,
        uint256 totalRewardsAmount
    );
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
     * @notice Claim rewards for an operator from a specific merkle root index using Substrate/Snowbridge positional Merkle proofs.
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param numberOfLeaves The total number of leaves in the Merkle tree
     * @param leafIndex The index of the operator's leaf in the Merkle tree
     * @param proof Positional Merkle proof (from leaf to root)
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        uint256 numberOfLeaves,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from the latest merkle root using Substrate/Snowbridge positional Merkle proofs.
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param numberOfLeaves The total number of leaves in the Merkle tree
     * @param leafIndex The index of the operator's leaf in the Merkle tree
     * @param proof Positional Merkle proof (from leaf to root)
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimLatestRewards(
        address operatorAddress,
        uint256 operatorPoints,
        uint256 numberOfLeaves,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from multiple merkle root indices using Substrate/Snowbridge positional Merkle proofs.
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndices Array of merkle root indices to claim from
     * @param operatorPoints Array of points earned by the operator for each root
     * @param numberOfLeaves Array with the total number of leaves for each Merkle tree
     * @param leafIndices Array of leaf indices for the operator in each Merkle tree
     * @param proofs Array of positional Merkle proofs for each claim
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewardsBatch(
        address operatorAddress,
        uint256[] calldata rootIndices,
        uint256[] calldata operatorPoints,
        uint256[] calldata numberOfLeaves,
        uint256[] calldata leafIndices,
        bytes32[][] calldata proofs
    ) external;

    /**
     * @notice Sets the rewards agent address in the RewardsRegistry contract
     * @param rewardsAgent New rewards agent address
     * @dev Only callable by the AVS (Service Manager)
     */
    function setRewardsAgent(
        address rewardsAgent
    ) external;

    /**
     * @notice Get the merkle root at a specific index
     * @param index Index of the merkle root to retrieve
     * @return The merkle root at the specified index
     */
    function getMerkleRootByIndex(
        uint256 index
    ) external view returns (bytes32);

    /**
     * @notice Get the latest merkle root index
     * @return The index of the latest merkle root (returns 0 if no roots exist)
     */
    function getLatestMerkleRootIndex() external view returns (uint256);

    /**
     * @notice Get the latest merkle root
     * @return The latest merkle root (returns bytes32(0) if no roots exist)
     */
    function getLatestMerkleRoot() external view returns (bytes32);

    /**
     * @notice Get the total number of merkle roots in history
     * @return The total count of merkle roots
     */
    function getMerkleRootHistoryLength() external view returns (uint256);

    /**
     * @notice Check if an operator has claimed rewards for a specific root index
     * @param operatorAddress Address of the operator
     * @param rootIndex Index of the merkle root to check
     * @return True if the operator has claimed rewards for this root index, false otherwise
     */
    function hasClaimedByIndex(
        address operatorAddress,
        uint256 rootIndex
    ) external view returns (bool);
}
