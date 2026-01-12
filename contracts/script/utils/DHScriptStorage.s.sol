// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

/**
 * @title DHScriptStorage
 * @notice This contract is a utility for scripts that need to interact with DataHaven contracts.
 */
contract DHScriptStorage is Script {
    // DataHaven Contract declarations
    DataHavenServiceManager public serviceManager;

    /**
     * @notice Loads the DataHaven contracts from the deployment file.
     */
    function _loadDHContracts(
        string memory network
    ) internal {
        // Load the deployment file
        string memory deploymentFile =
            vm.readFile(string.concat("./deployments/", network, ".json"));

        // Store the contract addresses
        serviceManager =
            DataHavenServiceManager(vm.parseJsonAddress(deploymentFile, ".ServiceManager"));
    }
}
