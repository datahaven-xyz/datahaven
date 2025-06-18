// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {Test, console, stdError} from "forge-std/Test.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {RewardsRegistry} from "../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry, IRewardsRegistryErrors} from "../src/interfaces/IRewardsRegistry.sol";

contract RewardsRegistryTest is AVSDeployer {
    address public nonRewardsAgent;
    address public operatorAddress;

    // Test data
    bytes32 public merkleRoot;
    bytes32 public newMerkleRoot;
    uint256 public operatorPoints;
    bytes32[] public validProof;
    bytes32[] public invalidProof;

    // Events
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 newRootIndex);
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
        nonRewardsAgent = address(0x5678);
        operatorAddress = address(0xABCD);

        // Set up test data
        operatorPoints = 100;

        // For testing MerkleProof verification, we'll use the simplest case:
        // A binary tree with just our target leaf and a sibling leaf
        // Our leaf (the one we want to prove exists in the tree)
        bytes32 leaf = keccak256(abi.encode(operatorAddress, operatorPoints));

        // Sibling leaf (another element in the Merkle tree)
        bytes32 siblingLeaf = keccak256(abi.encodePacked("sibling"));

        // Sort leaves to follow the canonical order used by most Merkle tree libraries
        (bytes32 leftLeaf, bytes32 rightLeaf) =
            leaf < siblingLeaf ? (leaf, siblingLeaf) : (siblingLeaf, leaf);

        // Calculate parent node (this will be the Merkle root for our simple tree)
        merkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));

        // The proof to verify our leaf is just the sibling leaf
        validProof = new bytes32[](1);
        validProof[0] = siblingLeaf;

        // For tests that need a second Merkle root
        bytes32 newSiblingLeaf = keccak256(abi.encodePacked("new sibling"));
        (leftLeaf, rightLeaf) =
            leaf < newSiblingLeaf ? (leaf, newSiblingLeaf) : (newSiblingLeaf, leaf);
        newMerkleRoot = keccak256(abi.encodePacked(leftLeaf, rightLeaf));

        // An invalid proof
        invalidProof = new bytes32[](1);
        invalidProof[0] = keccak256(abi.encodePacked("wrong sibling"));
    }

    // Helper to test our proof construction
    function test_verifyProofConstruction() public view {
        bytes32 leaf = keccak256(abi.encode(operatorAddress, operatorPoints));
        bool result = MerkleProof.verify(validProof, merkleRoot, leaf);
        assertTrue(result, "Proof verification should succeed");
    }

    /**
     *
     *        Constructor Tests      *
     *
     */
    function test_constructor() public view {
        assertEq(
            rewardsRegistry.avs(), address(serviceManager), "AVS address should be set correctly"
        );
        assertEq(
            rewardsRegistry.rewardsAgent(),
            mockRewardsAgent,
            "Rewards agent address should be set correctly"
        );
    }

    /**
     *
     *  updateRewardsMerkleRoot Tests *
     *
     */
    function test_updateRewardsMerkleRoot() public {
        vm.prank(mockRewardsAgent);

        vm.expectEmit(true, true, true, true);
        emit RewardsMerkleRootUpdated(bytes32(0), merkleRoot, 0);

        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        assertEq(rewardsRegistry.getLatestMerkleRoot(), merkleRoot, "Merkle root should be updated");
    }

    function test_updateRewardsMerkleRoot_NotRewardsAgent() public {
        vm.prank(nonRewardsAgent);

        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.OnlyRewardsAgent.selector));

        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);
    }

    function test_updateRewardsMerkleRoot_EmitEvent() public {
        // First update
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Second update with expectation of emitting event with correct old and new roots
        vm.prank(mockRewardsAgent);

        vm.expectEmit(true, true, true, true);
        emit RewardsMerkleRootUpdated(merkleRoot, newMerkleRoot, 1);

        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);
    }

    /**
     *
     *    setRewardsAgent Tests     *
     *
     */
    function test_setRewardsAgent() public {
        address newRewardsAgent = address(0x9876);

        vm.prank(address(serviceManager));
        rewardsRegistry.setRewardsAgent(newRewardsAgent);

        assertEq(rewardsRegistry.rewardsAgent(), newRewardsAgent, "Rewards agent should be updated");
    }

    function test_setRewardsAgent_NotAVS() public {
        vm.prank(nonRewardsAgent);

        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.OnlyAVS.selector));

        rewardsRegistry.setRewardsAgent(address(0x9876));
    }

    /**
     *
     *      claimRewards Tests      *
     *
     */
    function test_claimRewards() public {
        // First update merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Add ETH to contract for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);

        uint256 initialBalance = operatorAddress.balance;

        vm.prank(address(serviceManager));

        vm.expectEmit(true, true, true, true);
        emit RewardsClaimedForIndex(operatorAddress, 0, operatorPoints, operatorPoints);

        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);

        // Verify state changes
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Operator should have claimed from the latest root index"
        );
        assertEq(
            operatorAddress.balance,
            initialBalance + operatorPoints,
            "Operator should receive correct rewards"
        );
    }

    function test_claimRewards_NotAVS() public {
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(nonRewardsAgent);

        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.OnlyAVS.selector));

        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);
    }

    function test_claimRewards_AlreadyClaimed() public {
        // First update merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Add ETH to contract for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);

        // First claim succeeds
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);

        // Second claim fails
        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);
    }

    function test_claimRewards_InvalidProof() public {
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(address(serviceManager));
        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.InvalidMerkleProof.selector));
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, invalidProof);
    }

    function test_claimRewards_NoMerkleRoot() public {
        // No merkle roots exist yet
        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsMerkleRootNotSet.selector)
        );
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);
    }

    function test_claimRewards_DifferentRoot() public {
        // First merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Add ETH to contract for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);

        // First claim succeeds
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);

        // Update to new merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        // Create a new valid proof for the new root
        bytes32[] memory newProof = new bytes32[](1);
        bytes32 newSiblingLeaf = keccak256(abi.encodePacked("new sibling"));
        newProof[0] = newSiblingLeaf;

        // Operator can claim again with new merkle root
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, newProof);

        // Verify both indices are now claimed
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Operator should have claimed from first root index"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 1),
            "Operator should have claimed from second root index"
        );
    }

    function test_claimRewards_InsufficientBalance() public {
        // Set merkle root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // No ETH in contract for rewards - ensure contract has 0 balance
        vm.deal(address(rewardsRegistry), 0);

        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsTransferFailed.selector)
        );
        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);
    }

    function test_receive() public {
        // Test that the contract can receive ETH
        uint256 amount = 1 ether;
        vm.deal(address(this), amount);

        (bool success,) = address(rewardsRegistry).call{value: amount}("");
        assertTrue(success, "Contract should be able to receive ETH");
        assertEq(address(rewardsRegistry).balance, amount, "Contract balance should increase");
    }

    /**
     *
     *    Merkle Root History Tests *
     *
     */
    function test_getMerkleRootByIndex() public {
        // Add first root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Add second root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        // Test accessing by index
        assertEq(
            rewardsRegistry.getMerkleRootByIndex(0),
            merkleRoot,
            "First root should be accessible by index 0"
        );
        assertEq(
            rewardsRegistry.getMerkleRootByIndex(1),
            newMerkleRoot,
            "Second root should be accessible by index 1"
        );
    }

    function test_getMerkleRootByIndex_InvalidIndex() public {
        // Add one root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        // Try to access invalid index
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.InvalidMerkleRootIndex.selector)
        );
        rewardsRegistry.getMerkleRootByIndex(1);
    }

    function test_getLatestMerkleRootIndex() public {
        // Initially should return 0 when no roots exist
        assertEq(
            rewardsRegistry.getLatestMerkleRootIndex(), 0, "Should return 0 when no roots exist"
        );

        // Add first root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);
        assertEq(rewardsRegistry.getLatestMerkleRootIndex(), 0, "Should return 0 for first root");

        // Add second root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);
        assertEq(rewardsRegistry.getLatestMerkleRootIndex(), 1, "Should return 1 for second root");
    }

    function test_getMerkleRootHistoryLength() public {
        // Initially should be 0
        assertEq(rewardsRegistry.getMerkleRootHistoryLength(), 0, "Should be 0 initially");

        // Add first root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);
        assertEq(rewardsRegistry.getMerkleRootHistoryLength(), 1, "Should be 1 after first root");

        // Add second root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);
        assertEq(rewardsRegistry.getMerkleRootHistoryLength(), 2, "Should be 2 after second root");
    }

    function test_historyPreservesQuickAccess() public {
        // Add multiple roots
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        // Latest root should be accessible directly without index
        assertEq(
            rewardsRegistry.getLatestMerkleRoot(),
            newMerkleRoot,
            "getLatestMerkleRoot should return latest root"
        );

        // But we should also be able to access by index
        assertEq(
            rewardsRegistry.getMerkleRootByIndex(1),
            newMerkleRoot,
            "Latest root should also be accessible by index"
        );
        assertEq(
            rewardsRegistry.getMerkleRootByIndex(0),
            merkleRoot,
            "Previous root should be accessible by index"
        );
    }

    /**
     *
     *  Index-based Claim Tests   *
     *
     */
    function test_claimRewardsByIndex() public {
        // Add multiple roots
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        // Add ETH to contract for rewards
        vm.deal(address(rewardsRegistry), 1000 ether);

        uint256 initialBalance = operatorAddress.balance;

        // Claim from first root (index 0)
        vm.prank(address(serviceManager));

        vm.expectEmit(true, true, true, true);
        emit RewardsClaimedForIndex(operatorAddress, 0, operatorPoints, operatorPoints);

        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);

        // Verify state changes
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Operator should have claimed from index 0"
        );
        assertEq(
            operatorAddress.balance,
            initialBalance + operatorPoints,
            "Operator should receive correct rewards"
        );
    }

    function test_claimRewardsByIndex_InvalidIndex() public {
        vm.deal(address(rewardsRegistry), 1000 ether);

        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.InvalidMerkleRootIndex.selector)
        );
        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);
    }

    function test_claimRewardsByIndex_AlreadyClaimed() public {
        // Add root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.deal(address(rewardsRegistry), 1000 ether);

        // First claim succeeds
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);

        // Second claim fails
        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);
    }

    function test_hasClaimedByIndex() public {
        // Add root
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.deal(address(rewardsRegistry), 1000 ether);

        // Initially not claimed
        assertFalse(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Should not have claimed initially"
        );

        // Claim
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);

        // Now claimed
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0), "Should have claimed after claim"
        );
    }

    /**
     *
     *   Batch Claim Tests        *
     *
     */
    function test_claimRewardsBatch() public {
        // Add multiple roots
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        vm.deal(address(rewardsRegistry), 1000 ether);

        // Prepare batch claim data
        uint256[] memory rootIndices = new uint256[](2);
        rootIndices[0] = 0;
        rootIndices[1] = 1;

        uint256[] memory points = new uint256[](2);
        points[0] = operatorPoints;
        points[1] = operatorPoints;

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = validProof;

        // Create proof for second root
        bytes32[] memory newProof = new bytes32[](1);
        bytes32 newSiblingLeaf = keccak256(abi.encodePacked("new sibling"));
        newProof[0] = newSiblingLeaf;
        proofs[1] = newProof;

        uint256 initialBalance = operatorAddress.balance;

        // Batch claim
        vm.prank(address(serviceManager));

        vm.expectEmit(true, true, true, true);
        emit RewardsBatchClaimedForIndices(operatorAddress, rootIndices, points, operatorPoints * 2);

        rewardsRegistry.claimRewardsBatch(operatorAddress, rootIndices, points, proofs);

        // Verify both indices are claimed
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 0),
            "Should have claimed from index 0"
        );
        assertTrue(
            rewardsRegistry.hasClaimedByIndex(operatorAddress, 1),
            "Should have claimed from index 1"
        );

        // Verify total rewards received
        assertEq(
            operatorAddress.balance,
            initialBalance + (operatorPoints * 2),
            "Should receive rewards from both claims"
        );
    }

    function test_claimRewardsBatch_ArrayLengthMismatch() public {
        uint256[] memory rootIndices = new uint256[](2);
        uint256[] memory points = new uint256[](1); // Wrong length
        bytes32[][] memory proofs = new bytes32[][](2);

        vm.prank(address(serviceManager));
        vm.expectRevert(abi.encodeWithSelector(IRewardsRegistryErrors.ArrayLengthMismatch.selector));
        rewardsRegistry.claimRewardsBatch(operatorAddress, rootIndices, points, proofs);
    }

    function test_claimRewardsBatch_PartialClaimFailure() public {
        // Add roots
        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        vm.prank(mockRewardsAgent);
        rewardsRegistry.updateRewardsMerkleRoot(newMerkleRoot);

        vm.deal(address(rewardsRegistry), 1000 ether);

        // Claim from index 0 first
        vm.prank(address(serviceManager));
        rewardsRegistry.claimRewardsByIndex(operatorAddress, 0, operatorPoints, validProof);

        // Now try batch claim that includes already claimed index 0
        uint256[] memory rootIndices = new uint256[](2);
        rootIndices[0] = 0; // Already claimed
        rootIndices[1] = 1;

        uint256[] memory points = new uint256[](2);
        points[0] = operatorPoints;
        points[1] = operatorPoints;

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = validProof;

        bytes32[] memory newProof = new bytes32[](1);
        bytes32 newSiblingLeaf = keccak256(abi.encodePacked("new sibling"));
        newProof[0] = newSiblingLeaf;
        proofs[1] = newProof;

        // Should fail because index 0 is already claimed
        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        rewardsRegistry.claimRewardsBatch(operatorAddress, rootIndices, points, proofs);
    }
}
