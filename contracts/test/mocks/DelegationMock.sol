// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {console2 as console} from "forge-std/Test.sol";

import {IDelegationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IDelegationManager.sol";
import {IStrategyManager} from "eigenlayer-contracts/src/contracts/interfaces/IStrategyManager.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IPauserRegistry} from "eigenlayer-contracts/src/contracts/interfaces/IPauserRegistry.sol";
import {ISignatureUtils} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtils.sol";
import {SlashingLib} from "eigenlayer-contracts/src/contracts/libraries/SlashingLib.sol";

contract DelegationIntermediate is IDelegationManager {
    function initialize(address initialOwner, uint256 initialPausedStatus) external virtual {}

    function registerAsOperator(
        OperatorDetails calldata registeringOperatorDetails,
        uint32 allocationDelay,
        string calldata metadataURI
    ) external virtual {}

    function modifyOperatorDetails(
        OperatorDetails calldata newOperatorDetails
    ) external virtual {}

    function updateOperatorMetadataURI(
        string calldata metadataURI
    ) external virtual {}

    function delegateTo(
        address operator,
        SignatureWithExpiry memory approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external virtual {}

    function undelegate(
        address staker
    ) external virtual returns (bytes32[] memory withdrawalRoots) {}

    function queueWithdrawals(
        QueuedWithdrawalParams[] calldata params
    ) external virtual returns (bytes32[] memory) {}

    function completeQueuedWithdrawals(
        IERC20[][] calldata tokens,
        bool[] calldata receiveAsTokens,
        uint256 numToComplete
    ) external virtual {}

    function completeQueuedWithdrawal(
        Withdrawal calldata withdrawal,
        IERC20[] calldata tokens,
        bool receiveAsTokens
    ) external virtual {}

    function completeQueuedWithdrawals(
        Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        bool[] calldata receiveAsTokens
    ) external virtual {}

    function increaseDelegatedShares(
        address staker,
        IStrategy strategy,
        uint256 existingDepositShares,
        uint256 addedShares
    ) external virtual {}

    function decreaseBeaconChainScalingFactor(
        address staker,
        uint256 existingShares,
        uint64 proportionOfOldBalance
    ) external virtual {}

    function burnOperatorShares(
        address operator,
        IStrategy strategy,
        uint64 prevMaxMagnitude,
        uint64 newMaxMagnitude
    ) external virtual {}

    function completeQueuedWithdrawal(
        Withdrawal calldata withdrawal,
        IERC20[] calldata tokens,
        uint256 middlewareTimesIndex,
        bool receiveAsTokens
    ) external virtual {}

    function completeQueuedWithdrawals(
        Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        uint256[] calldata middlewareTimesIndexes,
        bool[] calldata receiveAsTokens
    ) external virtual {}

    function delegatedTo(
        address staker
    ) external view virtual returns (address) {}

    function delegationApproverSaltIsSpent(
        address _delegationApprover,
        bytes32 salt
    ) external view virtual returns (bool) {}

    function cumulativeWithdrawalsQueued(
        address staker
    ) external view virtual returns (uint256) {}

    function isDelegated(
        address staker
    ) external view virtual returns (bool) {}

    function isOperator(
        address operator
    ) external view virtual returns (bool) {}

    function operatorDetails(
        address operator
    ) external view virtual returns (OperatorDetails memory) {}

    function delegationApprover(
        address operator
    ) external view virtual returns (address) {}

    function getOperatorShares(
        address operator,
        IStrategy[] memory strategies
    ) external view virtual returns (uint256[] memory) {}

    function getOperatorsShares(
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view virtual returns (uint256[][] memory) {}

    function getSlashableSharesInQueue(
        address operator,
        IStrategy strategy
    ) external view virtual returns (uint256) {}

    function getWithdrawableShares(
        address staker,
        IStrategy[] memory strategies
    )
        external
        view
        virtual
        override
        returns (uint256[] memory withdrawableShares, uint256[] memory depositShares)
    {}

    function getDepositedShares(
        address staker
    ) external view virtual returns (IStrategy[] memory, uint256[] memory) {}

    function depositScalingFactor(
        address staker,
        IStrategy strategy
    ) external view virtual returns (uint256) {}

    function getBeaconChainSlashingFactor(
        address staker
    ) external view virtual returns (uint64) {}

    function getQueuedWithdrawals(
        address staker
    )
        external
        view
        virtual
        override
        returns (Withdrawal[] memory withdrawals, uint256[][] memory shares)
    {}

    function calculateWithdrawalRoot(
        Withdrawal memory withdrawal
    ) external pure virtual returns (bytes32) {}

    function calculateDelegationApprovalDigestHash(
        address staker,
        address operator,
        address _delegationApprover,
        bytes32 approverSalt,
        uint256 expiry
    ) external view virtual returns (bytes32) {}

    function beaconChainETHStrategy() external view virtual override returns (IStrategy) {}

    function DELEGATION_APPROVAL_TYPEHASH() external view virtual override returns (bytes32) {}

    function registerAsOperator(
        address initDelegationApprover,
        uint32 allocationDelay,
        string calldata metadataURI
    ) external virtual {}

    function modifyOperatorDetails(
        address operator,
        address newDelegationApprover
    ) external virtual {}

    function updateOperatorMetadataURI(
        address operator,
        string calldata metadataURI
    ) external virtual {}

    function redelegate(
        address newOperator,
        SignatureWithExpiry memory newOperatorApproverSig,
        bytes32 approverSalt
    ) external virtual returns (bytes32[] memory withdrawalRoots) {}

    function decreaseDelegatedShares(
        address staker,
        uint256 curDepositShares,
        uint64 prevBeaconChainSlashingFactor,
        uint256 wadSlashed
    ) external virtual {}

    function decreaseDelegatedShares(
        address staker,
        uint256 curDepositShares,
        uint64 beaconChainSlashingFactorDecrease
    ) external virtual {}

    function minWithdrawalDelayBlocks() external view virtual override returns (uint32) {}

    function slashOperatorShares(
        address operator,
        IStrategy strategy,
        uint64 prevMaxMagnitude,
        uint64 newMaxMagnitude
    ) external {}

    function getQueuedWithdrawal(
        bytes32 withdrawalRoot
    ) external view override returns (Withdrawal memory) {}

    function getQueuedWithdrawalRoots(
        address staker
    ) external view override returns (bytes32[] memory) {}

    function convertToDepositShares(
        address staker,
        IStrategy[] memory strategies,
        uint256[] memory withdrawableShares
    ) external view override returns (uint256[] memory) {}
}

contract DelegationMock is DelegationIntermediate {
    mapping(address => bool) internal _isOperator;
    mapping(address => mapping(IStrategy => uint256)) internal _weightOf;

    function setOperatorShares(
        address operator,
        IStrategy strategy,
        uint256 actualWeight
    ) external {
        _weightOf[operator][strategy] = actualWeight;
    }

    function setIsOperator(address operator, bool isOperator) external {
        _isOperator[operator] = isOperator;
    }

    function isOperator(
        address operator
    ) external view override returns (bool) {
        return _isOperator[operator];
    }

    function getOperatorShares(
        address operator,
        IStrategy[] calldata strategies
    ) external view override returns (uint256[] memory) {
        uint256[] memory shares = new uint256[](strategies.length);
        for (uint256 i = 0; i < strategies.length; i++) {
            shares[i] = _weightOf[operator][strategies[i]];
        }
        return shares;
    }

    function getOperatorsShares(
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view override returns (uint256[][] memory) {
        uint256[][] memory operatorSharesArray = new uint256[][](operators.length);
        for (uint256 i = 0; i < operators.length; i++) {
            operatorSharesArray[i] = new uint256[](strategies.length);
            for (uint256 j = 0; j < strategies.length; j++) {
                operatorSharesArray[i][j] = _weightOf[operators[i]][strategies[j]];
            }
        }
        return operatorSharesArray;
    }

    function minWithdrawalDelayBlocks() external view override returns (uint32) {
        return 10000;
    }
}
