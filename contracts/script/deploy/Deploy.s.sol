// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeployParams} from "./DeployParams.s.sol";
import {Logging} from "../utils/Logging.sol";

import {Gateway} from "snowbridge/src/Gateway.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {GatewayProxy} from "snowbridge/src/GatewayProxy.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {Initializer} from "snowbridge/src/Initializer.sol";
import {OperatingMode} from "snowbridge/src/types/Common.sol";
import {ud60x18} from "snowbridge/lib/prb-math/src/UD60x18.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";

import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";

// Additional EigenLayer imports
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {EigenPod} from "eigenlayer-contracts/src/contracts/pods/EigenPod.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";
import {StrategyBaseTVLLimits} from
    "eigenlayer-contracts/src/contracts/strategies/StrategyBaseTVLLimits.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {ERC20PresetFixedSupply} from
    "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import {ITransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";
import {MerkleUtils} from "../../src/libraries/MerkleUtils.sol";

contract Deploy is Script, DeployParams {
    // Progress indicator
    uint16 private deploymentStep = 0;
    uint16 private totalSteps = 4; // Total major deployment steps

    uint256 internal deployerPrivateKey = vm.envOr(
        "DEPLOYER_PRIVATE_KEY",
        uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // First pre-funded account from Anvil
    );

    uint256 internal avsOwnerPrivateKey = vm.envOr(
        "AVS_OWNER_PRIVATE_KEY",
        uint256(0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e) // Sixth pre-funded account from Anvil
    );

    // EigenLayer Contract declarations
    EmptyContract internal emptyContract;
    RewardsCoordinator internal rewardsCoordinator;
    RewardsCoordinator internal rewardsCoordinatorImplementation;
    PermissionController internal permissionController;
    PermissionController internal permissionControllerImplementation;
    AllocationManager internal allocationManager;
    AllocationManager internal allocationManagerImplementation;
    DelegationManager internal delegation;
    DelegationManager internal delegationImplementation;
    StrategyManager internal strategyManager;
    StrategyManager internal strategyManagerImplementation;
    AVSDirectory internal avsDirectory;
    AVSDirectory internal avsDirectoryImplementation;
    EigenPodManager internal eigenPodManager;
    EigenPodManager internal eigenPodManagerImplementation;
    UpgradeableBeacon internal eigenPodBeacon;
    EigenPod internal eigenPodImplementation;
    StrategyBaseTVLLimits internal baseStrategyImplementation;
    StrategyBaseTVLLimits[] internal deployedStrategies;
    IETHPOSDeposit internal ethPOSDeposit;

    // EigenLayer required semver
    string internal constant SEMVER = "v1.0.0";

    function logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    function run() public {
        Logging.logHeader("DATAHAVEN DEPLOYMENT SCRIPT");
        console.log("|  Network: %s", vm.envOr("NETWORK", string("anvil")));
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        Logging.logFooter();

        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Start the broadcast for the deployment transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy EigenLayer core contracts
        Logging.logHeader("EIGENLAYER CORE CONTRACTS DEPLOYMENT");
        Logging.logInfo("Deploying core infrastructure contracts");

        // Deploy proxy admin for ability to upgrade proxy contracts
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        // Deploy pauser registry
        PauserRegistry pauserRegistry = deployPauserRegistry(eigenLayerConfig);
        Logging.logContractDeployed("PauserRegistry", address(pauserRegistry));

        // Deploy empty contract to use as initial implementation for proxies
        emptyContract = new EmptyContract();
        Logging.logContractDeployed("EmptyContract", address(emptyContract));

        // Deploy proxies that will point to implementations
        Logging.logSection("Deploying Proxy Contracts");
        deployProxies(proxyAdmin);
        Logging.logStep("Initial proxies deployed successfully");

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        // Deploy EigenPod implementation and beacon
        eigenPodImplementation = new EigenPod(
            ethPOSDeposit, eigenPodManager, eigenLayerConfig.beaconChainGenesisTimestamp, SEMVER
        );
        eigenPodBeacon = new UpgradeableBeacon(address(eigenPodImplementation));
        Logging.logContractDeployed("EigenPod Implementation", address(eigenPodImplementation));
        Logging.logContractDeployed("EigenPod Beacon", address(eigenPodBeacon));

        // Deploy implementation contracts
        Logging.logSection("Deploying Implementation Contracts");
        deployImplementations(eigenLayerConfig, pauserRegistry);
        Logging.logStep("Implementation contracts deployed successfully");

        // Upgrade proxies to point to implementations and initialize
        Logging.logSection("Initializing Contracts");
        upgradeAndInitializeProxies(eigenLayerConfig, proxyAdmin);
        Logging.logStep("Proxies upgraded and initialized successfully");

        // Deploy strategy implementation and create strategy proxies
        Logging.logSection("Deploying Strategy Contracts");
        deployStrategies(eigenLayerConfig, pauserRegistry, proxyAdmin);
        Logging.logStep("Strategy contracts deployed successfully");

        // Transfer ownership of core contracts
        proxyAdmin.transferOwnership(eigenLayerConfig.executorMultisig);
        eigenPodBeacon.transferOwnership(eigenLayerConfig.executorMultisig);
        Logging.logStep("Ownership transferred to multisig");

        Logging.logFooter();
        logProgress();

        // Deploy DataHaven custom contracts
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        DataHavenServiceManager serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);
        Logging.logContractDeployed(
            "ServiceManager Implementation", address(serviceManagerImplementation)
        );

        DataHavenServiceManager serviceManager = DataHavenServiceManager(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        DataHavenServiceManager.initialize.selector,
                        avsConfig.avsOwner,
                        avsConfig.rewardsInitiator
                    )
                )
            )
        );
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

        // This needs to be executed by the AVS owner
        vm.stopBroadcast();
        vm.startBroadcast(avsOwnerPrivateKey);

        // Set the slasher in the ServiceManager
        Logging.logSection("Configuring Service Manager");
        serviceManager.setSlasher(vetoableSlasher);
        Logging.logStep("Slasher set in ServiceManager");

        // Set the RewardsRegistry in the ServiceManager
        serviceManager.setRewardsRegistry(0, rewardsRegistry);
        Logging.logStep("RewardsRegistry set in ServiceManager");

        Logging.logFooter();
        logProgress();

        // Going back to the deployer to deploy Snowbridge
        vm.stopBroadcast();
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Snowbridge and configure Agent
        Logging.logHeader("SNOWBRIDGE DEPLOYMENT");

        (
            BeefyClient beefyClient,
            AgentExecutor agentExecutor,
            IGatewayV2 gateway,
            address payable rewardsAgentAddress
        ) = deploySnowbridge(snowbridgeConfig);

        Logging.logFooter();
        logProgress();

        // This needs to be executed by the AVS owner
        vm.stopBroadcast();
        vm.startBroadcast(avsOwnerPrivateKey);

        // Set the Agent in the RewardsRegistry
        Logging.logHeader("FINAL CONFIGURATION");
        serviceManager.setRewardsAgent(0, address(rewardsAgentAddress));
        Logging.logStep("Agent set in RewardsRegistry");
        Logging.logContractDeployed("Agent Address", rewardsAgentAddress);

        vm.stopBroadcast();
        Logging.logFooter();
        logProgress();

        // Output all deployed contract addresses
        outputDeployedAddresses(
            beefyClient,
            agentExecutor,
            gateway,
            serviceManager,
            vetoableSlasher,
            rewardsRegistry,
            rewardsAgentAddress
        );
    }

    function deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        Logging.logSection("Deploying Snowbridge Core Components");

        BeefyClient beefyClient = deployBeefyClient(config);
        Logging.logContractDeployed("BeefyClient", address(beefyClient));

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

        return (beefyClient, agentExecutor, gateway, rewardsAgentAddress);
    }

    function deployProxies(
        ProxyAdmin proxyAdmin
    ) internal {
        // Deploy proxies with empty implementation initially
        delegation = DelegationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("DelegationManager Proxy", address(delegation));

        strategyManager = StrategyManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("StrategyManager Proxy", address(strategyManager));

        avsDirectory = AVSDirectory(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("AVSDirectory Proxy", address(avsDirectory));

        eigenPodManager = EigenPodManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("EigenPodManager Proxy", address(eigenPodManager));

        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("RewardsCoordinator Proxy", address(rewardsCoordinator));

        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("AllocationManager Proxy", address(allocationManager));

        permissionController = PermissionController(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("PermissionController Proxy", address(permissionController));
    }

    function deployImplementations(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry
    ) internal {
        // Deploy implementation contracts
        delegationImplementation = new DelegationManager(
            strategyManager,
            eigenPodManager,
            allocationManager,
            pauserRegistry,
            permissionController,
            config.minWithdrawalDelayBlocks,
            SEMVER
        );
        Logging.logContractDeployed(
            "DelegationManager Implementation", address(delegationImplementation)
        );

        strategyManagerImplementation = new StrategyManager(delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "StrategyManager Implementation", address(strategyManagerImplementation)
        );

        avsDirectoryImplementation = new AVSDirectory(delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "AVSDirectory Implementation", address(avsDirectoryImplementation)
        );

        eigenPodManagerImplementation =
            new EigenPodManager(ethPOSDeposit, eigenPodBeacon, delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "EigenPodManager Implementation", address(eigenPodManagerImplementation)
        );

        rewardsCoordinatorImplementation = new RewardsCoordinator(
            IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams(
                delegation,
                strategyManager,
                allocationManager,
                pauserRegistry,
                permissionController,
                config.calculationIntervalSeconds,
                config.maxRewardsDuration,
                config.maxRetroactiveLength,
                config.maxFutureLength,
                config.genesisRewardsTimestamp,
                SEMVER
            )
        );
        Logging.logContractDeployed(
            "RewardsCoordinator Implementation", address(rewardsCoordinatorImplementation)
        );

        allocationManagerImplementation = new AllocationManager(
            delegation,
            pauserRegistry,
            permissionController,
            config.deallocationDelay,
            config.allocationConfigurationDelay,
            SEMVER
        );
        Logging.logContractDeployed(
            "AllocationManager Implementation", address(allocationManagerImplementation)
        );

        permissionControllerImplementation = new PermissionController(SEMVER);
        Logging.logContractDeployed(
            "PermissionController Implementation", address(permissionControllerImplementation)
        );
    }

    function upgradeAndInitializeProxies(
        EigenLayerConfig memory config,
        ProxyAdmin proxyAdmin
    ) internal {
        // Initialize DelegationManager
        {
            IStrategy[] memory strategies;
            uint256[] memory withdrawalDelayBlocks;

            proxyAdmin.upgradeAndCall(
                ITransparentUpgradeableProxy(payable(address(delegation))),
                address(delegationImplementation),
                abi.encodeWithSelector(
                    DelegationManager.initialize.selector,
                    config.executorMultisig,
                    config.delegationInitPausedStatus,
                    config.delegationWithdrawalDelayBlocks,
                    strategies,
                    withdrawalDelayBlocks
                )
            );
            Logging.logStep("DelegationManager initialized");
        }

        // Initialize StrategyManager
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(strategyManager))),
            address(strategyManagerImplementation),
            abi.encodeWithSelector(
                StrategyManager.initialize.selector,
                config.executorMultisig,
                config.operationsMultisig,
                config.strategyManagerInitPausedStatus
            )
        );
        Logging.logStep("StrategyManager initialized");

        // Initialize AVSDirectory
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(avsDirectory))),
            address(avsDirectoryImplementation),
            abi.encodeWithSelector(
                AVSDirectory.initialize.selector,
                config.executorMultisig,
                0 // Initial paused status
            )
        );
        Logging.logStep("AVSDirectory initialized");

        // Initialize EigenPodManager
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(eigenPodManager))),
            address(eigenPodManagerImplementation),
            abi.encodeWithSelector(
                EigenPodManager.initialize.selector,
                config.executorMultisig,
                config.eigenPodManagerInitPausedStatus
            )
        );
        Logging.logStep("EigenPodManager initialized");

        // Initialize RewardsCoordinator
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(rewardsCoordinator))),
            address(rewardsCoordinatorImplementation),
            abi.encodeWithSelector(
                RewardsCoordinator.initialize.selector,
                config.executorMultisig,
                config.rewardsCoordinatorInitPausedStatus,
                config.rewardsUpdater,
                config.activationDelay,
                config.globalCommissionBips
            )
        );
        Logging.logStep("RewardsCoordinator initialized");

        // Initialize AllocationManager
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(allocationManager))),
            address(allocationManagerImplementation),
            abi.encodeWithSelector(
                AllocationManager.initialize.selector,
                config.executorMultisig,
                config.allocationManagerInitPausedStatus
            )
        );
        Logging.logStep("AllocationManager initialized");

        // Initialize PermissionController (no initialization function)
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(payable(address(permissionController))),
            address(permissionControllerImplementation)
        );
        Logging.logStep("PermissionController upgraded");
    }

    function deployStrategies(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry,
        ProxyAdmin proxyAdmin
    ) internal {
        // Deploy base strategy implementation
        baseStrategyImplementation =
            new StrategyBaseTVLLimits(strategyManager, pauserRegistry, SEMVER);
        Logging.logContractDeployed("Strategy Implementation", address(baseStrategyImplementation));

        // Create default test token and strategy if needed
        // In a production environment, this would be replaced with actual token addresses
        if (block.chainid != 1) {
            // Only for non-mainnet
            address testToken = address(
                new ERC20PresetFixedSupply(
                    "TestToken", "TEST", 1000000 ether, config.executorMultisig
                )
            );
            Logging.logContractDeployed("TestToken", testToken);

            // Create strategy for test token
            StrategyBaseTVLLimits strategy = StrategyBaseTVLLimits(
                address(
                    new TransparentUpgradeableProxy(
                        address(baseStrategyImplementation),
                        address(proxyAdmin),
                        abi.encodeWithSelector(
                            StrategyBaseTVLLimits.initialize.selector,
                            1000000 ether, // maxPerDeposit
                            10000000 ether, // maxDeposits
                            IERC20(testToken)
                        )
                    )
                )
            );

            deployedStrategies.push(strategy);
            Logging.logContractDeployed("Test Strategy", address(strategy));
        }
    }

    function deployProxyAdmin() internal returns (ProxyAdmin) {
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        return proxyAdmin;
    }

    function deployPauserRegistry(
        EigenLayerConfig memory config
    ) internal returns (PauserRegistry) {
        // Use the array of pauser addresses directly from the config
        return new PauserRegistry(config.pauserAddresses, config.unpauserAddress);
    }

    function buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array using the shared library
        bytes32 merkleRoot = MerkleUtils.calculateMerkleRoot(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

    function deployBeefyClient(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            buildValidatorSet(0, config.initialValidators);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            buildValidatorSet(1, config.nextValidators);

        // Deploy BeefyClient
        return new BeefyClient(
            config.randaoCommitDelay,
            config.randaoCommitExpiration,
            config.minNumRequiredSignatures,
            config.startBlock,
            validatorSet,
            nextValidatorSet
        );
    }

    function outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
        VetoableSlasher vetoableSlasher,
        RewardsRegistry rewardsRegistry,
        address agent
    ) internal {
        Logging.logHeader("DEPLOYMENT SUMMARY");

        Logging.logSection("Snowbridge Contracts");
        Logging.logContractDeployed("BeefyClient", address(beefyClient));
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));
        Logging.logContractDeployed("Gateway", address(gateway));
        Logging.logContractDeployed("Agent", agent);

        Logging.logSection("DataHaven Contracts");
        Logging.logContractDeployed("ServiceManager", address(serviceManager));
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));

        Logging.logSection("EigenLayer Core Contracts");
        Logging.logContractDeployed("DelegationManager", address(delegation));
        Logging.logContractDeployed("StrategyManager", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory", address(avsDirectory));
        Logging.logContractDeployed("EigenPodManager", address(eigenPodManager));
        Logging.logContractDeployed("EigenPodBeacon", address(eigenPodBeacon));
        Logging.logContractDeployed("RewardsCoordinator", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager", address(allocationManager));
        Logging.logContractDeployed("PermissionController", address(permissionController));

        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = vm.envOr("NETWORK", string("anvil"));
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
        json =
            string.concat(json, '"VetoableSlasher": "', vm.toString(address(vetoableSlasher)), '",');
        json =
            string.concat(json, '"RewardsRegistry": "', vm.toString(address(rewardsRegistry)), '",');
        json = string.concat(json, '"Agent": "', vm.toString(agent), '",');

        // EigenLayer contracts
        json = string.concat(json, '"DelegationManager": "', vm.toString(address(delegation)), '",');
        json =
            string.concat(json, '"StrategyManager": "', vm.toString(address(strategyManager)), '",');
        json = string.concat(json, '"AVSDirectory": "', vm.toString(address(avsDirectory)), '",');
        json =
            string.concat(json, '"EigenPodManager": "', vm.toString(address(eigenPodManager)), '",');
        json =
            string.concat(json, '"EigenPodBeacon": "', vm.toString(address(eigenPodBeacon)), '",');
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
}
