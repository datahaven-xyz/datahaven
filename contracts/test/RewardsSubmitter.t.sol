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
    uint32 public genesisTimestamp;
    uint32 public eraDuration = 6 hours;

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

        // Deploy reward token
        rewardToken = new ERC20FixedSupply("DataHaven", "HAVE", 1000000e18, address(this));

        // Set up genesis timestamp aligned to CALCULATION_INTERVAL_SECONDS (7 days in test setup)
        // GENESIS_REWARDS_TIMESTAMP from AVSDeployer is already aligned to 7 days
        genesisTimestamp = GENESIS_REWARDS_TIMESTAMP;

        // Configure the rewards submitter
        vm.startPrank(avsOwner);
        serviceManager.setRewardsSnowbridgeAgent(snowbridgeAgent);
        serviceManager.setRewardToken(address(rewardToken));
        serviceManager.setEraParameters(genesisTimestamp, eraDuration);

        // Set up strategy multipliers (using deployed strategies from AVSDeployer)
        IStrategy[] memory strategies = new IStrategy[](deployedStrategies.length);
        uint96[] memory multipliers = new uint96[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategies[i] = deployedStrategies[i];
            multipliers[i] = uint96((i + 1) * 1e18); // 1x, 2x, 3x multipliers
        }
        serviceManager.setStrategyMultipliers(strategies, multipliers);
        vm.stopPrank();

        // Fund the service manager with reward tokens
        rewardToken.transfer(address(serviceManager), 100000e18);
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

    function test_setEraParameters() public {
        uint32 newGenesis = genesisTimestamp + TEST_CALCULATION_INTERVAL;
        uint32 newDuration = 43200; // 12 hours

        vm.prank(avsOwner);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.EraParametersSet(newGenesis, newDuration);
        serviceManager.setEraParameters(newGenesis, newDuration);

        assertEq(serviceManager.eraGenesisTimestamp(), newGenesis);
        assertEq(serviceManager.eraDuration(), newDuration);
    }

    function test_setEraParameters_revertsIfGenesisNotAligned() public {
        uint32 unalignedGenesis = genesisTimestamp + 100; // Not a multiple of 86400

        vm.prank(avsOwner);
        vm.expectRevert(IDataHavenServiceManagerErrors.InvalidGenesisTimestamp.selector);
        serviceManager.setEraParameters(unalignedGenesis, eraDuration);
    }

    function test_setEraParameters_revertsIfDurationZero() public {
        vm.prank(avsOwner);
        vm.expectRevert(IDataHavenServiceManagerErrors.InvalidEraDuration.selector);
        serviceManager.setEraParameters(genesisTimestamp, 0);
    }

    function test_setStrategyMultipliers() public {
        IStrategy[] memory strategies = new IStrategy[](2);
        uint96[] memory multipliers = new uint96[](2);
        strategies[0] = deployedStrategies[0];
        strategies[1] = deployedStrategies[1];
        multipliers[0] = 2e18;
        multipliers[1] = 3e18;

        vm.prank(avsOwner);
        serviceManager.setStrategyMultipliers(strategies, multipliers);

        (IStrategy[] memory storedStrategies, uint96[] memory storedMultipliers) =
            serviceManager.getStrategyMultipliers();
        assertEq(storedStrategies.length, 2);
        assertEq(storedMultipliers.length, 2);
        assertEq(address(storedStrategies[0]), address(strategies[0]));
        assertEq(storedMultipliers[0], 2e18);
    }

    function test_setStrategyMultipliers_revertsIfLengthMismatch() public {
        IStrategy[] memory strategies = new IStrategy[](2);
        uint96[] memory multipliers = new uint96[](1);

        vm.prank(avsOwner);
        vm.expectRevert(IDataHavenServiceManagerErrors.StrategiesMultipliersLengthMismatch.selector);
        serviceManager.setStrategyMultipliers(strategies, multipliers);
    }

    // ============ Access Control Tests ============

    function test_submitRewards_revertsIfNotSnowbridgeAgent() public {
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        vm.prank(operator1);
        vm.expectRevert(IDataHavenServiceManagerErrors.OnlyRewardsSnowbridgeAgent.selector);
        serviceManager.submitRewards(0, rewards);
    }

    // ============ Validation Tests ============

    function test_submitRewards_revertsIfEraAlreadyProcessed() public {
        // First submission should succeed
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        // Warp to a time after the era ends (for retroactive submission)
        vm.warp(genesisTimestamp + TEST_CALCULATION_INTERVAL + 1);

        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(0, rewards);

        // Second submission for same era should revert
        vm.prank(snowbridgeAgent);
        vm.expectRevert(
            abi.encodeWithSelector(IDataHavenServiceManagerErrors.EraAlreadyProcessed.selector, 0)
        );
        serviceManager.submitRewards(0, rewards);
    }

    function test_submitRewards_revertsIfRewardTokenNotSet() public {
        // Clear reward token
        vm.prank(avsOwner);
        serviceManager.setRewardToken(address(0));

        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.RewardTokenNotSet.selector);
        serviceManager.submitRewards(0, rewards);
    }

    function test_submitRewards_revertsIfNoStrategiesConfigured() public {
        // Clear strategies
        IStrategy[] memory emptyStrategies = new IStrategy[](0);
        uint96[] memory emptyMultipliers = new uint96[](0);
        vm.prank(avsOwner);
        serviceManager.setStrategyMultipliers(emptyStrategies, emptyMultipliers);

        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.NoStrategiesConfigured.selector);
        serviceManager.submitRewards(0, rewards);
    }

    function test_submitRewards_revertsIfEmptyOperatorsArray() public {
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](0);

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.EmptyOperatorsArray.selector);
        serviceManager.submitRewards(0, rewards);
    }

    function test_submitRewards_revertsIfEraParametersNotConfigured() public {
        // Deploy a fresh service manager without era parameters
        vm.startPrank(regularDeployer);
        DataHavenServiceManager freshServiceManager = DataHavenServiceManager(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        DataHavenServiceManager.initialise.selector,
                        avsOwner,
                        rewardsInitiator,
                        deployedStrategies,
                        address(0)
                    )
                )
            )
        );
        vm.stopPrank();

        // Configure only agent, token, and strategies (not era parameters)
        vm.startPrank(avsOwner);
        freshServiceManager.setRewardsSnowbridgeAgent(snowbridgeAgent);
        freshServiceManager.setRewardToken(address(rewardToken));
        IStrategy[] memory strategies = new IStrategy[](1);
        uint96[] memory multipliers = new uint96[](1);
        strategies[0] = deployedStrategies[0];
        multipliers[0] = 1e18;
        freshServiceManager.setStrategyMultipliers(strategies, multipliers);
        vm.stopPrank();

        // Fund it
        rewardToken.transfer(address(freshServiceManager), 10000e18);

        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        vm.prank(snowbridgeAgent);
        vm.expectRevert(IDataHavenServiceManagerErrors.EraParametersNotConfigured.selector);
        freshServiceManager.submitRewards(0, rewards);
    }

    // ============ Success Tests ============

    function test_submitRewards_singleOperator() public {
        uint256 rewardAmount = 1000e18;
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: rewardAmount});

        // Warp to a time after the era ends
        vm.warp(genesisTimestamp + TEST_CALCULATION_INTERVAL + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(true, false, false, true);
        emit IDataHavenServiceManagerEvents.EraRewardsSubmitted(0, rewardAmount, 1);
        serviceManager.submitRewards(0, rewards);

        // Verify era is marked as processed
        assertTrue(serviceManager.isEraProcessed(0));
    }

    function test_submitRewards_multipleOperators() public {
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

        // Warp to a time after the era ends
        vm.warp(genesisTimestamp + TEST_CALCULATION_INTERVAL + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(true, false, false, true);
        emit IDataHavenServiceManagerEvents.EraRewardsSubmitted(0, totalAmount, 2);
        serviceManager.submitRewards(0, rewards);

        assertTrue(serviceManager.isEraProcessed(0));
    }

    function test_submitRewards_multipleEras() public {
        IRewardsCoordinatorTypes.OperatorReward[] memory rewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        rewards[0] = IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        // Submit era 0
        vm.warp(genesisTimestamp + TEST_CALCULATION_INTERVAL + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(0, rewards);
        assertTrue(serviceManager.isEraProcessed(0));

        // Submit era 1
        vm.warp(genesisTimestamp + 2 * TEST_CALCULATION_INTERVAL + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(1, rewards);
        assertTrue(serviceManager.isEraProcessed(1));

        // Submit era 2
        vm.warp(genesisTimestamp + 3 * TEST_CALCULATION_INTERVAL + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(2, rewards);
        assertTrue(serviceManager.isEraProcessed(2));
    }

    // ============ View Function Tests ============

    function test_isEraProcessed_returnsFalseForUnprocessedEra() public view {
        assertFalse(serviceManager.isEraProcessed(0));
        assertFalse(serviceManager.isEraProcessed(100));
    }

    function test_getStrategyMultipliers() public view {
        (IStrategy[] memory strategies, uint96[] memory multipliers) =
            serviceManager.getStrategyMultipliers();

        assertEq(strategies.length, deployedStrategies.length);
        assertEq(multipliers.length, deployedStrategies.length);
    }
}

