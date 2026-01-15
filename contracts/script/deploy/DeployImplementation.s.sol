// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

// EigenLayer imports
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";

// OpenZeppelin imports
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

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
        address allocationManager = vm.envAddress("ALLOCATION_MANAGER");

        require(rewardsCoordinator != address(0), "REWARDS_COORDINATOR not set");
        require(allocationManager != address(0), "ALLOCATION_MANAGER not set");

        vm.broadcast();
        DataHavenServiceManager serviceManagerImpl = new DataHavenServiceManager(
            RewardsCoordinator(rewardsCoordinator), AllocationManager(allocationManager)
        );

        console.log("ServiceManager Implementation deployed at:", address(serviceManagerImpl));
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
        ProxyAdmin(proxyAdmin)
            .upgrade(ITransparentUpgradeableProxy(payable(serviceManager)), newImplementation);

        console.log("ServiceManager proxy updated to new implementation:", newImplementation);
    }
}
