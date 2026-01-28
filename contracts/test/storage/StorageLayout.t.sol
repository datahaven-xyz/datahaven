// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {
    ITransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {AVSDeployer} from "../utils/AVSDeployer.sol";
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

/// @title Storage Layout Tests for DataHavenServiceManager
/// @notice Verifies that proxy upgrades preserve state correctly
contract StorageLayoutTest is AVSDeployer {
    function setUp() public {
        _deployMockEigenLayerAndAVS();
    }

    /// @notice Proves state is preserved across proxy upgrade
    function test_upgradePreservesState() public {
        // 1. Populate state
        address testValidator = address(0x1234);
        address newRewardsInitiator = address(0x9999);

        vm.startPrank(avsOwner);
        serviceManager.addValidatorToAllowlist(testValidator);
        serviceManager.setRewardsInitiator(newRewardsInitiator);
        vm.stopPrank();

        // 2. Record state before upgrade
        bool allowlistBefore = serviceManager.validatorsAllowlist(testValidator);
        address rewardsInitiatorBefore = serviceManager.rewardsInitiator();
        address ownerBefore = serviceManager.owner();
        address gatewayBefore = serviceManager.snowbridgeGateway();

        // 3. Deploy new implementation
        DataHavenServiceManager newImpl =
            new DataHavenServiceManager(rewardsCoordinator, allocationManager);

        // 4. Upgrade proxy
        vm.prank(proxyAdminOwner);
        proxyAdmin.upgrade(ITransparentUpgradeableProxy(address(serviceManager)), address(newImpl));

        // 5. Verify state preserved
        assertEq(
            serviceManager.validatorsAllowlist(testValidator),
            allowlistBefore,
            "validatorsAllowlist should be preserved"
        );
        assertEq(
            serviceManager.rewardsInitiator(),
            rewardsInitiatorBefore,
            "rewardsInitiator should be preserved"
        );
        assertEq(serviceManager.owner(), ownerBefore, "owner should be preserved");
        assertEq(
            serviceManager.snowbridgeGateway(),
            gatewayBefore,
            "snowbridgeGateway should be preserved"
        );
    }

    /// @notice Verifies validatorEthAddressToSolochainAddress mapping is preserved
    function test_upgradePreservesValidatorMappings() public {
        address testValidator = address(0xABCD);
        address testSolochainAddress = address(0xDEF0);

        // Add validator to allowlist first
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(testValidator);

        // Register operator via allocationManager to set the solochain address mapping
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = 0; // VALIDATORS_SET_ID

        vm.prank(address(allocationManager));
        serviceManager.registerOperator(
            testValidator,
            address(serviceManager),
            operatorSetIds,
            abi.encodePacked(testSolochainAddress)
        );

        // Record state before upgrade
        bool inAllowlistBefore = serviceManager.validatorsAllowlist(testValidator);
        address solochainAddressBefore =
            serviceManager.validatorEthAddressToSolochainAddress(testValidator);

        // Verify the mapping was set correctly before upgrade
        assertEq(solochainAddressBefore, testSolochainAddress, "Solochain address should be set");

        // Deploy new implementation and upgrade
        DataHavenServiceManager newImpl =
            new DataHavenServiceManager(rewardsCoordinator, allocationManager);

        vm.prank(proxyAdminOwner);
        proxyAdmin.upgrade(ITransparentUpgradeableProxy(address(serviceManager)), address(newImpl));

        // Verify both mappings preserved after upgrade
        assertEq(
            serviceManager.validatorsAllowlist(testValidator),
            inAllowlistBefore,
            "validatorsAllowlist mapping should be preserved after upgrade"
        );
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(testValidator),
            solochainAddressBefore,
            "validatorEthAddressToSolochainAddress mapping should be preserved after upgrade"
        );
        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(testValidator),
            testSolochainAddress,
            "validatorEthAddressToSolochainAddress should have correct value after upgrade"
        );
    }

    /// @notice Verifies multiple validators in allowlist are preserved
    function test_upgradePreservesMultipleValidators() public {
        address[] memory validators = new address[](3);
        validators[0] = address(0x1111);
        validators[1] = address(0x2222);
        validators[2] = address(0x3333);

        // Add multiple validators
        vm.startPrank(avsOwner);
        for (uint256 i = 0; i < validators.length; i++) {
            serviceManager.addValidatorToAllowlist(validators[i]);
        }
        vm.stopPrank();

        // Deploy new implementation and upgrade
        DataHavenServiceManager newImpl =
            new DataHavenServiceManager(rewardsCoordinator, allocationManager);

        vm.prank(proxyAdminOwner);
        proxyAdmin.upgrade(ITransparentUpgradeableProxy(address(serviceManager)), address(newImpl));

        // Verify all validators still in allowlist
        for (uint256 i = 0; i < validators.length; i++) {
            assertTrue(
                serviceManager.validatorsAllowlist(validators[i]),
                "All validators should remain in allowlist after upgrade"
            );
        }
    }

    /// @notice Verifies that upgrade doesn't affect functionality
    function test_functionalityAfterUpgrade() public {
        // Deploy new implementation and upgrade
        DataHavenServiceManager newImpl =
            new DataHavenServiceManager(rewardsCoordinator, allocationManager);

        vm.prank(proxyAdminOwner);
        proxyAdmin.upgrade(ITransparentUpgradeableProxy(address(serviceManager)), address(newImpl));

        // Verify functionality still works
        address newValidator = address(0xBEEF);

        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(newValidator);

        assertTrue(
            serviceManager.validatorsAllowlist(newValidator),
            "Should be able to add validators after upgrade"
        );

        vm.prank(avsOwner);
        serviceManager.removeValidatorFromAllowlist(newValidator);

        assertFalse(
            serviceManager.validatorsAllowlist(newValidator),
            "Should be able to remove validators after upgrade"
        );
    }
}
