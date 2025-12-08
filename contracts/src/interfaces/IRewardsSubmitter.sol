// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";

/**
 * @title IRewardsSubmitter Errors Interface
 * @notice Contains all error definitions used by the RewardsSubmitter
 */
interface IRewardsSubmitterErrors {
    /// @notice Thrown when caller is not the authorized Snowbridge Agent
    error OnlyRewardsSnowbridgeAgent();

    /// @notice Thrown when era has already been processed
    error EraAlreadyProcessed(uint32 eraIndex);

    /// @notice Thrown when reward token is not set
    error RewardTokenNotSet();

    /// @notice Thrown when no strategies are configured
    error NoStrategiesConfigured();

    /// @notice Thrown when operators array is empty
    error EmptyOperatorsArray();

    /// @notice Thrown when era parameters are not configured
    error EraParametersNotConfigured();

    /// @notice Thrown when genesis timestamp is invalid (not aligned to CALCULATION_INTERVAL_SECONDS)
    error InvalidGenesisTimestamp();

    /// @notice Thrown when era duration is invalid
    error InvalidEraDuration();

    /// @notice Thrown when strategies and multipliers arrays have different lengths
    error StrategiesMultipliersLengthMismatch();
}

/**
 * @title IRewardsSubmitter Events Interface
 * @notice Contains all event definitions emitted by the RewardsSubmitter
 */
interface IRewardsSubmitterEvents {
    /// @notice Emitted when era rewards are successfully submitted to EigenLayer
    /// @param eraIndex The era index that was processed
    /// @param totalAmount The total amount of rewards distributed
    /// @param operatorCount The number of operators that received rewards
    event EraRewardsSubmitted(uint32 indexed eraIndex, uint256 totalAmount, uint256 operatorCount);

    /// @notice Emitted when the Snowbridge Agent address is updated
    /// @param oldAgent The previous Snowbridge Agent address
    /// @param newAgent The new Snowbridge Agent address
    event RewardsSnowbridgeAgentSet(address indexed oldAgent, address indexed newAgent);

    /// @notice Emitted when the reward token is updated
    /// @param oldToken The previous reward token address
    /// @param newToken The new reward token address
    event RewardTokenSet(address indexed oldToken, address indexed newToken);

    /// @notice Emitted when era parameters are updated
    /// @param genesisTimestamp The genesis timestamp for era calculations
    /// @param eraDuration The duration of each era in seconds
    event EraParametersSet(uint32 genesisTimestamp, uint32 eraDuration);

    /// @notice Emitted when strategy multipliers are updated
    /// @param strategies The strategies that were configured
    /// @param multipliers The multipliers for each strategy
    event StrategyMultipliersSet(IStrategy[] strategies, uint96[] multipliers);
}

/**
 * @title IRewardsSubmitter Interface
 * @notice Interface for submitting operator rewards to EigenLayer RewardsCoordinator
 * @dev This interface is implemented by the DataHavenServiceManager to receive rewards
 *      from DataHaven via Snowbridge and submit them to EigenLayer for distribution
 */
interface IRewardsSubmitter is IRewardsSubmitterErrors, IRewardsSubmitterEvents {
    /**
     * @notice Submit rewards for an era to EigenLayer
     * @param eraIndex The era index being rewarded
     * @param operatorRewards Array of (operator, amount) pairs sorted by operator address
     * @dev Only callable by the authorized Snowbridge Agent
     * @dev Operators must be sorted in ascending order by address
     * @dev Each era can only be processed once (replay protection)
     */
    function submitRewards(
        uint32 eraIndex,
        IRewardsCoordinatorTypes.OperatorReward[] calldata operatorRewards
    ) external;

    /**
     * @notice Set the Snowbridge Agent address authorized to submit rewards
     * @param agent The address of the Snowbridge Agent
     * @dev Only callable by the owner
     */
    function setRewardsSnowbridgeAgent(
        address agent
    ) external;

    /**
     * @notice Set the reward token address
     * @param token The address of the reward token (e.g., wHAVE)
     * @dev Only callable by the owner
     */
    function setRewardToken(
        address token
    ) external;

    /**
     * @notice Set era parameters for timestamp calculation
     * @param genesisTimestamp The timestamp of era 0 (must align to CALCULATION_INTERVAL_SECONDS)
     * @param eraDuration The duration of each era in seconds
     * @dev Only callable by the owner
     * @dev genesisTimestamp must be a multiple of CALCULATION_INTERVAL_SECONDS (86400)
     */
    function setEraParameters(
        uint32 genesisTimestamp,
        uint32 eraDuration
    ) external;

    /**
     * @notice Set strategy multipliers for reward distribution
     * @param strategies Array of strategies (must be sorted in ascending order by address)
     * @param multipliers Array of multipliers for each strategy (1e18 = 1x weight)
     * @dev Only callable by the owner
     * @dev Strategies must be sorted in ascending order of addresses
     */
    function setStrategyMultipliers(
        IStrategy[] calldata strategies,
        uint96[] calldata multipliers
    ) external;

    /**
     * @notice Check if an era has been processed
     * @param eraIndex The era index to check
     * @return True if the era has been processed
     */
    function isEraProcessed(
        uint32 eraIndex
    ) external view returns (bool);

    /**
     * @notice Get the Snowbridge Agent address
     * @return The address of the authorized Snowbridge Agent
     */
    function rewardsSnowbridgeAgent() external view returns (address);

    /**
     * @notice Get the reward token address
     * @return The address of the reward token
     */
    function rewardToken() external view returns (address);

    /**
     * @notice Get the genesis timestamp for era calculations
     * @return The genesis timestamp
     */
    function eraGenesisTimestamp() external view returns (uint32);

    /**
     * @notice Get the era duration in seconds
     * @return The era duration
     */
    function eraDuration() external view returns (uint32);

    /**
     * @notice Get the configured strategy multipliers
     * @return strategies Array of configured strategies
     * @return multipliers Array of multipliers for each strategy
     */
    function getStrategyMultipliers()
        external
        view
        returns (IStrategy[] memory strategies, uint96[] memory multipliers);
}

