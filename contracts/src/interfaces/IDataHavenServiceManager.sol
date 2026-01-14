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
    /// @notice Thrown when an invalid (zero) solochain address is provided
    error InvalidSolochainAddress();
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
