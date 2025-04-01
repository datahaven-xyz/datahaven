// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {InboundMessageV2} from "snowbridge/src/Types.sol";
import {CommandV2, CommandKind, IGatewayV2} from "snowbridge/src/Types.sol";
import {CallContractParams} from "snowbridge/src/v2/Types.sol";
import {BeefyVerification} from "snowbridge/src/BeefyVerification.sol";

import {MockSnowbridgeAndAVSDeployer} from "./utils/MockSnowbridgeAndAVSDeployer.sol";

import "forge-std/Test.sol";

contract SnowbridgeIntegrationTest is MockSnowbridgeAndAVSDeployer {
    function setUp() public {
        _deployMockAllContracts();
    }

    /**
     *
     *        Constructor Tests      *
     *
     */
    function test_constructor() public view {
        assertEq(
            rewardsRegistry.rewardsAgent(),
            address(rewardsAgent),
            "Rewards agent address should be set correctly"
        );

        assertEq(
            gateway.agentOf(REWARDS_MESSAGE_ORIGIN),
            address(rewardsAgent),
            "Rewards agent should be set correctly"
        );
    }

    function test_newRewardsMessage() public {
        // Build validator points merkle tree
        uint128[] memory validatorPoints = new uint128[](10);
        validatorPoints[0] = uint128(1111);
        validatorPoints[1] = uint128(2222);
        validatorPoints[2] = uint128(3333);
        validatorPoints[3] = uint128(4444);
        validatorPoints[4] = uint128(5555);
        validatorPoints[5] = uint128(6666);
        validatorPoints[6] = uint128(7777);
        validatorPoints[7] = uint128(8888);
        validatorPoints[8] = uint128(9999);
        validatorPoints[9] = uint128(101010);

        bytes32 validatorPointsMerkleRoot =
            _buildValidatorPointsMerkleTree(initialValidators, validatorPoints);

        // Build messages merkle tree
        CallContractParams memory updateRewardsCommandParams = CallContractParams({
            target: address(rewardsRegistry),
            data: abi.encodeWithSelector(
                bytes4(keccak256("updateRewardsMerkleRoot(bytes32)")), validatorPointsMerkleRoot
            ),
            value: 0
        });
        CommandV2 memory updateRewardsCommand = CommandV2({
            kind: CommandKind.CallContract,
            gas: 1000000,
            payload: abi.encode(updateRewardsCommandParams)
        });
        CommandV2[] memory commands = new CommandV2[](1);
        commands[0] = updateRewardsCommand;

        InboundMessageV2 memory updateRewardsMessage = InboundMessageV2({
            origin: REWARDS_MESSAGE_ORIGIN,
            nonce: 0,
            topic: bytes32(0),
            commands: commands
        });

        InboundMessageV2[] memory messages = new InboundMessageV2[](3);
        messages[0] = updateRewardsMessage;
        messages[1] = InboundMessageV2({
            origin: bytes32(0),
            nonce: 1,
            topic: bytes32(0),
            commands: new CommandV2[](0)
        });
        messages[2] =
            InboundMessageV2({origin: bytes32(0), nonce: 2, topic: bytes32(0), commands: commands});

        bytes32 messagesMerkleRoot = _buildMessagesMerkleTree(messages);
        bytes32[] memory messagesProof = _buildMessagesProof(messages, 0);

        // Build BEEFY partial leaf
        BeefyVerification.MMRLeafPartial memory partialLeaf = BeefyVerification.MMRLeafPartial({
            version: 0,
            parentNumber: 18122022,
            parentHash: keccak256(abi.encode(18122022)),
            nextAuthoritySetID: 18122022,
            nextAuthoritySetLen: 10,
            nextAuthoritySetRoot: keccak256(abi.encode(18122022))
        });

        // Build BEEFY proof
        // Any non-empty BEEFY proof will do for the mock
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256(abi.encode(18122022));

        BeefyVerification.Proof memory beefyProof =
            BeefyVerification.Proof({leafPartial: partialLeaf, leafProof: proof, leafProofOrder: 0});

        // Call gateway.v2_submit with a proof of the message and a valid BEEFY proof
        // Expect an IGatewayV2.InboundMessageDispatched event to be emitted
        bytes32 rewardAddress = keccak256(abi.encodePacked("rewardAddress"));
        vm.expectEmit(address(gateway));
        emit IGatewayV2.InboundMessageDispatched(0, bytes32(0), true, rewardAddress);
        gateway.v2_submit(updateRewardsMessage, messagesProof, beefyProof, rewardAddress);

        // TODO: Call serviceManager.claimOperatorRewards with a proof of the rewards
        // TODO: The Validator should receive the rewards
    }

    // function test_newRewardsMessage_NotRewardsAgent() public {
    //     // TODO: Create merkle tree of rewards for validators
    //     // TODO: Create merkle tree of messages with message from wrong origin
    //     // TODO: Create new BEEFY leaf with messages merkle root in the extra field
    //     // TODO: Add that new BEEFY leaf to BeefyClient
    //     // TODO: Call gateway.v2_submit with a proof of the message and a valid BEEFY proof
    //     // TODO: Should fail because the message is from the wrong agent
    // }

    function _buildValidatorPointsMerkleTree(
        bytes32[] memory validators,
        uint128[] memory points
    ) internal returns (bytes32) {
        require(
            validators.length == points.length,
            "Validators and points arrays must be of the same length"
        );

        bytes32[] memory leaves = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            leaves[i] = keccak256(abi.encode(validators[i], points[i]));
        }

        return _calculateMerkleRoot(leaves);
    }

    function _buildMessagesMerkleTree(
        InboundMessageV2[] memory messages
    ) internal returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            leaves[i] = keccak256(abi.encode(messages[i]));
        }

        return _calculateMerkleRoot(leaves);
    }

    function _buildMessagesProof(
        InboundMessageV2[] memory messages,
        uint256 leafIndex
    ) internal returns (bytes32[] memory) {
        bytes32[] memory leaves = new bytes32[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            leaves[i] = keccak256(abi.encode(messages[i]));
        }

        return _buildMerkleProof(leaves, leafIndex);
    }
}
