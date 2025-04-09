// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";

// EigenLayer imports
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {EigenPod} from "eigenlayer-contracts/src/contracts/pods/EigenPod.sol";
import {StrategyBaseTVLLimits} from
    "eigenlayer-contracts/src/contracts/strategies/StrategyBaseTVLLimits.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";

/**
 * @title ELScriptStorage
 * @notice This contract is a utility for scripts that need to interact with EigenLayer contracts.
 */
contract ELScriptStorage is Script {
    // EigenLayer Contract declarations
    RewardsCoordinator public rewardsCoordinator;
    PermissionController public permissionController;
    AllocationManager public allocationManager;
    DelegationManager public delegation;
    StrategyManager public strategyManager;
    EigenPodManager public eigenPodManager;
    EigenPod public eigenPodBeacon;
    StrategyBaseTVLLimits public baseStrategy;
    StrategyBaseTVLLimits[] public deployedStrategies;
    IETHPOSDeposit public ethPOSDeposit;

    // EigenLayer required semver
    string public constant SEMVER = "v1.0.0";

    /**
     * @notice Loads the EigenLayer contracts from the deployment file.
     */
    function _loadELContracts(
        string memory network
    ) internal {
        // Load the deployment file
        string memory deploymentFile =
            vm.readFile(string.concat("./deployments/", network, ".json"));

        // Store the contract addresses
        rewardsCoordinator =
            RewardsCoordinator(vm.parseJsonAddress(deploymentFile, ".RewardsCoordinator"));
        permissionController =
            PermissionController(vm.parseJsonAddress(deploymentFile, ".PermissionController"));
        allocationManager =
            AllocationManager(vm.parseJsonAddress(deploymentFile, ".AllocationManager"));
        delegation = DelegationManager(vm.parseJsonAddress(deploymentFile, ".DelegationManager"));
        strategyManager = StrategyManager(vm.parseJsonAddress(deploymentFile, ".StrategyManager"));
        eigenPodManager = EigenPodManager(vm.parseJsonAddress(deploymentFile, ".EigenPodManager"));
        eigenPodBeacon = EigenPod(payable(vm.parseJsonAddress(deploymentFile, ".EigenPodBeacon")));
        baseStrategy = StrategyBaseTVLLimits(
            vm.parseJsonAddress(deploymentFile, ".BaseStrategyImplementation")
        );
        ethPOSDeposit = IETHPOSDeposit(vm.parseJsonAddress(deploymentFile, ".ETHPOSDeposit"));
        address[] memory deployedStrategiesAddresses =
            vm.parseJsonAddressArray(deploymentFile, ".DeployedStrategies");
        for (uint256 i = 0; i < deployedStrategiesAddresses.length; i++) {
            deployedStrategies.push(StrategyBaseTVLLimits(deployedStrategiesAddresses[i]));
        }
    }
}
