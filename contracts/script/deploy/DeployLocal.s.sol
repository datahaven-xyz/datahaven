// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeployParams} from "./DeployParams.s.sol";
import {Logging} from "../utils/Logging.sol";
import {Accounts} from "../utils/Accounts.sol";
import {StateDiffRecorder} from "../utils/StateDiffRecorder.sol";
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
import {ERC20PresetFixedSupply} from
    "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {TransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

// EigenLayer imports
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {EigenPod} from "eigenlayer-contracts/src/contracts/pods/EigenPod.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {StrategyBaseTVLLimits} from
    "eigenlayer-contracts/src/contracts/strategies/StrategyBaseTVLLimits.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";

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

// Struct to store more detailed strategy information
struct StrategyInfo {
    address address_;
    address underlyingToken;
    address tokenCreator;
}

contract Deploy is StateDiffRecorder, DeployParams, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps = 4; // Total major deployment steps

    // EigenLayer Contract declarations
    EmptyContract public emptyContract;
    RewardsCoordinator public rewardsCoordinator;
    RewardsCoordinator public rewardsCoordinatorImplementation;
    PermissionController public permissionController;
    PermissionController public permissionControllerImplementation;
    AllocationManager public allocationManager;
    AllocationManager public allocationManagerImplementation;
    DelegationManager public delegation;
    DelegationManager public delegationImplementation;
    StrategyManager public strategyManager;
    StrategyManager public strategyManagerImplementation;
    AVSDirectory public avsDirectory;
    AVSDirectory public avsDirectoryImplementation;
    EigenPodManager public eigenPodManager;
    EigenPodManager public eigenPodManagerImplementation;
    UpgradeableBeacon public eigenPodBeacon;
    EigenPod public eigenPodImplementation;
    StrategyBaseTVLLimits public baseStrategyImplementation;
    StrategyInfo[] public deployedStrategies;
    IETHPOSDeposit public ethPOSDeposit;

    // EigenLayer required semver
    string public constant SEMVER = "v1.0.0";

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    function run() public trackStateDiff {
        Logging.logHeader("DATAHAVEN DEPLOYMENT SCRIPT");
        console.log("|  Network: %s", vm.envOr("NETWORK", string("anvil")));
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        Logging.logFooter();

        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Deploy EigenLayer core contracts
        Logging.logHeader("EIGENLAYER CORE CONTRACTS DEPLOYMENT");
        Logging.logInfo("Deploying core infrastructure contracts");

        // Deploy proxy admin for ability to upgrade proxy contracts
        vm.broadcast(_deployerPrivateKey);
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        // Deploy pauser registry
        PauserRegistry pauserRegistry = _deployPauserRegistry(eigenLayerConfig);
        Logging.logContractDeployed("PauserRegistry", address(pauserRegistry));

        // Deploy empty contract to use as initial implementation for proxies
        vm.broadcast(_deployerPrivateKey);
        emptyContract = new EmptyContract();
        Logging.logContractDeployed("EmptyContract", address(emptyContract));

        // Deploy proxies that will point to implementations
        Logging.logSection("Deploying Proxy Contracts");
        _deployProxies(proxyAdmin);
        Logging.logStep("Initial proxies deployed successfully");

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        // Deploy EigenPod implementation and beacon
        vm.broadcast(_deployerPrivateKey);
        eigenPodImplementation = new EigenPod(
            ethPOSDeposit, eigenPodManager, eigenLayerConfig.beaconChainGenesisTimestamp, SEMVER
        );
        vm.broadcast(_deployerPrivateKey);
        eigenPodBeacon = new UpgradeableBeacon(address(eigenPodImplementation));
        Logging.logContractDeployed("EigenPod Implementation", address(eigenPodImplementation));
        Logging.logContractDeployed("EigenPod Beacon", address(eigenPodBeacon));

        // Deploy implementation contracts
        Logging.logSection("Deploying Implementation Contracts");
        _deployImplementations(eigenLayerConfig, pauserRegistry);
        Logging.logStep("Implementation contracts deployed successfully");

        // Upgrade proxies to point to implementations and initialise
        Logging.logSection("Initializing Contracts");
        _upgradeAndInitializeProxies(eigenLayerConfig, proxyAdmin);
        Logging.logStep("Proxies upgraded and initialized successfully");

        // Deploy strategy implementation and create strategy proxies
        Logging.logSection("Deploying Strategy Contracts");
        _deployStrategies(pauserRegistry, proxyAdmin);
        Logging.logStep("Strategy contracts deployed successfully");

        // Transfer ownership of core contracts
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.transferOwnership(eigenLayerConfig.executorMultisig);
        vm.broadcast(_deployerPrivateKey);
        eigenPodBeacon.transferOwnership(eigenLayerConfig.executorMultisig);
        Logging.logStep("Ownership transferred to multisig");

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
            VetoableSlasher vetoableSlasher,
            RewardsRegistry rewardsRegistry,
            bytes4 updateRewardsMerkleRootSelector
        ) = _deployDataHavenContracts(avsConfig, proxyAdmin, gateway);

        Logging.logFooter();
        _logProgress();

        // Set the Agent in the RewardsRegistry
        Logging.logHeader("FINAL CONFIGURATION");
        // This needs to be executed by the AVS owner
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(0, address(rewardsAgentAddress));
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
            vetoableSlasher,
            rewardsRegistry,
            rewardsAgentAddress
        );

        // Process and export final state diff
        finalizeStateDiff();
        // Output rewards info (Rewards agent address and origin, updateRewardsMerkleRoot function selector)
        _outputRewardsInfo(
            rewardsAgentAddress,
            snowbridgeConfig.rewardsMessageOrigin,
            updateRewardsMerkleRootSelector
        );
    }

    function _deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal trackStateDiff returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
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

    function _deployProxies(
        ProxyAdmin proxyAdmin
    ) internal trackStateDiff {
        // Deploy proxies with empty implementation initially
        vm.broadcast(_deployerPrivateKey);
        delegation = DelegationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("DelegationManager Proxy", address(delegation));

        vm.broadcast(_deployerPrivateKey);
        strategyManager = StrategyManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("StrategyManager Proxy", address(strategyManager));

        vm.broadcast(_deployerPrivateKey);
        avsDirectory = AVSDirectory(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("AVSDirectory Proxy", address(avsDirectory));

        vm.broadcast(_deployerPrivateKey);
        eigenPodManager = EigenPodManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("EigenPodManager Proxy", address(eigenPodManager));

        vm.broadcast(_deployerPrivateKey);
        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("RewardsCoordinator Proxy", address(rewardsCoordinator));

        vm.broadcast(_deployerPrivateKey);
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("AllocationManager Proxy", address(allocationManager));

        vm.broadcast(_deployerPrivateKey);
        permissionController = PermissionController(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        Logging.logContractDeployed("PermissionController Proxy", address(permissionController));
    }

    function _deployImplementations(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry
    ) internal trackStateDiff {
        // Deploy implementation contracts
        vm.broadcast(_deployerPrivateKey);
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

        vm.broadcast(_deployerPrivateKey);
        strategyManagerImplementation = new StrategyManager(delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "StrategyManager Implementation", address(strategyManagerImplementation)
        );

        vm.broadcast(_deployerPrivateKey);
        avsDirectoryImplementation = new AVSDirectory(delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "AVSDirectory Implementation", address(avsDirectoryImplementation)
        );

        vm.broadcast(_deployerPrivateKey);
        eigenPodManagerImplementation =
            new EigenPodManager(ethPOSDeposit, eigenPodBeacon, delegation, pauserRegistry, SEMVER);
        Logging.logContractDeployed(
            "EigenPodManager Implementation", address(eigenPodManagerImplementation)
        );

        vm.broadcast(_deployerPrivateKey);
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

        vm.broadcast(_deployerPrivateKey);
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

        vm.broadcast(_deployerPrivateKey);
        permissionControllerImplementation = new PermissionController(SEMVER);
        Logging.logContractDeployed(
            "PermissionController Implementation", address(permissionControllerImplementation)
        );
    }

    function _upgradeAndInitializeProxies(
        EigenLayerConfig memory config,
        ProxyAdmin proxyAdmin
    ) internal trackStateDiff {
        // Initialize DelegationManager
        {
            IStrategy[] memory strategies;
            uint256[] memory withdrawalDelayBlocks;

            vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
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
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(payable(address(permissionController))),
            address(permissionControllerImplementation)
        );
        Logging.logStep("PermissionController upgraded");
    }

    function _deployStrategies(
        PauserRegistry pauserRegistry,
        ProxyAdmin proxyAdmin
    ) internal trackStateDiff {
        // Deploy base strategy implementation
        vm.broadcast(_deployerPrivateKey);
        baseStrategyImplementation =
            new StrategyBaseTVLLimits(strategyManager, pauserRegistry, SEMVER);
        Logging.logContractDeployed("Strategy Implementation", address(baseStrategyImplementation));

        // Create default test token and strategy if needed
        // In a production environment, this would be replaced with actual token addresses.
        if (block.chainid != 1) {
            // We mint tokens to the operator account so that it then has a balance to deposit as stake.
            vm.broadcast(_deployerPrivateKey);
            address testToken =
                address(new ERC20PresetFixedSupply("TestToken", "TEST", 1000000 ether, _operator));
            Logging.logContractDeployed("TestToken", testToken);

            // Create strategy for test token
            vm.broadcast(_deployerPrivateKey);
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

            // Store the strategy with its token information
            deployedStrategies.push(
                StrategyInfo({
                    address_: address(strategy),
                    underlyingToken: testToken,
                    tokenCreator: _operator
                })
            );
            Logging.logContractDeployed("Test Strategy", address(strategy));
        }

        // Whitelist strategies in the strategy manager
        IStrategy[] memory strategies = new IStrategy[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategies[i] = IStrategy(deployedStrategies[i].address_);
        }
        vm.broadcast(_operationsMultisigPrivateKey);
        strategyManager.addStrategiesToDepositWhitelist(strategies);
    }

    function _deployProxyAdmin() internal trackStateDiff returns (ProxyAdmin) {
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        return proxyAdmin;
    }

    function _deployPauserRegistry(
        EigenLayerConfig memory config
    ) internal trackStateDiff returns (PauserRegistry) {
        // Use the array of pauser addresses directly from the config
        vm.broadcast(_deployerPrivateKey);
        return new PauserRegistry(config.pauserAddresses, config.unpauserAddress);
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
    ) internal trackStateDiff returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            _buildValidatorSet(0, config.initialValidators);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            _buildValidatorSet(1, config.nextValidators);

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

    function _outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
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

        Logging.logSection("EigenLayer Core Contracts");
        Logging.logContractDeployed("DelegationManager", address(delegation));
        Logging.logContractDeployed("StrategyManager", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory", address(avsDirectory));
        Logging.logContractDeployed("EigenPodManager", address(eigenPodManager));
        Logging.logContractDeployed("EigenPodBeacon", address(eigenPodBeacon));
        Logging.logContractDeployed("RewardsCoordinator", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager", address(allocationManager));
        Logging.logContractDeployed("PermissionController", address(permissionController));
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        Logging.logSection("Strategy Contracts");
        Logging.logContractDeployed(
            "BaseStrategyImplementation", address(baseStrategyImplementation)
        );
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            Logging.logContractDeployed(
                string.concat("DeployedStrategy", vm.toString(i)), deployedStrategies[i].address_
            );
        }

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
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');

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
            json, '"PermissionController": "', vm.toString(address(permissionController)), '",'
        );
        json = string.concat(json, '"ETHPOSDeposit": "', vm.toString(address(ethPOSDeposit)), '",');
        json = string.concat(
            json,
            '"BaseStrategyImplementation": "',
            vm.toString(address(baseStrategyImplementation)),
            '"'
        );

        // Add strategies with token information
        if (deployedStrategies.length > 0) {
            json = string.concat(json, ",");
            json = string.concat(json, '"DeployedStrategies": [');

            for (uint256 i = 0; i < deployedStrategies.length; i++) {
                json = string.concat(json, "{");
                json = string.concat(
                    json, '"address": "', vm.toString(deployedStrategies[i].address_), '",'
                );
                json = string.concat(
                    json,
                    '"underlyingToken": "',
                    vm.toString(deployedStrategies[i].underlyingToken),
                    '",'
                );
                json = string.concat(
                    json, '"tokenCreator": "', vm.toString(deployedStrategies[i].tokenCreator), '"'
                );
                json = string.concat(json, "}");

                // Add comma if not the last element
                if (i < deployedStrategies.length - 1) {
                    json = string.concat(json, ",");
                }
            }

            json = string.concat(json, "]");
        }

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
        string memory network = vm.envOr("NETWORK", string("anvil"));
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
        ProxyAdmin proxyAdmin,
        IGatewayV2 gateway
    ) internal trackStateDiff returns (DataHavenServiceManager, VetoableSlasher, RewardsRegistry, bytes4) {
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        vm.broadcast(_deployerPrivateKey);
        DataHavenServiceManager serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);
        Logging.logContractDeployed(
            "ServiceManager Implementation", address(serviceManagerImplementation)
        );

        // Extract strategies logic to a helper function to reduce local variables
        _prepareStrategiesForServiceManager(avsConfig, deployedStrategies);

        // Create service manager initialisation parameters struct to reduce stack variables
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
            _createServiceManagerProxy(serviceManagerImplementation, proxyAdmin, initParams);
        Logging.logContractDeployed("ServiceManager Proxy", address(serviceManager));

        // Deploy VetoableSlasher
        vm.broadcast(_deployerPrivateKey);
        VetoableSlasher vetoableSlasher = new VetoableSlasher(
            allocationManager,
            serviceManager,
            avsConfig.vetoCommitteeMember,
            avsConfig.vetoWindowBlocks
        );
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));

        // Deploy RewardsRegistry
        vm.broadcast(_deployerPrivateKey);
        RewardsRegistry rewardsRegistry = new RewardsRegistry(
            address(serviceManager),
            address(0) // Will be set to the Agent address after creation
        );
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));
        bytes4 updateRewardsMerkleRootSelector = IRewardsRegistry.updateRewardsMerkleRoot.selector;

        Logging.logSection("Configuring Service Manager");

        // Register the DataHaven service in the AllocationManager
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.updateAVSMetadataURI("");
        Logging.logStep("DataHaven service registered in AllocationManager");

        // Set the slasher in the ServiceManager
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setSlasher(vetoableSlasher);
        Logging.logStep("Slasher set in ServiceManager");

        // Set the RewardsRegistry in the ServiceManager
        uint32 validatorsSetId = serviceManager.VALIDATORS_SET_ID();
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsRegistry(validatorsSetId, rewardsRegistry);
        Logging.logStep("RewardsRegistry set in ServiceManager");

        return (serviceManager, vetoableSlasher, rewardsRegistry, updateRewardsMerkleRootSelector);
    }

    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ProxyAdmin proxyAdmin,
        ServiceManagerInitParams memory params
    ) internal trackStateDiff returns (DataHavenServiceManager) {
        vm.broadcast(_deployerPrivateKey);
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

    function _prepareStrategiesForServiceManager(
        AVSConfig memory config,
        StrategyInfo[] memory strategies
    ) internal pure {
        if (config.validatorsStrategies.length == 0) {
            config.validatorsStrategies = new address[](strategies.length);
            config.bspsStrategies = new address[](strategies.length);
            config.mspsStrategies = new address[](strategies.length);
            for (uint256 i = 0; i < strategies.length; i++) {
                config.validatorsStrategies[i] = strategies[i].address_;
                config.bspsStrategies[i] = strategies[i].address_;
                config.mspsStrategies[i] = strategies[i].address_;
            }
        }
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
