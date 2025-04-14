// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {Test, console, stdError} from "forge-std/Test.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {RewardsRegistry} from "../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry, IRewardsRegistryErrors} from "../src/interfaces/IRewardsRegistry.sol";
import {ServiceManagerMock} from "./mocks/ServiceManagerMock.sol";
import {IServiceManager, IServiceManagerErrors} from "../src/interfaces/IServiceManager.sol";

contract ServiceManagerRewardsRegistryTest is MockAVSDeployer {
    // Test addresses
    address public operatorAddress;
    address public nonOperatorAddress;

    // Test data
    uint32 public operatorSetId;
    bytes32 public merkleRoot;
    uint256 public operatorPoints;
    bytes32[] public validProof;

    // Events
    event RewardsRegistrySet(uint32 indexed operatorSetId, address indexed rewardsRegistry);
    event RewardsClaimed(address indexed operatorAddress, uint256 points, uint256 rewardsAmount);

    function setUp() public {
        _deployMockEigenLayerAndAVS();

        // Set up test addresses
        operatorAddress = address(0xABCD);
        nonOperatorAddress = address(0x5678);

        // Configure test data
        operatorSetId = 1;
        operatorPoints = 100;

        // Create a merkle tree where we know what the root should be based on our leaf
        bytes32 leaf = keccak256(abi.encode(operatorAddress, operatorPoints));
        bytes32 siblingLeaf = keccak256(abi.encodePacked("sibling"));
        (bytes32 leftLeaf, bytes32 rightLeaf) =
            leaf < siblingLeaf ? (leaf, siblingLeaf) : (siblingLeaf, leaf);
        merkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));
        validProof = new bytes32[](1);
        validProof[0] = siblingLeaf;

        // Set up the rewards registry for the operator set
        vm.prank(avsOwner);
        serviceManager.setRewardsRegistry(operatorSetId, IRewardsRegistry(address(rewardsRegistry)));

        // Set the merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Add funds to the registry for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);
    }

    function test_setRewardsRegistry() public {
        uint32 newOperatorSetId = 2;
        RewardsRegistry newRewardsRegistry =
            new RewardsRegistry(address(serviceManager), mockRewardsAgent);

        vm.prank(avsOwner);
        vm.expectEmit(true, true, true, true);
        emit RewardsRegistrySet(newOperatorSetId, address(newRewardsRegistry));

        serviceManager.setRewardsRegistry(
            newOperatorSetId, IRewardsRegistry(address(newRewardsRegistry))
        );

        assertEq(
            address(serviceManager.getOperatorSetRewardsRegistry(newOperatorSetId)),
            address(newRewardsRegistry),
            "Rewards registry should be set correctly"
        );
    }

    function test_setRewardsRegistry_NotOwner() public {
        uint32 newOperatorSetId = 2;
        RewardsRegistry newRewardsRegistry =
            new RewardsRegistry(address(serviceManager), mockRewardsAgent);

        vm.prank(nonOperatorAddress);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));

        serviceManager.setRewardsRegistry(
            newOperatorSetId, IRewardsRegistry(address(newRewardsRegistry))
        );
    }

    function test_claimOperatorRewards() public {
        uint256 initialBalance = operatorAddress.balance;

        vm.prank(operatorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardsClaimed(operatorAddress, operatorPoints, operatorPoints);

        serviceManager.claimOperatorRewards(operatorSetId, operatorPoints, validProof);

        assertEq(
            operatorAddress.balance,
            initialBalance + operatorPoints,
            "Operator should receive correct rewards"
        );
    }

    function test_claimOperatorRewards_NoRewardsRegistry() public {
        uint32 invalidSetId = 999;

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IServiceManagerErrors.NoRewardsRegistryForOperatorSet.selector)
        );

        serviceManager.claimOperatorRewards(invalidSetId, operatorPoints, validProof);
    }

    function test_claimOperatorRewards_AlreadyClaimed() public {
        // First claim
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(operatorSetId, operatorPoints, validProof);

        // Second claim should fail
        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimed.selector)
        );

        serviceManager.claimOperatorRewards(operatorSetId, operatorPoints, validProof);
    }

    function test_integration_multipleOperatorSets() public {
        // Set up a second operator set with a different registry
        uint32 secondOperatorSetId = 2;
        RewardsRegistry secondRegistry =
            new RewardsRegistry(address(serviceManager), mockRewardsAgent);

        // Set up the second registry
        vm.prank(avsOwner);
        serviceManager.setRewardsRegistry(
            secondOperatorSetId, IRewardsRegistry(address(secondRegistry))
        );

        // Create a different merkle root for the second registry
        bytes32 secondLeaf = keccak256(abi.encode(operatorAddress, operatorPoints));
        bytes32 secondSiblingLeaf = keccak256(abi.encodePacked("second sibling"));
        (bytes32 leftLeaf, bytes32 rightLeaf) = secondLeaf < secondSiblingLeaf
            ? (secondLeaf, secondSiblingLeaf)
            : (secondSiblingLeaf, secondLeaf);
        bytes32 secondMerkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));

        // Set the merkle root in the second registry
        vm.prank(mockRewardsAgent);
        secondRegistry.updateRewardsMerkleRoot(secondMerkleRoot);

        // Fund the second registry
        vm.deal(address(secondRegistry), 1000 ether);

        // Create proof for second registry
        bytes32[] memory secondProof = new bytes32[](1);
        secondProof[0] = secondSiblingLeaf;

        // Claim from first registry
        uint256 initialBalance = operatorAddress.balance;
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(operatorSetId, operatorPoints, validProof);

        // Verify balance after first claim
        assertEq(
            operatorAddress.balance,
            initialBalance + operatorPoints,
            "Operator should receive correct rewards from first registry"
        );

        // Claim from second registry
        uint256 balanceAfterFirstClaim = operatorAddress.balance;
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(secondOperatorSetId, operatorPoints, secondProof);

        // Verify balance after second claim
        assertEq(
            operatorAddress.balance,
            balanceAfterFirstClaim + operatorPoints,
            "Operator should receive correct rewards from second registry"
        );
    }
}
