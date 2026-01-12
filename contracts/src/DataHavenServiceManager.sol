// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

// OpenZeppelin imports
import {OwnableUpgradeable} from "@openzeppelin-upgrades/contracts/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

// Snowbridge imports
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";

// DataHaven imports
import {DataHavenSnowbridgeMessages} from "./libraries/DataHavenSnowbridgeMessages.sol";
import {IDataHavenServiceManager} from "./interfaces/IDataHavenServiceManager.sol";

/**
 * @title DataHaven ServiceManager contract
 * @notice Manages validators in the DataHaven network and submits rewards to EigenLayer
 */
contract DataHavenServiceManager is OwnableUpgradeable, IAVSRegistrar, IDataHavenServiceManager {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice The metadata for the DataHaven AVS.
    string public constant DATAHAVEN_AVS_METADATA = "https://datahaven.network/";

    /// @notice The EigenLayer operator set ID for the Validators securing the DataHaven network.
    uint32 public constant VALIDATORS_SET_ID = 0;

    // ============ Immutables ============

    /// @notice The EigenLayer AllocationManager contract
    IAllocationManager internal immutable _allocationManager;

    /// @notice The EigenLayer RewardsCoordinator contract
    IRewardsCoordinator internal immutable _rewardsCoordinator;

    /// @notice The EigenLayer PermissionController contract
    IPermissionController internal immutable _permissionController;

    // ============ State Variables ============

    /// @notice The address authorized to initiate rewards submissions
    address public rewardsInitiator;

    /// @notice Storage gap for upgradeability
    uint256[49] private __GAP;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;

    /// @notice The Snowbridge Gateway contract
    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    // ============ Modifiers ============

    /// @notice Restricts function to the rewards initiator
    modifier onlyRewardsInitiator() {
        require(msg.sender == rewardsInitiator, OnlyRewardsInitiator());
        _;
    }

    /// @notice Restricts function to registered validators
    modifier onlyValidator() {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        require(
            _allocationManager.isMemberOfOperatorSet(msg.sender, operatorSet),
            CallerIsNotValidator()
        );
        _;
    }

    // ============ Constructor ============

    /// @notice Sets the immutable EigenLayer contract references
    /// @param __rewardsCoordinator The EigenLayer RewardsCoordinator contract
    /// @param __permissionController The EigenLayer PermissionController contract
    /// @param __allocationManager The EigenLayer AllocationManager contract
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    ) {
        _rewardsCoordinator = __rewardsCoordinator;
        _permissionController = __permissionController;
        _allocationManager = __allocationManager;
        _disableInitializers();
    }

    // ============ Initializer ============

    /// @inheritdoc IDataHavenServiceManager
    function initialise(
        address initialOwner,
        address _rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        address _snowbridgeGatewayAddress
    ) public virtual initializer {
        __Ownable_init();
        _transferOwnership(initialOwner);
        _setRewardsInitiator(_rewardsInitiator);

        // Register the DataHaven service in the AllocationManager.
        _allocationManager.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator set for the DataHaven service.
        _createDataHavenOperatorSets(validatorsStrategies);

        // Set the Snowbridge Gateway address.
        _snowbridgeGateway = IGatewayV2(_snowbridgeGatewayAddress);
    }

    // ============ Snowbridge Functions ============

    /// @inheritdoc IDataHavenServiceManager
    function sendNewValidatorSet(
        uint128 executionFee,
        uint128 relayerFee
    ) external payable onlyOwner {
        bytes memory message = buildNewValidatorSetMessage();
        _snowbridgeGateway.v2_sendMessage{value: msg.value}(
            message,
            new bytes[](0),
            bytes(""),
            executionFee,
            relayerFee
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function buildNewValidatorSetMessage() public view returns (bytes memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        address[] memory currentValidatorSet = _allocationManager.getMembers(operatorSet);

        address[] memory newValidatorSet = new address[](currentValidatorSet.length);
        for (uint256 i = 0; i < currentValidatorSet.length; i++) {
            newValidatorSet[i] = validatorEthAddressToSolochainAddress[currentValidatorSet[i]];
        }
        DataHavenSnowbridgeMessages.NewValidatorSetPayload memory newValidatorSetPayload =
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: newValidatorSet});
        DataHavenSnowbridgeMessages.NewValidatorSet memory newValidatorSetMessage =
            DataHavenSnowbridgeMessages.NewValidatorSet({payload: newValidatorSetPayload});

        return DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessage(newValidatorSetMessage);
    }

    /// @inheritdoc IDataHavenServiceManager
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external onlyValidator {
        validatorEthAddressToSolochainAddress[msg.sender] = solochainAddress;
    }

    /// @inheritdoc IDataHavenServiceManager
    function setSnowbridgeGateway(
        address _newSnowbridgeGateway
    ) external onlyOwner {
        _snowbridgeGateway = IGatewayV2(_newSnowbridgeGateway);
        emit SnowbridgeGatewaySet(_newSnowbridgeGateway);
    }

    /// @inheritdoc IDataHavenServiceManager
    function snowbridgeGateway() external view returns (address) {
        return address(_snowbridgeGateway);
    }

    // ============ IAVSRegistrar Implementation ============

    /// @inheritdoc IAVSRegistrar
    function registerOperator(
        address operator,
        address avsAddress,
        uint32[] calldata operatorSetIds,
        bytes calldata data
    ) external override {
        if (avsAddress != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantRegisterToMultipleOperatorSets();
        }

        if (operatorSetIds[0] != VALIDATORS_SET_ID) {
            revert InvalidOperatorSetId();
        }

        if (!validatorsAllowlist[operator]) {
            revert OperatorNotInAllowlist();
        }

        require(data.length == 20, "Invalid solochain address length");
        validatorEthAddressToSolochainAddress[operator] = address(bytes20(data));

        emit OperatorRegistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address operator,
        address avsAddress,
        uint32[] calldata operatorSetIds
    ) external override {
        if (avsAddress != address(this)) {
            revert IncorrectAVSAddress();
        }

        if (operatorSetIds.length != 1) {
            revert CantDeregisterFromMultipleOperatorSets();
        }

        if (operatorSetIds[0] != VALIDATORS_SET_ID) {
            revert InvalidOperatorSetId();
        }

        delete validatorEthAddressToSolochainAddress[operator];

        emit OperatorDeregistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IAVSRegistrar
    function supportsAVS(
        address avsAddress
    ) external view override returns (bool) {
        return avsAddress == address(this);
    }

    // ============ Validator Management ============

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

    // ============ Rewards Functions ============

    /// @inheritdoc IDataHavenServiceManager
    function submitRewards(
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission calldata submission
    ) external override onlyRewardsInitiator {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < submission.operatorRewards.length; i++) {
            totalAmount += submission.operatorRewards[i].amount;
        }

        submission.token.safeIncreaseAllowance(address(_rewardsCoordinator), totalAmount);

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] memory submissions =
            new IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[](1);
        submissions[0] = submission;

        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        _rewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission(
            operatorSet, submissions
        );

        emit RewardsSubmitted(totalAmount, submission.operatorRewards.length);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setRewardsInitiator(
        address newRewardsInitiator
    ) external override onlyOwner {
        address oldInitiator = rewardsInitiator;
        _setRewardsInitiator(newRewardsInitiator);
        emit RewardsInitiatorSet(oldInitiator, newRewardsInitiator);
    }

    // ============ AVS Management Functions ============

    /// @inheritdoc IDataHavenServiceManager
    function updateAVSMetadataURI(
        string memory _metadataURI
    ) external onlyOwner {
        _allocationManager.updateAVSMetadataURI(address(this), _metadataURI);
    }

    /// @inheritdoc IDataHavenServiceManager
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) external {
        IAllocationManagerTypes.DeregisterParams memory params =
            IAllocationManagerTypes.DeregisterParams({
                operator: operator, avs: address(this), operatorSetIds: operatorSetIds
            });
        _allocationManager.deregisterFromOperatorSets(params);
    }

    /// @inheritdoc IDataHavenServiceManager
    function avs() external view returns (address) {
        return address(this);
    }

    /// @inheritdoc IDataHavenServiceManager
    function createOperatorSets(
        IAllocationManager.CreateSetParams[] calldata params
    ) external onlyOwner {
        _allocationManager.createOperatorSets(address(this), params);
    }

    // ============ PermissionController Proxy Functions ============

    /// @inheritdoc IDataHavenServiceManager
    function addPendingAdmin(
        address admin
    ) external onlyOwner {
        _permissionController.addPendingAdmin({account: address(this), admin: admin});
    }

    /// @inheritdoc IDataHavenServiceManager
    function removePendingAdmin(
        address pendingAdmin
    ) external onlyOwner {
        _permissionController.removePendingAdmin({account: address(this), admin: pendingAdmin});
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeAdmin(
        address admin
    ) external onlyOwner {
        _permissionController.removeAdmin({account: address(this), admin: admin});
    }

    /// @inheritdoc IDataHavenServiceManager
    function setAppointee(
        address appointee,
        address target,
        bytes4 selector
    ) external onlyOwner {
        _permissionController.setAppointee({
            account: address(this), appointee: appointee, target: target, selector: selector
        });
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeAppointee(
        address appointee,
        address target,
        bytes4 selector
    ) external onlyOwner {
        _permissionController.removeAppointee({
            account: address(this), appointee: appointee, target: target, selector: selector
        });
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

    /**
     * @notice Internal function to set the rewards initiator
     * @param _rewardsInitiator The new rewards initiator address
     */
    function _setRewardsInitiator(
        address _rewardsInitiator
    ) internal {
        rewardsInitiator = _rewardsInitiator;
    }
}
