// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IStrategyManager} from "eigenlayer-contracts/src/contracts/interfaces/IStrategyManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {IAVSDirectory} from "eigenlayer-contracts/src/contracts/interfaces/IAVSDirectory.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";

import {ERC20FixedSupply} from "./ERC20FixedSupply.sol";
import {IServiceManager} from "../../src/interfaces/IServiceManager.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {IVetoableSlasher} from "../../src/interfaces/IVetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";
// Mocks
import {StrategyManagerMock} from "eigenlayer-contracts/src/test/mocks/StrategyManagerMock.sol";
import {RewardsCoordinatorMock} from "../mocks/RewardsCoordinatorMock.sol";
import {PermissionControllerMock} from "../mocks/PermissionControllerMock.sol";
import {EigenPodManagerMock} from "../mocks/EigenPodManagerMock.sol";
import {AllocationManagerMock} from "../mocks/AllocationManagerMock.sol";
import {DelegationMock} from "../mocks/DelegationMock.sol";
import {ServiceManagerMock} from "../mocks/ServiceManagerMock.sol";

import "forge-std/Test.sol";

contract MockAVSDeployer is Test {
    Vm cheats = Vm(VM_ADDRESS);

    ProxyAdmin public proxyAdmin;
    PauserRegistry public pauserRegistry;

    EmptyContract public emptyContract;

    // AVS contracts
    ServiceManagerMock public serviceManager;
    ServiceManagerMock public serviceManagerImplementation;
    VetoableSlasher public vetoableSlasher;
    RewardsRegistry public rewardsRegistry;

    // VetoableSlasher roles and parameters
    address public vetoCommitteeMember = address(uint160(uint256(keccak256("vetoCommitteeMember"))));
    uint32 public vetoWindowBlocks = 100; // 100 blocks veto window for tests

    // RewardsRegistry roles and parameters
    address public rewardsAgent = address(uint160(uint256(keccak256("rewardsAgent"))));

    // EigenLayer contracts
    StrategyManagerMock public strategyManagerMock;
    DelegationMock public delegationMock;
    EigenPodManagerMock public eigenPodManagerMock;
    AllocationManager public allocationManager;
    AllocationManager public allocationManagerImplementation;
    AllocationManagerMock public allocationManagerMock;
    RewardsCoordinator public rewardsCoordinator;
    RewardsCoordinator public rewardsCoordinatorImplementation;
    RewardsCoordinatorMock public rewardsCoordinatorMock;
    PermissionControllerMock public permissionControllerMock;

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
    uint32 CALCULATION_INTERVAL_SECONDS = 7 days;
    uint32 MAX_REWARDS_DURATION = 70 days;
    uint32 MAX_RETROACTIVE_LENGTH = 84 days;
    uint32 MAX_FUTURE_LENGTH = 28 days;
    uint32 GENESIS_REWARDS_TIMESTAMP = 1712188800;

    /// @notice Delay in timestamp before a posted root can be claimed against
    uint32 activationDelay = 7 days;
    /// @notice the commission for all operators across all AVSs
    uint16 globalCommissionBips = 1000;

    // Mock strategies
    IERC20[] rewardTokens;
    uint256 mockTokenInitialSupply = 10e50;
    IStrategy strategyMock1;
    IStrategy strategyMock2;
    IStrategy strategyMock3;
    StrategyBase strategyImplementation;
    IRewardsCoordinator.StrategyAndMultiplier[] defaultStrategyAndMultipliers;

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
        delegationMock = new DelegationMock();
        eigenPodManagerMock = new EigenPodManagerMock(pauserRegistry);
        allocationManagerMock = new AllocationManagerMock();
        permissionControllerMock = new PermissionControllerMock();
        rewardsCoordinatorMock = new RewardsCoordinatorMock();
        cheats.stopPrank();

        cheats.prank(strategyOwner);
        strategyManagerMock = new StrategyManagerMock(delegationMock);

        console.log("EigenLayer contracts deployed");

        // Deploying proxy contracts for ServiceManager, and AllocationManager.
        // The `proxyAdmin` contract is set as the admin of the proxy contracts,
        // which will be later upgraded to the actual implementation.
        cheats.prank(regularDeployer);
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );

        console.log("Proxy contracts deployed");

        // Deploying AllocationManager implementation and upgrading the proxy.
        cheats.prank(regularDeployer);
        allocationManagerImplementation = new AllocationManager(
            delegationMock,
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

        // Deploying RewardsCoordinator implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        cheats.startPrank(regularDeployer);
        IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams memory params =
        IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams({
            delegationManager: delegationMock,
            strategyManager: IStrategyManager(address(strategyManagerMock)),
            allocationManager: allocationManagerMock,
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

        // Deploying ServiceManager implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        cheats.startPrank(regularDeployer);
        serviceManagerImplementation =
            new ServiceManagerMock(rewardsCoordinator, permissionControllerMock, allocationManager);
        serviceManager = ServiceManagerMock(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        ServiceManagerMock.initialize.selector, avsOwner, rewardsInitiator
                    )
                )
            )
        );
        cheats.stopPrank();
        console.log("ServiceManager implementation deployed");

        // Deploy and configure the VetoableSlasher
        cheats.startPrank(regularDeployer);
        vetoableSlasher = new VetoableSlasher(
            allocationManager, serviceManager, vetoCommitteeMember, vetoWindowBlocks
        );
        cheats.stopPrank();

        // Set the slasher in the ServiceManager
        cheats.prank(avsOwner);
        serviceManager.setSlasher(vetoableSlasher);

        console.log("VetoableSlasher deployed and configured");

        // Deploy the RewardsRegistry contract
        cheats.prank(regularDeployer);
        rewardsRegistry = new RewardsRegistry(address(serviceManager), rewardsAgent);
    }

    function _setUpDefaultStrategiesAndMultipliers() internal virtual {
        // Deploy mock tokens to be used for strategies.
        vm.startPrank(strategyOwner);
        IERC20 token1 =
            new ERC20FixedSupply("dog wif hat", "MOCK1", mockTokenInitialSupply, address(this));
        IERC20 token2 =
            new ERC20FixedSupply("jeo boden", "MOCK2", mockTokenInitialSupply, address(this));
        IERC20 token3 =
            new ERC20FixedSupply("pepe wif avs", "MOCK3", mockTokenInitialSupply, address(this));

        // Deploy mock strategies.
        strategyImplementation = new StrategyBase(
            IStrategyManager(address(strategyManagerMock)), pauserRegistry, "v-mock"
        );
        strategyMock1 = StrategyBase(
            address(
                new TransparentUpgradeableProxy(
                    address(strategyImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(StrategyBase.initialize.selector, token1, pauserRegistry)
                )
            )
        );
        strategyMock2 = StrategyBase(
            address(
                new TransparentUpgradeableProxy(
                    address(strategyImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(StrategyBase.initialize.selector, token2, pauserRegistry)
                )
            )
        );
        strategyMock3 = StrategyBase(
            address(
                new TransparentUpgradeableProxy(
                    address(strategyImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(StrategyBase.initialize.selector, token3, pauserRegistry)
                )
            )
        );
        vm.stopPrank();

        IStrategy[] memory strategies = new IStrategy[](3);
        strategies[0] = strategyMock1;
        strategies[1] = strategyMock2;
        strategies[2] = strategyMock3;
        strategies = _sortArrayAsc(strategies);

        vm.startPrank(strategyOwner);
        strategyManagerMock.setStrategyWhitelist(strategies[0], true);
        strategyManagerMock.setStrategyWhitelist(strategies[1], true);
        strategyManagerMock.setStrategyWhitelist(strategies[2], true);
        vm.stopPrank();

        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(IStrategy(address(strategies[0])), 1e18)
        );
        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(IStrategy(address(strategies[1])), 2e18)
        );
        defaultStrategyAndMultipliers.push(
            IRewardsCoordinatorTypes.StrategyAndMultiplier(IStrategy(address(strategies[2])), 3e18)
        );
    }

    function _labelContracts() internal {
        vm.label(address(emptyContract), "EmptyContract");
        vm.label(address(proxyAdmin), "ProxyAdmin");
        vm.label(address(pauserRegistry), "PauserRegistry");
        vm.label(address(delegationMock), "DelegationMock");
        vm.label(address(eigenPodManagerMock), "EigenPodManagerMock");
        vm.label(address(strategyManagerMock), "StrategyManagerMock");
        vm.label(address(allocationManagerMock), "AllocationManagerMock");
        vm.label(address(rewardsCoordinatorMock), "RewardsCoordinatorMock");
        vm.label(address(allocationManager), "AllocationManager");
        vm.label(address(allocationManagerImplementation), "AllocationManagerImplementation");
        vm.label(address(serviceManager), "ServiceManager");
        vm.label(address(serviceManagerImplementation), "ServiceManagerImplementation");
        vm.label(address(vetoableSlasher), "VetoableSlasher");
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

    function _incrementAddress(address start, uint256 inc) internal pure returns (address) {
        return address(uint160(uint256(uint160(start) + inc)));
    }

    function _incrementBytes32(bytes32 start, uint256 inc) internal pure returns (bytes32) {
        return bytes32(uint256(start) + inc);
    }
}
