// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";
import {
    IDataHavenServiceManagerErrors,
    IDataHavenServiceManagerEvents
} from "../src/interfaces/IDataHavenServiceManager.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

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
                || testSelector == this.test_fuzz_sendNewValidatorSetForEra.selector
                || testSelector
                    == this.test_buildNewValidatorSetMessageForEra_exactEncoding.selector
        ) {
            beforeTestCalldata = new bytes[](1);
            beforeTestCalldata[0] = abi.encodeWithSelector(this.setupValidatorsAsOperators.selector);
        }
    }

    // ============ setValidatorSetSubmitter ============

    function test_setValidatorSetSubmitter() public {
        // After initialization, validatorSetSubmitter is already set to avsOwner
        assertEq(
            serviceManager.validatorSetSubmitter(),
            avsOwner,
            "validatorSetSubmitter should be set to avsOwner after init"
        );

        cheats.expectEmit();
        emit IDataHavenServiceManagerEvents.ValidatorSetSubmitterUpdated(avsOwner, submitterA);
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
        // Set submitter A (rotating from avsOwner set during init)
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

    function test_sendNewValidatorSetForEra_revertsOnEmptyValidatorSet() public {
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

        vm.deal(submitterA, 10 ether);
        cheats.prank(submitterA);
        cheats.expectRevert(
            abi.encodeWithSelector(IDataHavenServiceManagerErrors.EmptyValidatorSet.selector)
        );
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(1, 1 ether, 1 ether);
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

    function test_sendNewValidatorSetForEra_revertsWhenSubmitterIsZeroAddress() public {
        // Deploy a fresh proxy with address(0) as the submitter
        IStrategy[] memory emptyStrategies = new IStrategy[](0);

        cheats.startPrank(regularDeployer);
        DataHavenServiceManager zeroSubmitterSM = DataHavenServiceManager(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        DataHavenServiceManager.initialize.selector,
                        avsOwner,
                        rewardsInitiator,
                        emptyStrategies,
                        address(snowbridgeGatewayMock),
                        address(0)
                    )
                )
            )
        );
        cheats.stopPrank();

        assertEq(
            zeroSubmitterSM.validatorSetSubmitter(),
            address(0),
            "validatorSetSubmitter should be address(0)"
        );

        vm.deal(submitterA, 10 ether);
        cheats.prank(submitterA);
        cheats.expectRevert(
            abi.encodeWithSelector(
                IDataHavenServiceManagerErrors.OnlyValidatorSetSubmitter.selector
            )
        );
        zeroSubmitterSM.sendNewValidatorSetForEra{value: 2 ether}(1, 1 ether, 1 ether);
    }

    function test_fuzz_sendNewValidatorSetForEra(
        uint64 targetEra
    ) public {
        cheats.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitterA);

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

    function test_buildNewValidatorSetMessageForEra_exactEncoding() public view {
        uint64 targetEra = 42;
        bytes memory message = serviceManager.buildNewValidatorSetMessageForEra(targetEra);

        // Total: 4 (EL_MESSAGE_ID) + 1 (V0) + 1 (ReceiveValidators)
        //      + 1 (compact 10) + 10*20 (validators) + 8 (era) = 215
        assertEq(message.length, 215, "Message length should be 215 bytes");

        // First 4 bytes: EL_MESSAGE_ID = 0x70150038
        assertEq(uint8(message[0]), 0x70, "EL_MESSAGE_ID byte 0");
        assertEq(uint8(message[1]), 0x15, "EL_MESSAGE_ID byte 1");
        assertEq(uint8(message[2]), 0x00, "EL_MESSAGE_ID byte 2");
        assertEq(uint8(message[3]), 0x38, "EL_MESSAGE_ID byte 3");

        // Byte 4: V0 = 0x00
        assertEq(uint8(message[4]), 0x00, "V0 byte mismatch");

        // Byte 5: ReceiveValidators = 0x00
        assertEq(uint8(message[5]), 0x00, "ReceiveValidators byte mismatch");

        // Byte 6: SCALE compact encoding of 10 validators = 10 << 2 = 40 = 0x28
        assertEq(uint8(message[6]), 0x28, "Compact encoding of 10 validators");

        // Last 8 bytes: era 42 in SCALE little-endian = 0x2A00000000000000
        assertEq(uint8(message[207]), 0x2A, "Era LE byte 0");
        assertEq(uint8(message[208]), 0x00, "Era LE byte 1");
        assertEq(uint8(message[209]), 0x00, "Era LE byte 2");
        assertEq(uint8(message[210]), 0x00, "Era LE byte 3");
        assertEq(uint8(message[211]), 0x00, "Era LE byte 4");
        assertEq(uint8(message[212]), 0x00, "Era LE byte 5");
        assertEq(uint8(message[213]), 0x00, "Era LE byte 6");
        assertEq(uint8(message[214]), 0x00, "Era LE byte 7");
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
