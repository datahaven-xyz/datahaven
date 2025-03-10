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
    ServiceManagerMock public avs;

    // RewardsCoordinator config
    address rewardsUpdater =
        address(uint160(uint256(keccak256("rewardsUpdater"))));
    uint32 CALCULATION_INTERVAL_SECONDS = 7 days;
    uint32 MAX_REWARDS_DURATION = 70 days;
    uint32 MAX_RETROACTIVE_LENGTH = 84 days;
    uint32 MAX_FUTURE_LENGTH = 28 days;
    uint32 GENESIS_REWARDS_TIMESTAMP = 1712188800;
    uint256 MAX_REWARDS_AMOUNT = 1e38 - 1;
    /// TODO: what values should these have
    uint32 OPERATOR_SET_GENESIS_REWARDS_TIMESTAMP = 0;
    /// TODO: What values these should have
    uint32 OPERATOR_SET_MAX_RETROACTIVE_LENGTH = 0;

    /// @notice Delay in timestamp before a posted root can be claimed against
    uint32 activationDelay = 7 days;
    /// @notice the commission for all operators across all AVSs
    uint16 globalCommissionBips = 1000;

    // Testing Config and Mocks
    address serviceManagerOwner;
    address rewardsInitiator =
        address(uint160(uint256(keccak256("rewardsInitiator"))));
    IERC20[] rewardTokens;
    uint256 mockTokenInitialSupply = 10e50;
    IStrategy strategyMock1;
    IStrategy strategyMock2;
    IStrategy strategyMock3;
    StrategyBase strategyImplementation;
    IRewardsCoordinator.StrategyAndMultiplier[] defaultStrategyAndMultipliers;

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();
    }
}
