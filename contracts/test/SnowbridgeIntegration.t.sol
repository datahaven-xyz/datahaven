// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {MockSnowbridgeAndAVSDeployer} from "./utils/MockSnowbridgeAndAVSDeployer.sol";

import "forge-std/Test.sol";

contract SnowbridgeIntegrationTest is MockSnowbridgeAndAVSDeployer {
    function setUp() public {
        _deployMockAllContracts();
    }

    /**
     *
     *        Constructor Tests      *
     *
     */
    function test_constructor() public view {
        assertEq(
            rewardsRegistry.rewardsAgent(),
            address(rewardsAgent),
            "Rewards agent address should be set correctly"
        );

        assertEq(
            gateway.agentOf(bytes32(0)),
            address(rewardsAgent),
            "Rewards agent should be set correctly"
        );
    }
}
