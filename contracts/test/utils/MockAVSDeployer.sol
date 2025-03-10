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

    /// @notice StakeRegistry, Constant used as a divisor in calculating weights.
    uint256 public constant WEIGHTING_DIVISOR = 1e18;

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
    BN254.G1Point internal defaultPubKey =
        BN254.G1Point(
            18260007818883133054078754218619977578772505796600400998181738095793040006897,
            3432351341799135763167709827653955074218841517684851694584291831827675065899
        );
    string defaultSocket = "69.69.69.69:420";
    uint96 defaultStake = 1 ether;
    uint8 defaultQuorumNumber = 0;

    uint32 defaultMaxOperatorCount = 10;
    uint16 defaultKickBIPsOfOperatorStake = 15000;
    uint16 defaultKickBIPsOfTotalStake = 150;
    uint8 numQuorums = 192;

    ISlashingRegistryCoordinatorTypes.OperatorSetParam[] operatorSetParams;

    uint8 maxQuorumsToRegisterFor = 4;
    uint256 maxOperatorsToRegister = 4;
    uint32 registrationBlockNumber = 100;
    uint32 blocksBetweenRegistrations = 10;

    IBLSApkRegistry.PubkeyRegistrationParams pubkeyRegistrationParams;

    struct OperatorMetadata {
        uint256 quorumBitmap;
        address operator;
        bytes32 operatorId;
        BN254.G1Point pubkey;
        uint96[] stakes; // in every quorum for simplicity
    }

    uint256 MAX_QUORUM_BITMAP = type(uint192).max;

    function _deployMockEigenLayerAndAVS() internal {
        _deployMockEigenLayerAndAVS(numQuorums);
    }

    function _deployMockEigenLayerAndAVS(uint8 numQuorumsToAdd) internal {
        emptyContract = new EmptyContract();
        defaultOperatorId = defaultPubKey.hashG1Point();

        cheats.startPrank(proxyAdminOwner);
        proxyAdmin = new ProxyAdmin();
        address[] memory pausers = new address[](1);
        pausers[0] = pauser;
        pauserRegistry = new PauserRegistry(pausers, unpauser);
        delegationMock = new DelegationMock();
        avsDirectoryMock = new AVSDirectoryMock();
        eigenPodManagerMock = new EigenPodManagerMock(pauserRegistry);
        strategyManagerMock = new StrategyManagerMock(delegationMock);
        allocationManagerMock = new AllocationManagerMock();
        permissionControllerMock = new PermissionControllerMock();
        avsDirectoryImplementation = new AVSDirectory(
            delegationMock,
            pauserRegistry
        ); // TODO: config value
        avsDirectory = AVSDirectory(
            address(
                new TransparentUpgradeableProxy(
                    address(avsDirectoryImplementation),
                    address(proxyAdmin),
                    abi.encodeWithSelector(
                        AVSDirectory.initialize.selector,
                        msg.sender, // initialOwner
                        0 // initialPausedStatus
                    )
                )
            )
        );
        rewardsCoordinatorMock = new RewardsCoordinatorMock();
        strategyManagerMock.setDelegationManager(delegationMock);
        cheats.stopPrank();

        cheats.startPrank(registryCoordinatorOwner);
        registryCoordinator = RegistryCoordinatorHarness(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
        stakeRegistry = StakeRegistryHarness(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
        indexRegistry = IndexRegistry(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
        blsApkRegistry = BLSApkRegistryHarness(
            address(
                new TransparentUpgradeableProxy(
                    address(emptyContract),
                    address(proxyAdmin),
                    ""
                )
            )
        );
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

        socketRegistry = SocketRegistry(
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

        stakeRegistryImplementation = new StakeRegistryHarness(
            ISlashingRegistryCoordinator(registryCoordinator),
            delegationMock,
            avsDirectory,
            allocationManagerMock
        );
        proxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(address(stakeRegistry))),
            address(stakeRegistryImplementation)
        );

        socketRegistryImplementation = new SocketRegistry(registryCoordinator);

        proxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(address(socketRegistry))),
            address(socketRegistryImplementation)
        );

        blsApkRegistryImplementation = new BLSApkRegistryHarness(
            registryCoordinator
        );
        proxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(address(blsApkRegistry))),
            address(blsApkRegistryImplementation)
        );

        indexRegistryImplementation = new IndexRegistry(registryCoordinator);
        proxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(address(indexRegistry))),
            address(indexRegistryImplementation)
        );

        serviceManagerImplementation = new ServiceManagerMock(
            avsDirectoryMock,
            IRewardsCoordinator(address(rewardsCoordinatorMock)),
            registryCoordinator,
            stakeRegistry,
            permissionControllerMock,
            allocationManagerMock
        );
        proxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(address(serviceManager))),
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
            TransparentUpgradeableProxy(payable(address(allocationManager))),
            address(allocationManagerImplementation)
        );

        serviceManager.initialize({
            initialOwner: registryCoordinatorOwner,
            rewardsInitiator: proxyAdminOwner
        });

        // set the public key for an operator, using harnessed function to bypass checks
        blsApkRegistry.setBLSPublicKey(defaultOperator, defaultPubKey);

        // setup the dummy minimum stake for quorum
        uint96[] memory minimumStakeForQuorum = new uint96[](numQuorumsToAdd);
        for (uint256 i = 0; i < minimumStakeForQuorum.length; i++) {
            minimumStakeForQuorum[i] = uint96(i + 1);
        }

        // setup the dummy quorum strategies
        IStakeRegistryTypes.StrategyParams[][]
            memory quorumStrategiesConsideredAndMultipliers = new IStakeRegistryTypes.StrategyParams[][](
                numQuorumsToAdd
            );
        for (
            uint256 i = 0;
            i < quorumStrategiesConsideredAndMultipliers.length;
            i++
        ) {
            quorumStrategiesConsideredAndMultipliers[
                i
            ] = new IStakeRegistryTypes.StrategyParams[](1);
            quorumStrategiesConsideredAndMultipliers[i][0] = IStakeRegistryTypes
                .StrategyParams(
                    IStrategy(address(uint160(i))),
                    uint96(WEIGHTING_DIVISOR)
                );
        }

        registryCoordinatorImplementation = new RegistryCoordinatorHarness(
            serviceManager,
            stakeRegistry,
            blsApkRegistry,
            indexRegistry,
            socketRegistry,
            allocationManagerMock,
            pauserRegistry
        );
        {
            proxyAdmin.upgradeAndCall(
                TransparentUpgradeableProxy(
                    payable(address(registryCoordinator))
                ),
                address(registryCoordinatorImplementation),
                abi.encodeCall(
                    SlashingRegistryCoordinator.initialize,
                    (
                        registryCoordinatorOwner, // _initialOwner
                        churnApprover, // _churnApprover
                        ejector, // _ejector
                        0, // _initialPausedStatus
                        address(serviceManager) // _accountIdentifier
                    )
                )
            );

            delete operatorSetParams;
            for (uint256 i = 0; i < numQuorumsToAdd; i++) {
                // hard code these for now
                operatorSetParams.push(
                    ISlashingRegistryCoordinatorTypes.OperatorSetParam({
                        maxOperatorCount: defaultMaxOperatorCount,
                        kickBIPsOfOperatorStake: defaultKickBIPsOfOperatorStake,
                        kickBIPsOfTotalStake: defaultKickBIPsOfTotalStake
                    })
                );
            }

            cheats.stopPrank();

            // add TOTAL_DELEGATED stake type quorums
            for (uint256 i = 0; i < numQuorumsToAdd; i++) {
                cheats.prank(registryCoordinator.owner());
                registryCoordinator.createTotalDelegatedStakeQuorum(
                    operatorSetParams[i],
                    minimumStakeForQuorum[i],
                    quorumStrategiesConsideredAndMultipliers[i]
                );
            }
        }

        operatorStateRetriever = new OperatorStateRetriever();

        // Set RegistryCoordinator as M2 state with existing quorums
        registryCoordinator.setM2QuorumBitmap(0);
        registryCoordinator.setOperatorSetsEnabled(false);
        registryCoordinator.setM2QuorumRegistrationDisabled(false);
    }

    function _labelContracts() internal {
        vm.label(address(emptyContract), "EmptyContract");
        vm.label(address(proxyAdmin), "ProxyAdmin");
        vm.label(address(pauserRegistry), "PauserRegistry");
        vm.label(address(delegationMock), "DelegationMock");
        vm.label(address(avsDirectoryMock), "AVSDirectoryMock");
        vm.label(address(eigenPodManagerMock), "EigenPodManagerMock");
        vm.label(address(strategyManagerMock), "StrategyManagerMock");
        vm.label(address(allocationManagerMock), "AllocationManagerMock");
        vm.label(
            address(avsDirectoryImplementation),
            "AVSDirectoryImplementation"
        );
        vm.label(address(avsDirectory), "AVSDirectory");
        vm.label(address(rewardsCoordinatorMock), "RewardsCoordinatorMock");
        vm.label(address(registryCoordinator), "RegistryCoordinator");
        vm.label(address(stakeRegistry), "StakeRegistry");
        vm.label(address(indexRegistry), "IndexRegistry");
        vm.label(address(blsApkRegistry), "BLSApkRegistry");
        vm.label(address(serviceManager), "ServiceManager");
        vm.label(address(allocationManager), "AllocationManager");
        vm.label(
            address(stakeRegistryImplementation),
            "StakeRegistryImplementation"
        );
        vm.label(
            address(blsApkRegistryImplementation),
            "BLSApkRegistryImplementation"
        );
        vm.label(
            address(indexRegistryImplementation),
            "IndexRegistryImplementation"
        );
        vm.label(
            address(serviceManagerImplementation),
            "ServiceManagerImplementation"
        );
        vm.label(
            address(allocationManagerImplementation),
            "AllocationManagerImplementation"
        );
    }

    /**
     * @notice registers operator with coordinator
     */
    function _registerOperatorWithCoordinator(
        address operator,
        uint256 quorumBitmap,
        BN254.G1Point memory pubKey
    ) internal {
        _registerOperatorWithCoordinator(
            operator,
            quorumBitmap,
            pubKey,
            defaultStake
        );
    }

    /**
     * @notice registers operator with coordinator
     */
    function _registerOperatorWithCoordinator(
        address operator,
        uint256 quorumBitmap,
        BN254.G1Point memory pubKey,
        uint96 stake
    ) internal {
        // quorumBitmap can only have 192 least significant bits
        quorumBitmap &= MAX_QUORUM_BITMAP;

        blsApkRegistry.setBLSPublicKey(operator, pubKey);

        bytes memory quorumNumbers = BitmapUtils.bitmapToBytesArray(
            quorumBitmap
        );
        for (uint256 i = 0; i < quorumNumbers.length; i++) {
            _setOperatorWeight(operator, uint8(quorumNumbers[i]), stake);
        }

        ISignatureUtils.SignatureWithSaltAndExpiry
            memory emptySignatureAndExpiry;
        cheats.prank(operator);
        registryCoordinator.registerOperator(
            quorumNumbers,
            defaultSocket,
            pubkeyRegistrationParams,
            emptySignatureAndExpiry
        );
    }

    /**
     * @notice registers operator with coordinator
     */
    function _registerOperatorWithCoordinator(
        address operator,
        uint256 quorumBitmap,
        BN254.G1Point memory pubKey,
        uint96[] memory stakes
    ) internal {
        // quorumBitmap can only have 192 least significant bits
        quorumBitmap &= MAX_QUORUM_BITMAP;

        blsApkRegistry.setBLSPublicKey(operator, pubKey);

        bytes memory quorumNumbers = BitmapUtils.bitmapToBytesArray(
            quorumBitmap
        );
        for (uint256 i = 0; i < quorumNumbers.length; i++) {
            _setOperatorWeight(
                operator,
                uint8(quorumNumbers[i]),
                stakes[uint8(quorumNumbers[i])]
            );
        }

        ISignatureUtils.SignatureWithSaltAndExpiry
            memory emptySignatureAndExpiry;
        cheats.prank(operator);
        registryCoordinator.registerOperator(
            quorumNumbers,
            defaultSocket,
            pubkeyRegistrationParams,
            emptySignatureAndExpiry
        );
    }

    function _registerRandomOperators(
        uint256 pseudoRandomNumber
    ) internal returns (OperatorMetadata[] memory, uint256[][] memory) {
        OperatorMetadata[] memory operatorMetadatas = new OperatorMetadata[](
            maxOperatorsToRegister
        );
        for (uint256 i = 0; i < operatorMetadatas.length; i++) {
            // limit to 16 quorums so we don't run out of gas, make them all register for quorum 0 as well
            operatorMetadatas[i].quorumBitmap =
                (uint256(
                    keccak256(
                        abi.encodePacked("quorumBitmap", pseudoRandomNumber, i)
                    )
                ) & (1 << (maxQuorumsToRegisterFor - 1))) |
                1;
            operatorMetadatas[i].operator = _incrementAddress(
                defaultOperator,
                i
            );
            operatorMetadatas[i].pubkey = BN254.hashToG1(
                keccak256(abi.encodePacked("pubkey", pseudoRandomNumber, i))
            );
            operatorMetadatas[i].operatorId = operatorMetadatas[i]
                .pubkey
                .hashG1Point();
            operatorMetadatas[i].stakes = new uint96[](maxQuorumsToRegisterFor);
            for (uint256 j = 0; j < maxQuorumsToRegisterFor; j++) {
                operatorMetadatas[i].stakes[j] = uint96(
                    uint64(
                        uint256(
                            keccak256(
                                abi.encodePacked(
                                    "stakes",
                                    pseudoRandomNumber,
                                    i,
                                    j
                                )
                            )
                        )
                    )
                );
            }
        }

        // get the index in quorumBitmaps of each operator in each quorum in the order they will register
        uint256[][] memory expectedOperatorOverallIndices = new uint256[][](
            numQuorums
        );
        for (uint256 i = 0; i < numQuorums; i++) {
            uint32 numOperatorsInQuorum;
            // for each quorumBitmap, check if the i'th bit is set
            for (uint256 j = 0; j < operatorMetadatas.length; j++) {
                if ((operatorMetadatas[j].quorumBitmap >> i) & 1 == 1) {
                    numOperatorsInQuorum++;
                }
            }
            expectedOperatorOverallIndices[i] = new uint256[](
                numOperatorsInQuorum
            );
            uint256 numOperatorCounter;
            for (uint256 j = 0; j < operatorMetadatas.length; j++) {
                if ((operatorMetadatas[j].quorumBitmap >> i) & 1 == 1) {
                    expectedOperatorOverallIndices[i][numOperatorCounter] = j;
                    numOperatorCounter++;
                }
            }
        }

        // register operators
        for (uint256 i = 0; i < operatorMetadatas.length; i++) {
            cheats.roll(
                registrationBlockNumber + blocksBetweenRegistrations * i
            );

            _registerOperatorWithCoordinator(
                operatorMetadatas[i].operator,
                operatorMetadatas[i].quorumBitmap,
                operatorMetadatas[i].pubkey,
                operatorMetadatas[i].stakes
            );
        }

        return (operatorMetadatas, expectedOperatorOverallIndices);
    }

    /**
     * @dev Set the operator weight for a given quorum. Note we have to do this by setting delegationMock operatorShares
     * Given each quorum must have at least one strategy, we set operatorShares for this strategy to this weight
     * Returns actual weight calculated set for operator shares in DelegationMock since multiplier and WEIGHTING_DIVISOR calculations
     * can give small rounding errors.
     */
    function _setOperatorWeight(
        address operator,
        uint8 quorumNumber,
        uint96 weight
    ) internal returns (uint96) {
        // Set StakeRegistry operator weight by setting DelegationManager operator shares
        (IStrategy strategy, uint96 multiplier) = stakeRegistry.strategyParams(
            quorumNumber,
            0
        );
        uint256 actualWeight = ((uint256(weight) * WEIGHTING_DIVISOR) /
            uint256(multiplier));
        delegationMock.setOperatorShares(operator, strategy, actualWeight);
        return uint96(actualWeight);
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

    function _signOperatorChurnApproval(
        address registeringOperator,
        bytes32 registeringOperatorId,
        ISlashingRegistryCoordinator.OperatorKickParam[]
            memory operatorKickParams,
        bytes32 salt,
        uint256 expiry
    )
        internal
        view
        returns (ISignatureUtils.SignatureWithSaltAndExpiry memory)
    {
        bytes32 digestHash = registryCoordinator
            .calculateOperatorChurnApprovalDigestHash(
                registeringOperator,
                registeringOperatorId,
                operatorKickParams,
                salt,
                expiry
            );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            churnApproverPrivateKey,
            digestHash
        );
        return
            ISignatureUtils.SignatureWithSaltAndExpiry({
                signature: abi.encodePacked(r, s, v),
                expiry: expiry,
                salt: salt
            });
    }

    function _createOperators(
        uint256 numOperators,
        uint256 startIndex
    ) internal returns (Operator[] memory) {
        Operator[] memory operators = new Operator[](numOperators);
        for (uint256 i = 0; i < numOperators; i++) {
            operators[i] = OperatorWalletLib.createOperator(
                string(abi.encodePacked("operator-", i + startIndex))
            );
        }
        return operators;
    }
}
