// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

/**
 * @title SortedMerkleProof
 * @notice Verifies sorted-hash Merkle proofs (pair order determined by hash value).
 *         This matches the runtime merkle tree used in DataHaven rewards.
 */
library SortedMerkleProof {
    /**
     * @notice Verify that a leaf is part of a sorted-hash Merkle tree.
     * @param root the root of the merkle tree
     * @param leaf the leaf hash
     * @param position the position of the leaf (only used for bounds check)
     * @param width the number of leaves in the tree
     * @param proof the array of proofs from leaf to root
     */
    function verify(
        bytes32 root,
        bytes32 leaf,
        uint256 position,
        uint256 width,
        bytes32[] calldata proof
    ) internal pure returns (bool) {
        if (position >= width) {
            return false;
        }

        bytes32 node = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            node = node < sibling ? efficientHash(node, sibling) : efficientHash(sibling, node);
        }
        return node == root;
    }

    /**
     * @notice Efficiently hashes two bytes32 values using assembly
     */
    function efficientHash(bytes32 a, bytes32 b) internal pure returns (bytes32 value) {
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}
