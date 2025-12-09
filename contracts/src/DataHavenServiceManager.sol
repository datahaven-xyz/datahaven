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

    IGatewayV2 private _snowbridgeGateway;

    /// @inheritdoc IDataHavenServiceManager
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    // ============ Rewards Submitter Storage ============

    /// @notice Address authorized to submit rewards via Snowbridge
    address internal _rewardsSnowbridgeAgent;

    /// @notice The reward token (e.g., wHAVE)
    address internal _rewardToken;

    /// @notice Genesis timestamp for era calculations (must align to CALCULATION_INTERVAL_SECONDS)
    uint32 internal _eraGenesisTimestamp;

    /// @notice Duration of each era in seconds
    uint32 internal _eraDuration;

    /// @notice Mapping of era index to whether it has been processed
    mapping(uint32 eraIndex => bool processed) internal _processedEras;

    /// @notice Array of strategies for reward distribution
    IStrategy[] internal _rewardStrategies;

    /// @notice Array of multipliers for each strategy (parallel to _rewardStrategies)
    uint96[] internal _rewardMultipliers;

    /// @dev Gap for future storage variables
    uint256[44] private __gap;

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

    /// @notice Modifier to ensure the caller is the authorized Snowbridge Agent
    modifier onlyRewardsSnowbridgeAgent() {
        if (msg.sender != _rewardsSnowbridgeAgent) {
            revert OnlyRewardsSnowbridgeAgent();
        }
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
        uint32 eraIndex,
        IRewardsCoordinatorTypes.OperatorReward[] calldata operatorRewards
    ) external override onlyRewardsSnowbridgeAgent {
        // Validate era hasn't been processed (replay protection)
        if (_processedEras[eraIndex]) {
            revert EraAlreadyProcessed(eraIndex);
        }

        // Validate reward token is set
        if (_rewardToken == address(0)) {
            revert RewardTokenNotSet();
        }

        // Validate strategies are configured
        if (_rewardStrategies.length == 0) {
            revert NoStrategiesConfigured();
        }

        // Validate operators array is not empty
        if (operatorRewards.length == 0) {
            revert EmptyOperatorsArray();
        }

        // Validate era parameters are configured
        if (_eraGenesisTimestamp == 0 || _eraDuration == 0) {
            revert EraParametersNotConfigured();
        }

        // Mark era as processed
        _processedEras[eraIndex] = true;

        // Calculate total amount and build strategies array
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < operatorRewards.length; i++) {
            totalAmount += operatorRewards[i].amount;
        }

        // Build StrategyAndMultiplier array
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](_rewardStrategies.length);
        for (uint256 i = 0; i < _rewardStrategies.length; i++) {
            strategiesAndMultipliers[i] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
                strategy: _rewardStrategies[i], multiplier: _rewardMultipliers[i]
            });
        }

        // Get the calculation interval from RewardsCoordinator
        uint32 calculationInterval = _rewardsCoordinator.CALCULATION_INTERVAL_SECONDS();

        // Calculate startTimestamp based on era index
        // startTimestamp = genesisTimestamp + (eraIndex * calculationInterval)
        // Note: We use the RewardsCoordinator's CALCULATION_INTERVAL_SECONDS as the effective era duration
        // for EigenLayer compatibility, regardless of actual DataHaven era duration
        uint32 startTimestamp = _eraGenesisTimestamp + (eraIndex * calculationInterval);

        // Approve RewardsCoordinator to spend tokens
        IERC20(_rewardToken).safeIncreaseAllowance(address(_rewardsCoordinator), totalAmount);

        // Build the operator-directed rewards submission
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] memory submissions =
            new IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[](1);

        // Copy operatorRewards to memory array
        IRewardsCoordinatorTypes.OperatorReward[] memory operatorRewardsMem =
            new IRewardsCoordinatorTypes.OperatorReward[](operatorRewards.length);
        for (uint256 i = 0; i < operatorRewards.length; i++) {
            operatorRewardsMem[i] = operatorRewards[i];
        }

        submissions[0] = IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
            strategiesAndMultipliers: strategiesAndMultipliers,
            token: IERC20(_rewardToken),
            operatorRewards: operatorRewardsMem,
            startTimestamp: startTimestamp,
            duration: calculationInterval,
            description: string(
                abi.encodePacked("DataHaven Era ", _uint32ToString(eraIndex), " rewards")
            )
        });

        // Submit to EigenLayer RewardsCoordinator
        OperatorSet memory operatorSet = OperatorSet({avs: address(this), id: VALIDATORS_SET_ID});
        _rewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission(
            operatorSet, submissions
        );

        emit EraRewardsSubmitted(eraIndex, totalAmount, operatorRewards.length);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setRewardsSnowbridgeAgent(
        address agent
    ) external override onlyOwner {
        address oldAgent = _rewardsSnowbridgeAgent;
        _rewardsSnowbridgeAgent = agent;
        emit RewardsSnowbridgeAgentSet(oldAgent, agent);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setRewardToken(
        address token
    ) external override onlyOwner {
        address oldToken = _rewardToken;
        _rewardToken = token;
        emit RewardTokenSet(oldToken, token);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setEraParameters(
        uint32 genesisTimestamp,
        uint32 eraDurationSeconds
    ) external override onlyOwner {
        // Get the calculation interval from RewardsCoordinator
        uint32 calculationInterval = _rewardsCoordinator.CALCULATION_INTERVAL_SECONDS();

        // Validate genesis timestamp is aligned to CALCULATION_INTERVAL_SECONDS
        if (genesisTimestamp % calculationInterval != 0) {
            revert InvalidGenesisTimestamp();
        }

        // Validate era duration is non-zero
        if (eraDurationSeconds == 0) {
            revert InvalidEraDuration();
        }

        _eraGenesisTimestamp = genesisTimestamp;
        _eraDuration = eraDurationSeconds;

        emit EraParametersSet(genesisTimestamp, eraDurationSeconds);
    }

    /// @inheritdoc IDataHavenServiceManager
    function setStrategyMultipliers(
        IStrategy[] calldata strategies,
        uint96[] calldata multipliers
    ) external override onlyOwner {
        if (strategies.length != multipliers.length) {
            revert StrategiesMultipliersLengthMismatch();
        }

        // Clear existing arrays
        delete _rewardStrategies;
        delete _rewardMultipliers;

        // Set new values
        for (uint256 i = 0; i < strategies.length; i++) {
            _rewardStrategies.push(strategies[i]);
            _rewardMultipliers.push(multipliers[i]);
        }

        emit StrategyMultipliersSet(strategies, multipliers);
    }

    /// @inheritdoc IDataHavenServiceManager
    function isEraProcessed(
        uint32 eraIndex
    ) external view override returns (bool) {
        return _processedEras[eraIndex];
    }

    /// @inheritdoc IDataHavenServiceManager
    function rewardsSnowbridgeAgent() external view override returns (address) {
        return _rewardsSnowbridgeAgent;
    }

    /// @inheritdoc IDataHavenServiceManager
    function rewardToken() external view override returns (address) {
        return _rewardToken;
    }

    /// @inheritdoc IDataHavenServiceManager
    function eraGenesisTimestamp() external view override returns (uint32) {
        return _eraGenesisTimestamp;
    }

    /// @inheritdoc IDataHavenServiceManager
    function eraDuration() external view override returns (uint32) {
        return _eraDuration;
    }

    /// @inheritdoc IDataHavenServiceManager
    function getStrategyMultipliers()
        external
        view
        override
        returns (IStrategy[] memory strategies, uint96[] memory multipliers)
    {
        return (_rewardStrategies, _rewardMultipliers);
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
     * @notice Converts a uint32 to its string representation
     * @param value The uint32 value to convert
     * @return The string representation
     */
    function _uint32ToString(
        uint32 value
    ) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint32 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
