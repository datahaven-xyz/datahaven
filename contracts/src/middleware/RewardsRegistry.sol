// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {SubstrateMerkleProof} from "snowbridge/src/utils/SubstrateMerkleProof.sol";
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";
import {IDataHavenServiceManager} from "../interfaces/IDataHavenServiceManager.sol";
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
     * @notice Claim rewards for an operator from a specific merkle root index
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    // Removed OZ claim with sorted proof

    /**
     * @notice Claim rewards for an operator from the latest merkle root
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    // Removed OZ latest-claim with sorted proof

    /**
     * @notice Claim rewards for an operator from multiple merkle root indices
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndices Array of merkle root indices to claim from
     * @param operatorPoints Array of points earned by the operator for each root
     * @param proofs Array of merkle proofs to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    // Removed OZ batch claim with sorted proof

    /**
     * @notice Internal function to validate a claim and calculate rewards
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @return rewardsAmount The amount of rewards calculated
     */
    // Removed OZ validator; all validation is through _validateClaim

    /**
     * @notice Claim rewards using Substrate/Snowbridge positional Merkle proofs (compatibility with DataHaven runtime).
     */
    function claimRewards(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        uint256 numberOfLeaves,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external override onlyAVS {
        uint256 rewardsAmount = _validateClaim(
            operatorAddress, rootIndex, operatorPoints, numberOfLeaves, leafIndex, proof
        );
        _transferRewards(operatorAddress, rewardsAmount);

        emit RewardsClaimedForIndex(operatorAddress, rootIndex, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Claim latest rewards using Substrate/Snowbridge positional Merkle proofs (compatibility with DataHaven runtime).
     */
    function claimLatestRewards(
        address operatorAddress,
        uint256 operatorPoints,
        uint256 numberOfLeaves,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external override onlyAVS {
        if (merkleRootHistory.length == 0) {
            revert RewardsMerkleRootNotSet();
        }
        uint256 latestIndex = merkleRootHistory.length - 1;
        uint256 rewardsAmount = _validateClaim(
            operatorAddress, latestIndex, operatorPoints, numberOfLeaves, leafIndex, proof
        );
        _transferRewards(operatorAddress, rewardsAmount);

        emit RewardsClaimedForIndex(operatorAddress, latestIndex, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Batch claim using Substrate/Snowbridge positional Merkle proofs.
     */
    function claimRewardsBatch(
        address operatorAddress,
        uint256[] calldata rootIndices,
        uint256[] calldata operatorPoints,
        uint256[] calldata numberOfLeaves,
        uint256[] calldata leafIndices,
        bytes32[][] calldata proofs
    ) external override onlyAVS {
        if (
            rootIndices.length != operatorPoints.length || rootIndices.length != proofs.length
                || rootIndices.length != numberOfLeaves.length
                || rootIndices.length != leafIndices.length
        ) {
            revert ArrayLengthMismatch();
        }

        uint256 totalRewards = 0;
        for (uint256 i = 0; i < rootIndices.length; i++) {
            totalRewards += _validateClaim(
                operatorAddress,
                rootIndices[i],
                operatorPoints[i],
                numberOfLeaves[i],
                leafIndices[i],
                proofs[i]
            );
        }

        _transferRewards(operatorAddress, totalRewards);

        emit RewardsBatchClaimedForIndices(
            operatorAddress, rootIndices, operatorPoints, totalRewards
        );
    }

    /**
     * @notice Internal validation for Substrate/Snowbridge positional Merkle proof flow.
     */
    function _validateClaim(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        uint256 numberOfLeaves,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) internal returns (uint256 rewardsAmount) {
        if (rootIndex >= merkleRootHistory.length) {
            revert InvalidMerkleRootIndex();
        }

        if (operatorClaimedByIndex[operatorAddress][rootIndex]) {
            revert RewardsAlreadyClaimedForIndex();
        }

        // Compute Substrate-compatible leaf: keccak256(SCALE(accountId || u32LE points))
        // For DataHaven, AccountId comes from the AVS mapping (validatorEthAddressToSolochainAddress) if set.
        address leafAccount = operatorAddress;
        address mappedSolochain =
            IDataHavenServiceManager(avs).validatorEthAddressToSolochainAddress(operatorAddress);
        if (mappedSolochain != address(0)) {
            leafAccount = mappedSolochain;
        }
        bytes memory preimage =
            abi.encodePacked(leafAccount, ScaleCodec.encodeU32(uint32(operatorPoints)));
        bytes32 substrateLeaf = keccak256(preimage);

        bool ok = SubstrateMerkleProof.verify(
            merkleRootHistory[rootIndex], substrateLeaf, leafIndex, numberOfLeaves, proof
        );
        if (!ok) revert InvalidMerkleProof();

        rewardsAmount = operatorPoints;
        operatorClaimedByIndex[operatorAddress][rootIndex] = true;
    }

    /**
     * @notice Internal function to transfer rewards to an operator
     * @param operatorAddress Address of the operator to receive rewards
     * @param rewardsAmount Amount of rewards to transfer
     */
    function _transferRewards(address operatorAddress, uint256 rewardsAmount) internal {
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
        uint256 length = merkleRootHistory.length;
        return length == 0 ? 0 : length - 1;
    }

    /**
     * @notice Get the latest merkle root
     * @return The latest merkle root (returns bytes32(0) if no roots exist)
     */
    function getLatestMerkleRoot() external view override returns (bytes32) {
        uint256 length = merkleRootHistory.length;
        return length == 0 ? bytes32(0) : merkleRootHistory[length - 1];
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
