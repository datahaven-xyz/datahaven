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
 * @notice Script for deploying implementation contracts and upgrading proxies
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

        uint256 deployerPrivateKey = uint256(vm.envBytes32("PRIVATE_KEY"));
        vm.broadcast(deployerPrivateKey);
        DataHavenServiceManager serviceManagerImpl = new DataHavenServiceManager(
            RewardsCoordinator(rewardsCoordinator), AllocationManager(allocationManager)
        );

        console.log("ServiceManager Implementation deployed at:", address(serviceManagerImpl));
    }

    /**
     * @notice Update ServiceManager proxy and set version in one transaction.
     * @dev Uses upgradeAndCall so the version update is atomically bundled with the upgrade.
     *      updateVersion is gated by onlyProxyAdmin, and upgradeAndCall executes the calldata
     *      with msg.sender = ProxyAdmin — satisfying that check.
     *      The AVS owner owns the ProxyAdmin, so the trust chain is: AVS owner → ProxyAdmin → updateVersion.
     */
    function updateServiceManagerProxyWithVersion() public {
        console.log("Updating ServiceManager proxy with version...");

        // Get addresses and version from environment variables
        address serviceManager = vm.envAddress("SERVICE_MANAGER");
        address newImplementation = vm.envAddress("SERVICE_MANAGER_IMPL");
        address proxyAdmin = vm.envAddress("PROXY_ADMIN");
        string memory newVersion = vm.envString("NEW_VERSION");

        require(serviceManager != address(0), "SERVICE_MANAGER not set");
        require(newImplementation != address(0), "SERVICE_MANAGER_IMPL not set");
        require(newImplementation.code.length > 0, "SERVICE_MANAGER_IMPL is not a contract");
        require(proxyAdmin != address(0), "PROXY_ADMIN not set");
        require(bytes(newVersion).length > 0, "NEW_VERSION not set");

        // Encode the updateVersion call — gated by onlyProxyAdmin, satisfied since
        // upgradeAndCall executes this calldata with msg.sender = ProxyAdmin
        bytes memory data = abi.encodeWithSignature("updateVersion(string)", newVersion);

        // AVS owner owns the ProxyAdmin (transferred during deployment)
        uint256 avsOwnerPrivateKey = uint256(vm.envBytes32("AVS_OWNER_PRIVATE_KEY"));
        vm.broadcast(avsOwnerPrivateKey);
        ProxyAdmin(proxyAdmin)
            .upgradeAndCall(
                ITransparentUpgradeableProxy(payable(serviceManager)), newImplementation, data
            );

        console.log("ServiceManager proxy updated to:", newImplementation);
        console.log("Version updated to:", newVersion);
    }
}
