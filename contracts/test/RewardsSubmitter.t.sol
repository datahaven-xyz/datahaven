// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {ERC20FixedSupply} from "./utils/ERC20FixedSupply.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {
    IDataHavenServiceManager,
    IDataHavenServiceManagerEvents,
    IDataHavenServiceManagerErrors
} from "../src/interfaces/IDataHavenServiceManager.sol";

contract RewardsSubmitterTest is AVSDeployer {
    // Test addresses
    address public snowbridgeAgent = address(uint160(uint256(keccak256("snowbridgeAgent"))));
    address public operator1 = address(uint160(uint256(keccak256("operator1"))));
    address public operator2 = address(uint160(uint256(keccak256("operator2"))));

    // Test token
    ERC20FixedSupply public rewardToken;

    // Constants aligned with test AVSDeployer's RewardsCoordinator setup (7 days)
    uint32 public constant TEST_CALCULATION_INTERVAL = 7 days;

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

        // Deploy reward token
        rewardToken = new ERC20FixedSupply("DataHaven", "HAVE", 1000000e18, address(this));

        // Configure the rewards submitter
        vm.startPrank(avsOwner);
        serviceManager.setRewardsSnowbridgeAgent(snowbridgeAgent);
        serviceManager.setRewardToken(address(rewardToken));
        vm.stopPrank();

        // Fund the service manager with reward tokens
        rewardToken.transfer(address(serviceManager), 100000e18);
    }

    // Helper function to build strategies and multipliers array
    function _buildStrategiesAndMultipliers()
        internal
        view
        returns (IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory)
    {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategiesAndMultipliers[i] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
                strategy: deployedStrategies[i],
                multiplier: uint96((i + 1) * 1e18) // 1x, 2x, 3x multipliers
            });
        }
        return strategiesAndMultipliers;
    }

    // ============ Configuration Tests ============

    function test_setRewardsSnowbridgeAgent() public {
        address newAgent = address(0x123);

        vm.prank(avsOwner);
        vm.expectEmit(true, true, false, false);
        emit IDataHavenServiceManagerEvents.RewardsSnowbridgeAgentSet(snowbridgeAgent, newAgent);
        serviceManager.setRewardsSnowbridgeAgent(newAgent);

        assertEq(serviceManager.rewardsSnowbridgeAgent(), newAgent);
    }

    function test_setRewardsSnowbridgeAgent_revertsIfNotOwner() public {
        vm.prank(operator1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.setRewardsSnowbridgeAgent(address(0x123));
    }

    function test_setRewardToken() public {
        address newToken = address(0x456);

        vm.prank(avsOwner);
        vm.expectEmit(true, true, false, false);
        emit IDataHavenServiceManagerEvents.RewardTokenSet(address(rewardToken), newToken);
        serviceManager.setRewardToken(newToken);

        assertEq(serviceManager.rewardToken(), newToken);
    }

    // ============ Access Control Tests ============

    function test_submitRewards_revertsIfNotSnowbridgeAgent() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            _buildStrategiesAndMultipliers();
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        vm.prank(operator1);
        vm.expectRevert(IDataHavenServiceManagerErrors.OnlyRewardsSnowbridgeAgent.selector);
        serviceManager.submitRewards(startTimestamp, duration, strategiesAndMultipliers, rewards);
    }

    // ============ Validation Tests ============

    function test_submitRewards_revertsIfEmptyStrategiesArray() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory emptyStrategies =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](0);
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.EmptyStrategiesArray.selector);
        serviceManager.submitRewards(startTimestamp, duration, emptyStrategies, rewards);
    }

    function test_submitRewards_revertsIfEmptyOperatorsArray() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            _buildStrategiesAndMultipliers();
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](0);

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.EmptyOperatorsArray.selector);
        serviceManager.submitRewards(startTimestamp, duration, strategiesAndMultipliers, rewards);
    }

    // ============ Success Tests ============

    function test_submitRewards_singleOperator() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            _buildStrategiesAndMultipliers();
        uint256 rewardAmount = 1000e18;
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: rewardAmount});

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        // Warp to a time after the period ends
        vm.warp(startTimestamp + duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(rewardAmount, 1);
        serviceManager.submitRewards(startTimestamp, duration, strategiesAndMultipliers, rewards);
    }

    function test_submitRewards_multipleOperators() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            _buildStrategiesAndMultipliers();

        // Ensure operators are sorted in ascending order (required by EigenLayer)
        address opLow = address(0x1);
        address opHigh = address(0x2);

        uint256 amount1 = 600e18;
        uint256 amount2 = 400e18;
        uint256 totalAmount = amount1 + amount2;

        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](2);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: opLow, amount: amount1});
        rewards[1] = IRewardsCoordinatorTypes.OperatorReward({operator: opHigh, amount: amount2});

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        // Warp to a time after the period ends
        vm.warp(startTimestamp + duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(totalAmount, 2);
        serviceManager.submitRewards(startTimestamp, duration, strategiesAndMultipliers, rewards);
    }

    function test_submitRewards_multipleSubmissions() public {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            _buildStrategiesAndMultipliers();
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        uint32 duration = TEST_CALCULATION_INTERVAL;

        // Submit for period 0
        uint32 startTimestamp0 = GENESIS_REWARDS_TIMESTAMP;
        vm.warp(startTimestamp0 + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(startTimestamp0, duration, strategiesAndMultipliers, rewards);

        // Submit for period 1
        uint32 startTimestamp1 = GENESIS_REWARDS_TIMESTAMP + duration;
        vm.warp(startTimestamp1 + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(startTimestamp1, duration, strategiesAndMultipliers, rewards);

        // Submit for period 2
        uint32 startTimestamp2 = GENESIS_REWARDS_TIMESTAMP + 2 * duration;
        vm.warp(startTimestamp2 + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(startTimestamp2, duration, strategiesAndMultipliers, rewards);
    }

    function test_submitRewards_withDifferentMultipliers() public {
        // Test that different multipliers can be passed per submission
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](2);
        strategiesAndMultipliers[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: deployedStrategies[0],
            multiplier: 5e18 // 5x multiplier
        });
        strategiesAndMultipliers[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: deployedStrategies[1],
            multiplier: 1e18 // 1x multiplier
        });

        uint256 rewardAmount = 1000e18;
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: rewardAmount});

        uint32 startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        uint32 duration = TEST_CALCULATION_INTERVAL;

        vm.warp(startTimestamp + duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(rewardAmount, 1);
        serviceManager.submitRewards(startTimestamp, duration, strategiesAndMultipliers, rewards);
    }
}
