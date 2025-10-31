// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {DeployBase, StrategyInfo, ServiceManagerInitParams} from "./DeployBase.s.sol";

// Snowbridge imports for function signatures
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";

// Logging import
import {Logging} from "../utils/Logging.sol";
import {Accounts} from "../utils/Accounts.sol";
import {ValidatorsUtils} from "../utils/ValidatorsUtils.sol";

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

// DataHaven imports for function signatures
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";

// Additional imports specific to local deployment
import {
    ERC20PresetFixedSupply
} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

// EigenLayer core contract imports for implementation declarations
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {
    PermissionController
} from "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";

import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {EigenStrategy} from "eigenlayer-contracts/src/contracts/strategies/EigenStrategy.sol";
import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {EigenPod} from "eigenlayer-contracts/src/contracts/pods/EigenPod.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {
    StrategyBaseTVLLimits
} from "eigenlayer-contracts/src/contracts/strategies/StrategyBaseTVLLimits.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";

import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";

/**
 * @title DeployLocal
 * @notice Deployment script for local development (anvil) - deploys full EigenLayer infrastructure
 */
contract DeployLocal is DeployBase {
    // Local-specific EigenLayer Contract declarations
    EmptyContract public emptyContract;
    RewardsCoordinator public rewardsCoordinatorImplementation;
    PermissionController public permissionControllerImplementation;
    AllocationManager public allocationManagerImplementation;
    DelegationManager public delegationImplementation;
    StrategyManager public strategyManagerImplementation;
    AVSDirectory public avsDirectoryImplementation;
    EigenPodManager public eigenPodManagerImplementation;
    UpgradeableBeacon public eigenPodBeacon;
    EigenPod public eigenPodImplementation;
    StrategyBaseTVLLimits public baseStrategyImplementation;
    StrategyInfo[] public deployedStrategies;
    IStrategy public eigenStrategy;

    // EigenLayer required semver
    string public constant SEMVER = "v1.0.0";

    function run() public {
        totalSteps = 4; // Total major deployment steps for local
        _executeSharedDeployment();
    }

    // Implementation of abstract functions from DeployBase
    function _getNetworkName() internal pure override returns (string memory) {
        return "anvil";
    }

    function _getDeploymentMode() internal pure override returns (string memory) {
        return "LOCAL";
    }

    function _setupEigenLayerContracts(
        EigenLayerConfig memory eigenLayerConfig
    ) internal override returns (ProxyAdmin) {
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

        vm.broadcast(_deployerPrivateKey);
        eigenStrategy =
            IStrategy(address(new EigenStrategy(strategyManager, pauserRegistry, SEMVER)));
        Logging.logContractDeployed("EigenStrategy", address(eigenStrategy));

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        // Deploy EigenPod implementation and beacon
        vm.broadcast(_deployerPrivateKey);
        eigenPodImplementation = new EigenPod(ethPOSDeposit, eigenPodManager, SEMVER);
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
        return proxyAdmin;
    }

    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ProxyAdmin proxyAdmin,
        ServiceManagerInitParams memory params
    ) internal override returns (DataHavenServiceManager) {
        // Prepare strategies for service manager (local deployment has deployed strategies)
        _prepareStrategiesForServiceManager(params);

        vm.broadcast(_deployerPrivateKey);
        bytes memory initData = abi.encodeWithSelector(
            DataHavenServiceManager.initialise.selector,
            params.avsOwner,
            params.rewardsInitiator,
            params.validatorsStrategies,
            new IStrategy[](0), // FIXME remove when BSPs are removed
            new IStrategy[](0), // FIXME remove when MSPs are removed
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
        VetoableSlasher vetoableSlasher,
        RewardsRegistry rewardsRegistry,
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
        Logging.logContractDeployed("EigenStrategy", address(eigenStrategy));
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
        json = string.concat(
            json, '"VetoableSlasher": "', vm.toString(address(vetoableSlasher)), '",'
        );
        json = string.concat(
            json, '"RewardsRegistry": "', vm.toString(address(rewardsRegistry)), '",'
        );
        json = string.concat(json, '"RewardsAgent": "', vm.toString(rewardsAgent), '",');

        // EigenLayer contracts
        json = string.concat(json, '"DelegationManager": "', vm.toString(address(delegation)), '",');
        json = string.concat(
            json, '"StrategyManager": "', vm.toString(address(strategyManager)), '",'
        );
        json = string.concat(json, '"AVSDirectory": "', vm.toString(address(avsDirectory)), '",');
        json = string.concat(
            json, '"EigenPodManager": "', vm.toString(address(eigenPodManager)), '",'
        );
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

    // LOCAL-SPECIFIC FUNCTIONS

    function _prepareStrategiesForServiceManager(
        ServiceManagerInitParams memory params
    ) internal view {
        if (params.validatorsStrategies.length == 0) {
            params.validatorsStrategies = new address[](deployedStrategies.length);
            for (uint256 i = 0; i < deployedStrategies.length; i++) {
                params.validatorsStrategies[i] = deployedStrategies[i].address_;
            }
        }
    }

    function _deployProxies(
        ProxyAdmin proxyAdmin
    ) internal {
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
    ) internal {
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
        strategyManagerImplementation =
            new StrategyManager(allocationManager, delegation, pauserRegistry, SEMVER);
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
            eigenStrategy,
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
    ) internal {
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
                AllocationManager.initialize.selector, config.allocationManagerInitPausedStatus
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
    ) internal {
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
                    address_: address(strategy), underlyingToken: testToken, tokenCreator: _operator
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

    function _deployPauserRegistry(
        EigenLayerConfig memory config
    ) internal returns (PauserRegistry) {
        // Use the array of pauser addresses directly from the config
        vm.broadcast(_deployerPrivateKey);
        return new PauserRegistry(config.pauserAddresses, config.unpauserAddress);
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
