// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title TestUtils
 * @notice Utility functions for testing DataHaven contracts
 */
library TestUtils {
    using SafeCast for uint256;
    /**
     * @notice Generates mock validator addresses for testing
     * @param count Number of validators to generate
     * @param startIndex Starting index for validator numbering (defaults to 0)
     * @return Array of validator addresses
     */
    function generateMockValidatorsAddresses(
        uint256 count,
        uint256 startIndex
    ) internal pure returns (address[] memory) {
        address[] memory validators = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            validators[i] = address((startIndex + i + 1).toUint160());
        }
        return validators;
    }

    /**
     * @notice Generates mock validator addresses for testing (overload with default startIndex = 0)
     * @param count Number of validators to generate
     * @return Array of validator addresses
     */
    function generateMockValidatorsAddresses(
        uint256 count
    ) internal pure returns (address[] memory) {
        return generateMockValidatorsAddresses(count, 0);
    }

    /**
     * @notice Generates mock validator addresses for testing
     * @param count Number of validators to generate
     * @param startIndex Starting index for validator numbering (defaults to 0)
     * @return Array of validator addresses
     */
    function generateMockValidators(
        uint256 count,
        uint256 startIndex
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory validators = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            validators[i] = bytes32(startIndex + i + 1);
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
    ) internal pure returns (bytes32[] memory) {
        return generateMockValidators(count, 0);
    }
}
