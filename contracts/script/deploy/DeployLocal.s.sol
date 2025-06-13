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

    function run() public {
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
        ProxyAdmin proxyAdmin = _deployProxyAdmin();
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        // Deploy pauser registry
        PauserRegistry pauserRegistry = _deployPauserRegistry(eigenLayerConfig);
        Logging.logContractDeployed("PauserRegistry", address(pauserRegistry));

        // Deploy empty contract to use as initial implementation for proxies
        emptyContract = _deployEmptyContract();
        Logging.logContractDeployed("EmptyContract", address(emptyContract));

        // Deploy proxies that will point to implementations
        Logging.logSection("Deploying Proxy Contracts");
        _deployProxies(proxyAdmin);
        Logging.logStep("Initial proxies deployed successfully");

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        // Deploy EigenPod implementation and beacon
        eigenPodImplementation = _deployEigenPodImplementation(
            ethPOSDeposit, eigenPodManager, eigenLayerConfig.beaconChainGenesisTimestamp
        );
        Logging.logContractDeployed("EigenPod Implementation", address(eigenPodImplementation));

        eigenPodBeacon = _deployEigenPodBeacon(eigenPodImplementation);
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
        _transferProxyAdminOwnership(proxyAdmin, eigenLayerConfig.executorMultisig);
        _transferEigenPodBeaconOwnership(eigenPodBeacon, eigenLayerConfig.executorMultisig);
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
            RewardsRegistry rewardsRegistry
        ) = _deployDataHavenContracts(avsConfig, proxyAdmin, gateway);

        Logging.logFooter();
        _logProgress();

        // Set the Agent in the RewardsRegistry
        Logging.logHeader("FINAL CONFIGURATION");
        // This needs to be executed by the AVS owner
        _setRewardsAgent(serviceManager, 0, rewardsAgentAddress);
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
    }

    function _deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        Logging.logSection("Deploying Snowbridge Core Components");

        BeefyClient beefyClient = _deployBeefyClient(config);
        Logging.logContractDeployed("BeefyClient", address(beefyClient));

        AgentExecutor agentExecutor = _deployAgentExecutor();
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));

        Gateway gatewayImplementation = _deployGatewayImplementation(beefyClient, agentExecutor);
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

        IGatewayV2 gateway = _deployGatewayProxy(gatewayImplementation, gatewayConfig);
        Logging.logContractDeployed("Gateway Proxy", address(gateway));

        // Create Agent
        Logging.logSection("Creating Snowbridge Agent");
        _createSnowbridgeAgent(gateway, config.rewardsMessageOrigin);
        address payable rewardsAgentAddress = payable(gateway.agentOf(config.rewardsMessageOrigin));
        Logging.logContractDeployed("Rewards Agent", rewardsAgentAddress);

        return (beefyClient, agentExecutor, gateway, rewardsAgentAddress);
    }

    function _deployProxies(
        ProxyAdmin proxyAdmin
    ) internal {
        // Deploy proxies with empty implementation initially
        delegation =
            DelegationManager(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("DelegationManager Proxy", address(delegation));

        strategyManager =
            StrategyManager(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("StrategyManager Proxy", address(strategyManager));

        avsDirectory = AVSDirectory(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("AVSDirectory Proxy", address(avsDirectory));

        eigenPodManager =
            EigenPodManager(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("EigenPodManager Proxy", address(eigenPodManager));

        rewardsCoordinator =
            RewardsCoordinator(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("RewardsCoordinator Proxy", address(rewardsCoordinator));

        allocationManager =
            AllocationManager(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("AllocationManager Proxy", address(allocationManager));

        permissionController =
            PermissionController(_deployProxy(address(emptyContract), address(proxyAdmin), ""));
        Logging.logContractDeployed("PermissionController Proxy", address(permissionController));
    }

    function _deployImplementations(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry
    ) internal {
        // Deploy implementation contracts
        delegationImplementation = _deployDelegationImplementation(
            strategyManager,
            eigenPodManager,
            allocationManager,
            pauserRegistry,
            permissionController,
            config.minWithdrawalDelayBlocks
        );
        Logging.logContractDeployed(
            "DelegationManager Implementation", address(delegationImplementation)
        );

        strategyManagerImplementation =
            _deployStrategyManagerImplementation(delegation, pauserRegistry);
        Logging.logContractDeployed(
            "StrategyManager Implementation", address(strategyManagerImplementation)
        );

        avsDirectoryImplementation = _deployAVSDirectoryImplementation(delegation, pauserRegistry);
        Logging.logContractDeployed(
            "AVSDirectory Implementation", address(avsDirectoryImplementation)
        );

        eigenPodManagerImplementation = _deployEigenPodManagerImplementation(
            ethPOSDeposit, eigenPodBeacon, delegation, pauserRegistry
        );
        Logging.logContractDeployed(
            "EigenPodManager Implementation", address(eigenPodManagerImplementation)
        );

        rewardsCoordinatorImplementation = _deployRewardsCoordinatorImplementation(
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

        allocationManagerImplementation = _deployAllocationManagerImplementation(
            delegation,
            pauserRegistry,
            permissionController,
            config.deallocationDelay,
            config.allocationConfigurationDelay
        );
        Logging.logContractDeployed(
            "AllocationManager Implementation", address(allocationManagerImplementation)
        );

        permissionControllerImplementation = _deployPermissionControllerImplementation();
        Logging.logContractDeployed(
            "PermissionController Implementation", address(permissionControllerImplementation)
        );
    }

    function _upgradeAndInitializeProxies(
        EigenLayerConfig memory config,
        ProxyAdmin proxyAdmin
    ) internal {
        // Initialize DelegationManager
        {
            IStrategy[] memory strategies;
            uint256[] memory withdrawalDelayBlocks;

            _upgradeAndInitializeDelegationManager(
                proxyAdmin,
                config.executorMultisig,
                config.delegationInitPausedStatus,
                config.delegationWithdrawalDelayBlocks,
                strategies,
                withdrawalDelayBlocks
            );
            Logging.logStep("DelegationManager initialized");
        }

        // Initialize StrategyManager
        _upgradeAndInitializeStrategyManager(
            proxyAdmin,
            config.executorMultisig,
            config.operationsMultisig,
            config.strategyManagerInitPausedStatus
        );
        Logging.logStep("StrategyManager initialized");

        // Initialize AVSDirectory
        _upgradeAndInitializeAVSDirectory(
            proxyAdmin,
            config.executorMultisig,
            0 // Initial paused status
        );
        Logging.logStep("AVSDirectory initialized");

        // Initialize EigenPodManager
        _upgradeAndInitializeEigenPodManager(
            proxyAdmin, config.executorMultisig, config.eigenPodManagerInitPausedStatus
        );
        Logging.logStep("EigenPodManager initialized");

        // Initialize RewardsCoordinator
        _upgradeAndInitializeRewardsCoordinator(
            proxyAdmin,
            config.executorMultisig,
            config.rewardsCoordinatorInitPausedStatus,
            config.rewardsUpdater,
            config.activationDelay,
            config.globalCommissionBips
        );
        Logging.logStep("RewardsCoordinator initialized");

        // Initialize AllocationManager
        _upgradeAndInitializeAllocationManager(
            proxyAdmin, config.executorMultisig, config.allocationManagerInitPausedStatus
        );
        Logging.logStep("AllocationManager initialized");

        // Initialize PermissionController (no initialization function)
        _upgradePermissionController(proxyAdmin);
        Logging.logStep("PermissionController upgraded");
    }

    function _deployStrategies(PauserRegistry pauserRegistry, ProxyAdmin proxyAdmin) internal {
        // Deploy base strategy implementation
        baseStrategyImplementation = _deployStrategyImplementation(pauserRegistry);
        Logging.logContractDeployed("Strategy Implementation", address(baseStrategyImplementation));

        // Create default test token and strategy if needed
        // In a production environment, this would be replaced with actual token addresses.
        if (block.chainid != 1) {
            // We mint tokens to the operator account so that it then has a balance to deposit as stake.
            address testToken = _deployTestToken();
            Logging.logContractDeployed("TestToken", testToken);

            // Create strategy for test token
            StrategyBaseTVLLimits strategy =
                _deployTestStrategy(baseStrategyImplementation, proxyAdmin, testToken);

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
        _whitelistStrategies(strategies);
    }

    function _deployProxyAdmin() internal trackStateDiff returns (ProxyAdmin) {
        vm.broadcast(_deployerPrivateKey);
        return new ProxyAdmin();
    }

    function _deployEmptyContract() internal trackStateDiff returns (EmptyContract) {
        vm.broadcast(_deployerPrivateKey);
        return new EmptyContract();
    }

    function _deployEigenPodImplementation(
        IETHPOSDeposit ethPOSDeposit_,
        EigenPodManager eigenPodManager_,
        uint64 beaconChainGenesisTimestamp
    ) internal trackStateDiff returns (EigenPod) {
        vm.broadcast(_deployerPrivateKey);
        return new EigenPod(ethPOSDeposit_, eigenPodManager_, beaconChainGenesisTimestamp, SEMVER);
    }

    function _deployEigenPodBeacon(
        EigenPod implementation
    ) internal trackStateDiff returns (UpgradeableBeacon) {
        vm.broadcast(_deployerPrivateKey);
        return new UpgradeableBeacon(address(implementation));
    }

    function _transferProxyAdminOwnership(
        ProxyAdmin proxyAdmin,
        address newOwner
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.transferOwnership(newOwner);
    }

    function _transferEigenPodBeaconOwnership(
        UpgradeableBeacon beacon,
        address newOwner
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        beacon.transferOwnership(newOwner);
    }

    function _setRewardsAgent(
        DataHavenServiceManager serviceManager,
        uint32 operatorSetId,
        address rewardsAgent
    ) internal trackStateDiff {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(operatorSetId, rewardsAgent);
    }

    function _deployAgentExecutor() internal trackStateDiff returns (AgentExecutor) {
        vm.broadcast(_deployerPrivateKey);
        return new AgentExecutor();
    }

    function _deployGatewayImplementation(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor
    ) internal trackStateDiff returns (Gateway) {
        vm.broadcast(_deployerPrivateKey);
        return new Gateway(address(beefyClient), address(agentExecutor));
    }

    function _deployGatewayProxy(
        Gateway implementation,
        Initializer.Config memory config
    ) internal trackStateDiff returns (IGatewayV2) {
        vm.broadcast(_deployerPrivateKey);
        return IGatewayV2(address(new GatewayProxy(address(implementation), abi.encode(config))));
    }

    function _createSnowbridgeAgent(IGatewayV2 gateway, bytes32 origin) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        gateway.v2_createAgent(origin);
    }

    function _deployProxy(
        address implementation,
        address admin,
        bytes memory data
    ) internal trackStateDiff returns (address) {
        vm.broadcast(_deployerPrivateKey);
        return address(new TransparentUpgradeableProxy(implementation, admin, data));
    }

    function _deployBeefyClientContract(
        uint256 randaoCommitDelay,
        uint256 randaoCommitExpiration,
        uint256 minNumRequiredSignatures,
        uint256 startBlock,
        BeefyClient.ValidatorSet memory validatorSet,
        BeefyClient.ValidatorSet memory nextValidatorSet
    ) internal trackStateDiff returns (BeefyClient) {
        vm.broadcast(_deployerPrivateKey);
        return new BeefyClient(
            randaoCommitDelay,
            randaoCommitExpiration,
            minNumRequiredSignatures,
            uint64(startBlock),
            validatorSet,
            nextValidatorSet
        );
    }

    function _deployDelegationImplementation(
        StrategyManager strategyManager_,
        EigenPodManager eigenPodManager_,
        AllocationManager allocationManager_,
        PauserRegistry pauserRegistry_,
        PermissionController permissionController_,
        uint32 minWithdrawalDelayBlocks
    ) internal trackStateDiff returns (DelegationManager) {
        vm.broadcast(_deployerPrivateKey);
        return new DelegationManager(
            strategyManager_,
            eigenPodManager_,
            allocationManager_,
            pauserRegistry_,
            permissionController_,
            minWithdrawalDelayBlocks,
            SEMVER
        );
    }

    function _deployStrategyManagerImplementation(
        DelegationManager delegation_,
        PauserRegistry pauserRegistry_
    ) internal trackStateDiff returns (StrategyManager) {
        vm.broadcast(_deployerPrivateKey);
        return new StrategyManager(delegation_, pauserRegistry_, SEMVER);
    }

    function _deployAVSDirectoryImplementation(
        DelegationManager delegation_,
        PauserRegistry pauserRegistry_
    ) internal trackStateDiff returns (AVSDirectory) {
        vm.broadcast(_deployerPrivateKey);
        return new AVSDirectory(delegation_, pauserRegistry_, SEMVER);
    }

    function _deployEigenPodManagerImplementation(
        IETHPOSDeposit ethPOSDeposit_,
        UpgradeableBeacon eigenPodBeacon_,
        DelegationManager delegation_,
        PauserRegistry pauserRegistry_
    ) internal trackStateDiff returns (EigenPodManager) {
        vm.broadcast(_deployerPrivateKey);
        return new EigenPodManager(
            ethPOSDeposit_, eigenPodBeacon_, delegation_, pauserRegistry_, SEMVER
        );
    }

    function _deployRewardsCoordinatorImplementation(
        IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams memory params
    ) internal trackStateDiff returns (RewardsCoordinator) {
        vm.broadcast(_deployerPrivateKey);
        return new RewardsCoordinator(params);
    }

    function _deployAllocationManagerImplementation(
        DelegationManager delegation_,
        PauserRegistry pauserRegistry_,
        PermissionController permissionController_,
        uint32 deallocationDelay,
        uint32 allocationConfigurationDelay
    ) internal trackStateDiff returns (AllocationManager) {
        vm.broadcast(_deployerPrivateKey);
        return new AllocationManager(
            delegation_,
            pauserRegistry_,
            permissionController_,
            deallocationDelay,
            allocationConfigurationDelay,
            SEMVER
        );
    }

    function _deployPermissionControllerImplementation()
        internal
        trackStateDiff
        returns (PermissionController)
    {
        vm.broadcast(_deployerPrivateKey);
        return new PermissionController(SEMVER);
    }

    function _upgradeAndInitializeDelegationManager(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        uint256 delegationInitPausedStatus,
        uint32 delegationWithdrawalDelayBlocks,
        IStrategy[] memory strategies,
        uint256[] memory withdrawalDelayBlocks
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(delegation))),
            address(delegationImplementation),
            abi.encodeWithSelector(
                DelegationManager.initialize.selector,
                executorMultisig,
                delegationInitPausedStatus,
                delegationWithdrawalDelayBlocks,
                strategies,
                withdrawalDelayBlocks
            )
        );
    }

    function _upgradeAndInitializeStrategyManager(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        address operationsMultisig,
        uint256 strategyManagerInitPausedStatus
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(strategyManager))),
            address(strategyManagerImplementation),
            abi.encodeWithSelector(
                StrategyManager.initialize.selector,
                executorMultisig,
                operationsMultisig,
                strategyManagerInitPausedStatus
            )
        );
    }

    function _upgradeAndInitializeAVSDirectory(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        uint256 pausedStatus
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(avsDirectory))),
            address(avsDirectoryImplementation),
            abi.encodeWithSelector(AVSDirectory.initialize.selector, executorMultisig, pausedStatus)
        );
    }

    function _upgradeAndInitializeEigenPodManager(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        uint256 eigenPodManagerInitPausedStatus
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(eigenPodManager))),
            address(eigenPodManagerImplementation),
            abi.encodeWithSelector(
                EigenPodManager.initialize.selector,
                executorMultisig,
                eigenPodManagerInitPausedStatus
            )
        );
    }

    function _upgradeAndInitializeRewardsCoordinator(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        uint256 rewardsCoordinatorInitPausedStatus,
        address rewardsUpdater,
        uint32 activationDelay,
        uint16 globalCommissionBips
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(rewardsCoordinator))),
            address(rewardsCoordinatorImplementation),
            abi.encodeWithSelector(
                RewardsCoordinator.initialize.selector,
                executorMultisig,
                rewardsCoordinatorInitPausedStatus,
                rewardsUpdater,
                activationDelay,
                globalCommissionBips
            )
        );
    }

    function _upgradeAndInitializeAllocationManager(
        ProxyAdmin proxyAdmin,
        address executorMultisig,
        uint256 allocationManagerInitPausedStatus
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(allocationManager))),
            address(allocationManagerImplementation),
            abi.encodeWithSelector(
                AllocationManager.initialize.selector,
                executorMultisig,
                allocationManagerInitPausedStatus
            )
        );
    }

    function _upgradePermissionController(
        ProxyAdmin proxyAdmin
    ) internal trackStateDiff {
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(payable(address(permissionController))),
            address(permissionControllerImplementation)
        );
    }

    function _deployStrategyImplementation(
        PauserRegistry pauserRegistry
    ) internal trackStateDiff returns (StrategyBaseTVLLimits) {
        vm.broadcast(_deployerPrivateKey);
        return new StrategyBaseTVLLimits(strategyManager, pauserRegistry, SEMVER);
    }

    function _deployTestToken() internal trackStateDiff returns (address) {
        vm.broadcast(_deployerPrivateKey);
        return address(new ERC20PresetFixedSupply("TestToken", "TEST", 1000000 ether, _operator));
    }

    function _deployTestStrategy(
        StrategyBaseTVLLimits implementation,
        ProxyAdmin proxyAdmin,
        address testToken
    ) internal trackStateDiff returns (StrategyBaseTVLLimits) {
        vm.broadcast(_deployerPrivateKey);
        return StrategyBaseTVLLimits(
            address(
                new TransparentUpgradeableProxy(
                    address(implementation),
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
    }

    function _whitelistStrategies(
        IStrategy[] memory strategies
    ) internal trackStateDiff {
        vm.broadcast(_operationsMultisigPrivateKey);
        strategyManager.addStrategiesToDepositWhitelist(strategies);
    }

    function _deployServiceManagerImplementation()
        internal
        trackStateDiff
        returns (DataHavenServiceManager)
    {
        vm.broadcast(_deployerPrivateKey);
        return
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);
    }

    function _deployVetoableSlasher(
        DataHavenServiceManager serviceManager,
        address vetoCommitteeMember,
        uint256 vetoWindowBlocks
    ) internal trackStateDiff returns (VetoableSlasher) {
        vm.broadcast(_deployerPrivateKey);
        return new VetoableSlasher(
            allocationManager, serviceManager, vetoCommitteeMember, uint32(vetoWindowBlocks)
        );
    }

    function _deployRewardsRegistry(
        DataHavenServiceManager serviceManager
    ) internal trackStateDiff returns (RewardsRegistry) {
        vm.broadcast(_deployerPrivateKey);
        return new RewardsRegistry(
            address(serviceManager),
            address(0) // Will be set to the Agent address after creation
        );
    }

    function _updateAVSMetadata(
        DataHavenServiceManager serviceManager,
        string memory metadataURI
    ) internal trackStateDiff {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.updateAVSMetadataURI(metadataURI);
    }

    function _setSlasher(
        DataHavenServiceManager serviceManager,
        VetoableSlasher slasher
    ) internal trackStateDiff {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setSlasher(slasher);
    }

    function _setRewardsRegistry(
        DataHavenServiceManager serviceManager,
        uint32 operatorSetId,
        RewardsRegistry rewardsRegistry
    ) internal trackStateDiff {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsRegistry(operatorSetId, rewardsRegistry);
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
    ) internal returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            _buildValidatorSet(0, config.initialValidators);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            _buildValidatorSet(1, config.nextValidators);

        // Deploy BeefyClient
        return _deployBeefyClientContract(
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

    function _deployDataHavenContracts(
        AVSConfig memory avsConfig,
        ProxyAdmin proxyAdmin,
        IGatewayV2 gateway
    ) internal returns (DataHavenServiceManager, VetoableSlasher, RewardsRegistry) {
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        DataHavenServiceManager serviceManagerImplementation = _deployServiceManagerImplementation();
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
        VetoableSlasher vetoableSlasher = _deployVetoableSlasher(
            serviceManager, avsConfig.vetoCommitteeMember, avsConfig.vetoWindowBlocks
        );
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));

        // Deploy RewardsRegistry
        RewardsRegistry rewardsRegistry = _deployRewardsRegistry(serviceManager);
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));

        Logging.logSection("Configuring Service Manager");

        // Register the DataHaven service in the AllocationManager
        _updateAVSMetadata(serviceManager, "");
        Logging.logStep("DataHaven service registered in AllocationManager");

        // Set the slasher in the ServiceManager
        _setSlasher(serviceManager, vetoableSlasher);
        Logging.logStep("Slasher set in ServiceManager");

        // Set the RewardsRegistry in the ServiceManager
        uint32 validatorsSetId = serviceManager.VALIDATORS_SET_ID();
        _setRewardsRegistry(serviceManager, validatorsSetId, rewardsRegistry);
        Logging.logStep("RewardsRegistry set in ServiceManager");

        return (serviceManager, vetoableSlasher, rewardsRegistry);
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
}
