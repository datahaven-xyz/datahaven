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
import {TransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

// EigenLayer imports (for references only)
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {MerkleUtils} from "../../src/libraries/MerkleUtils.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";

struct ServiceManagerInitParams {
    address avsOwner;
    address rewardsInitiator;
    address[] validatorsStrategies;
    address[] bspsStrategies;
    address[] mspsStrategies;
    address gateway;
}

contract DeployHoodi is Script, DeployParams, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps = 2; // Reduced steps since we're not deploying EigenLayer

    // EigenLayer Contract references (already deployed on Hoodi)
    DelegationManager public delegation;
    StrategyManager public strategyManager;
    AVSDirectory public avsDirectory;
    RewardsCoordinator public rewardsCoordinator;
    AllocationManager public allocationManager;
    PermissionController public permissionController;

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    function run() public {
        Logging.logHeader("DATAHAVEN HOODI DEPLOYMENT SCRIPT");
        console.log("|  Network: %s", vm.envOr("NETWORK", string("hoodi")));
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        Logging.logFooter();

        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Reference existing EigenLayer contracts on Hoodi
        Logging.logHeader("REFERENCING EXISTING EIGENLAYER CONTRACTS");
        _referenceEigenLayerContracts(eigenLayerConfig);
        Logging.logFooter();
        _logProgress();

        // Deploy Snowbridge and configure Agent
        Logging.logHeader("SNOWBRIDGE DEPLOYMENT");
        (
            BeefyClient beefyClient,
            AgentExecutor agentExecutor,
            IGatewayV2 gateway,
            address payable rewardsAgentAddress
        ) = _deploySnowbridge(snowbridgeConfig);
        Logging.logFooter();
        _logProgress();

        // Deploy DataHaven custom contracts
        (
            DataHavenServiceManager serviceManager,
            DataHavenServiceManager serviceManagerImplementation,
            VetoableSlasher vetoableSlasher,
            RewardsRegistry rewardsRegistry,
            bytes4 updateRewardsMerkleRootSelector
        ) = _deployDataHavenContracts(avsConfig, gateway);

        Logging.logFooter();
        _logProgress();

        // Set the Agent in the RewardsRegistry
        Logging.logHeader("FINAL CONFIGURATION");
        // This needs to be executed by the AVS owner
        vm.startBroadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(0, address(rewardsAgentAddress));
        vm.stopBroadcast();
        Logging.logStep("Agent set in RewardsRegistry");
        Logging.logContractDeployed("Agent Address", rewardsAgentAddress);

        Logging.logFooter();
        _logProgress();

        // Output all deployed contract addresses
        _outputDeployedAddresses(
            beefyClient,
            agentExecutor,
            gateway,
            serviceManager,
            serviceManagerImplementation,
            vetoableSlasher,
            rewardsRegistry,
            rewardsAgentAddress
        );

        // Output rewards info (Rewards agent address and origin, updateRewardsMerkleRoot function selector)
        _outputRewardsInfo(
            rewardsAgentAddress,
            snowbridgeConfig.rewardsMessageOrigin,
            updateRewardsMerkleRootSelector
        );
    }

    function _referenceEigenLayerContracts(
        EigenLayerConfig memory config
    ) internal {
        Logging.logSection("Referencing Existing EigenLayer Contracts on Hoodi");

        // Reference existing EigenLayer contracts using addresses from config
        delegation = DelegationManager(config.delegationManager);
        strategyManager = StrategyManager(config.strategyManager);
        avsDirectory = AVSDirectory(config.avsDirectory);
        rewardsCoordinator = RewardsCoordinator(config.rewardsCoordinator);
        allocationManager = AllocationManager(config.allocationManager);
        permissionController = PermissionController(config.permissionController);

        Logging.logContractDeployed("DelegationManager (existing)", address(delegation));
        Logging.logContractDeployed("StrategyManager (existing)", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory (existing)", address(avsDirectory));
        Logging.logContractDeployed("RewardsCoordinator (existing)", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager (existing)", address(allocationManager));
        Logging.logContractDeployed(
            "PermissionController (existing)", address(permissionController)
        );

        Logging.logStep("All EigenLayer contracts referenced successfully");
    }

    function _deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        Logging.logSection("Deploying Snowbridge Core Components");

        BeefyClient beefyClient = _deployBeefyClient(config);
        Logging.logContractDeployed("BeefyClient", address(beefyClient));

        vm.startBroadcast(_deployerPrivateKey);
        AgentExecutor agentExecutor = new AgentExecutor();
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));

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

        IGatewayV2 gateway = IGatewayV2(
            address(new GatewayProxy(address(gatewayImplementation), abi.encode(gatewayConfig)))
        );
        Logging.logContractDeployed("Gateway Proxy", address(gateway));

        // Create Agent
        Logging.logSection("Creating Snowbridge Agent");
        gateway.v2_createAgent(config.rewardsMessageOrigin);
        address payable rewardsAgentAddress = payable(gateway.agentOf(config.rewardsMessageOrigin));
        Logging.logContractDeployed("Rewards Agent", rewardsAgentAddress);
        vm.stopBroadcast();

        return (beefyClient, agentExecutor, gateway, rewardsAgentAddress);
    }

    function _buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array using the shared library
        bytes32 merkleRoot = MerkleUtils.calculateMerkleRootUnsorted(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

    function _deployBeefyClient(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            _buildValidatorSet(0, config.initialValidatorHashes);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            _buildValidatorSet(1, config.nextValidatorHashes);

        // Deploy BeefyClient
        vm.startBroadcast(_deployerPrivateKey);
        BeefyClient beefyClient = new BeefyClient(
            config.randaoCommitDelay,
            config.randaoCommitExpiration,
            config.minNumRequiredSignatures,
            config.startBlock,
            validatorSet,
            nextValidatorSet
        );
        vm.stopBroadcast();
        return beefyClient;
    }

    function _outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
        DataHavenServiceManager serviceManagerImplementation,
        VetoableSlasher vetoableSlasher,
        RewardsRegistry rewardsRegistry,
        address rewardsAgent
    ) internal {
        Logging.logHeader("DEPLOYMENT SUMMARY");

        Logging.logSection("Snowbridge Contracts + Rewards Agent");
        Logging.logContractDeployed("BeefyClient", address(beefyClient));
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));
        Logging.logContractDeployed("Gateway", address(gateway));
        Logging.logContractDeployed("RewardsAgent", rewardsAgent);

        Logging.logSection("DataHaven Contracts");
        Logging.logContractDeployed("ServiceManager", address(serviceManager));
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));

        Logging.logSection("EigenLayer Core Contracts (Existing on Hoodi)");
        Logging.logContractDeployed("DelegationManager", address(delegation));
        Logging.logContractDeployed("StrategyManager", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory", address(avsDirectory));
        Logging.logContractDeployed("RewardsCoordinator", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager", address(allocationManager));
        Logging.logContractDeployed("PermissionController", address(permissionController));

        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = vm.envOr("NETWORK", string("hoodi"));
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
        json =
            string.concat(json, '"VetoableSlasher": "', vm.toString(address(vetoableSlasher)), '",');
        json =
            string.concat(json, '"RewardsRegistry": "', vm.toString(address(rewardsRegistry)), '",');
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');

        // EigenLayer contracts (existing on Hoodi)
        json = string.concat(json, '"DelegationManager": "', vm.toString(address(delegation)), '",');
        json =
            string.concat(json, '"StrategyManager": "', vm.toString(address(strategyManager)), '",');
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

    function _outputRewardsInfo(
        address rewardsAgent,
        bytes32 rewardsAgentOrigin,
        bytes4 updateRewardsMerkleRootSelector
    ) internal {
        Logging.logHeader("REWARDS AGENT INFO");
        Logging.logContractDeployed("RewardsAgent", rewardsAgent);
        Logging.logAgentOrigin("RewardsAgentOrigin", vm.toString(rewardsAgentOrigin));
        Logging.logFunctionSelector(
            "updateRewardsMerkleRootSelector", vm.toString(updateRewardsMerkleRootSelector)
        );
        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = vm.envOr("NETWORK", string("hoodi"));
        string memory rewardsInfoPath =
            string.concat(vm.projectRoot(), "/deployments/", network, "-rewards-info.json");

        // Create directory if it doesn't exist
        vm.createDir(string.concat(vm.projectRoot(), "/deployments"), true);

        // Create JSON with rewards info
        string memory json = "{";
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');
        json = string.concat(json, '"RewardsAgentOrigin": "', vm.toString(rewardsAgentOrigin), '",');
        json = string.concat(
            json,
            '"updateRewardsMerkleRootSelector": "',
            _trimToBytes4(vm.toString(updateRewardsMerkleRootSelector)),
            '"'
        );
        json = string.concat(json, "}");

        // Write to file
        vm.writeFile(rewardsInfoPath, json);
        Logging.logInfo(string.concat("Rewards info saved to: ", rewardsInfoPath));
    }

    function _deployDataHavenContracts(
        AVSConfig memory avsConfig,
        IGatewayV2 gateway
    )
        internal
        returns (
            DataHavenServiceManager,
            DataHavenServiceManager,
            VetoableSlasher,
            RewardsRegistry,
            bytes4
        )
    {
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        vm.startBroadcast(_deployerPrivateKey);
        DataHavenServiceManager serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);
        Logging.logContractDeployed(
            "ServiceManager Implementation", address(serviceManagerImplementation)
        );

        // Create service manager initialisation parameters struct
        ServiceManagerInitParams memory initParams = ServiceManagerInitParams({
            avsOwner: avsConfig.avsOwner,
            rewardsInitiator: avsConfig.rewardsInitiator,
            validatorsStrategies: avsConfig.validatorsStrategies,
            bspsStrategies: avsConfig.bspsStrategies,
            mspsStrategies: avsConfig.mspsStrategies,
            gateway: address(gateway)
        });

        // Create the service manager proxy
        DataHavenServiceManager serviceManager =
            _createServiceManagerProxy(serviceManagerImplementation, initParams);
        Logging.logContractDeployed("ServiceManager Proxy", address(serviceManager));

        // Deploy VetoableSlasher
        VetoableSlasher vetoableSlasher = new VetoableSlasher(
            allocationManager,
            serviceManager,
            avsConfig.vetoCommitteeMember,
            avsConfig.vetoWindowBlocks
        );
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));

        // Deploy RewardsRegistry
        RewardsRegistry rewardsRegistry = new RewardsRegistry(
            address(serviceManager),
            address(0) // Will be set to the Agent address after creation
        );
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));
        bytes4 updateRewardsMerkleRootSelector = IRewardsRegistry.updateRewardsMerkleRoot.selector;
        vm.stopBroadcast();

        Logging.logSection("Configuring Service Manager");

        // Register the DataHaven service in the AllocationManager
        vm.startBroadcast(_avsOwnerPrivateKey);
        serviceManager.updateAVSMetadataURI("");
        Logging.logStep("DataHaven service registered in AllocationManager");

        // Set the slasher in the ServiceManager
        serviceManager.setSlasher(vetoableSlasher);
        Logging.logStep("Slasher set in ServiceManager");

        // Set the RewardsRegistry in the ServiceManager
        uint32 validatorsSetId = serviceManager.VALIDATORS_SET_ID();
        serviceManager.setRewardsRegistry(validatorsSetId, rewardsRegistry);
        Logging.logStep("RewardsRegistry set in ServiceManager");
        vm.stopBroadcast();

        return (
            serviceManager,
            serviceManagerImplementation,
            vetoableSlasher,
            rewardsRegistry,
            updateRewardsMerkleRootSelector
        );
    }

    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ServiceManagerInitParams memory params
    ) internal returns (DataHavenServiceManager) {
        // Deploy ProxyAdmin for the proxy
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        bytes memory initData = abi.encodeWithSelector(
            DataHavenServiceManager.initialise.selector,
            params.avsOwner,
            params.rewardsInitiator,
            params.validatorsStrategies,
            params.bspsStrategies,
            params.mspsStrategies,
            params.gateway
        );

        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(address(implementation), address(proxyAdmin), initData);

        return DataHavenServiceManager(address(proxy));
    }

    /**
     * @dev Helper function to trim a padded hex string to only the first 4 bytes (10 characters: 0x + 8 hex digits)
     * @param paddedHex The padded hex string from vm.toString()
     * @return A hex string with only the first 4 bytes (e.g., "0x12345678")
     */
    function _trimToBytes4(
        string memory paddedHex
    ) internal pure returns (string memory) {
        bytes memory data = bytes(paddedHex);
        bytes memory trimmed = new bytes(10); // 0x + 8 hex chars = 10 total chars

        for (uint256 i = 0; i < 10; i++) {
            trimmed[i] = data[i];
        }

        return string(trimmed);
    }
}
