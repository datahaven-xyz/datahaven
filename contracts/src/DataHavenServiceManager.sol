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
    IAllocationManager internal immutable _ALLOCATION_MANAGER;

    /// @notice The EigenLayer RewardsCoordinator contract
    IRewardsCoordinator internal immutable _REWARDS_COORDINATOR;

    // ============ State Variables ============

    /// @notice The address authorized to initiate rewards submissions
    address public rewardsInitiator;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => bool) public validatorsAllowlist;

    /// @notice The Snowbridge Gateway contract
    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorSolochainAddressToEthAddress;

    /// @notice Storage gap for upgradeability (must be at end of state variables)
    // solhint-disable-next-line var-name-mixedcase
    uint256[45] private __GAP;

    // ============ Modifiers ============

    /// @notice Restricts function to the rewards initiator
    modifier onlyRewardsInitiator() {
        _checkRewardsInitiator();
        _;
    }

    /// @notice Restricts function to registered validators
    modifier onlyValidator() {
        _checkValidator();
        _;
    }

    /// @notice Restricts function to the EigenLayer AllocationManager
    modifier onlyAllocationManager() {
        _checkAllocationManager();
        _;
    }

    function _checkRewardsInitiator() internal view {
        require(msg.sender == rewardsInitiator, OnlyRewardsInitiator());
    }

    function _checkValidator() internal view {
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        require(
            _ALLOCATION_MANAGER.isMemberOfOperatorSet(msg.sender, operatorSet),
            CallerIsNotValidator()
        );
    }

    function _checkAllocationManager() internal view {
        require(msg.sender == address(_ALLOCATION_MANAGER), OnlyAllocationManager());
    }

    // ============ Constructor ============

    /// @notice Sets the immutable EigenLayer contract references
    /// @param rewardsCoordinator_ The EigenLayer RewardsCoordinator contract
    /// @param allocationManager_ The EigenLayer AllocationManager contract
    constructor(
        IRewardsCoordinator rewardsCoordinator_,
        IAllocationManager allocationManager_
    ) {
        _REWARDS_COORDINATOR = rewardsCoordinator_;
        _ALLOCATION_MANAGER = allocationManager_;
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
        require(_rewardsInitiator != address(0), ZeroAddress());
        require(_snowbridgeGatewayAddress != address(0), ZeroAddress());

        __Ownable_init();
        _transferOwnership(initialOwner);
        rewardsInitiator = _rewardsInitiator;
        emit RewardsInitiatorSet(address(0), _rewardsInitiator);

        // Register the DataHaven service in the AllocationManager.
        _ALLOCATION_MANAGER.updateAVSMetadataURI(address(this), DATAHAVEN_AVS_METADATA);

        // Create the operator set for the DataHaven service.
        IAllocationManagerTypes.CreateSetParams[] memory operatorSets =
            new IAllocationManagerTypes.CreateSetParams[](1);
        operatorSets[0] = IAllocationManagerTypes.CreateSetParams({
            operatorSetId: VALIDATORS_SET_ID, strategies: validatorsStrategies
        });
        _ALLOCATION_MANAGER.createOperatorSets(address(this), operatorSets);

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
        address[] memory currentValidatorSet = _ALLOCATION_MANAGER.getMembers(operatorSet);

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

        address existingEthOperator = validatorSolochainAddressToEthAddress[solochainAddress];
        require(
            existingEthOperator == address(0) || existingEthOperator == msg.sender,
            SolochainAddressAlreadyAssigned()
        );

        address oldSolochainAddress = validatorEthAddressToSolochainAddress[msg.sender];
        if (oldSolochainAddress != address(0) && oldSolochainAddress != solochainAddress) {
            delete validatorSolochainAddressToEthAddress[oldSolochainAddress];
        }

        validatorEthAddressToSolochainAddress[msg.sender] = solochainAddress;
        validatorSolochainAddressToEthAddress[solochainAddress] = msg.sender;
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

        address solochainAddress = _toAddress(data);
        address existingEthOperator = validatorSolochainAddressToEthAddress[solochainAddress];
        require(
            existingEthOperator == address(0) || existingEthOperator == operator,
            SolochainAddressAlreadyAssigned()
        );

        address oldSolochainAddress = validatorEthAddressToSolochainAddress[operator];
        if (oldSolochainAddress != address(0) && oldSolochainAddress != solochainAddress) {
            delete validatorSolochainAddressToEthAddress[oldSolochainAddress];
        }

        validatorEthAddressToSolochainAddress[operator] = solochainAddress;
        validatorSolochainAddressToEthAddress[solochainAddress] = operator;

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

        address oldSolochainAddress = validatorEthAddressToSolochainAddress[operator];
        delete validatorEthAddressToSolochainAddress[operator];
        if (oldSolochainAddress != address(0)) {
            delete validatorSolochainAddressToEthAddress[oldSolochainAddress];
        }

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
        return _ALLOCATION_MANAGER.getStrategiesInOperatorSet(operatorSet);
    }

    /// @inheritdoc IDataHavenServiceManager
    function removeStrategiesFromValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _ALLOCATION_MANAGER.removeStrategiesFromOperatorSet(
            address(this), VALIDATORS_SET_ID, _strategies
        );
    }

    /// @inheritdoc IDataHavenServiceManager
    function addStrategiesToValidatorsSupportedStrategies(
        IStrategy[] calldata _strategies
    ) external onlyOwner {
        _ALLOCATION_MANAGER.addStrategiesToOperatorSet(
            address(this), VALIDATORS_SET_ID, _strategies
        );
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

        submission.token.safeIncreaseAllowance(address(_REWARDS_COORDINATOR), totalAmount);

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory translatedSubmission =
            submission;
        for (uint256 i = 0; i < translatedSubmission.operatorRewards.length; i++) {
            translatedSubmission.operatorRewards[i].operator = _ethOperatorFromSolochain(
                translatedSubmission.operatorRewards[i].operator
            );
        }

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] memory submissions =
            new IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[](1);
        submissions[0] = translatedSubmission;

        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        _REWARDS_COORDINATOR.createOperatorDirectedOperatorSetRewardsSubmission(
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
        _ALLOCATION_MANAGER.updateAVSMetadataURI(address(this), _metadataURI);
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
        _ALLOCATION_MANAGER.deregisterFromOperatorSets(params);
    }

    // ============ Slashing Submitter Functions ============

    /**
     * @notice Slash the operators of the validators set
     * @param slashings array of request to slash operator containing the operator to slash, array of proportions to slash and the reason of the slashing.
     */
    function slashValidatorsOperator(
        SlashingRequest[] calldata slashings
    ) external onlyRewardsInitiator {
        for (uint256 i = 0; i < slashings.length; i++) {
            address ethOperator = _ethOperatorFromSolochain(slashings[i].operator);
            IAllocationManagerTypes.SlashingParams memory slashingParams =
                IAllocationManagerTypes.SlashingParams({
                    operator: ethOperator,
                    operatorSetId: VALIDATORS_SET_ID,
                    strategies: slashings[i].strategies,
                    wadsToSlash: slashings[i].wadsToSlash,
                    description: slashings[i].description
                });

            _ALLOCATION_MANAGER.slashOperator(address(this), slashingParams);
        }

        emit SlashingComplete();
    }

    // ============ Internal Functions ============

    /**
     * @notice Safely converts a 20-byte array to an address
     * @param data The bytes to convert (must be exactly 20 bytes)
     * @return result The address representation of the bytes
     */
    function _toAddress(
        bytes memory data
    ) private pure returns (address result) {
        require(data.length == 20, InvalidSolochainAddressLength());
        assembly {
            result := shr(96, mload(add(data, 32)))
        }
        require(result != address(0), ZeroAddress());
    }

    /**
     * @notice Returns the EigenLayer operator address for a Solochain validator address
     * @dev Reverts if the Solochain address has not been mapped to an operator
     */
    function _ethOperatorFromSolochain(
        address solochainAddress
    ) internal view returns (address) {
        address ethOperator = validatorSolochainAddressToEthAddress[solochainAddress];
        require(ethOperator != address(0), UnknownSolochainAddress());
        return ethOperator;
    }
}
