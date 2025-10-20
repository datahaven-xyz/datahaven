// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

/**
 * @title MerkleUtils
 * @notice Utility functions for Merkle tree operations
 */
library MerkleUtils {
    /**
     * @notice Calculates the Merkle root from an array of leaf nodes
     * @param leaves The array of leaf node hashes
     * @param sorting Indicate if we should sort or no the pair before hashing. It is important when using Open Zeppelin's Merkle Tree verification function
     * @return The Merkle root hash
     */
    function calculateMerkleRoot(
        bytes32[] memory leaves,
        bool sorting
    ) internal pure returns (bytes32) {
        // If there are no validators, return empty hash
        if (leaves.length == 0) {
            return bytes32(0);
        }

        // If there's only one validator, its hash is the root
        if (leaves.length == 1) {
            return leaves[0];
        }

        // Create a new array to hold the current layer's hashes
        bytes32[] memory currentLayer = new bytes32[](leaves.length);
        for (uint256 i = 0; i < leaves.length; i++) {
            currentLayer[i] = leaves[i];
        }

        // Iterate until we reach the root
        while (currentLayer.length > 1) {
            // Calculate size of the next layer
            uint256 nextLayerSize = currentLayer.length / 2;
            // If there's an odd number of elements, add one more slot for the unpaired element
            if (currentLayer.length % 2 == 1) {
                nextLayerSize += 1;
            }

            bytes32[] memory nextLayer = new bytes32[](nextLayerSize);

            // Process pairs and build the next layer
            uint256 nextIndex = 0;
            for (uint256 i = 0; i < currentLayer.length; i += 2) {
                // If this is the last element and we have an odd number, propagate it to the next layer
                if (i + 1 >= currentLayer.length) {
                    nextLayer[nextIndex] = currentLayer[i];
                    nextIndex++;
                } else {
                    // We check if the pair need to be sorted or not before hashing. Open Zeppelin Merkle Tree requires pairs to be sorted before hashing to optimize proof calculation.
                    // Eigen Layer use Open Zeppelin Merkle Tree lib so we need to support it too. For the rest we use `efficientHash` to generate the correct merkle root (e.g to be compatible with substrate).
                    if (sorting) {
                        nextLayer[nextIndex] = hashPair(currentLayer[i], currentLayer[i + 1]);
                    } else {
                        nextLayer[nextIndex] = efficientHash(currentLayer[i], currentLayer[i + 1]);
                    }
                    nextIndex++;
                }
            }

            currentLayer = nextLayer;
        }

        // Return the root (the only element left in currentLayer)
        return currentLayer[0];
    }

    /**
     * @notice Builds a Merkle proof for a specific leaf
     * @param leaves The array of leaf hashes
     * @param leafIndex The index of the leaf to generate a proof for
     * @param sorting Indicate if we should sort or no the pair before hashing. It is important when using Open Zeppelin's Merkle Tree verification function
     * @return The Merkle proof as an array of hashes
     */
    function buildMerkleProof(
        bytes32[] memory leaves,
        uint256 leafIndex,
        bool sorting
    ) internal pure returns (bytes32[] memory) {
        require(leaves.length > 0, "Empty leaves");
        require(leafIndex < leaves.length, "Leaf index out of bounds");

        // For a single leaf, there's no proof needed
        if (leaves.length == 1) {
            return new bytes32[](0);
        }

        // Initialize proof array with maximum possible length
        // The maximum depth of a binary tree with n leaves is log2(n) rounded up
        uint256 maxDepth = 0;
        uint256 layerSize = leaves.length;
        while (layerSize > 1) {
            layerSize = (layerSize + 1) / 2;
            maxDepth++;
        }

        bytes32[] memory proof = new bytes32[](maxDepth);
        uint256 proofIndex = 0;

        // Create a copy of the leaves array
        bytes32[] memory currentLayer = new bytes32[](leaves.length);
        for (uint256 i = 0; i < leaves.length; i++) {
            currentLayer[i] = leaves[i];
        }

        // Track the current position of our target leaf
        uint256 currentPosition = leafIndex;

        // Traverse from leaves to root
        while (currentLayer.length > 1) {
            // Calculate size of the next layer
            uint256 nextLayerSize = currentLayer.length / 2;
            if (currentLayer.length % 2 == 1) {
                nextLayerSize += 1;
            }

            bytes32[] memory nextLayer = new bytes32[](nextLayerSize);

            // Collect the sibling for our proof and build the next layer
            uint256 nextIndex = 0;
            for (uint256 i = 0; i < currentLayer.length; i += 2) {
                if (i + 1 >= currentLayer.length) {
                    // Handle the case of an odd number of elements
                    nextLayer[nextIndex] = currentLayer[i];

                    // If our target is the last unpaired element
                    if (currentPosition == i) {
                        // For odd element at the end with no pair, we don't add anything to the proof here
                        // But we update the position for the next layer
                        currentPosition = nextIndex;
                    }
                } else {
                    // We check if the pair need to be sorted or not before hashing. Open Zeppelin Merkle Tree requires pairs to be sorted before hashing to optimize proof calculation.
                    // Eigen Layer use Open Zeppelin Merkle Tree lib so we need to support it too. For the rest we use `efficientHash` to generate the correct merkle root (e.g to be compatible with substrate).
                    if (sorting) {
                        nextLayer[nextIndex] = hashPair(currentLayer[i], currentLayer[i + 1]);
                    } else {
                        nextLayer[nextIndex] = efficientHash(currentLayer[i], currentLayer[i + 1]);
                    }

                    // If our target is in this pair, add the sibling to the proof
                    if (currentPosition == i) {
                        proof[proofIndex] = currentLayer[i + 1];
                        proofIndex++;
                        currentPosition = nextIndex;
                    } else if (currentPosition == i + 1) {
                        proof[proofIndex] = currentLayer[i];
                        proofIndex++;
                        currentPosition = nextIndex;
                    }
                }
                nextIndex++;
            }

            currentLayer = nextLayer;
        }

        // Resize the proof array to the actual number of elements
        bytes32[] memory finalProof = new bytes32[](proofIndex);
        for (uint256 i = 0; i < proofIndex; i++) {
            finalProof[i] = proof[i];
        }

        return finalProof;
    }

    /**
     * @notice Hashes a pair of bytes32 values in sorted order
     * @param a First hash
     * @param b Second hash
     * @return The hash of the pair
     */
    function hashPair(
        bytes32 a,
        bytes32 b
    ) internal pure returns (bytes32) {
        return a < b ? efficientHash(a, b) : efficientHash(b, a);
    }

    /**
     * @notice Efficiently hashes two bytes32 values using assembly
     * @param a First value
     * @param b Second value
     * @return value The keccak256 hash
     */
    function efficientHash(
        bytes32 a,
        bytes32 b
    ) internal pure returns (bytes32 value) {
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}
