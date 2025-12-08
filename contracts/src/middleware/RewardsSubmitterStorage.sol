// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsSubmitter} from "../interfaces/IRewardsSubmitter.sol";

/**
 * @title RewardsSubmitterStorage
 * @notice Storage contract for RewardsSubmitter state variables
 * @dev This contract is inherited by DataHavenServiceManager to add rewards submission functionality
 */
abstract contract RewardsSubmitterStorage is IRewardsSubmitter {
    // ============ State Variables ============

    /// @notice Address authorized to submit rewards via Snowbridge
    address internal _rewardsSnowbridgeAgent;

    /// @notice The reward token (e.g., wHAVE)
    address internal _rewardToken;

    /// @notice Genesis timestamp for era calculations (must align to CALCULATION_INTERVAL_SECONDS)
    uint32 internal _eraGenesisTimestamp;

    /// @notice Duration of each era in seconds
    uint32 internal _eraDuration;

    /// @notice Mapping of era index to whether it has been processed
    mapping(uint32 eraIndex => bool processed) internal _processedEras;

    /// @notice Array of strategies for reward distribution
    IStrategy[] internal _rewardStrategies;

    /// @notice Array of multipliers for each strategy (parallel to _rewardStrategies)
    uint96[] internal _rewardMultipliers;

    // ============ Storage Gap ============

    /// @dev Gap for future storage variables
    uint256[44] private __gap;

    // ============ View Functions ============

    /// @inheritdoc IRewardsSubmitter
    function isEraProcessed(
        uint32 eraIndex
    ) external view override returns (bool) {
        return _processedEras[eraIndex];
    }

    /// @inheritdoc IRewardsSubmitter
    function rewardsSnowbridgeAgent() external view override returns (address) {
        return _rewardsSnowbridgeAgent;
    }

    /// @inheritdoc IRewardsSubmitter
    function rewardToken() external view override returns (address) {
        return _rewardToken;
    }

    /// @inheritdoc IRewardsSubmitter
    function eraGenesisTimestamp() external view override returns (uint32) {
        return _eraGenesisTimestamp;
    }

    /// @inheritdoc IRewardsSubmitter
    function eraDuration() external view override returns (uint32) {
        return _eraDuration;
    }

    /// @inheritdoc IRewardsSubmitter
    function getStrategyMultipliers()
        external
        view
        override
        returns (IStrategy[] memory strategies, uint96[] memory multipliers)
    {
        return (_rewardStrategies, _rewardMultipliers);
    }
}

