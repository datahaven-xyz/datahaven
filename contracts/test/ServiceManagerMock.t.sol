// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";

import {ServiceManagerMock} from "./mocks/ServiceManagerMock.sol";
import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {IServiceManagerBaseEvents} from "./events/IServiceManagerBaseEvents.sol";

contract ServiceManagerBaseTest is MockAVSDeployer, IServiceManagerBaseEvents {
    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();
    }

    function test_setup() public {
        assertEq(serviceManager.owner(), avsOwner);
        assertEq(serviceManager.rewardsInitiator(), rewardsInitiator);
    }
}
