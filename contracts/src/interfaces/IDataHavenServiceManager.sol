// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

// EigenLayer imports
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";

/**
 * @title DataHaven Service Manager Errors Interface
 * @notice Contains all error definitions used by the DataHaven Service Manager
 */
interface IDataHavenServiceManagerErrors {
    /// @notice Thrown when an operator attempts to register with an incorrect AVS address
    error IncorrectAVSAddress();
    /// @notice Thrown when an operator attempts to register to multiple operator sets at once
    error CantRegisterToMultipleOperatorSets();
    /// @notice Thrown when an operator attempts to deregister from multiple operator sets at once
    error CantDeregisterFromMultipleOperatorSets();
    /// @notice Thrown when an invalid operator set ID is provided
    error InvalidOperatorSetId();
    /// @notice Thrown when an operator not in the appropriate allowlist attempts to register
    error OperatorNotInAllowlist();
    /// @notice Thrown when the caller is not a Validator in the Validators operator set
    error CallerIsNotValidator();
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
 * @title DataHaven Service Manager Events Interface
 * @notice Contains all event definitions emitted by the DataHaven Service Manager
 */
interface IDataHavenServiceManagerEvents {
    /// @notice Emitted when an operator successfully registers to an operator set
    /// @param operator Address of the operator that registered
    /// @param operatorSetId ID of the operator set the operator registered to
    event OperatorRegistered(address indexed operator, uint32 indexed operatorSetId);

    /// @notice Emitted when an operator deregisters from an operator set
    /// @param operator Address of the operator that deregistered
    /// @param operatorSetId ID of the operator set the operator deregistered from
    event OperatorDeregistered(address indexed operator, uint32 indexed operatorSetId);

    /// @notice Emitted when a validator is added to the allowlist
    /// @param validator Address of the validator added to the allowlist
    event ValidatorAddedToAllowlist(address indexed validator);

    /// @notice Emitted when a validator is removed from the allowlist
    /// @param validator Address of the validator removed from the allowlist
    event ValidatorRemovedFromAllowlist(address indexed validator);

    /// @notice Emitted when the Snowbridge Gateway address is set
    /// @param snowbridgeGateway Address of the Snowbridge Gateway
    event SnowbridgeGatewaySet(address indexed snowbridgeGateway);

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
 * @title DataHaven Service Manager Interface
 * @notice Defines the interface for the DataHaven Service Manager, which manages validators
 *         in the DataHaven network
 */
interface IDataHavenServiceManager is
    IDataHavenServiceManagerErrors,
    IDataHavenServiceManagerEvents
{
    /// @notice Checks if a validator address is in the allowlist
    /// @param validator Address to check
    /// @return True if the validator is in the allowlist, false otherwise
    function validatorsAllowlist(
        address validator
    ) external view returns (bool);

    /// @notice Returns the Snowbridge Gateway address
    /// @return The Snowbridge gateway address
    function snowbridgeGateway() external view returns (address);

    /**
     * @notice Converts a validator address to the corresponding Solochain address
     * @param validatorAddress The address of the validator to convert
     * @return The corresponding Solochain address
     */
    function validatorEthAddressToSolochainAddress(
        address validatorAddress
    ) external view returns (address);

    /**
     * @notice Initializes the DataHaven Service Manager
     * @param initialOwner Address of the initial owner
     * @param rewardsInitiator Address authorized to initiate rewards
     * @param validatorsStrategies Array of strategies supported by validators
     */
    function initialise(
        address initialOwner,
        address rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        address _snowbridgeGatewayAddress
    ) external;

    /**
     * @notice Sends a new validator set to the Snowbridge Gateway
     * @dev The new validator set is made up of the Validators currently
     *      registered in the DataHaven Service Manager as operators of
     *      the Validators operator set (operatorSetId = VALIDATORS_SET_ID)
     * @dev Only callable by the owner
     * @param executionFee The execution fee for the Snowbridge message
     * @param relayerFee The relayer fee for the Snowbridge message
     */
    function sendNewValidatorSet(
        uint128 executionFee,
        uint128 relayerFee
    ) external payable;

    /**
     * @notice Builds a new validator set message to be sent to the Snowbridge Gateway
     * @return The encoded message bytes to be sent to the Snowbridge Gateway
     */
    function buildNewValidatorSetMessage() external view returns (bytes memory);

    /**
     * @notice Updates the Solochain address for a Validator
     * @param solochainAddress The new Solochain address for the Validator
     * @dev The caller must be the registered operator address for the Validator, in EigenLayer,
     *      in the Validators operator set (operatorSetId = VALIDATORS_SET_ID)
     */
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external;

    /**
     * @notice Sets the Snowbridge Gateway address
     * @param _snowbridgeGateway The address of the Snowbridge Gateway
     */
    function setSnowbridgeGateway(
        address _snowbridgeGateway
    ) external;

    /**
     * @notice Adds a validator to the allowlist
     * @param validator Address of the validator to add
     */
    function addValidatorToAllowlist(
        address validator
    ) external;

    /**
     * @notice Removes a validator from the allowlist
     * @param validator Address of the validator to remove
     */
    function removeValidatorFromAllowlist(
        address validator
    ) external;

    /**
     * @notice Returns all strategies supported by the DataHaven Validators operator set
     * @return An array of strategy contracts that validators can delegate to
     */
    function validatorsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for DataHaven Validators
     * @param _strategies Array of strategy contracts to remove from validators operator set
     */
    function removeStrategiesFromValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for DataHaven Validators
     * @param _strategies Array of strategy contracts to add to validators operator set
     */
    function addStrategiesToValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    // ============ Rewards Submitter Functions ============

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
