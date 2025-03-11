// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {
    IAllocationManager,
    OperatorSet
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IPauserRegistry} from "eigenlayer-contracts/src/contracts/interfaces/IPauserRegistry.sol";

contract AllocationManagerIntermediate is IAllocationManager {
    function initialize(address initialOwner, uint256 initialPausedStatus) external virtual {}

    function slashOperator(address avs, SlashingParams calldata params) external virtual {}

    function modifyAllocations(
        address operator,
        AllocateParams[] calldata params
    ) external virtual {}

    function clearDeallocationQueue(
        address operator,
        IStrategy[] calldata strategies,
        uint16[] calldata numToClear
    ) external virtual {}

    function registerForOperatorSets(
        address operator,
        RegisterParams calldata params
    ) external virtual {}

    function deregisterFromOperatorSets(
        DeregisterParams calldata params
    ) external virtual {}

    function setAllocationDelay(address operator, uint32 delay) external virtual {}

    function setAVSRegistrar(address avs, IAVSRegistrar registrar) external virtual {}

    function updateAVSMetadataURI(address avs, string calldata metadataURI) external virtual {}

    function createOperatorSets(address avs, CreateSetParams[] calldata params) external virtual {}

    function addStrategiesToOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual {}

    function removeStrategiesFromOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual {}

    function getOperatorSetCount(
        address avs
    ) external view virtual returns (uint256) {}

    function getAllocatedSets(
        address operator
    ) external view virtual returns (OperatorSet[] memory) {}

    function getAllocatedStrategies(
        address operator,
        OperatorSet memory operatorSet
    ) external view virtual returns (IStrategy[] memory) {}

    function getAllocation(
        address operator,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view virtual returns (Allocation memory) {}

    function getAllocations(
        address[] memory operators,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view virtual returns (Allocation[] memory) {}

    function getStrategyAllocations(
        address operator,
        IStrategy strategy
    ) external view virtual returns (OperatorSet[] memory, Allocation[] memory) {}

    function getAllocatableMagnitude(
        address operator,
        IStrategy strategy
    ) external view virtual returns (uint64) {}

    function getMaxMagnitude(
        address operator,
        IStrategy strategy
    ) external view virtual returns (uint64) {}

    function getMaxMagnitudes(
        address operator,
        IStrategy[] calldata strategies
    ) external view virtual returns (uint64[] memory) {}

    function getMaxMagnitudes(
        address[] calldata operators,
        IStrategy strategy
    ) external view virtual returns (uint64[] memory) {}

    function getMaxMagnitudesAtBlock(
        address operator,
        IStrategy[] calldata strategies,
        uint32 blockNumber
    ) external view virtual returns (uint64[] memory) {}

    function getAllocationDelay(
        address operator
    ) external view virtual returns (bool isSet, uint32 delay) {}

    function getRegisteredSets(
        address operator
    ) external view virtual returns (OperatorSet[] memory operatorSets) {}

    function isOperatorSet(
        OperatorSet memory operatorSet
    ) external view virtual returns (bool) {}

    function getMembers(
        OperatorSet memory operatorSet
    ) external view virtual returns (address[] memory operators) {}

    function getMemberCount(
        OperatorSet memory operatorSet
    ) external view virtual returns (uint256) {}

    function getAVSRegistrar(
        address avs
    ) external view virtual returns (IAVSRegistrar) {}

    function getStrategiesInOperatorSet(
        OperatorSet memory operatorSet
    ) external view virtual returns (IStrategy[] memory strategies) {}

    function getMinimumSlashableStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies,
        uint32 futureBlock
    ) external view virtual returns (uint256[][] memory slashableStake) {}

    function isMemberOfOperatorSet(
        address operator,
        OperatorSet memory operatorSet
    ) external view virtual returns (bool) {}

    function version() external view override returns (string memory) {}

    function getEncumberedMagnitude(
        address operator,
        IStrategy strategy
    ) external view override returns (uint64) {}

    function getAllocatedStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view override returns (uint256[][] memory slashableStake) {}

    function isOperatorSlashable(
        address operator,
        OperatorSet memory operatorSet
    ) external view override returns (bool) {}
}

contract AllocationManagerMock is AllocationManagerIntermediate {}
