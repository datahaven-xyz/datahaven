// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

/**
 * @title TestUtils
 * @notice Utility functions for testing DataHaven contracts
 */
library TestUtils {
    /**
     * @notice Generates mock validator addresses for testing
     * @param count Number of validators to generate
     * @param startIndex Starting index for validator numbering (defaults to 0)
     * @return Array of validator addresses
     */
    function generateMockValidators(
        uint256 count,
        uint256 startIndex
    ) internal pure returns (address[] memory) {
        address[] memory validators = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            // Generate a deterministic address by hashing and taking the last 20 bytes
            bytes32 hash = keccak256(abi.encodePacked("validator", startIndex + i + 1));
            validators[i] = address(uint160(uint256(hash)));
        }
        return validators;
    }

    /**
     * @notice Generates mock validator addresses for testing (overload with default startIndex = 0)
     * @param count Number of validators to generate
     * @return Array of validator addresses
     */
    function generateMockValidators(
        uint256 count
    ) internal pure returns (address[] memory) {
        return generateMockValidators(count, 0);
    }
}
