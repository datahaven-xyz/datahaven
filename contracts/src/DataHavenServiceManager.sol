// SPDX-License-Identifier: GPL-3.0
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
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Snowbridge imports
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";

// DataHaven imports
import {DataHavenSnowbridgeMessages} from "./libraries/DataHavenSnowbridgeMessages.sol";
import {IDataHavenServiceManager} from "./interfaces/IDataHavenServiceManager.sol";
import {ServiceManagerBase} from "./middleware/ServiceManagerBase.sol";
import "forge-std/Test.sol";

/**
 * @title DataHaven ServiceManager contract
 * @notice Manages validators in the DataHaven network and submits rewards to EigenLayer
 */
contract DataHavenServiceManager is ServiceManagerBase, IDataHavenServiceManager {
    using SafeERC20 for IERC20;
    /// @notice The metadata for the DataHaven AVS.
    string public constant DATAHAVEN_AVS_METADATA = "https://datahaven.network/";

    /// @notice The EigenLayer operator set ID for the Validators securing the DataHaven network.
    uint32 public constant VALIDATORS_SET_ID = 0;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;

    event ValidatorsSlashedTest(address);

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
        address _snowbridgeGatewayAddress
    ) public virtual initializer {
        __ServiceManagerBase_init(initialOwner, rewardsInitiator);

        // Register the DataHaven service in the AllocationManager.
        _allocationManager.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator set for the DataHaven service.
        _createDataHavenOperatorSets(validatorsStrategies);

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
        _snowbridgeGateway.v2_sendMessage{value: msg.value}(
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

        // Only validators are supported
        if (operatorSetIds[0] != VALIDATORS_SET_ID) {
            revert InvalidOperatorSetId();
        }

        if (!validatorsAllowlist[operator]) {
            revert OperatorNotInAllowlist();
        }

        // In the case of the Validators operator set, expect the data to have the Solochain address of the operator.
        // Require validators to provide 20 bytes addresses.
        require(data.length == 20, "Invalid solochain address length");
        validatorEthAddressToSolochainAddress[operator] = address(bytes20(data));

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

        if (operatorSetIds[0] != VALIDATORS_SET_ID) {
            revert InvalidOperatorSetId();
        }

        // Remove validator from the addresses mapping
        delete validatorEthAddressToSolochainAddress[operator];

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
    function removeValidatorFromAllowlist(
        address validator
    ) external onlyOwner {
        validatorsAllowlist[validator] = false;
        emit ValidatorRemovedFromAllowlist(validator);
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
    function snowbridgeGateway() external view returns (address) {
        return address(_snowbridgeGateway);
    }

    // ============ Rewards Submitter Functions ============

    /// @inheritdoc IDataHavenServiceManager
    function submitRewards(
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission calldata submission
    ) external override onlyRewardsInitiator {
        // Calculate total amount for event
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < submission.operatorRewards.length; i++) {
            totalAmount += submission.operatorRewards[i].amount;
        }

        // Approve RewardsCoordinator to spend tokens
        submission.token.safeIncreaseAllowance(address(_rewardsCoordinator), totalAmount);

        // Wrap in array for RewardsCoordinator
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] memory submissions =
            new IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[](1);
        submissions[0] = submission;

        // Submit to EigenLayer RewardsCoordinator
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        _rewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission(
            operatorSet, submissions
        );

        emit RewardsSubmitted(totalAmount, submission.operatorRewards.length);
    }

    /// @notice Sets the rewards initiator address (overrides deprecated base implementation)
    /// @param newRewardsInitiator The new rewards initiator address
    /// @dev Only callable by the owner
    function setRewardsInitiator(
        address newRewardsInitiator
    ) external override(IDataHavenServiceManager, ServiceManagerBase) onlyOwner {
        address oldInitiator = rewardsInitiator;
        _setRewardsInitiator(newRewardsInitiator);
        emit RewardsInitiatorSet(oldInitiator, newRewardsInitiator);
    }

    // ============ Internal Functions ============

    /**
     * @notice Creates the initial operator set for DataHaven in the AllocationManager.
     * @dev This function should be called during initialisation to set up the required operator set.
     */
    function _createDataHavenOperatorSets(
        IStrategy[] memory validatorsStrategies
    ) internal {
        IAllocationManagerTypes.CreateSetParams[] memory operatorSets =
            new IAllocationManagerTypes.CreateSetParams[](1);
        operatorSets[0] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: VALIDATORS_SET_ID, strategies: validatorsStrategies
        });
        _allocationManager.createOperatorSets(address(this), operatorSets);
    }

    function slashValidatorsOperator(address[] calldata operators) external {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        IStrategy[] memory strategies = _allocationManager.getStrategiesInOperatorSet(operatorSet);

        uint256 wadToSlash = 1e16;
        string memory description = "slashing validator";

        uint256[] memory wadsToSlash = new uint256[](strategies.length);        
        for(uint i=0; i<wadsToSlash.length; i++){
            wadsToSlash[i] = wadToSlash;
        }

        for(uint i=0; i<operators.length; i++){
            emit ValidatorsSlashedTest(operators[i]);
    
            IAllocationManagerTypes.SlashingParams memory slashingParams = IAllocationManagerTypes.SlashingParams({
                operator: operators[i],
                operatorSetId: VALIDATORS_SET_ID,
                strategies: strategies,
                wadsToSlash: wadsToSlash,
                description: description
            });

            _allocationManager.slashOperator(address(this), slashingParams);
        }
    }

}
