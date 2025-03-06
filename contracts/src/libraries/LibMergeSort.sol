// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

library LibMergeSort {
    function sort(
        address[] memory array
    ) internal pure returns (address[] memory) {
        if (array.length <= 1) {
            return array;
        }

        uint256 mid = array.length / 2;
        address[] memory left = new address[](mid);
        address[] memory right = new address[](array.length - mid);

        for (uint256 i = 0; i < mid; i++) {
            left[i] = array[i];
        }
        for (uint256 i = mid; i < array.length; i++) {
            right[i - mid] = array[i];
        }

        return mergeSortArrays(sort(left), sort(right));
    }

    function mergeSortArrays(
        address[] memory left,
        address[] memory right
    ) internal pure returns (address[] memory) {
        uint256 leftLength = left.length;
        uint256 rightLength = right.length;
        address[] memory merged = new address[](leftLength + rightLength);

        uint256 i = 0; // Index for left array
        uint256 j = 0; // Index for right array
        uint256 k = 0; // Index for merged array

        // Merge the two arrays into the merged array
        while (i < leftLength && j < rightLength) {
            if (left[i] < right[j]) {
                merged[k++] = left[i++];
            } else if (left[i] > right[j]) {
                merged[k++] = right[j++];
            } else {
                merged[k++] = left[i++];
                j++;
            }
        }

        // Copy remaining elements of left, if any
        while (i < leftLength) {
            merged[k++] = left[i++];
        }

        // Copy remaining elements of right, if any
        while (j < rightLength) {
            merged[k++] = right[j++];
        }

        // Resize the merged array to remove unused space
        assembly {
            mstore(merged, k)
        }

        return merged;
    }
}
