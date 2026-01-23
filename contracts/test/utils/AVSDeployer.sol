// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    TransparentUpgradeableProxy,
    ITransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IStrategyManager} from "eigenlayer-contracts/src/contracts/interfaces/IStrategyManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";
import {EigenStrategy} from "eigenlayer-contracts/src/contracts/strategies/EigenStrategy.sol";
import {EigenPodManagerMock} from "eigenlayer-contracts/src/test/mocks/EigenPodManagerMock.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {IEigenPodManager} from "eigenlayer-contracts/src/contracts/interfaces/IEigenPodManager.sol";
import {ERC20FixedSupply} from "./ERC20FixedSupply.sol";
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
// Mocks
import {RewardsCoordinatorMock} from "../mocks/RewardsCoordinatorMock.sol";
import {PermissionControllerMock} from "../mocks/PermissionControllerMock.sol";
import {SnowbridgeGatewayMock} from "../mocks/SnowbridgeGatewayMock.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";

import {Test, console, Vm} from "forge-std/Test.sol";

contract AVSDeployer is Test {
    using SafeCast for uint256;

    Vm public cheats = Vm(VM_ADDRESS);

    ProxyAdmin public proxyAdmin;
    PauserRegistry public pauserRegistry;

    EmptyContract public emptyContract;

    // AVS contracts
    DataHavenServiceManager public serviceManager;
    DataHavenServiceManager public serviceManagerImplementation;

    // Truncation is intentional - deriving a deterministic mock address from hash
    address public vetoCommitteeMember =
        address(uint160(uint256(keccak256("vetoCommitteeMember"))));
    uint32 public vetoWindowBlocks = 100; // 100 blocks veto window for tests

    // EigenLayer contracts
    StrategyManager public strategyManager;
    StrategyManager public strategyManagerImplementation;
    DelegationManager public delegationManager;
    DelegationManager public delegationManagerImplementation;
    EigenPodManagerMock public eigenPodManagerMock;
    AllocationManager public allocationManager;
    AllocationManager public allocationManagerImplementation;
    IStrategy public eigenStrategy;
    RewardsCoordinator public rewardsCoordinator;
    RewardsCoordinator public rewardsCoordinatorImplementation;
    RewardsCoordinatorMock public rewardsCoordinatorMock;
    PermissionControllerMock public permissionControllerMock;
    SnowbridgeGatewayMock public snowbridgeGatewayMock;

    // Addresses
    address public proxyAdminOwner = address(uint160(uint256(keccak256("proxyAdminOwner"))));
    address public regularDeployer = address(uint160(uint256(keccak256("regularDeployer"))));
    address public avsOwner = address(uint160(uint256(keccak256("avsOwner"))));
    address public rewardsInitiator = address(uint160(uint256(keccak256("rewardsInitiator"))));
    address public pauser = address(uint160(uint256(keccak256("pauser"))));
    address public unpauser = address(uint160(uint256(keccak256("unpauser"))));
    address public rewardsUpdater = address(uint160(uint256(keccak256("rewardsUpdater"))));
    address public strategyOwner = address(uint160(uint256(keccak256("strategyOwner"))));

    // RewardsCoordinator constants
    uint32 public constant CALCULATION_INTERVAL_SECONDS = 7 days;
    uint32 public constant MAX_REWARDS_DURATION = 70 days;
    uint32 public constant MAX_RETROACTIVE_LENGTH = 84 days;
    uint32 public constant MAX_FUTURE_LENGTH = 28 days;
    uint32 public constant GENESIS_REWARDS_TIMESTAMP = 1712188800;

    /// @notice Delay in timestamp before a posted root can be claimed against
    uint32 public activationDelay = 7 days;
    /// @notice the commission for all operators across all AVSs
    uint16 public globalCommissionBips = 1000;

    // Mock strategies
    IERC20[] public rewardTokens;
    uint256 public mockTokenInitialSupply = 10e50;
    IStrategy[] public deployedStrategies;
    StrategyBase public strategyImplementation;
    IRewardsCoordinator.StrategyAndMultiplier[] public defaultStrategyAndMultipliers;

    function _deployMockEigenLayerAndAVS() internal {
        emptyContract = new EmptyContract();

        // Deploy EigenLayer core contracts.
        cheats.startPrank(proxyAdminOwner);
        proxyAdmin = new ProxyAdmin();
        cheats.stopPrank();

        console.log("ProxyAdmin deployed");

        cheats.startPrank(regularDeployer);
        address[] memory pausers = new address[](1);
        pausers[0] = pauser;
        pauserRegistry = new PauserRegistry(pausers, unpauser);
        eigenPodManagerMock = new EigenPodManagerMock(pauserRegistry);
        permissionControllerMock = new PermissionControllerMock();
        rewardsCoordinatorMock = new RewardsCoordinatorMock();
        snowbridgeGatewayMock = new SnowbridgeGatewayMock();
        cheats.stopPrank();

        console.log("Mock EigenLayer contracts deployed");

        // Deploying proxy contracts for AllocationManager and StrategyManager.
        // The `proxyAdmin` contract is set as the admin of the proxy contracts,
        // which will be later upgraded to the actual implementation.
        cheats.prank(regularDeployer);
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        strategyManager = StrategyManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );

        console.log("AllocationManager and StrategyManager proxy contracts deployed");

        cheats.prank(regularDeployer);
        eigenStrategy =
            IStrategy(address(new EigenStrategy(strategyManager, pauserRegistry, "v-mock")));

        console.log("EigenStrategy deployed");

        // Deploying DelegationManager implementation and its proxy.
        cheats.prank(regularDeployer);
        delegationManagerImplementation = new DelegationManager(
            strategyManager,
            IEigenPodManager(address(eigenPodManagerMock)),
            allocationManager,
            pauserRegistry,
            permissionControllerMock,
            uint32(10), // MIN_WITHDRAWAL_DELAY_BLOCKS
            "v-mock"
        );
        cheats.prank(regularDeployer);
        delegationManager = DelegationManager(
            address(
                new TransparentUpgradeableProxy(
                    address(delegationManagerImplementation), address(proxyAdmin), ""
                )
            )
        );
        // Deploying AllocationManager implementation and upgrading the proxy.
        cheats.prank(regularDeployer);
        allocationManagerImplementation = new AllocationManager(
            delegationManager,
            eigenStrategy,
            pauserRegistry,
            permissionControllerMock,
            uint32(7 days), // DEALLOCATION_DELAY
            uint32(1 days), // ALLOCATION_CONFIGURATION_DELAY
            "v-mock"
        );
        cheats.prank(proxyAdminOwner);
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(address(allocationManager)),
            address(allocationManagerImplementation)
        );

        console.log("AllocationManager implementation deployed");

        // Deploying StrategyManager implementation and its proxy.
        cheats.prank(regularDeployer);
        strategyManagerImplementation =
            new StrategyManager(allocationManager, delegationManager, pauserRegistry, "v-mock");
        cheats.prank(proxyAdminOwner);
        uint256 allUnpaused = 0;
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(address(strategyManager)),
            address(strategyManagerImplementation),
            abi.encodeWithSelector(
                StrategyManager.initialize.selector, strategyOwner, strategyOwner, allUnpaused
            )
        );

        console.log("StrategyManager implementation deployed");

        // Deploying RewardsCoordinator implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        cheats.startPrank(regularDeployer);
        IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams memory params =
            IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams({
                delegationManager: delegationManager,
                strategyManager: IStrategyManager(address(strategyManager)),
                allocationManager: allocationManager,
                pauserRegistry: pauserRegistry,
                permissionController: permissionControllerMock,
                CALCULATION_INTERVAL_SECONDS: CALCULATION_INTERVAL_SECONDS,
                MAX_REWARDS_DURATION: MAX_REWARDS_DURATION,
                MAX_RETROACTIVE_LENGTH: MAX_RETROACTIVE_LENGTH,
                MAX_FUTURE_LENGTH: MAX_FUTURE_LENGTH,
                GENESIS_REWARDS_TIMESTAMP: GENESIS_REWARDS_TIMESTAMP,
                version: "v-mock"
            });
        rewardsCoordinatorImplementation = new RewardsCoordinator(params);
        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(
                    address(rewardsCoordinatorImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        RewardsCoordinator.initialize.selector,
                        msg.sender,
                        0, /*initialPausedStatus*/
                        rewardsUpdater,
                        activationDelay,
                        globalCommissionBips
                    )
                )
            )
        );
        cheats.stopPrank();

        console.log("RewardsCoordinator implementation deployed");

        // Set up strategies before deploying the ServiceManager
        _setUpDefaultStrategiesAndMultipliers();

        // Deploying ServiceManager implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        cheats.startPrank(regularDeployer);
        serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, allocationManager);

        // Create array for validators strategies required by DataHavenServiceManager
        IStrategy[] memory validatorsStrategies = new IStrategy[](deployedStrategies.length);

        // For testing purposes, we'll use the deployed strategies for validators
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            validatorsStrategies[i] = deployedStrategies[i];
        }

        serviceManager = DataHavenServiceManager(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        DataHavenServiceManager.initialize.selector,
                        avsOwner,
                        rewardsInitiator,
                        validatorsStrategies,
                        address(snowbridgeGatewayMock)
                    )
                )
            )
        );
        cheats.stopPrank();
        console.log("ServiceManager implementation deployed");
    }

    function _setUpDefaultStrategiesAndMultipliers() internal virtual {
        // Deploy mock tokens to be used for strategies.
        cheats.startPrank(strategyOwner);
        IERC20 token1 =
            new ERC20FixedSupply("dog wif hat", "MOCK1", mockTokenInitialSupply, address(this));
        IERC20 token2 =
            new ERC20FixedSupply("jeo boden", "MOCK2", mockTokenInitialSupply, address(this));
        IERC20 token3 =
            new ERC20FixedSupply("pepe wif avs", "MOCK3", mockTokenInitialSupply, address(this));

        // Deploy mock strategies.
        strategyImplementation =
            new StrategyBase(IStrategyManager(address(strategyManager)), pauserRegistry, "v-mock");
        deployedStrategies.push(
            StrategyBase(
                address(
                    new TransparentUpgradeableProxy(
                        address(strategyImplementation),
                        address(proxyAdmin),
                        abi.encodeWithSelector(
                            StrategyBase.initialize.selector, token1, pauserRegistry
                        )
                    )
                )
            )
        );
        deployedStrategies.push(
            StrategyBase(
                address(
                    new TransparentUpgradeableProxy(
                        address(strategyImplementation),
                        address(proxyAdmin),
                        abi.encodeWithSelector(
                            StrategyBase.initialize.selector, token2, pauserRegistry
                        )
                    )
                )
            )
        );
        deployedStrategies.push(
            StrategyBase(
                address(
                    new TransparentUpgradeableProxy(
                        address(strategyImplementation),
                        address(proxyAdmin),
                        abi.encodeWithSelector(
                            StrategyBase.initialize.selector, token3, pauserRegistry
                        )
                    )
                )
            )
        );
        cheats.stopPrank();

        deployedStrategies = _sortArrayAsc(deployedStrategies);

        cheats.startPrank(strategyOwner);
        strategyManager.addStrategiesToDepositWhitelist(deployedStrategies);
        cheats.stopPrank();

        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(
                IStrategy(address(deployedStrategies[0])), 1e18
            )
        );
        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(
                IStrategy(address(deployedStrategies[1])), 2e18
            )
        );
        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(
                IStrategy(address(deployedStrategies[2])), 3e18
            )
        );
    }

    function _labelContracts() internal {
        cheats.label(address(emptyContract), "EmptyContract");
        cheats.label(address(proxyAdmin), "ProxyAdmin");
        cheats.label(address(pauserRegistry), "PauserRegistry");
        cheats.label(address(delegationManager), "DelegationManager");
        cheats.label(address(eigenPodManagerMock), "EigenPodManagerMock");
        cheats.label(address(strategyManager), "StrategyManager");
        cheats.label(address(rewardsCoordinatorMock), "RewardsCoordinatorMock");
        cheats.label(address(allocationManager), "AllocationManager");
        cheats.label(address(allocationManagerImplementation), "AllocationManagerImplementation");
        cheats.label(address(serviceManager), "ServiceManager");
        cheats.label(address(serviceManagerImplementation), "ServiceManagerImplementation");
    }

    /// @dev Sort to ensure that the array is in ascending order for strategies
    function _sortArrayAsc(
        IStrategy[] memory arr
    ) internal pure returns (IStrategy[] memory) {
        uint256 l = arr.length;
        for (uint256 i = 0; i < l; i++) {
            for (uint256 j = i + 1; j < l; j++) {
                if (address(arr[i]) > address(arr[j])) {
                    IStrategy temp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = temp;
                }
            }
        }
        return arr;
    }

    function _incrementAddress(
        address start,
        uint256 inc
    ) internal pure returns (address) {
        return address((uint256(uint160(start)) + inc).toUint160());
    }

    function _incrementBytes32(
        bytes32 start,
        uint256 inc
    ) internal pure returns (bytes32) {
        return bytes32(uint256(start) + inc);
    }

    function _setERC20Balance(
        address token,
        address user,
        uint256 amount
    ) internal {
        // Assumes balanceOf is in slot 0 (standard in OpenZeppelin ERC20)
        bytes32 slot = keccak256(abi.encode(user, uint256(0)));
        cheats.store(token, slot, bytes32(amount));
    }
}
