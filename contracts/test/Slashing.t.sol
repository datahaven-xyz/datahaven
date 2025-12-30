// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IAllocationManagerErrors,
    IAllocationManager,
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import "forge-std/Test.sol";

contract SlashingTest is AVSDeployer {
    address operator = address(0xabcd);


    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

    }

    function test_fulfilSlashingRequest() public {
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(operator);

        cheats.startPrank(operator);
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(address(operator))
            });

        allocationManager.registerForOperatorSets(operator, registerParams);

        address[] memory operators = new address[](1);
        operators[0] = operator;

        console.log(block.number);
        vm.roll(block.number + uint32(7 days) + 1);
        console.log(block.number);
        vm.expectEmit();
        // We emit the event we expect to see.
        emit DataHavenServiceManager.ValidatorsSlashedTest(operator);
        serviceManager.slashValidatorsOperator(operators);
    }

}