// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// EigenLayer imports
import {
    IAllocationManager,
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {
    IPermissionController
} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";
import {
    IRewardsCoordinator
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

// Snowbridge imports
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";

// DataHaven imports
import {DataHavenSnowbridgeMessages} from "./libraries/DataHavenSnowbridgeMessages.sol";
import {IDataHavenServiceManager} from "./interfaces/IDataHavenServiceManager.sol";
import {ServiceManagerBase} from "./middleware/ServiceManagerBase.sol";

/**
 * @title DataHaven ServiceManager contract
 * @notice Manages validators, backup storage providers (BSPs), and main storage providers (MSPs)
 * in the DataHaven network
 */
contract DataHavenServiceManager is ServiceManagerBase, IDataHavenServiceManager {
    /// @notice The metadata for the DataHaven AVS.
    string public constant DATAHAVEN_AVS_METADATA = "https://datahaven.network/";

    /// @notice The EigenLayer operator set ID for the Validators securing the DataHaven network.
    uint32 public constant VALIDATORS_SET_ID = 0;
    /// @notice The EigenLayer operator set ID for the Backup Storage Providers participating in the DataHaven network.
    uint32 public constant BSPS_SET_ID = 1;
    /// @notice The EigenLayer operator set ID for the Main Storage Providers participating in the DataHaven network.
    uint32 public constant MSPS_SET_ID = 2;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;
    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public bspsAllowlist;
    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public mspsAllowlist;

    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    ) ServiceManagerBase(__rewardsCoordinator, __permissionController, __allocationManager) {}

    /// @notice Modifier to ensure the caller is a registered Validator
    modifier onlyValidator() {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        require(
            _allocationManager.isMemberOfOperatorSet(msg.sender, operatorSet),
            CallerIsNotValidator()
        );
        _;
    }

    /// @inheritdoc IDataHavenServiceManager
    function initialise(
        address initialOwner,
        address rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies,
        address _snowbridgeGatewayAddress
    ) public virtual initializer {
        __ServiceManagerBase_init(initialOwner, rewardsInitiator);

        // Register the DataHaven service in the AllocationManager.
        _allocationManager.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator sets for the DataHaven service.
        _createDataHavenOperatorSets(validatorsStrategies, bspsStrategies, mspsStrategies);

        // Set the Snowbridge Gateway address.
        // This is the contract to which messages are sent, to be relayed to the Solochain network.
        _snowbridgeGateway = IGatewayV2(_snowbridgeGatewayAddress);
    }

    /// @inheritdoc IDataHavenServiceManager
    function sendNewValidatorSet(
        uint128 executionFee,
        uint128 relayerFee
    ) external payable onlyOwner {
        // Send the new validator set message to the Snowbridge Gateway
        bytes memory message = buildNewValidatorSetMessage();
        _snowbridgeGateway.v2_sendMessage{
            value: msg.value
        }(
            message,
            new bytes[](0), // No assets to send
            bytes(""), // No claimer
            executionFee,
            relayerFee
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function buildNewValidatorSetMessage() public view returns (bytes memory) {
        // Get the current validator set
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        address[] memory currentValidatorSet = _allocationManager.getMembers(operatorSet);

        // Build the new validator set message
        address[] memory newValidatorSet = new address[](currentValidatorSet.length);
        for (uint256 i = 0; i < currentValidatorSet.length; i++) {
            newValidatorSet[i] = validatorEthAddressToSolochainAddress[currentValidatorSet[i]];
        }
        DataHavenSnowbridgeMessages.NewValidatorSetPayload memory newValidatorSetPayload =
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: newValidatorSet});
        DataHavenSnowbridgeMessages.NewValidatorSet memory newValidatorSetMessage =
            DataHavenSnowbridgeMessages.NewValidatorSet({payload: newValidatorSetPayload});

        // Return the encoded message
        return DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessage(newValidatorSetMessage);
    }

    /// @inheritdoc IDataHavenServiceManager
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external onlyValidator {
        // Update the Solochain address for the Validator
        validatorEthAddressToSolochainAddress[msg.sender] = solochainAddress;
    }

    /// @inheritdoc IDataHavenServiceManager
    function setSnowbridgeGateway(
        address _newSnowbridgeGateway
    ) external onlyOwner {
        _snowbridgeGateway = IGatewayV2(_newSnowbridgeGateway);
        emit SnowbridgeGatewaySet(_newSnowbridgeGateway);
    }

    /// @inheritdoc IAVSRegistrar
    function registerOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds,
        bytes calldata data
    ) external override {
        if (avs != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantRegisterToMultipleOperatorSets();
        }

        // Case: Validator
        if (operatorSetIds[0] == VALIDATORS_SET_ID) {
            if (!validatorsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }

            // In the case of the Validators operator set, expect the data to have the Solochain address of the operator.
            // Require validators to provide 20 bytes addresses.
            require(data.length == 20, "Invalid solochain address length");
            validatorEthAddressToSolochainAddress[operator] = address(bytes20(data));
        }
        // Case: BSP
        else if (operatorSetIds[0] == BSPS_SET_ID) {
            if (!bspsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }
        }
        // Case: MSP
        else if (operatorSetIds[0] == MSPS_SET_ID) {
            if (!mspsAllowlist[operator]) {
                revert OperatorNotInAllowlist();
            }
        }
        // Case: Invalid operator set ID
        else {
            revert InvalidOperatorSetId();
        }

        emit OperatorRegistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds
    ) external override {
        if (avs != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantDeregisterFromMultipleOperatorSets();
        }

        if (
            operatorSetIds[0] != VALIDATORS_SET_ID && operatorSetIds[0] != BSPS_SET_ID
                && operatorSetIds[0] != MSPS_SET_ID
        ) {
            revert InvalidOperatorSetId();
        }

        if (operatorSetIds[0] == VALIDATORS_SET_ID) {
            // Remove validator from the addresses mapping
            delete validatorEthAddressToSolochainAddress[operator];
        }

        emit OperatorDeregistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addValidatorToAllowlist(
        address validator
    ) external onlyOwner {
        validatorsAllowlist[validator] = true;
        emit ValidatorAddedToAllowlist(validator);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addBspToAllowlist(
        address bsp
    ) external onlyOwner {
        bspsAllowlist[bsp] = true;
        emit BspAddedToAllowlist(bsp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addMspToAllowlist(
        address msp
    ) external onlyOwner {
        mspsAllowlist[msp] = true;
        emit MspAddedToAllowlist(msp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeValidatorFromAllowlist(
        address validator
    ) external onlyOwner {
        validatorsAllowlist[validator] = false;
        emit ValidatorRemovedFromAllowlist(validator);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeBspFromAllowlist(
        address bsp
    ) external onlyOwner {
        bspsAllowlist[bsp] = false;
        emit BspRemovedFromAllowlist(bsp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeMspFromAllowlist(
        address msp
    ) external onlyOwner {
        mspsAllowlist[msp] = false;
        emit MspRemovedFromAllowlist(msp);
    }

    /// @inheritdoc IDataHavenServiceManager
    function validatorsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(
            address(this), VALIDATORS_SET_ID, _strategies
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), VALIDATORS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function bspsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: BSPS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(address(this), BSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToBspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), BSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function mspsSupportedStrategies() external view returns (IStrategy[] memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: MSPS_SET_ID});
        return _allocationManager.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(address(this), MSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToMspsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(address(this), MSPS_SET_ID, _strategies);
    }

    /// @inheritdoc IDataHavenServiceManager
    function snowbridgeGateway() external view returns (address) {
        return address(_snowbridgeGateway);
    }

    /**
     * @notice Creates the initial operator sets for DataHaven in the AllocationManager.
     * @dev This function should be called during initialisation to set up the required operator sets.
     */
    function _createDataHavenOperatorSets(
        IStrategy[] memory validatorsStrategies,
        IStrategy[] memory bspsStrategies,
        IStrategy[] memory mspsStrategies
    ) internal {
        IAllocationManagerTypes.CreateSetParams[] memory operatorSets =
            new IAllocationManagerTypes.CreateSetParams[](3);
        operatorSets[0] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: VALIDATORS_SET_ID, strategies: validatorsStrategies
        });
        operatorSets[1] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: BSPS_SET_ID, strategies: bspsStrategies
        });
        operatorSets[2] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: MSPS_SET_ID, strategies: mspsStrategies
        });
        _allocationManager.createOperatorSets(address(this), operatorSets);
    }
}
