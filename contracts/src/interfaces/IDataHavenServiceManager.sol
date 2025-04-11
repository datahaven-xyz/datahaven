// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// EigenLayer imports
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

// Snowbridge imports
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";

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

    /// @notice Emitted when a Backup Storage Provider is added to the allowlist
    /// @param bsp Address of the BSP added to the allowlist
    event BspAddedToAllowlist(address indexed bsp);

    /// @notice Emitted when a Main Storage Provider is added to the allowlist
    /// @param msp Address of the MSP added to the allowlist
    event MspAddedToAllowlist(address indexed msp);

    /// @notice Emitted when a validator is removed from the allowlist
    /// @param validator Address of the validator removed from the allowlist
    event ValidatorRemovedFromAllowlist(address indexed validator);

    /// @notice Emitted when a Backup Storage Provider is removed from the allowlist
    /// @param bsp Address of the BSP removed from the allowlist
    event BspRemovedFromAllowlist(address indexed bsp);

    /// @notice Emitted when a Main Storage Provider is removed from the allowlist
    /// @param msp Address of the MSP removed from the allowlist
    event MspRemovedFromAllowlist(address indexed msp);

    /// @notice Emitted when the Snowbridge Gateway address is set
    /// @param snowbridgeGateway Address of the Snowbridge Gateway
    event SnowbridgeGatewaySet(address indexed snowbridgeGateway);
}

/**
 * @title DataHaven Service Manager Interface
 * @notice Defines the interface for the DataHaven Service Manager, which manages validators,
 *         backup storage providers (BSPs), and main storage providers (MSPs) in the DataHaven network
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

    /// @notice Checks if a BSP address is in the allowlist
    /// @param bsp Address to check
    /// @return True if the BSP is in the allowlist, false otherwise
    function bspsAllowlist(
        address bsp
    ) external view returns (bool);

    /// @notice Checks if an MSP address is in the allowlist
    /// @param msp Address to check
    /// @return True if the MSP is in the allowlist, false otherwise
    function mspsAllowlist(
        address msp
    ) external view returns (bool);

    /// @notice Returns the Snowbridge Gateway address
    /// @return The Snowbridge gateway address
    function snowbridgeGateway() external view returns (address);

    /**
     * @notice Converts a validator address to the corresponding Solochain address
     * @param validatorAddress The address of the validator to convert
     * @return The corresponding Solochain address
     */
    function validatorAddressToSolochainAddress(
        address validatorAddress
    ) external view returns (bytes32);

    /**
     * @notice Initializes the DataHaven Service Manager
     * @param initialOwner Address of the initial owner
     * @param rewardsInitiator Address authorized to initiate rewards
     * @param validatorsStrategies Array of strategies supported by validators
     * @param bspsStrategies Array of strategies supported by BSPs
     * @param mspsStrategies Array of strategies supported by MSPs
     */
    function initialize(
        address initialOwner,
        address rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies,
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
    function sendNewValidatorSet(uint128 executionFee, uint128 relayerFee) external payable;

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
        bytes32 solochainAddress
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
     * @notice Adds a BSP to the allowlist
     * @param bsp Address of the BSP to add
     */
    function addBspToAllowlist(
        address bsp
    ) external;

    /**
     * @notice Adds an MSP to the allowlist
     * @param msp Address of the MSP to add
     */
    function addMspToAllowlist(
        address msp
    ) external;

    /**
     * @notice Removes a validator from the allowlist
     * @param validator Address of the validator to remove
     */
    function removeValidatorFromAllowlist(
        address validator
    ) external;

    /**
     * @notice Removes a BSP from the allowlist
     * @param bsp Address of the BSP to remove
     */
    function removeBspFromAllowlist(
        address bsp
    ) external;

    /**
     * @notice Removes an MSP from the allowlist
     * @param msp Address of the MSP to remove
     */
    function removeMspFromAllowlist(
        address msp
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

    /**
     * @notice Returns all strategies supported by the Backup Storage Providers (BSPs) operator set
     * @return An array of strategy contracts that BSPs can delegate to
     */
    function bspsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for Backup Storage Providers
     * @param _strategies Array of strategy contracts to remove from BSPs operator set
     */
    function removeStrategiesFromBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for Backup Storage Providers
     * @param _strategies Array of strategy contracts to add to BSPs operator set
     */
    function addStrategiesToBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Returns all strategies supported by the Main Storage Providers (MSPs) operator set
     * @return An array of strategy contracts that MSPs can delegate to
     */
    function mspsSupportedStrategies() external view returns (IStrategy[] memory);

    /**
     * @notice Removes strategies from the list of supported strategies for Main Storage Providers
     * @param _strategies Array of strategy contracts to remove from MSPs operator set
     */
    function removeStrategiesFromMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;

    /**
     * @notice Adds strategies to the list of supported strategies for Main Storage Providers
     * @param _strategies Array of strategy contracts to add to MSPs operator set
     */
    function addStrategiesToMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external;
}
