// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeployParams} from "./DeployParams.s.sol";
import {Logging} from "../utils/Logging.sol";
import {Accounts} from "../utils/Accounts.sol";

// Snowbridge imports
import {Gateway} from "snowbridge/src/Gateway.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {GatewayProxy} from "snowbridge/src/GatewayProxy.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {Initializer} from "snowbridge/src/Initializer.sol";
import {OperatingMode} from "snowbridge/src/types/Common.sol";
import {ud60x18} from "snowbridge/lib/prb-math/src/UD60x18.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";

// OpenZeppelin imports
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

// EigenLayer imports
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {
    PermissionController
} from "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {ValidatorsUtils} from "../../script/utils/ValidatorsUtils.sol";

// Shared structs
struct ServiceManagerInitParams {
    address avsOwner;
    address rewardsInitiator;
    address[] validatorsStrategies;
    address gateway;
}

// Struct to store more detailed strategy information
struct StrategyInfo {
    address address_;
    address underlyingToken;
    address tokenCreator;
}

/**
 * @title DeployBase
 * @notice Base contract containing all shared deployment logic between local and testnet deployments
 */
abstract contract DeployBase is Script, DeployParams, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps;

    // Shared EigenLayer Contract references
    DelegationManager public delegation;
    StrategyManager public strategyManager;
    AVSDirectory public avsDirectory;
    RewardsCoordinator public rewardsCoordinator;
    AllocationManager public allocationManager;
    PermissionController public permissionController;
    EigenPodManager public eigenPodManager;
    IETHPOSDeposit public ethPOSDeposit;

    bool internal _txExecutionEnabled;

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    // Abstract functions that must be implemented by inheriting contracts
    function _setupEigenLayerContracts(
        EigenLayerConfig memory config
    ) internal virtual returns (ProxyAdmin);
    function _getNetworkName() internal virtual returns (string memory);
    function _getDeploymentMode() internal virtual returns (string memory);

    /**
     * @notice Shared deployment flow for both local and testnet deployments
     */
    function _executeSharedDeployment() internal {
        _txExecutionEnabled = vm.envOr("TX_EXECUTION", true);

        string memory networkName = _getNetworkName();
        string memory deploymentMode = _getDeploymentMode();

        Logging.logHeader("DATAHAVEN DEPLOYMENT SCRIPT");
        console.log("|  Network: %s", networkName);
        console.log("|  Mode: %s", deploymentMode);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        if (!_txExecutionEnabled) {
            Logging.logInfo("TX EXECUTION DISABLED: owner transactions must be executed manually");
        }
        Logging.logFooter();

        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Setup EigenLayer contracts (implementation varies by deployment type)
        ProxyAdmin proxyAdmin = _setupEigenLayerContracts(eigenLayerConfig);
        _logProgress();

        // Deploy Snowbridge (same for both modes)
        (
            BeefyClient beefyClient,
            AgentExecutor agentExecutor,
            IGatewayV2 gateway,
            address payable rewardsAgentAddress
        ) = _deploySnowbridge(snowbridgeConfig);
        Logging.logFooter();
        _logProgress();

        // Deploy DataHaven contracts (same for both modes)
        (
            DataHavenServiceManager serviceManager,
            DataHavenServiceManager serviceManagerImplementation
        ) = _deployDataHavenContracts(avsConfig, proxyAdmin, gateway);

        Logging.logFooter();
        _logProgress();

        // Final configuration (same for both modes)
        Logging.logHeader("FINAL CONFIGURATION");
        Logging.logContractDeployed("Rewards Agent Address", rewardsAgentAddress);
        Logging.logFooter();
        _logProgress();

        // Output deployment info
        _outputDeployedAddresses(
            beefyClient,
            agentExecutor,
            gateway,
            serviceManager,
            serviceManagerImplementation,
            rewardsAgentAddress
        );

        _outputRewardsAgentInfo(rewardsAgentAddress, snowbridgeConfig.rewardsMessageOrigin);
    }

    /**
     * @notice Deploy Snowbridge components (shared across all deployment types)
     */
    function _deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        Logging.logHeader("SNOWBRIDGE DEPLOYMENT");

        Logging.logSection("Deploying Snowbridge Core Components");

        BeefyClient beefyClient = _deployBeefyClient(config);
        Logging.logContractDeployed("BeefyClient", address(beefyClient));

        vm.broadcast(_deployerPrivateKey);
        AgentExecutor agentExecutor = new AgentExecutor();
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));

        vm.broadcast(_deployerPrivateKey);
        Gateway gatewayImplementation = new Gateway(address(beefyClient), address(agentExecutor));
        Logging.logContractDeployed("Gateway Implementation", address(gatewayImplementation));

        // Configure and deploy Gateway proxy
        OperatingMode defaultOperatingMode = OperatingMode.Normal;
        Initializer.Config memory gatewayConfig = Initializer.Config({
            mode: defaultOperatingMode,
            deliveryCost: 1,
            registerTokenFee: 1,
            assetHubCreateAssetFee: 1,
            assetHubReserveTransferFee: 1,
            exchangeRate: ud60x18(1),
            multiplier: ud60x18(1),
            foreignTokenDecimals: 18,
            maxDestinationFee: 1
        });

        vm.broadcast(_deployerPrivateKey);
        IGatewayV2 gateway = IGatewayV2(
            address(new GatewayProxy(address(gatewayImplementation), abi.encode(gatewayConfig)))
        );
        Logging.logContractDeployed("Gateway Proxy", address(gateway));

        // Create Agent
        Logging.logSection("Creating Snowbridge Agent");
        vm.broadcast(_deployerPrivateKey);
        gateway.v2_createAgent(config.rewardsMessageOrigin);
        address payable rewardsAgentAddress = payable(gateway.agentOf(config.rewardsMessageOrigin));
        Logging.logContractDeployed("Rewards Agent", rewardsAgentAddress);

        return (beefyClient, agentExecutor, gateway, rewardsAgentAddress);
    }

    /**
     * @notice Deploy BeefyClient (shared across all deployment types)
     */
    function _deployBeefyClient(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            ValidatorsUtils._buildValidatorSet(0, config.initialValidatorHashes);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            ValidatorsUtils._buildValidatorSet(1, config.nextValidatorHashes);

        // Deploy BeefyClient
        vm.broadcast(_deployerPrivateKey);
        return new BeefyClient(
            config.randaoCommitDelay,
            config.randaoCommitExpiration,
            config.minNumRequiredSignatures,
            config.startBlock,
            validatorSet,
            nextValidatorSet
        );
    }

    /**
     * @notice Deploy DataHaven custom contracts (shared with mode-specific proxy creation)
     */
    function _deployDataHavenContracts(
        AVSConfig memory avsConfig,
        ProxyAdmin proxyAdmin,
        IGatewayV2 gateway
    ) internal returns (DataHavenServiceManager, DataHavenServiceManager) {
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        vm.broadcast(_deployerPrivateKey);
        DataHavenServiceManager serviceManagerImplementation = new DataHavenServiceManager(
            rewardsCoordinator, permissionController, allocationManager
        );
        Logging.logContractDeployed(
            "ServiceManager Implementation", address(serviceManagerImplementation)
        );

        // Create service manager initialisation parameters struct
        ServiceManagerInitParams memory initParams = ServiceManagerInitParams({
            avsOwner: avsConfig.avsOwner,
            rewardsInitiator: avsConfig.rewardsInitiator,
            validatorsStrategies: avsConfig.validatorsStrategies,
            gateway: address(gateway)
        });

        // Create the service manager proxy (different logic for local vs testnet)
        DataHavenServiceManager serviceManager =
            _createServiceManagerProxy(serviceManagerImplementation, proxyAdmin, initParams);
        Logging.logContractDeployed("ServiceManager Proxy", address(serviceManager));

        Logging.logSection("Configuring Service Manager");

        // Register the DataHaven service in the AllocationManager
        if (_txExecutionEnabled) {
            vm.broadcast(_avsOwnerPrivateKey);
            serviceManager.updateAVSMetadataURI("");
            Logging.logStep("DataHaven service registered in AllocationManager");
        } else {
            Logging.logInfo("TX EXECUTION DISABLED: call updateAVSMetadataURI via multisig");
        }

        return (serviceManager, serviceManagerImplementation);
    }

    /**
     * @notice Create service manager proxy - implementation varies by deployment type
     */
    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ProxyAdmin proxyAdmin,
        ServiceManagerInitParams memory params
    ) internal virtual returns (DataHavenServiceManager);

    /**
     * @notice Output deployed addresses with mode-specific logic
     */
    function _outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
        DataHavenServiceManager serviceManagerImplementation,
        address rewardsAgent
    ) internal virtual;

    /**
     * @notice Output rewards agent info (shared across all deployment types)
     */
    function _outputRewardsAgentInfo(
        address rewardsAgent,
        bytes32 rewardsAgentOrigin
    ) internal {
        Logging.logHeader("REWARDS AGENT INFO");
        Logging.logContractDeployed("RewardsAgent", rewardsAgent);
        Logging.logAgentOrigin("RewardsAgentOrigin", vm.toString(rewardsAgentOrigin));
        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = _getNetworkName();
        string memory rewardsInfoPath =
            string.concat(vm.projectRoot(), "/deployments/", network, "-rewards-info.json");

        // Create directory if it doesn't exist
        vm.createDir(string.concat(vm.projectRoot(), "/deployments"), true);

        // Create JSON with rewards info
        string memory json = "{";
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');
        json = string.concat(json, '"RewardsAgentOrigin": "', vm.toString(rewardsAgentOrigin), '"');
        json = string.concat(json, "}");

        // Write to file
        vm.writeFile(rewardsInfoPath, json);
        Logging.logInfo(string.concat("Rewards info saved to: ", rewardsInfoPath));
    }
}
