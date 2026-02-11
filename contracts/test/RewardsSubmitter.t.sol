// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {ERC20FixedSupply} from "./utils/ERC20FixedSupply.sol";
import {IDataHavenServiceManagerEvents} from "../src/interfaces/IDataHavenServiceManager.sol";

contract RewardsSubmitterTest is AVSDeployer {
    using SafeERC20 for IERC20;

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

        // Configure the rewards initiator
        vm.prank(avsOwner);
        serviceManager.setRewardsInitiator(snowbridgeAgent);

        // Fund the service manager with reward tokens
        IERC20(address(rewardToken)).safeTransfer(address(serviceManager), 100000e18);
    }

    function _registerOperator(
        address ethOperator,
        address solochainOperator
    ) internal {
        // Allow our operator to register
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(ethOperator);

        vm.prank(ethOperator);
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(solochainOperator)
            });

        vm.prank(ethOperator);
        allocationManager.registerForOperatorSets(ethOperator, registerParams);
    }

    // Helper function to build a submission
    function _buildSubmission(
        uint256 rewardAmount,
        address operator
    ) internal view returns (IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory) {
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategiesAndMultipliers[i] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
                strategy: deployedStrategies[i], multiplier: uint96((i + 1) * 1e18)
            });
        }

        IRewardsCoordinatorTypes.OperatorReward[] memory operatorRewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        operatorRewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator, amount: rewardAmount});

        return IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
            strategiesAndMultipliers: strategiesAndMultipliers,
            token: IERC20(address(rewardToken)),
            operatorRewards: operatorRewards,
            startTimestamp: GENESIS_REWARDS_TIMESTAMP,
            duration: TEST_CALCULATION_INTERVAL,
            description: "DataHaven rewards"
        });
    }

    // ============ Configuration Tests ============

    function test_setRewardsInitiator() public {
        address newInitiator = address(0x123);

        vm.prank(avsOwner);
        vm.expectEmit(true, true, false, false);
        emit IDataHavenServiceManagerEvents.RewardsInitiatorSet(snowbridgeAgent, newInitiator);
        serviceManager.setRewardsInitiator(newInitiator);

        assertEq(serviceManager.rewardsInitiator(), newInitiator);
    }

    function test_setRewardsInitiator_revertsIfNotOwner() public {
        vm.prank(operator1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.setRewardsInitiator(address(0x123));
    }

    // ============ Access Control Tests ============

    function test_submitRewards_revertsIfNotRewardsInitiator() public {
        _registerOperator(operator1, operator1);
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            _buildSubmission(1000e18, operator1);

        vm.prank(operator1);
        vm.expectRevert(abi.encodeWithSignature("OnlyRewardsInitiator()"));
        serviceManager.submitRewards(submission);
    }

    // ============ Success Tests ============

    function test_submitRewards_singleOperator() public {
        _registerOperator(operator1, operator1);
        uint256 rewardAmount = 1000e18;
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            _buildSubmission(rewardAmount, operator1);

        // Warp to a time after the period ends
        vm.warp(submission.startTimestamp + submission.duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(rewardAmount, 1);
        serviceManager.submitRewards(submission);
    }

    function test_submitRewards_multipleOperators() public {
        _registerOperator(operator1, operator1);
        _registerOperator(operator2, operator2);

        // Build strategies
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategiesAndMultipliers[i] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
                strategy: deployedStrategies[i], multiplier: uint96((i + 1) * 1e18)
            });
        }

        // Ensure operators are sorted in ascending order (required by EigenLayer)
        (address opLow, address opHigh) =
            operator1 < operator2 ? (operator1, operator2) : (operator2, operator1);

        uint256 amount1 = 600e18;
        uint256 amount2 = 400e18;
        uint256 totalAmount = amount1 + amount2;

        IRewardsCoordinatorTypes.OperatorReward[] memory operatorRewards =
            new IRewardsCoordinatorTypes.OperatorReward[](2);
        operatorRewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: opLow, amount: amount1});
        operatorRewards[1] =
            IRewardsCoordinatorTypes.OperatorReward({operator: opHigh, amount: amount2});

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
                strategiesAndMultipliers: strategiesAndMultipliers,
                token: IERC20(address(rewardToken)),
                operatorRewards: operatorRewards,
                startTimestamp: GENESIS_REWARDS_TIMESTAMP,
                duration: TEST_CALCULATION_INTERVAL,
                description: "DataHaven rewards"
            });

        // Warp to a time after the period ends
        vm.warp(submission.startTimestamp + submission.duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(totalAmount, 2);
        serviceManager.submitRewards(submission);
    }

    function test_submitRewards_multipleSubmissions() public {
        _registerOperator(operator1, operator1);
        uint32 duration = TEST_CALCULATION_INTERVAL;

        // Submit for period 0
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission0 =
            _buildSubmission(1000e18, operator1);
        submission0.startTimestamp = GENESIS_REWARDS_TIMESTAMP;
        vm.warp(submission0.startTimestamp + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(submission0);

        // Submit for period 1
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission1 =
            _buildSubmission(1000e18, operator1);
        submission1.startTimestamp = GENESIS_REWARDS_TIMESTAMP + duration;
        vm.warp(submission1.startTimestamp + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(submission1);

        // Submit for period 2
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission2 =
            _buildSubmission(1000e18, operator1);
        submission2.startTimestamp = GENESIS_REWARDS_TIMESTAMP + 2 * duration;
        vm.warp(submission2.startTimestamp + duration + 1);
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(submission2);
    }

    function test_submitRewards_withCustomDescription() public {
        _registerOperator(operator1, operator1);
        // Build submission with custom description
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](1);
        strategiesAndMultipliers[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: deployedStrategies[0], multiplier: 1e18
        });

        IRewardsCoordinatorTypes.OperatorReward[] memory operatorRewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        operatorRewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 1000e18});

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
                strategiesAndMultipliers: strategiesAndMultipliers,
                token: IERC20(address(rewardToken)),
                operatorRewards: operatorRewards,
                startTimestamp: GENESIS_REWARDS_TIMESTAMP,
                duration: TEST_CALCULATION_INTERVAL,
                description: "Era 42 validator rewards"
            });

        vm.warp(submission.startTimestamp + submission.duration + 1);

        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(submission);
    }

    function test_submitRewards_withDifferentToken() public {
        _registerOperator(operator1, operator1);
        // Deploy a different token
        ERC20FixedSupply otherToken =
            new ERC20FixedSupply("Other", "OTHER", 1000000e18, address(this));
        IERC20(address(otherToken)).safeTransfer(address(serviceManager), 100000e18);

        // Build submission with different token
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory strategiesAndMultipliers =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](1);
        strategiesAndMultipliers[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: deployedStrategies[0], multiplier: 1e18
        });

        IRewardsCoordinatorTypes.OperatorReward[] memory operatorRewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        operatorRewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: 500e18});

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
                strategiesAndMultipliers: strategiesAndMultipliers,
                token: IERC20(address(otherToken)),
                operatorRewards: operatorRewards,
                startTimestamp: GENESIS_REWARDS_TIMESTAMP,
                duration: TEST_CALCULATION_INTERVAL,
                description: "Bonus rewards in OTHER token"
            });

        vm.warp(submission.startTimestamp + submission.duration + 1);

        vm.prank(snowbridgeAgent);
        vm.expectEmit(false, false, false, true);
        emit IDataHavenServiceManagerEvents.RewardsSubmitted(500e18, 1);
        serviceManager.submitRewards(submission);
    }

    function test_submitRewards_translatesSolochainOperatorToEthOperator() public {
        address solochainOperator = address(0xBEEF);
        _registerOperator(operator1, solochainOperator);
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(operator1),
            solochainOperator,
            "forward mapping should be set"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(solochainOperator),
            operator1,
            "reverse mapping should be set"
        );

        uint256 rewardAmount = 1000e18;
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            _buildSubmission(rewardAmount, solochainOperator);

        // Warp to a time after the period ends
        vm.warp(submission.startTimestamp + submission.duration + 1);

        IRewardsCoordinatorTypes.OperatorReward[] memory expectedOperatorRewards =
            new IRewardsCoordinatorTypes.OperatorReward[](1);
        expectedOperatorRewards[0] =
            IRewardsCoordinatorTypes.OperatorReward({operator: operator1, amount: rewardAmount});

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory expectedSubmission =
            IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission({
                strategiesAndMultipliers: submission.strategiesAndMultipliers,
                token: submission.token,
                operatorRewards: expectedOperatorRewards,
                startTimestamp: submission.startTimestamp,
                duration: submission.duration,
                description: submission.description
            });

        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[] memory submissions =
            new IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[](1);
        submissions[0] = expectedSubmission;

        OperatorSet memory operatorSet =
            OperatorSet({avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()});
        vm.expectCall(
            address(rewardsCoordinator),
            abi.encodeCall(
                IRewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission,
                (operatorSet, submissions)
            )
        );

        assertEq(
            submission.operatorRewards[0].operator,
            solochainOperator,
            "submission should use solochain operator"
        );
        vm.prank(snowbridgeAgent);
        serviceManager.submitRewards(submission);
    }

    function test_submitRewards_revertsIfUnknownSolochainAddress() public {
        address unknownSolochainOperator = address(0xDEAD);
        IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission memory submission =
            _buildSubmission(1000e18, unknownSolochainOperator);

        vm.prank(snowbridgeAgent);
        vm.expectRevert(abi.encodeWithSignature("UnknownSolochainAddress()"));
        serviceManager.submitRewards(submission);
    }
}
