// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {DeployBase, ServiceManagerInitParams} from "./DeployBase.s.sol";
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

// Snowbridge imports for function signatures
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";

// Logging import
import {Logging} from "../utils/Logging.sol";

// EigenLayer core contract imports for type casting
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {
    PermissionController
} from "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";

// OpenZeppelin imports for proxy creation
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title DeployLive
 * @notice Deployment script for live networks (hoodi testnet, ethereum mainnet)
 * @dev References existing EigenLayer contracts on the target chain
 */
contract DeployLive is DeployBase {
    string public networkName;

    function run() public {
        // Network detection and validation
        networkName = vm.envString("NETWORK");
        require(
            bytes(networkName).length > 0,
            "NETWORK environment variable required for live deployment"
        );

        _validateNetwork(networkName);
        totalSteps = 4;

        address avsOwnerEnv = vm.envOr("AVS_OWNER_ADDRESS", address(0));
        require(
            avsOwnerEnv != address(0),
            "AVS_OWNER_ADDRESS env variable required for live deployments"
        );

        _executeSharedDeployment();
    }

    // Implementation of abstract functions from DeployBase
    function _getNetworkName() internal view override returns (string memory) {
        return networkName;
    }

    function _getDeploymentMode() internal view override returns (string memory) {
        return string.concat("LIVE_", networkName);
    }

    function _setupEigenLayerContracts(
        EigenLayerConfig memory config
    ) internal override returns (ProxyAdmin) {
        Logging.logHeader("REFERENCING EXISTING EIGENLAYER CONTRACTS");
        Logging.logSection(
            string.concat("Referencing Existing EigenLayer Contracts on ", _getDeploymentMode())
        );

        // Reference existing EigenLayer contracts using addresses from config
        delegation = DelegationManager(config.delegationManager);
        strategyManager = StrategyManager(config.strategyManager);
        avsDirectory = AVSDirectory(config.avsDirectory);
        rewardsCoordinator = RewardsCoordinator(config.rewardsCoordinator);
        allocationManager = AllocationManager(config.allocationManager);
        permissionController = PermissionController(config.permissionController);

        // Validate that contracts exist at the specified addresses
        _validateContractExists(address(delegation), "DelegationManager");
        _validateContractExists(address(strategyManager), "StrategyManager");
        _validateContractExists(address(avsDirectory), "AVSDirectory");
        _validateContractExists(address(rewardsCoordinator), "RewardsCoordinator");
        _validateContractExists(address(allocationManager), "AllocationManager");
        _validateContractExists(address(permissionController), "PermissionController");

        Logging.logContractDeployed("DelegationManager (existing)", address(delegation));
        Logging.logContractDeployed("StrategyManager (existing)", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory (existing)", address(avsDirectory));
        Logging.logContractDeployed("RewardsCoordinator (existing)", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager (existing)", address(allocationManager));
        Logging.logContractDeployed(
            "PermissionController (existing)", address(permissionController)
        );

        Logging.logStep("All EigenLayer contracts referenced successfully");
        Logging.logFooter();

        // Live deployments create their own ProxyAdmin (no existing one from EigenLayer deployment)
        return ProxyAdmin(address(0)); // Will be created in _createServiceManagerProxy
    }

    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ProxyAdmin, // Ignored for live deployment
        ServiceManagerInitParams memory params
    ) internal override returns (DataHavenServiceManager) {
        // Live deployment creates its own ProxyAdmin for the service manager
        vm.broadcast(_deployerPrivateKey);
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        vm.broadcast(_deployerPrivateKey);
        bytes memory initData = abi.encodeWithSelector(
            DataHavenServiceManager.initialize.selector,
            params.avsOwner,
            params.rewardsInitiator,
            params.validatorsStrategies,
            params.gateway
        );

        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(address(implementation), address(proxyAdmin), initData);

        return DataHavenServiceManager(address(proxy));
    }

    function _outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
        DataHavenServiceManager serviceManagerImplementation,
        address rewardsAgent
    ) internal override {
        Logging.logHeader("DEPLOYMENT SUMMARY");

        Logging.logSection("Snowbridge Contracts + Rewards Agent");
        Logging.logContractDeployed("BeefyClient", address(beefyClient));
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));
        Logging.logContractDeployed("Gateway", address(gateway));
        Logging.logContractDeployed("RewardsAgent", rewardsAgent);

        Logging.logSection("DataHaven Contracts");
        Logging.logContractDeployed("ServiceManager", address(serviceManager));

        Logging.logSection(
            string.concat("EigenLayer Core Contracts (Existing on ", _getDeploymentMode(), ")")
        );
        Logging.logContractDeployed("DelegationManager", address(delegation));
        Logging.logContractDeployed("StrategyManager", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory", address(avsDirectory));
        Logging.logContractDeployed("RewardsCoordinator", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager", address(allocationManager));
        Logging.logContractDeployed("PermissionController", address(permissionController));

        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = _getNetworkName();
        string memory deploymentPath =
            string.concat(vm.projectRoot(), "/deployments/", network, ".json");

        // Create directory if it doesn't exist
        vm.createDir(string.concat(vm.projectRoot(), "/deployments"), true);

        // Create JSON with deployed addresses
        string memory json = "{";
        json = string.concat(json, '"network": "', network, '",');

        // Snowbridge contracts
        json = string.concat(json, '"BeefyClient": "', vm.toString(address(beefyClient)), '",');
        json = string.concat(json, '"AgentExecutor": "', vm.toString(address(agentExecutor)), '",');
        json = string.concat(json, '"Gateway": "', vm.toString(address(gateway)), '",');
        json =
            string.concat(json, '"ServiceManager": "', vm.toString(address(serviceManager)), '",');
        json = string.concat(
            json,
            '"ServiceManagerImplementation": "',
            vm.toString(address(serviceManagerImplementation)),
            '",'
        );
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');

        // EigenLayer contracts (existing on live network)
        json = string.concat(json, '"DelegationManager": "', vm.toString(address(delegation)), '",');
        json = string.concat(
            json, '"StrategyManager": "', vm.toString(address(strategyManager)), '",'
        );
        json = string.concat(json, '"AVSDirectory": "', vm.toString(address(avsDirectory)), '",');
        json = string.concat(
            json, '"RewardsCoordinator": "', vm.toString(address(rewardsCoordinator)), '",'
        );
        json = string.concat(
            json, '"AllocationManager": "', vm.toString(address(allocationManager)), '",'
        );
        json = string.concat(
            json, '"PermissionController": "', vm.toString(address(permissionController)), '"'
        );

        json = string.concat(json, "}");

        // Write to file
        vm.writeFile(deploymentPath, json);
        Logging.logInfo(string.concat("Deployment info saved to: ", deploymentPath));
    }

    // LIVE DEPLOYMENT FUNCTIONS

    /**
     * @notice Validate that the network ends with a supported chain name
     * @dev Networks can be prefixed with environment names like "stagenet-", "testnet-", "mainnet-", etc.
     *      Supported chains:
     *      - "hoodi" (Hoodi testnet): e.g., "hoodi", "stagenet-hoodi", "testnet-hoodi"
     *      - "ethereum" (Ethereum mainnet): e.g., "ethereum", "mainnet-ethereum"
     */
    function _validateNetwork(
        string memory network
    ) internal pure {
        // Check if network ends with a supported chain name
        // This allows for environment prefixes like "stagenet-hoodi", "mainnet-ethereum", etc.
        if (_endsWithChain(network, "hoodi") || _endsWithChain(network, "ethereum")) {
            return;
        }

        revert(
            string.concat(
                "Unsupported network: ",
                network,
                ". Network must end with 'hoodi' or 'ethereum' (e.g., 'hoodi', 'stagenet-hoodi', 'mainnet-ethereum')"
            )
        );
    }

    /**
     * @notice Check if a network string ends with a specific chain name
     * @param network The full network identifier (e.g., "stagenet-hoodi")
     * @param chain The chain suffix to check for (e.g., "hoodi")
     * @return True if network ends with the chain name
     */
    function _endsWithChain(
        string memory network,
        string memory chain
    ) internal pure returns (bool) {
        bytes memory networkBytes = bytes(network);
        bytes memory chainBytes = bytes(chain);

        if (networkBytes.length < chainBytes.length) {
            return false;
        }

        uint256 offset = networkBytes.length - chainBytes.length;
        for (uint256 i = 0; i < chainBytes.length; i++) {
            if (networkBytes[offset + i] != chainBytes[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * @notice Validate that a contract exists at the given address
     */
    function _validateContractExists(
        address contractAddress,
        string memory contractName
    ) internal view {
        require(
            contractAddress != address(0), string.concat(contractName, " address cannot be zero")
        );

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(contractAddress)
        }
        require(
            codeSize > 0,
            string.concat(
                "No contract found at ", contractName, " address: ", vm.toString(contractAddress)
            )
        );
    }
}
