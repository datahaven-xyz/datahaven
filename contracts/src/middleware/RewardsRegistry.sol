// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {RewardsRegistryStorage} from "./RewardsRegistryStorage.sol";

/**
 * @title RewardsRegistry
 * @notice Contract for managing operator rewards through a Merkle root verification process
 */
contract RewardsRegistry is RewardsRegistryStorage {
    /**
     * @notice Constructor to set up the rewards registry
     * @param _avs Address of the AVS (Service Manager)
     * @param _rewardsAgent Address of the rewards agent contract
     */
    constructor(address _avs, address _rewardsAgent) RewardsRegistryStorage(_avs, _rewardsAgent) {}

    /**
     * @notice Modifier to restrict function access to the rewards agent only
     */
    modifier onlyRewardsAgent() {
        if (msg.sender != rewardsAgent) {
            revert OnlyRewardsAgent();
        }
        _;
    }

    /**
     * @notice Modifier to restrict function access to the AVS only
     */
    modifier onlyAVS() {
        if (msg.sender != avs) {
            revert OnlyAVS();
        }
        _;
    }

    /**
     * @notice Update the rewards merkle root
     * @param newMerkleRoot New merkle root to be set
     * @dev Only callable by the rewards agent
     */
    function updateRewardsMerkleRoot(
        bytes32 newMerkleRoot
    ) external override onlyRewardsAgent {
        // Get the old root (bytes32(0) if no roots exist)
        bytes32 oldRoot = merkleRootHistory.length > 0
            ? merkleRootHistory[merkleRootHistory.length - 1]
            : bytes32(0);

        // Add the new root to the history
        uint256 newRootIndex = merkleRootHistory.length;
        merkleRootHistory.push(newMerkleRoot);

        // Emit the corresponding event
        emit RewardsMerkleRootUpdated(oldRoot, newMerkleRoot, newRootIndex);
    }

    /**
     * @notice Update the rewards agent address
     * @param _rewardsAgent New rewards agent address
     * @dev Only callable by the AVS
     */
    function setRewardsAgent(
        address _rewardsAgent
    ) external onlyAVS {
        rewardsAgent = _rewardsAgent;
    }

    /**
     * @notice Claim rewards for an operator (uses latest merkle root)
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external override onlyAVS {
        // Check that we have at least one merkle root
        if (merkleRootHistory.length == 0) {
            revert RewardsMerkleRootNotSet();
        }

        // Claim from the latest root index
        uint256 latestIndex = merkleRootHistory.length - 1;
        uint256 rewardsAmount = _performClaim(operatorAddress, latestIndex, operatorPoints, proof);

        // Emit the corresponding event
        emit RewardsClaimedForIndex(operatorAddress, latestIndex, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Claim rewards for an operator from a specific merkle root index
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewardsByIndex(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external override onlyAVS {
        // Perform the claim
        uint256 rewardsAmount = _performClaim(operatorAddress, rootIndex, operatorPoints, proof);

        // Emit the corresponding event
        emit RewardsClaimedForIndex(operatorAddress, rootIndex, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Claim rewards for an operator from multiple merkle root indices
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndices Array of merkle root indices to claim from
     * @param operatorPoints Array of points earned by the operator for each root
     * @param proofs Array of merkle proofs to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewardsBatch(
        address operatorAddress,
        uint256[] calldata rootIndices,
        uint256[] calldata operatorPoints,
        bytes32[][] calldata proofs
    ) external override onlyAVS {
        // Check that the arrays have the same length
        if (rootIndices.length != operatorPoints.length || rootIndices.length != proofs.length) {
            revert ArrayLengthMismatch();
        }

        // Perform the claims, accumulating the total rewards
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < rootIndices.length; i++) {
            totalRewards +=
                _performClaim(operatorAddress, rootIndices[i], operatorPoints[i], proofs[i]);
        }

        // Emit the corresponding event
        emit RewardsBatchClaimedForIndices(
            operatorAddress, rootIndices, operatorPoints, totalRewards
        );
    }

    /**
     * @notice Internal function to perform the actual claim of rewards
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @return rewardsAmount The amount of rewards calculated and transferred
     */
    function _performClaim(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) internal returns (uint256 rewardsAmount) {
        // Check that the root index to claim from exists
        if (rootIndex >= merkleRootHistory.length) {
            revert InvalidMerkleRootIndex();
        }

        // Check if operator has already claimed for this merkle root index
        if (operatorClaimedByIndex[operatorAddress][rootIndex]) {
            revert RewardsAlreadyClaimedForIndex();
        }

        // Verify the merkle proof
        bytes32 leaf = keccak256(abi.encode(operatorAddress, operatorPoints));
        if (!MerkleProof.verify(proof, merkleRootHistory[rootIndex], leaf)) {
            revert InvalidMerkleProof();
        }

        // Calculate rewards - currently 1 point = 1 wei (placeholder)
        // TODO: Update the reward calculation formula with the proper relationship
        rewardsAmount = operatorPoints;

        // Mark as claimed for this specific index
        operatorClaimedByIndex[operatorAddress][rootIndex] = true;

        // Transfer rewards to the operator
        (bool success,) = operatorAddress.call{value: rewardsAmount}("");
        if (!success) {
            revert RewardsTransferFailed();
        }
    }

    /**
     * @notice Get the merkle root at a specific index
     * @param index Index of the merkle root to retrieve
     * @return The merkle root at the specified index
     */
    function getMerkleRootByIndex(
        uint256 index
    ) external view override returns (bytes32) {
        if (index >= merkleRootHistory.length) {
            revert InvalidMerkleRootIndex();
        }
        return merkleRootHistory[index];
    }

    /**
     * @notice Get the latest merkle root index
     * @return The index of the latest merkle root (returns 0 if no roots exist)
     */
    function getLatestMerkleRootIndex() external view override returns (uint256) {
        if (merkleRootHistory.length == 0) {
            return 0;
        }
        return merkleRootHistory.length - 1;
    }

    /**
     * @notice Get the latest merkle root
     * @return The latest merkle root (returns bytes32(0) if no roots exist)
     */
    function getLatestMerkleRoot() external view override returns (bytes32) {
        if (merkleRootHistory.length == 0) {
            return bytes32(0);
        }
        return merkleRootHistory[merkleRootHistory.length - 1];
    }

    /**
     * @notice Get the total number of merkle roots in history
     * @return The total count of merkle roots
     */
    function getMerkleRootHistoryLength() external view override returns (uint256) {
        return merkleRootHistory.length;
    }

    /**
     * @notice Check if an operator has claimed rewards for a specific root index
     * @param operatorAddress Address of the operator
     * @param rootIndex Index of the merkle root to check
     * @return True if the operator has claimed rewards for this root index
     */
    function hasClaimedByIndex(
        address operatorAddress,
        uint256 rootIndex
    ) external view override returns (bool) {
        return operatorClaimedByIndex[operatorAddress][rootIndex];
    }

    /**
     * @notice Function to receive ETH
     */
    receive() external payable {}
}
