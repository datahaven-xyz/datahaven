// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {ISignatureUtils} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtils.sol";
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
    address public registryCoordinatorOwner =
        address(uint160(uint256(keccak256("registryCoordinatorOwner"))));
    address public pauser = address(uint160(uint256(keccak256("pauser"))));
    address public unpauser = address(uint160(uint256(keccak256("unpauser"))));

    uint256 churnApproverPrivateKey =
        uint256(keccak256("churnApproverPrivateKey"));
    address churnApprover = cheats.addr(churnApproverPrivateKey);
    bytes32 defaultSalt = bytes32(uint256(keccak256("defaultSalt")));

    address ejector = address(uint160(uint256(keccak256("ejector"))));

    address defaultOperator =
        address(uint160(uint256(keccak256("defaultOperator"))));
    bytes32 defaultOperatorId;
    string defaultSocket = "69.69.69.69:420";
    uint96 defaultStake = 1 ether;
    uint8 defaultQuorumNumber = 0;

    uint32 defaultMaxOperatorCount = 10;
    uint16 defaultKickBIPsOfOperatorStake = 15000;
    uint16 defaultKickBIPsOfTotalStake = 150;
    uint8 numQuorums = 192;

    uint8 maxQuorumsToRegisterFor = 4;
    uint256 maxOperatorsToRegister = 4;
    uint32 registrationBlockNumber = 100;
    uint32 blocksBetweenRegistrations = 10;

    uint256 MAX_QUORUM_BITMAP = type(uint192).max;

    function _deployMockEigenLayerAndAVS() internal {
        emptyContract = new EmptyContract();

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

        cheats.startPrank(registryCoordinatorOwner);
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

        cheats.startPrank(proxyAdminOwner);
        serviceManagerImplementation = new ServiceManagerMock(
            IRewardsCoordinator(address(rewardsCoordinatorMock)),
            permissionControllerMock,
            allocationManagerMock
        );
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(address(serviceManager)),
            address(serviceManagerImplementation)
        );

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

        serviceManager.initialize({
            initialOwner: registryCoordinatorOwner,
            rewardsInitiator: proxyAdminOwner
        });
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
