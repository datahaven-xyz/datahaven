// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

/* solhint-disable func-name-mixedcase */

import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";
import {DataHavenSnowbridgeMessages} from "../src/libraries/DataHavenSnowbridgeMessages.sol";
import {IDataHavenServiceManagerErrors} from "../src/interfaces/IDataHavenServiceManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ValidatorSetSelectionTest is SnowbridgeAndAVSDeployer {
    function setUp() public {
        _deployMockAllContracts();
    }

    // ============ Helpers ============

    function _getStrategies() internal view returns (IStrategy[] memory) {
        IStrategy[] memory strategies = new IStrategy[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategies[i] = deployedStrategies[i];
        }
        return strategies;
    }

    function _setupMultipliers(
        uint96[] memory multipliers
    ) internal {
        IStrategy[] memory strategies = _getStrategies();

        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory sm =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](strategies.length);
        for (uint256 i = 0; i < strategies.length; i++) {
            sm[i] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
                strategy: strategies[i], multiplier: multipliers[i]
            });
        }

        cheats.startPrank(avsOwner);
        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
        serviceManager.addStrategiesToValidatorsSupportedStrategies(sm);
        cheats.stopPrank();
    }

    function _uniformMultipliers() internal pure returns (uint96[] memory) {
        uint96[] memory m = new uint96[](3);
        m[0] = 1;
        m[1] = 1;
        m[2] = 1;
        return m;
    }

    function _registerOperator(
        address op,
        address solochainAddr,
        uint256[] memory stakeAmounts
    ) internal {
        cheats.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(op);

        cheats.startPrank(op);
        for (uint256 j = 0; j < deployedStrategies.length; j++) {
            IERC20 linkedToken = deployedStrategies[j].underlyingToken();
            _setERC20Balance(address(linkedToken), op, stakeAmounts[j]);
            linkedToken.approve(address(strategyManager), stakeAmounts[j]);
            strategyManager.depositIntoStrategy(deployedStrategies[j], linkedToken, stakeAmounts[j]);
        }
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(solochainAddr)
            });
        allocationManager.registerForOperatorSets(op, registerParams);
        cheats.stopPrank();
    }

    function _uniformStakes(
        uint256 amount
    ) internal view returns (uint256[] memory) {
        uint256[] memory stakes = new uint256[](deployedStrategies.length);
        for (uint256 j = 0; j < stakes.length; j++) {
            stakes[j] = amount;
        }
        return stakes;
    }

    function _allocateForOperator(
        address op
    ) internal {
        IStrategy[] memory strategies = _getStrategies();
        uint64[] memory newMagnitudes = new uint64[](strategies.length);
        for (uint256 j = 0; j < strategies.length; j++) {
            newMagnitudes[j] = 1e18;
        }

        IAllocationManagerTypes.AllocateParams[] memory allocParams =
            new IAllocationManagerTypes.AllocateParams[](1);
        allocParams[0] = IAllocationManagerTypes.AllocateParams({
            operatorSet: OperatorSet({
                avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()
            }),
            strategies: strategies,
            newMagnitudes: newMagnitudes
        });

        cheats.prank(op);
        allocationManager.modifyAllocations(op, allocParams);
    }

    function _advancePastAllocationConfigDelay() internal {
        uint32 delay = allocationManager.ALLOCATION_CONFIGURATION_DELAY();
        cheats.roll(block.number + delay + 1);
    }

    function _advancePastAllocationEffect() internal {
        cheats.roll(block.number + 1);
    }

    function _buildExpectedMessage(
        address[] memory validators
    ) internal pure returns (bytes memory) {
        return DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessagePayload(
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: validators})
        );
    }

    // ============ Admin Function Tests ============

    // Test #7: Add strategy + multiplier in one call; verify both stored
    function test_addStrategies_setsMultiplierAtomically() public {
        IStrategy[] memory strategies = _getStrategies();

        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory sm =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](3);
        sm[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[0], multiplier: 5000
        });
        sm[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[1], multiplier: 10000
        });
        sm[2] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[2], multiplier: 2000
        });

        cheats.startPrank(avsOwner);
        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
        serviceManager.addStrategiesToValidatorsSupportedStrategies(sm);
        cheats.stopPrank();

        assertEq(serviceManager.strategiesAndMultipliers(strategies[0]), 5000);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[1]), 10000);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[2]), 2000);
    }

    // Test #9: Remove strategy → multiplier and tracking bool deleted
    function test_removeStrategies_cleansUpMultiplier() public {
        IStrategy[] memory strategies = _getStrategies();

        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory sm =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](3);
        sm[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[0], multiplier: 5000
        });
        sm[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[1], multiplier: 10000
        });
        sm[2] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[2], multiplier: 2000
        });

        cheats.startPrank(avsOwner);
        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
        serviceManager.addStrategiesToValidatorsSupportedStrategies(sm);

        assertEq(serviceManager.strategiesAndMultipliers(strategies[1]), 10000);

        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
        cheats.stopPrank();

        assertEq(serviceManager.strategiesAndMultipliers(strategies[0]), 0);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[1]), 0);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[2]), 0);
    }

    // Test #11: Returns correct StrategyAndMultiplier structs
    function test_getStrategiesAndMultipliers_returnsCorrect() public {
        IStrategy[] memory strategies = _getStrategies();

        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory sm =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](3);
        sm[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[0], multiplier: 5000
        });
        sm[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[1], multiplier: 10000
        });
        sm[2] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[2], multiplier: 2000
        });

        cheats.startPrank(avsOwner);
        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
        serviceManager.addStrategiesToValidatorsSupportedStrategies(sm);
        cheats.stopPrank();

        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory result =
            serviceManager.getStrategiesAndMultipliers();

        assertEq(result.length, 3);
        for (uint256 i = 0; i < result.length; i++) {
            uint96 expectedMultiplier = serviceManager.strategiesAndMultipliers(result[i].strategy);
            assertEq(result[i].multiplier, expectedMultiplier);
        }
    }

    // Test: setStrategiesAndMultipliers updates existing multipliers
    function test_setStrategiesAndMultipliers_updatesMultipliers() public {
        IStrategy[] memory strategies = _getStrategies();

        // Set initial multipliers via _setupMultipliers
        uint96[] memory initial = new uint96[](3);
        initial[0] = 5000;
        initial[1] = 10000;
        initial[2] = 2000;
        _setupMultipliers(initial);

        // Update multipliers
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory updated =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](3);
        updated[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[0], multiplier: 1
        });
        updated[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[1], multiplier: 1
        });
        updated[2] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[2], multiplier: 9999
        });

        cheats.prank(avsOwner);
        serviceManager.setStrategiesAndMultipliers(updated);

        assertEq(serviceManager.strategiesAndMultipliers(strategies[0]), 1);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[1]), 1);
        assertEq(serviceManager.strategiesAndMultipliers(strategies[2]), 9999);
    }

    // Test: setStrategiesAndMultipliers changes validator ranking
    function test_setStrategiesAndMultipliers_affectsRanking() public {
        uint96[] memory mults = new uint96[](3);
        mults[0] = 10000;
        mults[1] = 1;
        mults[2] = 1;
        _setupMultipliers(mults);

        // Op A: heavy in strategy 0 (high multiplier) → initially ranked first
        address opA = vm.addr(801);
        address solochainA = address(uint160(0x6001));
        uint256[] memory stakesA = new uint256[](3);
        stakesA[0] = 1000 ether;
        stakesA[1] = 10 ether;
        stakesA[2] = 10 ether;
        _registerOperator(opA, solochainA, stakesA);

        // Op B: heavy in strategy 1 (low multiplier) → initially ranked second
        address opB = vm.addr(802);
        address solochainB = address(uint160(0x6002));
        uint256[] memory stakesB = new uint256[](3);
        stakesB[0] = 10 ether;
        stakesB[1] = 1000 ether;
        stakesB[2] = 10 ether;
        _registerOperator(opB, solochainB, stakesB);

        _advancePastAllocationConfigDelay();
        _allocateForOperator(opA);
        _allocateForOperator(opB);
        _advancePastAllocationEffect();

        // Before update: A ranks first (strategy 0 has multiplier 10_000)
        address[] memory expectedBefore = new address[](2);
        expectedBefore[0] = solochainA;
        expectedBefore[1] = solochainB;
        assertEq(
            serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expectedBefore)
        );

        // Flip multipliers: strategy 1 now has high multiplier
        IStrategy[] memory strategies = _getStrategies();
        IRewardsCoordinatorTypes.StrategyAndMultiplier[] memory flipped =
            new IRewardsCoordinatorTypes.StrategyAndMultiplier[](3);
        flipped[0] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[0], multiplier: 1
        });
        flipped[1] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[1], multiplier: 10000
        });
        flipped[2] = IRewardsCoordinatorTypes.StrategyAndMultiplier({
            strategy: strategies[2], multiplier: 1
        });

        cheats.prank(avsOwner);
        serviceManager.setStrategiesAndMultipliers(flipped);

        // After update: B ranks first (strategy 1 now has multiplier 10_000)
        address[] memory expectedAfter = new address[](2);
        expectedAfter[0] = solochainB;
        expectedAfter[1] = solochainA;
        assertEq(serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expectedAfter));
    }

    // ============ Selection Tests ============

    // Test #1: 3 strategies with different multipliers; verify correct ordering
    function test_weightedStake_multipleStrategies() public {
        uint96[] memory mults = new uint96[](3);
        mults[0] = 5000;
        mults[1] = 10000;
        mults[2] = 2000;
        _setupMultipliers(mults);

        // Op A: heavy in strategy 0 (multiplier 5000)
        address opA = vm.addr(101);
        address solochainA = address(uint160(0xA01));
        uint256[] memory stakesA = new uint256[](3);
        stakesA[0] = 1000 ether;
        stakesA[1] = 100 ether;
        stakesA[2] = 100 ether;
        _registerOperator(opA, solochainA, stakesA);

        // Op B: heavy in strategy 1 (multiplier 10000) → highest weighted stake
        address opB = vm.addr(102);
        address solochainB = address(uint160(0xB01));
        uint256[] memory stakesB = new uint256[](3);
        stakesB[0] = 100 ether;
        stakesB[1] = 1000 ether;
        stakesB[2] = 100 ether;
        _registerOperator(opB, solochainB, stakesB);

        // Op C: heavy in strategy 2 (multiplier 2000) → lowest weighted stake
        address opC = vm.addr(103);
        address solochainC = address(uint160(0xC01));
        uint256[] memory stakesC = new uint256[](3);
        stakesC[0] = 100 ether;
        stakesC[1] = 100 ether;
        stakesC[2] = 1000 ether;
        _registerOperator(opC, solochainC, stakesC);

        _advancePastAllocationConfigDelay();

        _allocateForOperator(opA);
        _allocateForOperator(opB);
        _allocateForOperator(opC);

        _advancePastAllocationEffect();

        // Expected order: B (highest multiplied strategy), A, C
        address[] memory expected = new address[](3);
        expected[0] = solochainB;
        expected[1] = solochainA;
        expected[2] = solochainC;

        assertEq(serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expected));
    }

    // Test #2: 2 operators with identical weighted stake; lower Eth address ranks first
    function test_tieBreak_lowerAddressWins() public {
        _setupMultipliers(_uniformMultipliers());

        address addrA = vm.addr(201);
        address addrB = vm.addr(202);

        // Ensure addrLow < addrHigh
        address addrLow = addrA < addrB ? addrA : addrB;
        address addrHigh = addrA < addrB ? addrB : addrA;

        address solochainLow = address(uint160(0xBB));
        address solochainHigh = address(uint160(0xAA));

        _registerOperator(addrLow, solochainLow, _uniformStakes(500 ether));
        _registerOperator(addrHigh, solochainHigh, _uniformStakes(500 ether));

        _advancePastAllocationConfigDelay();

        _allocateForOperator(addrLow);
        _allocateForOperator(addrHigh);

        _advancePastAllocationEffect();

        // Lower Eth address wins tie-break
        address[] memory expected = new address[](2);
        expected[0] = solochainLow;
        expected[1] = solochainHigh;

        assertEq(serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expected));
    }

    // Test #3: Register 35 operators; verify only top 32 selected
    function test_topN_moreThan32() public {
        _setupMultipliers(_uniformMultipliers());

        uint256 totalOps = 35;
        address[] memory operators = new address[](totalOps);
        address[] memory solochainAddrs = new address[](totalOps);

        for (uint256 i = 0; i < totalOps; i++) {
            operators[i] = vm.addr(300 + i);
            solochainAddrs[i] = address(uint160(0x1000 + i));
            _registerOperator(operators[i], solochainAddrs[i], _uniformStakes((i + 1) * 10 ether));
        }

        _advancePastAllocationConfigDelay();

        for (uint256 i = 0; i < totalOps; i++) {
            _allocateForOperator(operators[i]);
        }

        _advancePastAllocationEffect();

        bytes memory message = serviceManager.buildNewValidatorSetMessage();

        // Top 32 by descending stake: operators at indices 34, 33, ..., 3
        address[] memory expected = new address[](32);
        for (uint256 i = 0; i < 32; i++) {
            expected[i] = solochainAddrs[totalOps - 1 - i];
        }

        assertEq(message, _buildExpectedMessage(expected));
    }

    // Test #4: 5 operators; all included in output
    function test_lessThan32_includesAll() public {
        _setupMultipliers(_uniformMultipliers());

        uint256 totalOps = 5;
        address[] memory operators = new address[](totalOps);
        address[] memory solochainAddrs = new address[](totalOps);

        for (uint256 i = 0; i < totalOps; i++) {
            operators[i] = vm.addr(400 + i);
            solochainAddrs[i] = address(uint160(0x2000 + i));
            _registerOperator(operators[i], solochainAddrs[i], _uniformStakes((i + 1) * 100 ether));
        }

        _advancePastAllocationConfigDelay();

        for (uint256 i = 0; i < totalOps; i++) {
            _allocateForOperator(operators[i]);
        }

        _advancePastAllocationEffect();

        // All 5 included, sorted by descending stake
        address[] memory expected = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            expected[i] = solochainAddrs[totalOps - 1 - i];
        }

        assertEq(serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expected));
    }

    // Test #5: Operator with zero allocation excluded
    function test_zeroWeightedStake_filtered() public {
        _setupMultipliers(_uniformMultipliers());

        address op1 = vm.addr(501);
        address solochain1 = address(uint160(0x3001));
        _registerOperator(op1, solochain1, _uniformStakes(100 ether));

        address op2 = vm.addr(502);
        address solochain2 = address(uint160(0x3002));
        _registerOperator(op2, solochain2, _uniformStakes(200 ether));

        // op3 registered but NOT allocated → zero weighted stake
        address op3 = vm.addr(503);
        address solochain3 = address(uint160(0x3003));
        _registerOperator(op3, solochain3, _uniformStakes(300 ether));

        _advancePastAllocationConfigDelay();

        // Only allocate for op1 and op2
        _allocateForOperator(op1);
        _allocateForOperator(op2);

        _advancePastAllocationEffect();

        // op3 should be filtered out
        address[] memory expected = new address[](2);
        expected[0] = solochain2;
        expected[1] = solochain1;

        assertEq(serviceManager.buildNewValidatorSetMessage(), _buildExpectedMessage(expected));
    }

    // Test #6: Strategy without multiplier is treated as zero and filtered out
    function test_missingMultiplier_treatedAsZero() public {
        // After deploy, strategies added via initialize have no multipliers.
        // Register and allocate an operator so stake is non-zero before multiplier weighting.
        address op = vm.addr(601);
        address solochain = address(uint160(0x4001));
        _registerOperator(op, solochain, _uniformStakes(100 ether));

        _advancePastAllocationConfigDelay();
        _allocateForOperator(op);
        _advancePastAllocationEffect();

        // Missing multiplier entries map to zero, so weighted stake is zero and no candidate remains.
        vm.expectRevert(IDataHavenServiceManagerErrors.EmptyValidatorSet.selector);
        serviceManager.buildNewValidatorSetMessage();
    }

    // Test #12: Full integration — weighted selection + correct message encoding
    function test_buildMessage_encodesCorrectly() public {
        _setupMultipliers(_uniformMultipliers());

        address op1 = vm.addr(701);
        address solochain1 = address(uint160(0x5001));
        _registerOperator(op1, solochain1, _uniformStakes(500 ether));

        address op2 = vm.addr(702);
        address solochain2 = address(uint160(0x5002));
        _registerOperator(op2, solochain2, _uniformStakes(1000 ether));

        _advancePastAllocationConfigDelay();

        _allocateForOperator(op1);
        _allocateForOperator(op2);

        _advancePastAllocationEffect();

        bytes memory message = serviceManager.buildNewValidatorSetMessage();

        // op2 has higher stake → first
        address[] memory expected = new address[](2);
        expected[0] = solochain2;
        expected[1] = solochain1;

        assertEq(message, _buildExpectedMessage(expected));
    }
}
