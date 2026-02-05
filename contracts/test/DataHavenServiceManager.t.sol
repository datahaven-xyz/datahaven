// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

/* solhint-disable func-name-mixedcase */

import {Test, console} from "forge-std/Test.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {
    IDataHavenServiceManager,
    IDataHavenServiceManagerEvents,
    IDataHavenServiceManagerErrors
} from "../src/interfaces/IDataHavenServiceManager.sol";

/**
 * @title DataHavenServiceManager Unit Tests
 * @notice Comprehensive unit tests for DataHavenServiceManager contract
 * @dev Tests operator registration/deregistration, allowlist management, strategy management,
 *      and AVS management functions
 */
contract DataHavenServiceManagerTest is SnowbridgeAndAVSDeployer {
    // Test addresses
    address public testOperator = address(uint160(uint256(keccak256("testOperator"))));
    address public testOperator2 = address(uint160(uint256(keccak256("testOperator2"))));
    address public randomUser = address(uint160(uint256(keccak256("randomUser"))));

    // Test solochain address (20 bytes)
    address public testSolochainAddress = address(uint160(uint256(keccak256("solochainAddress"))));

    function setUp() public {
        _deployMockAllContracts();
    }

    // ============ supportsAVS Tests ============

    function test_supportsAVS_returnsTrue_forSelf() public view {
        bool result = serviceManager.supportsAVS(address(serviceManager));
        assertTrue(result, "Should support self as AVS");
    }

    function test_supportsAVS_returnsFalse_forOther() public view {
        bool result = serviceManager.supportsAVS(address(0x1234));
        assertFalse(result, "Should not support other addresses");
    }

    // ============ Validator Allowlist Tests ============

    function test_addValidatorToAllowlist_success() public {
        assertFalse(
            serviceManager.validatorsAllowlist(testOperator),
            "Operator should not be in allowlist initially"
        );

        vm.prank(avsOwner);
        vm.expectEmit(true, false, false, false);
        emit IDataHavenServiceManagerEvents.ValidatorAddedToAllowlist(testOperator);
        serviceManager.addValidatorToAllowlist(testOperator);

        assertTrue(
            serviceManager.validatorsAllowlist(testOperator),
            "Operator should be in allowlist after adding"
        );
    }

    function test_addValidatorToAllowlist_revertsIfNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.addValidatorToAllowlist(testOperator);
    }

    function test_removeValidatorFromAllowlist_success() public {
        // First add the validator
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(testOperator);
        assertTrue(
            serviceManager.validatorsAllowlist(testOperator), "Operator should be in allowlist"
        );

        // Now remove
        vm.prank(avsOwner);
        vm.expectEmit(true, false, false, false);
        emit IDataHavenServiceManagerEvents.ValidatorRemovedFromAllowlist(testOperator);
        serviceManager.removeValidatorFromAllowlist(testOperator);

        assertFalse(
            serviceManager.validatorsAllowlist(testOperator),
            "Operator should not be in allowlist after removal"
        );
    }

    function test_removeValidatorFromAllowlist_revertsIfNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.removeValidatorFromAllowlist(testOperator);
    }

    // ============ Operator Registration Tests (IAVSRegistrar) ============

    function test_registerOperator_revertsIfNotAllocationManager() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSignature("OnlyAllocationManager()"));
        serviceManager.registerOperator(testOperator, address(serviceManager), operatorSetIds, data);
    }

    function test_registerOperator_revertsIfIncorrectAVSAddress() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("IncorrectAVSAddress()"));
        serviceManager.registerOperator(testOperator, address(0x1234), operatorSetIds, data);
    }

    function test_registerOperator_revertsIfMultipleOperatorSets() public {
        uint32[] memory operatorSetIds = new uint32[](2);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        operatorSetIds[1] = 1;
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("CantRegisterToMultipleOperatorSets()"));
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, data
        );
    }

    function test_registerOperator_revertsIfInvalidOperatorSetId() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = 999; // Invalid ID
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("InvalidOperatorSetId()"));
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, data
        );
    }

    function test_registerOperator_revertsIfNotInAllowlist() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory data = abi.encodePacked(testSolochainAddress);

        // Ensure operator is not in allowlist
        assertFalse(serviceManager.validatorsAllowlist(testOperator));

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("OperatorNotInAllowlist()"));
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, data
        );
    }

    function test_registerOperator_revertsIfInvalidSolochainAddressLength() public {
        // Add operator to allowlist first
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(testOperator);

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory invalidData = abi.encodePacked(uint256(123)); // 32 bytes, not 20

        vm.prank(address(allocationManager));
        vm.expectRevert("Invalid solochain address length");
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, invalidData
        );
    }

    function test_registerOperator_success() public {
        // Add operator to allowlist first
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(testOperator);

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(address(allocationManager));
        vm.expectEmit(true, true, false, false);
        emit IDataHavenServiceManagerEvents.OperatorRegistered(
            testOperator, serviceManager.VALIDATORS_SET_ID()
        );
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, data
        );

        // Verify solochain address was set
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(testOperator),
            testSolochainAddress,
            "Solochain address should be set after registration"
        );
    }

    // ============ Operator Deregistration Tests (IAVSRegistrar) ============

    function test_deregisterOperator_revertsIfNotAllocationManager() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSignature("OnlyAllocationManager()"));
        serviceManager.deregisterOperator(testOperator, address(serviceManager), operatorSetIds);
    }

    function test_deregisterOperator_revertsIfIncorrectAVSAddress() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("IncorrectAVSAddress()"));
        serviceManager.deregisterOperator(testOperator, address(0x1234), operatorSetIds);
    }

    function test_deregisterOperator_revertsIfMultipleOperatorSets() public {
        uint32[] memory operatorSetIds = new uint32[](2);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        operatorSetIds[1] = 1;

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("CantDeregisterFromMultipleOperatorSets()"));
        serviceManager.deregisterOperator(testOperator, address(serviceManager), operatorSetIds);
    }

    function test_deregisterOperator_revertsIfInvalidOperatorSetId() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = 999; // Invalid ID

        vm.prank(address(allocationManager));
        vm.expectRevert(abi.encodeWithSignature("InvalidOperatorSetId()"));
        serviceManager.deregisterOperator(testOperator, address(serviceManager), operatorSetIds);
    }

    function test_deregisterOperator_success() public {
        // First register the operator
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(testOperator);

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        bytes memory data = abi.encodePacked(testSolochainAddress);

        vm.prank(address(allocationManager));
        serviceManager.registerOperator(
            testOperator, address(serviceManager), operatorSetIds, data
        );

        // Verify registration
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(testOperator),
            testSolochainAddress
        );

        // Now deregister
        vm.prank(address(allocationManager));
        vm.expectEmit(true, true, false, false);
        emit IDataHavenServiceManagerEvents.OperatorDeregistered(
            testOperator, serviceManager.VALIDATORS_SET_ID()
        );
        serviceManager.deregisterOperator(testOperator, address(serviceManager), operatorSetIds);

        // Verify solochain address was cleared
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(testOperator),
            address(0),
            "Solochain address should be cleared after deregistration"
        );
    }

    // ============ Strategy Management Tests ============

    function test_validatorsSupportedStrategies_returnsCorrectStrategies() public view {
        IStrategy[] memory strategies = serviceManager.validatorsSupportedStrategies();
        assertEq(
            strategies.length,
            deployedStrategies.length,
            "Should return correct number of strategies"
        );
    }

    function test_addStrategiesToValidatorsSupportedStrategies_revertsIfNotOwner() public {
        IStrategy[] memory newStrategies = new IStrategy[](1);
        newStrategies[0] = IStrategy(address(0x1234));

        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.addStrategiesToValidatorsSupportedStrategies(newStrategies);
    }

    function test_removeStrategiesFromValidatorsSupportedStrategies_revertsIfNotOwner() public {
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = deployedStrategies[0];

        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.removeStrategiesFromValidatorsSupportedStrategies(strategies);
    }

    // ============ Snowbridge Gateway Tests ============

    function test_setSnowbridgeGateway_success() public {
        address newGateway = address(0x5678);

        vm.prank(avsOwner);
        vm.expectEmit(true, false, false, false);
        emit IDataHavenServiceManagerEvents.SnowbridgeGatewaySet(newGateway);
        serviceManager.setSnowbridgeGateway(newGateway);

        assertEq(serviceManager.snowbridgeGateway(), newGateway, "Gateway should be updated");
    }

    function test_setSnowbridgeGateway_revertsIfNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.setSnowbridgeGateway(address(0x5678));
    }

    function test_snowbridgeGateway_returnsCorrectAddress() public view {
        address gatewayAddress = serviceManager.snowbridgeGateway();
        assertEq(gatewayAddress, address(gateway), "Should return correct gateway address");
    }

    // ============ AVS Management Tests ============

    function test_updateAVSMetadataURI_revertsIfNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.updateAVSMetadataURI("https://new-metadata.com");
    }

    function test_updateAVSMetadataURI_success() public {
        string memory newURI = "https://new-metadata.datahaven.xyz/";

        vm.prank(avsOwner);
        // This should not revert - the AllocationManager will update the URI
        serviceManager.updateAVSMetadataURI(newURI);
    }

    function test_deregisterOperatorFromOperatorSets_revertsIfNotOwner() public {
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();

        vm.prank(randomUser);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        serviceManager.deregisterOperatorFromOperatorSets(testOperator, operatorSetIds);
    }

    // ============ Validator Functions Tests ============

    function test_updateSolochainAddressForValidator_revertsIfNotValidator() public {
        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSignature("CallerIsNotValidator()"));
        serviceManager.updateSolochainAddressForValidator(testSolochainAddress);
    }

    // ============ Build New Validator Set Message Tests ============

    function test_buildNewValidatorSetMessage_returnsEncodedMessage() public {
        // Setup some validators first
        setupValidatorsAsOperators();

        bytes memory message = serviceManager.buildNewValidatorSetMessage();
        assertTrue(message.length > 0, "Message should not be empty");

        // Verify message starts with the expected message ID (0x70150038)
        bytes4 messageId = bytes4(message);
        assertEq(messageId, bytes4(0x70150038), "Message should start with EL_MESSAGE_ID");
    }

    function test_buildNewValidatorSetMessage_emptyValidatorSet() public view {
        // Without setting up validators, the set should be empty
        bytes memory message = serviceManager.buildNewValidatorSetMessage();
        assertTrue(message.length > 0, "Message should not be empty even with no validators");
    }

    // ============ Constants Tests ============

    function test_VALIDATORS_SET_ID_isZero() public view {
        assertEq(serviceManager.VALIDATORS_SET_ID(), 0, "VALIDATORS_SET_ID should be 0");
    }

    function test_DATAHAVEN_AVS_METADATA_isCorrect() public view {
        string memory metadata = serviceManager.DATAHAVEN_AVS_METADATA();
        assertEq(
            metadata, "https://datahaven.network/", "DATAHAVEN_AVS_METADATA should be correct"
        );
    }
}
