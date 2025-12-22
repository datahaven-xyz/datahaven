// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";

// EigenLayer imports
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {PermissionController} from "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";

// OpenZeppelin imports
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title DeployImplementation
 * @notice Script for deploying only implementation contracts for upgrades
 */
contract DeployImplementation is Script {
    function run() public {
        // This script is designed to be called with specific function selectors
        // Use forge script with --sig "functionName()" to call specific functions
    }

    /**
     * @notice Deploy new ServiceManager implementation
     */
    function deployServiceManagerImpl() public {
        console.log("Deploying ServiceManager Implementation...");

        // Get constructor parameters from environment variables
        address rewardsCoordinator = vm.envAddress("REWARDS_COORDINATOR");
        address permissionController = vm.envAddress("PERMISSION_CONTROLLER");
        address allocationManager = vm.envAddress("ALLOCATION_MANAGER");

        require(rewardsCoordinator != address(0), "REWARDS_COORDINATOR not set");
        require(permissionController != address(0), "PERMISSION_CONTROLLER not set");
        require(allocationManager != address(0), "ALLOCATION_MANAGER not set");

        vm.broadcast();
        DataHavenServiceManager serviceManagerImpl = new DataHavenServiceManager(
            RewardsCoordinator(rewardsCoordinator),
            PermissionController(permissionController),
            AllocationManager(allocationManager)
        );

        console.log("ServiceManager Implementation deployed at:", address(serviceManagerImpl));
    }

    /**
     * @notice Deploy new VetoableSlasher
     */
    function deployVetoableSlasher() public {
        console.log("Deploying VetoableSlasher...");

        // Get constructor parameters from environment variables
        address allocationManager = vm.envAddress("ALLOCATION_MANAGER");
        address serviceManager = vm.envAddress("SERVICE_MANAGER");

        require(allocationManager != address(0), "ALLOCATION_MANAGER not set");
        require(serviceManager != address(0), "SERVICE_MANAGER not set");

        vm.broadcast();
        VetoableSlasher vetoableSlasher = new VetoableSlasher(
            AllocationManager(allocationManager),
            DataHavenServiceManager(serviceManager),
            address(0), // vetoCommitteeMember - will be set later
            0 // vetoWindowBlocks - will be set later
        );

        console.log("VetoableSlasher deployed at:", address(vetoableSlasher));
    }

    /**
     * @notice Deploy new RewardsRegistry
     */
    function deployRewardsRegistry() public {
        console.log("Deploying RewardsRegistry...");

        // Get constructor parameters from environment variables
        address serviceManager = vm.envAddress("SERVICE_MANAGER");
        address rewardsAgent = vm.envAddress("REWARDS_AGENT");

        require(serviceManager != address(0), "SERVICE_MANAGER not set");
        require(rewardsAgent != address(0), "REWARDS_AGENT not set");

        vm.broadcast();
        RewardsRegistry rewardsRegistry = new RewardsRegistry();
        rewardsRegistry.initialize(serviceManager, rewardsAgent);

        console.log("RewardsRegistry deployed at:", address(rewardsRegistry));
    }

    /**
     * @notice Update ServiceManager proxy to point to new implementation
     */
    function updateServiceManagerProxy() public {
        console.log("Updating ServiceManager proxy...");

        // Get addresses from environment variables
        address serviceManager = vm.envAddress("SERVICE_MANAGER");
        address newImplementation = vm.envAddress("SERVICE_MANAGER_IMPL");
        address proxyAdmin = vm.envAddress("PROXY_ADMIN");

        require(serviceManager != address(0), "SERVICE_MANAGER not set");
        require(newImplementation != address(0), "SERVICE_MANAGER_IMPL not set");
        require(proxyAdmin != address(0), "PROXY_ADMIN not set");

        vm.broadcast();
        ProxyAdmin(proxyAdmin).upgrade(ITransparentUpgradeableProxy(payable(serviceManager)), newImplementation);

        console.log("ServiceManager proxy updated to new implementation:", newImplementation);
    }
}
