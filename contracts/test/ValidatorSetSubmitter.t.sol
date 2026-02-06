// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";
import {
    IDataHavenServiceManagerErrors,
    IDataHavenServiceManagerEvents
} from "../src/interfaces/IDataHavenServiceManager.sol";

contract ValidatorSetSubmitterTest is SnowbridgeAndAVSDeployer {
    address public submitterA = address(uint160(uint256(keccak256("submitterA"))));
    address public submitterB = address(uint160(uint256(keccak256("submitterB"))));
    address public nonOwner = address(uint160(uint256(keccak256("nonOwner"))));

    function setUp() public {
        _deployMockAllContracts();
    }

    function beforeTestSetup(
        bytes4 testSelector
    ) public pure returns (bytes[] memory beforeTestCalldata) {
        if (
            testSelector == this.test_sendNewValidatorSetForEra_success.selector
                || testSelector
                    == this.test_buildNewValidatorSetMessageForEra_encodesTargetEra.selector
        ) {
            beforeTestCalldata = new bytes[](1);
            beforeTestCalldata[0] = abi.encodeWithSelector(this.setupValidatorsAsOperators.selector);
        }
    }

    // ============ setValidatorSetSubmitter ============

    function test_setValidatorSetSubmitter() public {
        cheats.expectEmit();
        emit IDataHavenServiceManagerEvents.ValidatorSetSubmitterUpdated(address(0), submitterA);
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

        assertEq(
            serviceManager.validatorSetSubmitter(),
            submitterA,
            "validatorSetSubmitter should be set"
        );
    }

    function test_setValidatorSetSubmitter_revertsIfNotOwner() public {
        cheats.prank(nonOwner);
        cheats.expectRevert();
        serviceManager.setValidatorSetSubmitter(submitterA);
    }

    function test_setValidatorSetSubmitter_revertsOnZeroAddress() public {
        cheats.prank(avsOwner);
        cheats.expectRevert(
            abi.encodeWithSelector(IDataHavenServiceManagerErrors.ZeroAddress.selector)
        );
        serviceManager.setValidatorSetSubmitter(address(0));
    }

    function test_setValidatorSetSubmitter_rotation() public {
        // Set submitter A
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);
        assertEq(serviceManager.validatorSetSubmitter(), submitterA);

        // Rotate to submitter B
        cheats.expectEmit();
        emit IDataHavenServiceManagerEvents.ValidatorSetSubmitterUpdated(submitterA, submitterB);
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterB);
        assertEq(serviceManager.validatorSetSubmitter(), submitterB);

        // Old submitter A can no longer submit
        vm.deal(submitterA, 10 ether);
        cheats.prank(submitterA);
        cheats.expectRevert(
            abi.encodeWithSelector(
                IDataHavenServiceManagerErrors.OnlyValidatorSetSubmitter.selector
            )
        );
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(1, 1 ether, 1 ether);
    }

    // ============ sendNewValidatorSetForEra ============

    function test_sendNewValidatorSetForEra_revertsIfNotSubmitter() public {
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

        vm.deal(nonOwner, 10 ether);
        cheats.prank(nonOwner);
        cheats.expectRevert(
            abi.encodeWithSelector(
                IDataHavenServiceManagerErrors.OnlyValidatorSetSubmitter.selector
            )
        );
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(1, 1 ether, 1 ether);
    }

    function test_sendNewValidatorSetForEra_success() public {
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

        uint64 targetEra = 42;
        vm.deal(submitterA, 1000000 ether);

        bytes memory message = serviceManager.buildNewValidatorSetMessageForEra(targetEra);
        bytes32 expectedHash = keccak256(message);

        cheats.expectEmit();
        emit IDataHavenServiceManagerEvents.ValidatorSetMessageSubmitted(
            targetEra, expectedHash, submitterA
        );
        cheats.prank(submitterA);
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(targetEra, 1 ether, 1 ether);
    }

    function test_ownerCannotCallSendNewValidatorSetForEra() public {
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

        vm.deal(avsOwner, 10 ether);
        cheats.prank(avsOwner);
        cheats.expectRevert(
            abi.encodeWithSelector(
                IDataHavenServiceManagerErrors.OnlyValidatorSetSubmitter.selector
            )
        );
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(1, 1 ether, 1 ether);
    }

    // ============ buildNewValidatorSetMessageForEra ============

    function test_buildNewValidatorSetMessageForEra_encodesTargetEra() public view {
        bytes memory messageEra1 = serviceManager.buildNewValidatorSetMessageForEra(1);
        bytes memory messageEra2 = serviceManager.buildNewValidatorSetMessageForEra(2);
        bytes memory messageEra100 = serviceManager.buildNewValidatorSetMessageForEra(100);

        // Different era values must produce different encoded output
        assertTrue(
            keccak256(messageEra1) != keccak256(messageEra2),
            "Messages for different eras should differ"
        );
        assertTrue(
            keccak256(messageEra1) != keccak256(messageEra100),
            "Messages for different eras should differ"
        );
    }

    // ============ Legacy function removed ============

    function test_legacySendNewValidatorSet_removed() public {
        // The old sendNewValidatorSet(uint128,uint128) selector should not be callable
        bytes memory callData =
            abi.encodeWithSelector(bytes4(keccak256("sendNewValidatorSet(uint128,uint128)")), 1, 1);
        vm.deal(avsOwner, 10 ether);
        cheats.prank(avsOwner);
        (bool success,) = address(serviceManager).call{value: 2 ether}(callData);
        assertFalse(success, "Legacy sendNewValidatorSet should not be callable");
    }
}
