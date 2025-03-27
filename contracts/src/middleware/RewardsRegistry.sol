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
        bytes32 oldRoot = lastRewardsMerkleRoot;
        lastRewardsMerkleRoot = newMerkleRoot;
        emit RewardsMerkleRootUpdated(oldRoot, newMerkleRoot);
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
     * @notice Claim rewards for an operator
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorId ID of the operator
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        bytes32 operatorId,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external override onlyAVS {
        // Check that the lastRewardsMerkleRoot is not the default value
        if (lastRewardsMerkleRoot == bytes32(0)) {
            revert RewardsMerkleRootNotSet();
        }

        // Check if operator has already claimed for this merkle root
        if (operatorIdToLastClaimedRoot[operatorId] == lastRewardsMerkleRoot) {
            revert RewardsAlreadyClaimed();
        }

        // Verify the merkle proof
        bytes32 leaf = keccak256(abi.encode(operatorId, operatorPoints));
        if (!MerkleProof.verify(proof, lastRewardsMerkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        // Calculate rewards - currently 1 point = 1 wei (placeholder)
        // TODO: Update the reward calculation formula with the proper relationship
        uint256 rewardsAmount = operatorPoints;

        // Update the operator's last claimed root
        operatorIdToLastClaimedRoot[operatorId] = lastRewardsMerkleRoot;

        // Transfer rewards to the operator
        (bool success,) = operatorAddress.call{value: rewardsAmount}("");
        if (!success) {
            revert RewardsTransferFailed();
        }

        emit RewardsClaimed(operatorAddress, operatorId, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Function to receive ETH
     */
    receive() external payable {}
}
