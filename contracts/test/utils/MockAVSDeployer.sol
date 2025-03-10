// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {ISignatureUtils} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtils.sol";
import {IStrategyManager} from "eigenlayer-contracts/src/contracts/interfaces/IStrategyManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {IAVSDirectory} from "eigenlayer-contracts/src/contracts/interfaces/IAVSDirectory.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {PermissionController} from "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";

import {IServiceManager} from "../../src/interfaces/IServiceManager.sol";

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

    ServiceManagerMock public serviceManager;
    ServiceManagerMock public serviceManagerImplementation;

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

    address public proxyAdminOwner =
        address(uint160(uint256(keccak256("proxyAdminOwner"))));
    address public avsOwner = address(uint160(uint256(keccak256("avsOwner"))));
    address public rewardsInitiator =
        address(uint160(uint256(keccak256("rewardsInitiator"))));
    address public pauser = address(uint160(uint256(keccak256("pauser"))));
    address public unpauser = address(uint160(uint256(keccak256("unpauser"))));
    address public rewardsUpdater =
        address(uint160(uint256(keccak256("rewardsUpdater"))));

    uint32 CALCULATION_INTERVAL_SECONDS = 7 days;
    uint32 MAX_REWARDS_DURATION = 70 days;
    uint32 MAX_RETROACTIVE_LENGTH = 84 days;
    uint32 MAX_FUTURE_LENGTH = 28 days;
    uint32 GENESIS_REWARDS_TIMESTAMP = 1712188800;

    /// @notice Delay in timestamp before a posted root can be claimed against
    uint32 activationDelay = 7 days;
    /// @notice the commission for all operators across all AVSs
    uint16 globalCommissionBips = 1000;

    function _deployMockEigenLayerAndAVS() internal {
        emptyContract = new EmptyContract();

        // Deploy EigenLayer core contracts.
        cheats.startPrank(proxyAdminOwner);
        proxyAdmin = new ProxyAdmin();
        address[] memory pausers = new address[](1);
        pausers[0] = pauser;
        pauserRegistry = new PauserRegistry(pausers, unpauser);
        delegationMock = new DelegationMock();
        eigenPodManagerMock = new EigenPodManagerMock(pauserRegistry);
        strategyManagerMock = new StrategyManagerMock(delegationMock);
        allocationManagerMock = new AllocationManagerMock();
        permissionControllerMock = new PermissionControllerMock();
        rewardsCoordinatorMock = new RewardsCoordinatorMock();
        strategyManagerMock.setDelegationManager(delegationMock);
        cheats.stopPrank();

        // Deploying proxy contracts for ServiceManager, and AllocationManager.
        // The `proxyAdmin` contract is set as the admin of the proxy contracts,
        // which will be later upgraded to the actual implementation.
        cheats.startPrank(avsOwner);
        serviceManager = ServiceManagerMock(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
        cheats.stopPrank();

        // Deploying AllocationManager implementation and upgrading the proxy.
        allocationManagerImplementation = new AllocationManager(
            delegationMock,
            pauserRegistry,
            permissionControllerMock,
            uint32(7 days), // DEALLOCATION_DELAY
            uint32(1 days) // ALLOCATION_CONFIGURATION_DELAY
        );
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(address(allocationManager)),
            address(allocationManagerImplementation)
        );

        // Deploying RewardsCoordinator implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        rewardsCoordinatorImplementation = new RewardsCoordinator(
            delegationMock,
            IStrategyManager(address(strategyManagerMock)),
            allocationManagerMock,
            pauserRegistry,
            permissionControllerMock,
            CALCULATION_INTERVAL_SECONDS,
            MAX_REWARDS_DURATION,
            MAX_RETROACTIVE_LENGTH,
            MAX_FUTURE_LENGTH,
            GENESIS_REWARDS_TIMESTAMP
        );

        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(
                    address(rewardsCoordinatorImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        RewardsCoordinator.initialize.selector,
                        msg.sender,
                        0 /*initialPausedStatus*/,
                        rewardsUpdater,
                        activationDelay,
                        globalCommissionBips
                    )
                )
            )
        );

        // Deploying ServiceManager implementation and its proxy.
        // When the proxy is deployed, the `initialize` function is called.
        cheats.startPrank(proxyAdminOwner);
        serviceManagerImplementation = new ServiceManagerMock(
            rewardsCoordinator,
            permissionControllerMock,
            allocationManager
        );
        serviceManager = ServiceManagerMock(
            address(
                new TransparentUpgradeableProxy(
                    address(serviceManagerImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        ServiceManagerMock.initialize.selector,
                        avsOwner,
                        rewardsInitiator
                    )
                )
            )
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
        vm.label(
            address(allocationManagerImplementation),
            "AllocationManagerImplementation"
        );
        vm.label(address(serviceManager), "ServiceManager");
        vm.label(
            address(serviceManagerImplementation),
            "ServiceManagerImplementation"
        );
    }

    function _incrementAddress(
        address start,
        uint256 inc
    ) internal pure returns (address) {
        return address(uint160(uint256(uint160(start) + inc)));
    }

    function _incrementBytes32(
        bytes32 start,
        uint256 inc
    ) internal pure returns (bytes32) {
        return bytes32(uint256(start) + inc);
    }
}
