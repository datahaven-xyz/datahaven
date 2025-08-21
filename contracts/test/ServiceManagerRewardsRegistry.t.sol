// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {Test, console, stdError} from "forge-std/Test.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {RewardsRegistry} from "../src/middleware/RewardsRegistry.sol";
import {IRewardsRegistry, IRewardsRegistryErrors} from "../src/interfaces/IRewardsRegistry.sol";
import {ServiceManagerMock} from "./mocks/ServiceManagerMock.sol";
import {IServiceManager, IServiceManagerErrors} from "../src/interfaces/IServiceManager.sol";
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";

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
    uint256 public leafIndex;
    uint256 public numberOfLeaves;
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
        leafIndex = 0; // Position of our leaf in the tree
        numberOfLeaves = 2; // Simple tree with 2 leaves

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
        // Create first merkle tree with Substrate-compatible SCALE encoding
        bytes memory preimage =
            abi.encodePacked(operatorAddress, ScaleCodec.encodeU32(uint32(operatorPoints)));
        bytes32 leaf = keccak256(preimage);

        bytes memory siblingPreimage =
            abi.encodePacked(address(0x1111), ScaleCodec.encodeU32(uint32(50)));
        bytes32 siblingLeaf = keccak256(siblingPreimage);

        // For Substrate positional merkle proof, we construct the root based on position
        // Since leafIndex = 0, our leaf is on the left
        merkleRoot = keccak256(abi.encodePacked(leaf, siblingLeaf));
        validProof = new bytes32[](1);
        validProof[0] = siblingLeaf;
    }

    function _createSecondMerkleTree() internal {
        // Create second merkle tree with different points using SCALE encoding
        bytes memory preimage =
            abi.encodePacked(operatorAddress, ScaleCodec.encodeU32(uint32(secondOperatorPoints)));
        bytes32 leaf = keccak256(preimage);

        bytes memory siblingPreimage =
            abi.encodePacked(address(0x2222), ScaleCodec.encodeU32(uint32(75)));
        bytes32 siblingLeaf = keccak256(siblingPreimage);

        // Since leafIndex = 0, our leaf is on the left
        secondMerkleRoot = keccak256(abi.encodePacked(leaf, siblingLeaf));
        secondValidProof = new bytes32[](1);
        secondValidProof[0] = siblingLeaf;
    }

    function _createThirdMerkleTree() internal {
        // Create third merkle tree with different points using SCALE encoding
        bytes memory preimage =
            abi.encodePacked(operatorAddress, ScaleCodec.encodeU32(uint32(thirdOperatorPoints)));
        bytes32 leaf = keccak256(preimage);

        bytes memory siblingPreimage =
            abi.encodePacked(address(0x3333), ScaleCodec.encodeU32(uint32(60)));
        bytes32 siblingLeaf = keccak256(siblingPreimage);

        // Since leafIndex = 0, our leaf is on the left
        thirdMerkleRoot = keccak256(abi.encodePacked(leaf, siblingLeaf));
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

        serviceManager.claimLatestOperatorRewards(
            operatorSetId, thirdOperatorPoints, numberOfLeaves, leafIndex, thirdValidProof
        );

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

        serviceManager.claimLatestOperatorRewards(
            invalidSetId, operatorPoints, numberOfLeaves, leafIndex, validProof
        );
    }

    function test_claimLatestOperatorRewards_AlreadyClaimed() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        // First claim (uses latest merkle root - index 2)
        vm.prank(operatorAddress);
        serviceManager.claimLatestOperatorRewards(
            operatorSetId, thirdOperatorPoints, numberOfLeaves, leafIndex, thirdValidProof
        );

        // Second claim should fail
        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );

        serviceManager.claimLatestOperatorRewards(
            operatorSetId, thirdOperatorPoints, numberOfLeaves, leafIndex, thirdValidProof
        );
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

        serviceManager.claimOperatorRewards(
            operatorSetId, 0, operatorPoints, numberOfLeaves, leafIndex, validProof
        );

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
            operatorSetId, 1, secondOperatorPoints, numberOfLeaves, leafIndex, secondValidProof
        );

        assertEq(
            operatorAddress.balance,
            initialBalance + secondOperatorPoints,
            "Operator should receive rewards from second root"
        );

        // Claim from index 2 (third merkle root)
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(
            operatorSetId, 2, thirdOperatorPoints, numberOfLeaves, leafIndex, thirdValidProof
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
        serviceManager.claimOperatorRewards(
            operatorSetId, 999, operatorPoints, numberOfLeaves, leafIndex, validProof
        );
    }

    function test_claimOperatorRewards_AlreadyClaimed() public {
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );

        // First claim
        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewards(
            operatorSetId, 0, operatorPoints, numberOfLeaves, leafIndex, validProof
        );

        // Second claim should fail
        vm.prank(operatorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(IRewardsRegistryErrors.RewardsAlreadyClaimedForIndex.selector)
        );
        serviceManager.claimOperatorRewards(
            operatorSetId,
            0,
            operatorPoints,
            2, // numberOfLeaves (operator + sibling)
            0, // leafIndex (assuming operator leaf comes first)
            validProof
        );
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

        uint256[] memory widths = new uint256[](3);
        widths[0] = 2;
        widths[1] = 2;
        widths[2] = 2;
        uint256[] memory leafIdxs = new uint256[](3);
        leafIdxs[0] = 0;
        leafIdxs[1] = 0;
        leafIdxs[2] = 0;

        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, widths, leafIdxs, proofs
        );

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
        uint256[] memory widths2 = new uint256[](2);
        widths2[0] = 2;
        widths2[1] = 2;
        uint256[] memory leafIdxs2 = new uint256[](2);
        leafIdxs2[0] = 0;
        leafIdxs2[1] = 0;
        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, widths2, leafIdxs2, proofs
        );

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

        uint256[] memory numberOfLeaves = new uint256[](3);
        numberOfLeaves[0] = 2;
        numberOfLeaves[1] = 2;
        numberOfLeaves[2] = 2;

        uint256[] memory leafIndices = new uint256[](3);
        leafIndices[0] = 0;
        leafIndices[1] = 0;
        leafIndices[2] = 0;

        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, numberOfLeaves, leafIndices, proofs
        );
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
            operatorSetId,
            1,
            secondOperatorPoints,
            2, // numberOfLeaves (operator + sibling)
            0, // leafIndex (assuming operator leaf comes first)
            secondValidProof
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

        uint256[] memory numberOfLeaves = new uint256[](2);
        numberOfLeaves[0] = 2;
        numberOfLeaves[1] = 2;

        uint256[] memory leafIndices = new uint256[](2);
        leafIndices[0] = 0;
        leafIndices[1] = 0;

        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, numberOfLeaves, leafIndices, proofs
        );
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

        uint256[] memory numberOfLeaves = new uint256[](0);
        uint256[] memory leafIndices = new uint256[](0);

        vm.prank(operatorAddress);
        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, numberOfLeaves, leafIndices, proofs
        );

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

        // Create a different merkle root for the second registry using SCALE encoding
        bytes memory secondLeafPreimage =
            abi.encodePacked(operatorAddress, ScaleCodec.encodeU32(uint32(operatorPoints)));
        bytes32 secondLeaf = keccak256(secondLeafPreimage);

        bytes memory secondSiblingPreimage =
            abi.encodePacked(address(0x4444), ScaleCodec.encodeU32(uint32(80)));
        bytes32 secondSiblingLeaf = keccak256(secondSiblingPreimage);

        // Since leafIndex = 0, our leaf is on the left
        bytes32 secondRegistryMerkleRoot =
            keccak256(abi.encodePacked(secondLeaf, secondSiblingLeaf));

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
        serviceManager.claimLatestOperatorRewards(
            operatorSetId, thirdOperatorPoints, numberOfLeaves, leafIndex, thirdValidProof
        ); // Use latest root

        // Verify balance after first claim
        assertEq(
            operatorAddress.balance,
            initialBalance + thirdOperatorPoints,
            "Operator should receive correct rewards from first registry"
        );

        // Claim from second registry
        uint256 balanceAfterFirstClaim = operatorAddress.balance;
        vm.prank(operatorAddress);
        serviceManager.claimLatestOperatorRewards(
            secondOperatorSetId, operatorPoints, numberOfLeaves, leafIndex, secondProof
        );

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
        serviceManager.claimLatestOperatorRewards(
            operatorSetId, operatorPoints, numberOfLeaves, leafIndex, validProof
        );
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
        serviceManager.claimOperatorRewards(
            operatorSetId, 0, operatorPoints, numberOfLeaves, leafIndex, validProof
        );
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
        uint256[] memory widths3 = new uint256[](1);
        widths3[0] = 2;
        uint256[] memory leafIdxs3 = new uint256[](1);
        leafIdxs3[0] = 0;
        serviceManager.claimOperatorRewardsBatch(
            operatorSetId, rootIndices, points, widths3, leafIdxs3, proofs
        );
    }
}
