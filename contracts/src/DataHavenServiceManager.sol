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
    string public constant DATAHAVEN_AVS_METADATA =
        "https://raw.githubusercontent.com/datahaven-xyz/datahaven/refs/heads/main/contracts/deployments/metadata.json";

    /// @notice The EigenLayer operator set ID for the Validators securing the DataHaven network.
    uint32 public constant VALIDATORS_SET_ID = 0;

    // ============ Immutables ============

    /// @notice The EigenLayer AllocationManager contract
    IAllocationManager internal immutable _allocationManager;

    /// @notice The EigenLayer RewardsCoordinator contract
    IRewardsCoordinator internal immutable _rewardsCoordinator;

    // ============ State Variables ============

    /// @notice The address authorized to initiate rewards submissions
    address public rewardsInitiator;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;

    /// @notice The Snowbridge Gateway contract
    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    /// @notice Storage gap for upgradeability (must be at end of state variables)
    // solhint-disable-next-line var-name-mixedcase
    uint256[46] private __GAP;

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

    /// @notice Restricts function to the EigenLayer AllocationManager
    modifier onlyAllocationManager() {
        require(msg.sender == address(_allocationManager), OnlyAllocationManager());
        _;
    }

    /// @notice Sets the immutable EigenLayer contract references
    /// @param __rewardsCoordinator The EigenLayer RewardsCoordinator contract
    /// @param __allocationManager The EigenLayer AllocationManager contract
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IAllocationManager __allocationManager
    ) {
        _rewardsCoordinator = __rewardsCoordinator;
        _allocationManager = __allocationManager;
        _disableInitializers();
    }

    /// @inheritdoc IDataHavenServiceManager
    function initialize(
        address initialOwner,
        address _rewardsInitiator,
        IStrategy[] memory validatorsStrategies,
        address _snowbridgeGatewayAddress
    ) public virtual initializer {
        require(initialOwner != address(0), ZeroAddress());

        __Ownable_init();
        _transferOwnership(initialOwner);
        rewardsInitiator = _rewardsInitiator;

        // Register the DataHaven service in the AllocationManager.
        _allocationManager.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator set for the DataHaven service.
        IAllocationManagerTypes.CreateSetParams[] memory operatorSets =
            new IAllocationManagerTypes.CreateSetParams[](1);
        operatorSets[0] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: VALIDATORS_SET_ID, strategies: validatorsStrategies
        });
        _allocationManager.createOperatorSets(address(this), operatorSets);

        // Set the Snowbridge Gateway address.
        _snowbridgeGateway = IGatewayV2(_snowbridgeGatewayAddress);
    }

    /// @inheritdoc IDataHavenServiceManager
    function sendNewValidatorSet(
        uint128 executionFee,
        uint128 relayerFee
    ) external payable onlyOwner {
        bytes memory message = buildNewValidatorSetMessage();
        _snowbridgeGateway.v2_sendMessage{value: msg.value}(
            message, new bytes[](0), bytes(""), executionFee, relayerFee
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function buildNewValidatorSetMessage() public view returns (bytes memory) {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        address[] memory currentValidatorSet = _allocationManager.getMembers(operatorSet);

        // Allocate max size, then resize after filtering
        address[] memory newValidatorSet = new address[](currentValidatorSet.length);
        uint256 validCount = 0;
        for (uint256 i = 0; i < currentValidatorSet.length; i++) {
            address solochainAddr = validatorEthAddressToSolochainAddress[currentValidatorSet[i]];
            if (solochainAddr != address(0)) {
                newValidatorSet[validCount] = solochainAddr;
                ++validCount;
            }
        }
        // Resize array to actual count
        assembly {
            mstore(newValidatorSet, validCount)
        }

        return DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessagePayload(
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: newValidatorSet})
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function updateSolochainAddressForValidator(
        address solochainAddress
    ) external onlyValidator {
        require(solochainAddress != address(0), ZeroAddress());
        validatorEthAddressToSolochainAddress[msg.sender] = solochainAddress;
        emit SolochainAddressUpdated(msg.sender, solochainAddress);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setSnowbridgeGateway(
        address _newSnowbridgeGateway
    ) external onlyOwner {
        require(_newSnowbridgeGateway != address(0), ZeroAddress());
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
    ) external override onlyAllocationManager {
        require(avsAddress == address(this), IncorrectAVSAddress());
        require(operatorSetIds.length == 1, CantRegisterToMultipleOperatorSets());
        require(operatorSetIds[0] == VALIDATORS_SET_ID, InvalidOperatorSetId());
        require(validatorsAllowlist[operator], OperatorNotInAllowlist());
        require(data.length == 20, "Invalid solochain address length");
        address solochainAddress = address(bytes20(data));
        require(solochainAddress != address(0), ZeroAddress());
        validatorEthAddressToSolochainAddress[operator] = solochainAddress;

        emit OperatorRegistered(operator, operatorSetIds[0]);
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address operator,
        address avsAddress,
        uint32[] calldata operatorSetIds
    ) external override onlyAllocationManager {
        require(avsAddress == address(this), IncorrectAVSAddress());
        require(operatorSetIds.length == 1, CantDeregisterFromMultipleOperatorSets());
        require(operatorSetIds[0] == VALIDATORS_SET_ID, InvalidOperatorSetId());

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
        require(validator != address(0), ZeroAddress());
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
        require(newRewardsInitiator != address(0), ZeroAddress());
        address oldInitiator = rewardsInitiator;
        rewardsInitiator = newRewardsInitiator;
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
        uint32[] calldata operatorSetIds
    ) external onlyOwner {
        IAllocationManagerTypes.DeregisterParams memory params =
            IAllocationManagerTypes.DeregisterParams({
                operator: operator, avs: address(this), operatorSetIds: operatorSetIds
            });
        _allocationManager.deregisterFromOperatorSets(params);
    }
}
