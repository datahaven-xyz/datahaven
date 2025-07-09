// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {Test, console, stdError} from "forge-std/Test.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {RewardsRegistry} from "../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry, IRewardsRegistryErrors} from "../src/interfaces/IRewardsRegistry.sol";
import {ServiceManagerMock} from "./mocks/ServiceManagerMock.sol";
import {IServiceManager, IServiceManagerErrors} from "../src/interfaces/IServiceManager.sol";

contract ServiceManagerRewardsRegistryTest is AVSDeployer {
    // Test addresses
    address public operatorAddress;
    address public nonOperatorAddress;

    // Test data
    uint32 public operatorSetId;
    bytes32 public merkleRoot;
    bytes32 public secondMerkleRoot;
    bytes32 public thirdMerkleRoot;
    uint256 public operatorPoints;
    uint256 public secondOperatorPoints;
    uint256 public thirdOperatorPoints;
    bytes32[] public validProof;
    bytes32[] public secondValidProof;
    bytes32[] public thirdValidProof;

    // Events
    event RewardsRegistrySet(uint32 indexed operatorSetId, address indexed rewardsRegistry);
    event RewardsClaimedForIndex(
        address indexed operatorAddress,
        uint256 indexed rootIndex,
        uint256 points,
        uint256 rewardsAmount
    );
    event RewardsBatchClaimedForIndices(
        address indexed operatorAddress,
        uint256[] rootIndices,
        uint256[] points,
        uint256 totalRewardsAmount
    );

    function setUp() public {
        _deployMockEigenLayerAndAVS();

        // Set up test addresses
        operatorAddress = address(0xABCD);
        nonOperatorAddress = address(0x5678);

        // Configure test data
        operatorSetId = 1;
        operatorPoints = 100;
        secondOperatorPoints = 200;
        thirdOperatorPoints = 150;

        // Create multiple merkle trees for comprehensive batch testing
        _createFirstMerkleTree();
        _createSecondMerkleTree();
        _createThirdMerkleTree();

        // Set up the rewards registry for the operator set
        vm.prank(avsOwner);
        serviceManager.setRewardsRegistry(operatorSetId, IRewardsRegistry(address(rewardsRegistry)));

        // Set all three merkle roots to create a history
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(secondMerkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(thirdMerkleRoot);

        // Add funds to the registry for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);
    }

    function _createFirstMerkleTree() internal {
        // Create first merkle tree
        bytes32 leaf = keccak256(abi.encode(operatorAddress, operatorPoints));
        bytes32 siblingLeaf = keccak256(abi.encodePacked("sibling1"));
        (bytes32 leftLeaf, bytes32 rightLeaf) =
            leaf < siblingLeaf ? (leaf, siblingLeaf) : (siblingLeaf, leaf);
        merkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));
        validProof = new bytes32[](1);
        validProof[0] = siblingLeaf;
    }

    function _createSecondMerkleTree() internal {
        // Create second merkle tree with different points
        bytes32 leaf = keccak256(abi.encode(operatorAddress, secondOperatorPoints));
        bytes32 siblingLeaf = keccak256(abi.encodePacked("sibling2"));
        (bytes32 leftLeaf, bytes32 rightLeaf) =
            leaf < siblingLeaf ? (leaf, siblingLeaf) : (siblingLeaf, leaf);
        secondMerkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));
        secondValidProof = new bytes32[](1);
        secondValidProof[0] = siblingLeaf;
    }

    function _createThirdMerkleTree() internal {
        // Create third merkle tree with different points
        bytes32 leaf = keccak256(abi.encode(operatorAddress, thirdOperatorPoints));
        bytes32 siblingLeaf = keccak256(abi.encodePacked("sibling3"));
        (bytes32 leftLeaf, bytes32 rightLeaf) =
            leaf < siblingLeaf ? (leaf, siblingLeaf) : (siblingLeaf, leaf);
        thirdMerkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));
        thirdValidProof = new bytes32[](1);
        thirdValidProof[0] = siblingLeaf;
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
            address(serviceManager.operatorSetToRewardsRegistry(newOperatorSetId)),
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

    function test_claimLatestOperatorRewards() public {
        uint256 initialBalance = operatorAddress.balance;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardsClaimedForIndex(operatorAddress, 2, thirdOperatorPoints, thirdOperatorPoints);

        serviceManager.claimLatestOperatorRewards(operatorSetId, thirdOperatorPoints, thirdValidProof);

        assertEq(
            operatorAddress.balance,
            initialBalance + thirdOperatorPoints,
            "Operator should receive correct rewards"
        );
    }

    function test_claimLatestOperatorRewards_NoRewardsRegistry() public {
        uint32 invalidSetId = 999;

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IServiceManagerErrors.NoRewardsRegistryForOperatorSet.selector)
        );

        serviceManager.claimLatestOperatorRewards(invalidSetId, operatorPoints, validProof);
    }

    function test_claimLatestOperatorRewards_AlreadyClaimed() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        // First claim (uses latest merkle root - index 2)
        vm.prank(operatorAddress);
        serviceManager.claimLatestOperatorRewards(operatorSetId, thirdOperatorPoints, thirdValidProof);

        // Second claim should fail
        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );

        serviceManager.claimLatestOperatorRewards(operatorSetId, thirdOperatorPoints, thirdValidProof);
    }

    function test_claimOperatorRewards() public {
        uint256 initialBalance = operatorAddress.balance;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardsClaimedForIndex(operatorAddress, 0, operatorPoints, operatorPoints);

        serviceManager.claimOperatorRewards(operatorSetId, 0, operatorPoints, validProof);

        assertEq(
            operatorAddress.balance,
            initialBalance + operatorPoints,
            "Operator should receive correct rewards"
        );
    }

    function test_claimOperatorRewards_DifferentIndices() public {
        uint256 initialBalance = operatorAddress.balance;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        // Claim from index 1 (second merkle root)
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(
            operatorSetId, 1, secondOperatorPoints, secondValidProof
        );

        assertEq(
            operatorAddress.balance,
            initialBalance + secondOperatorPoints,
            "Operator should receive rewards from second root"
        );

        // Claim from index 2 (third merkle root)
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(
            operatorSetId, 2, thirdOperatorPoints, thirdValidProof
        );

        assertEq(
            operatorAddress.balance,
            initialBalance + secondOperatorPoints + thirdOperatorPoints,
            "Operator should receive rewards from both roots"
        );

        // Verify claim status
        assertFalse(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0), "Index 0 should not be claimed"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 1), "Index 1 should be claimed"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 2), "Index 2 should be claimed"
        );
    }

    function test_claimOperatorRewards_InvalidIndex() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.InvalidMerkleRootIndex.selector)
        );
        serviceManager.claimOperatorRewards(operatorSetId, 999, operatorPoints, validProof);
    }

    function test_claimOperatorRewards_AlreadyClaimed() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        // First claim
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(operatorSetId, 0, operatorPoints, validProof);

        // Second claim should fail
        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        serviceManager.claimOperatorRewards(operatorSetId, 0, operatorPoints, validProof);
    }

    function test_claimOperatorRewardsBatch() public {
        // Test claiming from multiple different merkle root indices
        uint256[] memory rootIndices = new uint256[](3);
        rootIndices[0] = 0; // First merkle root
        rootIndices[1] = 1; // Second merkle root
        rootIndices[2] = 2; // Third merkle root

        uint256[] memory points = new uint256[](3);
        points[0] = operatorPoints;
        points[1] = secondOperatorPoints;
        points[2] = thirdOperatorPoints;

        bytes32[][] memory proofs = new bytes32[][](3);
        proofs[0] = validProof;
        proofs[1] = secondValidProof;
        proofs[2] = thirdValidProof;

        uint256 expectedTotalRewards = operatorPoints + secondOperatorPoints + thirdOperatorPoints;
        uint256 initialBalance = operatorAddress.balance;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardsBatchClaimedForIndices(
            operatorAddress, rootIndices, points, expectedTotalRewards
        );

        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);

        // Verify final balance includes all rewards
        assertEq(
            operatorAddress.balance,
            initialBalance + expectedTotalRewards,
            "Operator should receive rewards from all three claims"
        );

        // Verify all indices are now claimed
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Operator should have claimed from index 0"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 1),
            "Operator should have claimed from index 1"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 2),
            "Operator should have claimed from index 2"
        );
    }

    function test_claimOperatorRewardsBatch_PartialBatch() public {
        // Test claiming from only some of the available merkle roots
        uint256[] memory rootIndices = new uint256[](2);
        rootIndices[0] = 0; // First merkle root
        rootIndices[1] = 2; // Third merkle root (skipping second)

        uint256[] memory points = new uint256[](2);
        points[0] = operatorPoints;
        points[1] = thirdOperatorPoints;

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = validProof;
        proofs[1] = thirdValidProof;

        uint256 expectedTotalRewards = operatorPoints + thirdOperatorPoints;
        uint256 initialBalance = operatorAddress.balance;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);

        // Verify balance and claim status
        assertEq(
            operatorAddress.balance,
            initialBalance + expectedTotalRewards,
            "Operator should receive rewards from claimed indices"
        );

        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Operator should have claimed from index 0"
        );
        assertFalse(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 1),
            "Operator should NOT have claimed from index 1"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 2),
            "Operator should have claimed from index 2"
        );
    }

    function test_claimOperatorRewardsBatch_ArrayLengthMismatch() public {
        uint256[] memory rootIndices = new uint256[](2);
        uint256[] memory points = new uint256[](1); // Wrong length
        bytes32[][] memory proofs = new bytes32[][](2);

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.ArrayLengthMismatch.selector));
        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);
    }

    function test_claimOperatorRewardsBatch_AlreadyClaimedIndex() public {
        // First claim from index 1
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(
            operatorSetId, 1, secondOperatorPoints, secondValidProof
        );

        // Now try to batch claim including the already claimed index 1
        uint256[] memory rootIndices = new uint256[](2);
        rootIndices[0] = 0;
        rootIndices[1] = 1; // Already claimed

        uint256[] memory points = new uint256[](2);
        points[0] = operatorPoints;
        points[1] = secondOperatorPoints;

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = validProof;
        proofs[1] = secondValidProof;

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);
    }

    function test_claimOperatorRewardsBatch_EmptyBatch() public {
        uint256[] memory rootIndices = new uint256[](0);
        uint256[] memory points = new uint256[](0);
        bytes32[][] memory proofs = new bytes32[][](0);

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        uint256 initialBalance = operatorAddress.balance;

        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);

        // Balance should remain unchanged
        assertEq(
            operatorAddress.balance,
            initialBalance,
            "Balance should remain unchanged for empty batch"
        );
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
        bytes32 secondRegistryMerkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));

        // Set the merkle root in the second registry
        vm.prank(mockRewardsAgent);
        secondRegistry.updateRewardsMerkleRoot(secondRegistryMerkleRoot);

        // Fund the second registry
        vm.deal(address(secondRegistry), 1000 ether);

        // Create proof for second registry
        bytes32[] memory secondProof = new bytes32[](1);
        secondProof[0] = secondSiblingLeaf;

        // Claim from first registry (uses latest merkle root - index 2)
        uint256 initialBalance = operatorAddress.balance;
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );
        vm.prank(operatorAddress);
        serviceManager.claimLatestOperatorRewards(operatorSetId, thirdOperatorPoints, thirdValidProof); // Use latest root

        // Verify balance after first claim
        assertEq(
            operatorAddress.balance,
            initialBalance + thirdOperatorPoints,
            "Operator should receive correct rewards from first registry"
        );

        // Claim from second registry
        uint256 balanceAfterFirstClaim = operatorAddress.balance;
        vm.prank(operatorAddress);
        serviceManager.claimLatestOperatorRewards(secondOperatorSetId, operatorPoints, secondProof);

        // Verify balance after second claim
        assertEq(
            operatorAddress.balance,
            balanceAfterFirstClaim + operatorPoints,
            "Operator should receive correct rewards from second registry"
        );
    }

    function test_claimLatestOperatorRewards_NotInOperatorSet() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(false) // Operator is NOT in the set
        );

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IServiceManagerErrors.OperatorNotInOperatorSet.selector)
        );
        serviceManager.claimLatestOperatorRewards(operatorSetId, operatorPoints, validProof);
    }

    function test_claimOperatorRewards_NotInOperatorSet() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(false) // Operator is NOT in the set
        );

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IServiceManagerErrors.OperatorNotInOperatorSet.selector)
        );
        serviceManager.claimOperatorRewards(operatorSetId, 0, operatorPoints, validProof);
    }

    function test_claimOperatorRewardsBatch_NotInOperatorSet() public {
        uint256[] memory rootIndices = new uint256[](1);
        rootIndices[0] = 0;
        uint256[] memory points = new uint256[](1);
        points[0] = operatorPoints;
        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = validProof;

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(false) // Operator is NOT in the set
        );

        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IServiceManagerErrors.OperatorNotInOperatorSet.selector)
        );
        serviceManager.claimOperatorRewardsBatch(operatorSetId, rootIndices, points, proofs);
    }
}
