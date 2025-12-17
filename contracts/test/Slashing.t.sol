// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IAllocationManagerErrors,
    IAllocationManager,
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {ISlasher, ISlasherErrors, ISlasherEvents} from "../src/interfaces/ISlasher.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import "forge-std/Test.sol";

contract SlashingTest is AVSDeployer {
    address operator = address(0xabcd);


    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

    }

    function test_registerOperator() public {

    }

    function test_fulfilSlashingRequest() public {
        // Setup mock params
        address operator = address(0xabcd);
        // uint32 operatorSetId = 1;
        // IStrategy[] memory strategies = new IStrategy[](1);
        // strategies[0] = deployedStrategies[0];
        // uint256[] memory wadsToSlash = new uint256[](1);
        // wadsToSlash[0] = 1e16;
        // string memory description = "Test slashing";

        // IAllocationManagerTypes.SlashingParams memory params = IAllocationManagerTypes.SlashingParams({
        //     operator: operator,
        //     operatorSetId: operatorSetId,
        //     strategies: strategies,
        //     wadsToSlash: wadsToSlash,
        //     description: description
        // });

        address[] memory operators = new address[](1);
        operators[0] = operator;

        console.log(block.number);
        vm.roll(block.number + uint32(7 days) + 1);
        console.log(block.number);
        vm.expectEmit();
        // We emit the event we expect to see.
        emit DataHavenServiceManager.ValidatorsSlashedTestBis(operator);
        serviceManager.slashValidatorsOperator(operators);
    }

}