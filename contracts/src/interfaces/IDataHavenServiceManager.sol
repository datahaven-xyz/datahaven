// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

// EigenLayer imports
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
    /// @notice Thrown when a function is called by an address that is not the RewardsInitiator
    error OnlyRewardsInitiator();
    /// @notice Thrown when a function is called by an address that is not the AllocationManager
    error OnlyAllocationManager();
    /// @notice Thrown when a zero address is provided where a non-zero address is required
    error ZeroAddress();
    /// @notice Thrown when the solochain address data length is not 20 bytes
    error InvalidSolochainAddressLength();
    /// @notice Thrown when the caller is not the authorized validator set submitter
    error OnlyValidatorSetSubmitter();
    /// @notice Thrown when trying to submit a validator set message with zero validators
    error EmptyValidatorSet();

    /// @notice Thrown when a Solochain address has not been mapped to an EigenLayer operator
    error UnknownSolochainAddress();

    /// @notice Thrown when a Solochain address is already assigned to a different operator
    error SolochainAddressAlreadyAssigned();

    /// @notice Thrown when a strategy is not registered in the operator set
    error StrategyNotInOperatorSet();
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

    /// @notice Emitted when rewards are successfully submitted to EigenLayer
    /// @param totalAmount The total amount of rewards distributed
    /// @param operatorCount The number of operators that received rewards
    event RewardsSubmitted(uint256 totalAmount, uint256 operatorCount);

    /// @notice Emitted when the rewards initiator address is updated
    /// @param oldInitiator The previous rewards initiator address
    /// @param newInitiator The new rewards initiator address
    event RewardsInitiatorSet(address indexed oldInitiator, address indexed newInitiator);

    /// @notice Emitted when a validator updates their solochain address
    /// @param validator Address of the validator
    /// @param solochainAddress The new solochain address
    event SolochainAddressUpdated(address indexed validator, address indexed solochainAddress);

    /// @notice Emitted when a batch of slashing request is being successfully slashed
    event SlashingComplete();

    /// @notice Emitted when strategy multipliers are set or updated
    /// @param strategyMultipliers Array of strategy-multiplier pairs that were set
    event StrategiesAndMultipliersSet(IRewardsCoordinatorTypes
                .StrategyAndMultiplier[] strategyMultipliers);
    /// @notice Emitted when the validator set submitter address is updated
    /// @param oldSubmitter The previous validator set submitter address
    /// @param newSubmitter The new validator set submitter address
    event ValidatorSetSubmitterUpdated(address indexed oldSubmitter, address indexed newSubmitter);

    /// @notice Emitted when a validator set message is submitted for a target era
    /// @param targetEra The target era for the validator set
    /// @param payloadHash The keccak256 hash of the encoded message payload
    /// @param submitter The address that submitted the validator set message
    event ValidatorSetMessageSubmitted(
        uint64 indexed targetEra, bytes32 payloadHash, address indexed submitter
    );
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
    /// @notice Slashing request sent from the datahaven slashing pallet via snowbridge to slash operators in the validators set in EL.
    struct SlashingRequest {
        address operator;
        IStrategy[] strategies;
        uint256[] wadsToSlash;
        string description;
    }

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

    /// @notice Returns the address authorized to submit validator set messages
    /// @return The validator set submitter address
    function validatorSetSubmitter() external view returns (address);

    /**
     * @notice Sets the address authorized to submit validator set messages
     * @param newSubmitter The new validator set submitter address
     * @dev Only callable by the owner
     */
    function setValidatorSetSubmitter(
        address newSubmitter
    ) external;

    /**
     * @notice Converts a Solochain validator address to the corresponding EigenLayer operator address
     * @param solochainAddress The Solochain validator address to convert
     * @return The corresponding EigenLayer operator address
     */
    function validatorSolochainAddressToEthAddress(
        address solochainAddress
    ) external view returns (address);

    /**
     * @notice Initializes the DataHaven Service Manager
     * @param initialOwner Address of the initial owner
     * @param rewardsInitiator Address authorized to initiate rewards
     * @param validatorsStrategiesAndMultipliers Array of strategy-multiplier pairs for the validators
     *        operator set. Each multiplier must be non-zero.
     * @param _snowbridgeGatewayAddress Address of the Snowbridge Gateway
     * @param _validatorSetSubmitter Address authorized to submit validator set messages
     */
    function initialize(
        address initialOwner,
        address rewardsInitiator,
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory validatorsStrategiesAndMultipliers,
        address _snowbridgeGatewayAddress,
        address _validatorSetSubmitter
    ) external;

    /**
     * @notice Sends a new validator set for a target era to the Snowbridge Gateway
     * @dev The new validator set is made up of the Validators currently
     *      registered in the DataHaven Service Manager as operators of
     *      the Validators operator set (operatorSetId = VALIDATORS_SET_ID)
     * @dev Only callable by the validator set submitter
     * @param targetEra The target era for the validator set submission
     * @param executionFee The execution fee for the Snowbridge message
     * @param relayerFee The relayer fee for the Snowbridge message
     */
    function sendNewValidatorSetForEra(
        uint64 targetEra,
        uint128 executionFee,
        uint128 relayerFee
    ) external payable;

    /**
     * @notice Builds a SCALE-encoded message containing the top validators by weighted stake
     * @dev Selects up to MAX_ACTIVE_VALIDATORS from registered operators. Each operator's
     *      weighted stake is computed as: sum(allocatedStake[j] * multiplier[j])
     *      across all strategies. Operators without a solochain address mapping or with zero
     *      weighted stake are excluded. Ties are broken by lower operator address.
     * @param targetEra The target era to encode in the message
     * @return The SCALE-encoded message bytes to be sent to the Snowbridge Gateway
     */
    function buildNewValidatorSetMessageForEra(
        uint64 targetEra
    ) external view returns (bytes memory);

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
     * @dev Each strategy's multiplier determines its weight in the validator selection
     *      formula: weightedStake = sum(allocatedStake[j] * multiplier[j])
     * @param _strategyMultipliers Array of strategy-multiplier pairs to add
     */
    function addStrategiesToValidatorsSupportedStrategies(
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] calldata _strategyMultipliers
    ) external;

    /**
     * @notice Returns the maximum number of active validators in the set
     * @return The maximum active validators constant
     */
    function MAX_ACTIVE_VALIDATORS() external pure returns (uint32);

    /**
     * @notice Returns the multiplier for a given strategy
     * @dev The multiplier determines how much an operator's allocated stake in this strategy
     *      contributes to their weighted stake during validator set selection.
     * @param strategy The strategy to look up
     * @return The multiplier weight
     */
    function strategiesAndMultipliers(
        IStrategy strategy
    ) external view returns (uint96);

    /**
     * @notice Updates multipliers for strategies already in the operator set
     * @dev Does not add or remove strategies from EigenLayer; only updates multiplier weights
     *      used in the validator selection weighted stake formula
     * @param _strategyMultipliers Array of strategy-multiplier pairs to update
     */
    function setStrategiesAndMultipliers(
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] calldata _strategyMultipliers
    ) external;

    /**
     * @notice Returns all strategies with their multipliers
     * @return Array of StrategyAndMultiplier structs with strategy addresses and multiplier weights
     */
    function getStrategiesAndMultipliers()
        external
        view
        returns (IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory);

    // ============ Rewards Submitter Functions ============

    /**
     * @notice Submit rewards to EigenLayer
     * @param submission The operator-directed rewards submission containing all reward parameters
     * @dev Only callable by the authorized Snowbridge Agent
     * @dev Strategies must be sorted in ascending order by address
     * @dev Operators must be sorted in ascending order by address
     * @dev Token must be pre-approved or held by the ServiceManager
     */
    function submitRewards(
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission calldata submission
    ) external;

    /**
     * @notice Set the rewards initiator address authorized to submit rewards
     * @param initiator The address of the rewards initiator (Snowbridge Agent)
     * @dev Only callable by the owner
     */
    function setRewardsInitiator(
        address initiator
    ) external;

    // ============ AVS Management Functions ============

    /**
     * @notice Updates the metadata URI for the AVS
     * @param _metadataURI is the metadata URI for the AVS
     * @dev Only callable by the owner
     */
    function updateAVSMetadataURI(
        string memory _metadataURI
    ) external;

    /**
     * @notice Force-deregisters an operator from specified operator sets
     * @param operator The address of the operator to deregister
     * @param operatorSetIds The IDs of the operator sets to deregister from
     * @dev Only callable by the owner. Use for removing misbehaving operators.
     */
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] calldata operatorSetIds
    ) external;
}
