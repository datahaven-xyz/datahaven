// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0 ^0.8.0 ^0.8.27;

// lib/eigenlayer-contracts/lib/openzeppelin-contracts-v4.9.0/contracts/utils/cryptography/MerkleProof.sol

// OpenZeppelin Contracts (last updated v4.9.0) (utils/cryptography/MerkleProof.sol)

/**
 * @dev These functions deal with verification of Merkle Tree proofs.
 *
 * The tree and the proofs can be generated using our
 * https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
 * You will find a quickstart guide in the readme.
 *
 * WARNING: You should avoid using leaf values that are 64 bytes long prior to
 * hashing, or use a hash function other than keccak256 for hashing leaves.
 * This is because the concatenation of a sorted pair of internal nodes in
 * the merkle tree could be reinterpreted as a leaf value.
 * OpenZeppelin's JavaScript library generates merkle trees that are safe
 * against this attack out of the box.
 */
library MerkleProof {
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     */
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    /**
     * @dev Calldata version of {verify}
     *
     * _Available since v4.7._
     */
    function verifyCalldata(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProofCalldata(proof, leaf) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leafs & pre-images are assumed to be sorted.
     *
     * _Available since v4.4._
     */
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = _hashPair(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Calldata version of {processProof}
     *
     * _Available since v4.7._
     */
    function processProofCalldata(bytes32[] calldata proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = _hashPair(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProof(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Calldata version of {multiProofVerify}
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * CAUTION: Not all merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * _Available since v4.7._
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 totalHashes = proofFlags.length;

        // Check proof validity.
        require(leavesLen + proof.length - 1 == totalHashes, "MerkleProof: invalid multiproof");

        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < totalHashes; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = _hashPair(a, b);
        }

        if (totalHashes > 0) {
            unchecked {
                return hashes[totalHashes - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Calldata version of {processMultiProof}.
     *
     * CAUTION: Not all merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * _Available since v4.7._
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 totalHashes = proofFlags.length;

        // Check proof validity.
        require(leavesLen + proof.length - 1 == totalHashes, "MerkleProof: invalid multiproof");

        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < totalHashes; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = _hashPair(a, b);
        }

        if (totalHashes > 0) {
            unchecked {
                return hashes[totalHashes - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? _efficientHash(a, b) : _efficientHash(b, a);
    }

    function _efficientHash(bytes32 a, bytes32 b) private pure returns (bytes32 value) {
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}

// src/interfaces/IRewardsRegistry.sol

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
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 newRootIndex);

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
     * @notice Claim rewards for an operator from a specific merkle root index
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimRewards(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

    /**
     * @notice Claim rewards for an operator from the latest merkle root
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimLatestRewards(
        address operatorAddress,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external;

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

// src/middleware/RewardsRegistryStorage.sol

/**
 * @title Storage variables for the RewardsRegistry contract
 * @notice This storage contract is separate from the logic to simplify the upgrade process
 */
abstract contract RewardsRegistryStorage is IRewardsRegistry {
    /**
     *
     *                            IMMUTABLES
     *
     */

    /// @notice Address of the AVS (Service Manager)
    address public immutable avs;

    /**
     *
     *                            STATE VARIABLES
     *
     */

    /// @notice Address of the rewards agent contract
    address public rewardsAgent;

    /// @notice History of all merkle roots, accessible by index
    bytes32[] public merkleRootHistory;

    /// @notice Mapping from operator to merkle root index to claimed status
    mapping(address => mapping(uint256 => bool)) public operatorClaimedByIndex;

    /**
     * @notice Constructor to set up the immutable AVS address
     * @param _avs Address of the AVS (Service Manager)
     * @param _rewardsAgent Address of the rewards agent contract
     */
    constructor(address _avs, address _rewardsAgent) {
        avs = _avs;
        rewardsAgent = _rewardsAgent;
    }

    // storage gap for upgradeability
    uint256[49] private __GAP;
}

// src/middleware/RewardsRegistry.sol

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
    function claimRewards(
        address operatorAddress,
        uint256 rootIndex,
        uint256 operatorPoints,
        bytes32[] calldata proof
    ) external override onlyAVS {
        // Validate the claim and calculate rewards
        uint256 rewardsAmount = _validateClaim(operatorAddress, rootIndex, operatorPoints, proof);
        _transferRewards(operatorAddress, rewardsAmount);

        // Emit the corresponding event
        emit RewardsClaimedForIndex(operatorAddress, rootIndex, operatorPoints, rewardsAmount);
    }

    /**
     * @notice Claim rewards for an operator from the latest merkle root
     * @param operatorAddress Address of the operator to receive rewards
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @dev Only callable by the AVS (Service Manager)
     */
    function claimLatestRewards(
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
        uint256 rewardsAmount = _validateClaim(operatorAddress, latestIndex, operatorPoints, proof);
        _transferRewards(operatorAddress, rewardsAmount);

        // Emit the corresponding event
        emit RewardsClaimedForIndex(operatorAddress, latestIndex, operatorPoints, rewardsAmount);
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

        // Validate all claims and accumulate the total rewards
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < rootIndices.length; i++) {
            totalRewards +=
                _validateClaim(operatorAddress, rootIndices[i], operatorPoints[i], proofs[i]);
        }

        // Transfer the total rewards in a single transaction
        _transferRewards(operatorAddress, totalRewards);

        // Emit the corresponding event
        emit RewardsBatchClaimedForIndices(
            operatorAddress, rootIndices, operatorPoints, totalRewards
        );
    }

    /**
     * @notice Internal function to validate a claim and calculate rewards
     * @param operatorAddress Address of the operator to receive rewards
     * @param rootIndex Index of the merkle root to claim from
     * @param operatorPoints Points earned by the operator
     * @param proof Merkle proof to validate the operator's rewards
     * @return rewardsAmount The amount of rewards calculated
     */
    function _validateClaim(
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

