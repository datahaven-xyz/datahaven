// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeployParams} from "./DeployParams.s.sol";

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
    uint256 internal deployerPrivateKey = vm.envOr(
        "DEPLOYER_PRIVATE_KEY",
        uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // First pre-funded account from Anvil
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

    function run() public {
        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Start the broadcast for the deployment transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy EigenLayer core contracts
        console.log(
            "[Deployment] =========== Starting EigenLayer core contracts deployment ==========="
        );

        // Deploy proxy admin for ability to upgrade proxy contracts
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        console.log("[Deployment] ProxyAdmin deployed at", address(proxyAdmin));

        // Deploy pauser registry
        PauserRegistry pauserRegistry = deployPauserRegistry(eigenLayerConfig);
        console.log("[Deployment] PauserRegistry deployed at", address(pauserRegistry));

        // Deploy empty contract to use as initial implementation for proxies
        emptyContract = new EmptyContract();
        console.log("[Deployment] EmptyContract deployed at", address(emptyContract));

        // Deploy proxies that will point to implementations
        deployProxies(proxyAdmin);
        console.log("[Deployment] Initial proxies deployed");

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());

        // Deploy EigenPod implementation and beacon
        eigenPodImplementation = new EigenPod(
            ethPOSDeposit, eigenPodManager, eigenLayerConfig.beaconChainGenesisTimestamp, SEMVER
        );
        eigenPodBeacon = new UpgradeableBeacon(address(eigenPodImplementation));
        console.log("[Deployment] EigenPod implementation and beacon deployed");

        // Deploy implementation contracts
        deployImplementations(eigenLayerConfig, pauserRegistry);
        console.log("[Deployment] Implementation contracts deployed");

        // Upgrade proxies to point to implementations and initialize
        upgradeAndInitializeProxies(eigenLayerConfig, proxyAdmin);
        console.log("[Deployment] Proxies upgraded and initialized");

        // Deploy strategy implementation and create strategy proxies
        deployStrategies(eigenLayerConfig, pauserRegistry, proxyAdmin);
        console.log("[Deployment] Strategy contracts deployed");

        // Transfer ownership of core contracts
        proxyAdmin.transferOwnership(eigenLayerConfig.executorMultisig);
        eigenPodBeacon.transferOwnership(eigenLayerConfig.executorMultisig);
        console.log("[Deployment] =========== EigenLayer core contracts deployed ===========");

        // Deploy DataHaven custom contracts
        console.log(
            "[Deployment] =========== Starting DataHaven custom contracts deployment ==========="
        );

        // Deploy the Service Manager
        DataHavenServiceManager serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);

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

        console.log("[Deployment] ServiceManager deployed at", address(serviceManager));

        // Deploy VetoableSlasher
        VetoableSlasher vetoableSlasher = new VetoableSlasher(
            allocationManager,
            serviceManager,
            avsConfig.vetoCommitteeMember,
            avsConfig.vetoWindowBlocks
        );

        console.log("[Deployment] VetoableSlasher deployed at", address(vetoableSlasher));

        // Deploy RewardsRegistry
        RewardsRegistry rewardsRegistry = new RewardsRegistry(
            address(serviceManager),
            address(0) // Will be set to the Agent address after creation
        );

        console.log("[Deployment] RewardsRegistry deployed at", address(rewardsRegistry));

        // Set the slasher in the ServiceManager
        serviceManager.setSlasher(vetoableSlasher);
        console.log("[Deployment] Slasher set in ServiceManager");
        console.log("[Deployment] =========== DataHaven custom contracts deployed ===========");

        // Deploy Snowbridge and configure Agent
        (
            BeefyClient beefyClient,
            AgentExecutor agentExecutor,
            IGatewayV2 gateway,
            address payable agentAddress
        ) = deploySnowbridge(snowbridgeConfig);

        // Set the Agent in the RewardsRegistry
        rewardsRegistry.setRewardsAgent(agentAddress);
        console.log("[Deployment] Agent set in RewardsRegistry at", agentAddress);

        // Set the RewardsRegistry in the ServiceManager
        serviceManager.setRewardsRegistry(0, rewardsRegistry);
        console.log("[Deployment] RewardsRegistry set in ServiceManager");

        vm.stopBroadcast();

        // Output all deployed contract addresses
        outputDeployedAddresses(
            beefyClient,
            agentExecutor,
            gateway,
            serviceManager,
            vetoableSlasher,
            rewardsRegistry,
            agentAddress
        );
    }

    function deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        console.log("[Deployment] =========== Starting Snowbridge deployment ===========");

        BeefyClient beefyClient = deployBeefyClient(config);
        AgentExecutor agentExecutor = new AgentExecutor();
        Gateway gatewayImplementation = new Gateway(address(beefyClient), address(agentExecutor));

        console.log("[Deployment] Snowbridge base contracts deployed");

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

        console.log("[Deployment] Gateway proxy deployed at", address(gateway));

        // Create Agent
        gateway.v2_createAgent(config.rewardsMessageOrigin);
        address payable agentAddress = payable(gateway.agentOf(config.rewardsMessageOrigin));

        console.log("[Deployment] Agent created at", agentAddress);
        console.log("[Deployment] =========== Snowbridge deployment completed ===========");

        return (beefyClient, agentExecutor, gateway, agentAddress);
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
        strategyManager = StrategyManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        avsDirectory = AVSDirectory(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        eigenPodManager = EigenPodManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        permissionController = PermissionController(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
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

        strategyManagerImplementation = new StrategyManager(delegation, pauserRegistry, SEMVER);

        avsDirectoryImplementation = new AVSDirectory(delegation, pauserRegistry, SEMVER);

        eigenPodManagerImplementation =
            new EigenPodManager(ethPOSDeposit, eigenPodBeacon, delegation, pauserRegistry, SEMVER);

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

        allocationManagerImplementation = new AllocationManager(
            delegation,
            pauserRegistry,
            permissionController,
            config.deallocationDelay,
            config.allocationConfigurationDelay,
            SEMVER
        );

        permissionControllerImplementation = new PermissionController(SEMVER);
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

        // Initialize PermissionController (no initialization function)
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(payable(address(permissionController))),
            address(permissionControllerImplementation)
        );
    }

    function deployStrategies(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry,
        ProxyAdmin proxyAdmin
    ) internal {
        // Deploy base strategy implementation
        baseStrategyImplementation =
            new StrategyBaseTVLLimits(strategyManager, pauserRegistry, SEMVER);

        // Create default test token and strategy if needed
        // In a production environment, this would be replaced with actual token addresses
        if (block.chainid != 1) {
            // Only for non-mainnet
            address testToken = address(
                new ERC20PresetFixedSupply(
                    "TestToken", "TEST", 1000000 ether, config.executorMultisig
                )
            );

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
            console.log("[Deployment] TestToken deployed at", testToken);
            console.log("[Deployment] Test Strategy deployed at", address(strategy));
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
        console.log("==========================================");
        console.log("Deployed Contract Addresses:");
        console.log("==========================================");
        console.log("BeefyClient:        ", address(beefyClient));
        console.log("AgentExecutor:      ", address(agentExecutor));
        console.log("Gateway:            ", address(gateway));
        console.log("ServiceManager:     ", address(serviceManager));
        console.log("VetoableSlasher:    ", address(vetoableSlasher));
        console.log("RewardsRegistry:    ", address(rewardsRegistry));
        console.log("Agent:              ", agent);
        console.log("==========================================");
        console.log("EigenLayer Core Contracts:");
        console.log("==========================================");
        console.log("DelegationManager:  ", address(delegation));
        console.log("StrategyManager:    ", address(strategyManager));
        console.log("AVSDirectory:       ", address(avsDirectory));
        console.log("EigenPodManager:    ", address(eigenPodManager));
        console.log("RewardsCoordinator: ", address(rewardsCoordinator));
        console.log("AllocationManager:  ", address(allocationManager));
        console.log("PermissionController:", address(permissionController));
        console.log("==========================================");

        // Write to deployment file for future reference
        string memory network = vm.envOr("NETWORK", string("localhost"));
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
        console.log("Deployment info saved to:", deploymentPath);
    }
}
