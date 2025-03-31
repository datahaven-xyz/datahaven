// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console, stdError} from "forge-std/Test.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {RewardsRegistry} from "../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry, IRewardsRegistryErrors} from "../src/interfaces/IRewardsRegistry.sol";

contract RewardsRegistryTest is MockAVSDeployer {
    address public nonRewardsAgent;
    address public operatorAddress;

    // Test data
    bytes32 public merkleRoot;
    bytes32 public newMerkleRoot;
    uint256 public operatorPoints;
    bytes32[] public validProof;
    bytes32[] public invalidProof;

    // Events
    event RewardsMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event RewardsClaimed(address indexed operatorAddress, uint256 points, uint256 rewardsAmount);

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
        emit RewardsMerkleRootUpdated(bytes32(0), merkleRoot);

        rewardsRegistry.updateRewardsMerkleRoot(merkleRoot);

        assertEq(
            rewardsRegistry.lastRewardsMerkleRoot(), merkleRoot, "Merkle root should be updated"
        );
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
        emit RewardsMerkleRootUpdated(merkleRoot, newMerkleRoot);

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
        emit RewardsClaimed(operatorAddress, operatorPoints, operatorPoints);

        rewardsRegistry.claimRewards(operatorAddress, operatorPoints, validProof);

        // Verify state changes
        assertEq(
            rewardsRegistry.operatorToLastClaimedRoot(operatorAddress),
            merkleRoot,
            "Operator's last claimed root should be updated"
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
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimed.selector)
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
        // lastRewardsMerkleRoot is not set
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

        assertEq(
            rewardsRegistry.operatorToLastClaimedRoot(operatorAddress),
            newMerkleRoot,
            "Operator's last claimed root should be updated to new root"
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
}
