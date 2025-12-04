// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IRewardsRegistry} from "../interfaces/IRewardsRegistry.sol";

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
    constructor(
        address _avs,
        address _rewardsAgent
    ) {
        avs = _avs;
        rewardsAgent = _rewardsAgent;
    }

    // storage gap for upgradeability
    uint256[49] private __GAP;
}
