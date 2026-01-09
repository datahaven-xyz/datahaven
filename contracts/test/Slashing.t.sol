// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IAllocationManagerErrors,
    IAllocationManager,
    IAllocationManagerTypes,
    IAllocationManagerEvents
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import "forge-std/Test.sol";

contract SlashingTest is AVSDeployer {
    address operator = address(0xabcd);
    address public snowbridgeAgent = address(uint160(uint256(keccak256("snowbridgeAgent"))));

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

    }

    function test_fulfilSlashingRequest() public {
        // Allow our operatir to register
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(operator);

        // Configure the rewards initiator (because only the reward agent can submit slashing request)
        vm.prank(avsOwner);
        serviceManager.setRewardsInitiator(snowbridgeAgent);

        vm.prank(operator);
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(address(operator))
            });

        vm.prank(operator);
        allocationManager.registerForOperatorSets(operator, registerParams);

        DataHavenServiceManager.SlashingRequest[] memory slashings = new DataHavenServiceManager.SlashingRequest[](1);
        uint256[] memory wadsToSlash = new uint256[](3); // 3 wadsToSlash because we have register 3 strategies for the Validator set 
        wadsToSlash[0] = 1e16;
        wadsToSlash[1] = 1e16;
        wadsToSlash[2] = 1e16;

        slashings[0] = DataHavenServiceManager.SlashingRequest(operator, wadsToSlash, "Testing slashing");

        console.log(block.number);
        vm.roll(block.number + uint32(7 days) + 1);
        console.log(block.number);
        vm.expectEmit();

        OperatorSet memory operatorSet = OperatorSet({avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()});
        IStrategy[] memory strategies = allocationManager.getStrategiesInOperatorSet(operatorSet);


        // Because the current magnituse for the allocation is 0
        uint256[] memory wadsToSlashed = new uint256[](3);

        // We emit the event we expect to see.
        vm.prank(snowbridgeAgent);
        emit IAllocationManagerEvents.OperatorSlashed(operator, operatorSet, strategies, wadsToSlashed, "Testing slashing");
        serviceManager.slashValidatorsOperator(slashings);
    }

}