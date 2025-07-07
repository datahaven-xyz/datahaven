// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {InboundMessageV2} from "snowbridge/src/Types.sol";
import {CommandV2, CommandKind, IGatewayV2} from "snowbridge/src/Types.sol";
import {
    CallContractParams,
    Payload,
    Message,
    MessageKind,
    Asset,
    AssetKind
} from "snowbridge/src/v2/Types.sol";
import {BeefyVerification} from "snowbridge/src/BeefyVerification.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";
import {IAllocationManager} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

import {MerkleUtils} from "../src/libraries/MerkleUtils.sol";
import {
    IRewardsRegistryEvents, IRewardsRegistryErrors
} from "../src/interfaces/IRewardsRegistry.sol";
import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";
import "forge-std/Test.sol";

contract SnowbridgeIntegrationTest is SnowbridgeAndAVSDeployer {
    // Storage variables to reduce stack depth
    uint128[] internal _validatorPoints;
    address[] internal _validatorAddresses;
    bytes32 internal _validatorPointsMerkleRoot;

    function setUp() public {
        _deployMockAllContracts();
    }

    function beforeTestSetup(
        bytes4 testSelector
    ) public pure returns (bytes[] memory beforeTestCalldata) {
        if (testSelector == this.test_sendNewValidatorsSetMessage.selector) {
            beforeTestCalldata = new bytes[](1);
            beforeTestCalldata[0] = abi.encodeWithSelector(this.setupValidatorsAsOperators.selector);
        }
    }

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
        // Setup validator data.
        _setupValidatorData();

        // Create and submit the rewards message.
        InboundMessageV2 memory updateRewardsMessage = _createRewardsMessage();

        // Build messages merkle tree
        // We want a proof of the first message, i.e. the actual rewards message
        bytes32[] memory messagesProof =
            _buildMessagesProofForGoodRewardsMessage(updateRewardsMessage);

        // Create BEEFY proof.
        BeefyVerification.Proof memory beefyProof = _createBeefyProof();

        // This is to mock that the `BeefyClient.verifyMMRLeafProof` function returns true
        // despite the fact that we never registered a BEEFY leaf with this message in the
        // `BeefyClient` contract.
        _mockBeefyVerification();

        // Submit message to Gateway.
        // We don't care about the rewardAddress that will get the Snowbridge rewards for relaying this message.
        bytes32 rewardAddress = keccak256(abi.encodePacked("rewardAddress"));
        vm.expectEmit(address(gateway));
        emit IGatewayV2.InboundMessageDispatched(0, bytes32(0), true, rewardAddress);
        gateway.v2_submit(updateRewardsMessage, messagesProof, beefyProof, rewardAddress);

        // Fund the RewardsRegistry to be able to distribute rewards
        vm.deal(address(rewardsRegistry), 1000000 ether);

        // Build proof for the first validator to claim rewards.
        bytes32[] memory rewardsProofFirstValidator =
            _buildValidatorPointsProof(_validatorAddresses, _validatorPoints, 0);

        // Claim rewards for the first validator.
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(IAllocationManager.isMemberOfOperatorSet.selector),
            abi.encode(true)
        );
        vm.startPrank(_validatorAddresses[0]);
        vm.expectEmit(address(rewardsRegistry));
        emit IRewardsRegistryEvents.RewardsClaimed(
            _validatorAddresses[0], _validatorPoints[0], uint256(_validatorPoints[0])
        );
        serviceManager.claimOperatorRewards(0, _validatorPoints[0], rewardsProofFirstValidator);
        vm.stopPrank();

        // Check that the validator has received the rewards.
        assertEq(
            address(_validatorAddresses[0]).balance,
            _validatorPoints[0],
            "Validator should receive rewards"
        );

        // Build proof for the last validator to claim rewards.
        bytes32[] memory rewardsProofLastValidator =
            _buildValidatorPointsProof(_validatorAddresses, _validatorPoints, 9);

        // Claim rewards for the last validator.
        vm.startPrank(_validatorAddresses[9]);
        vm.expectEmit(address(rewardsRegistry));
        emit IRewardsRegistryEvents.RewardsClaimed(
            _validatorAddresses[9], _validatorPoints[9], uint256(_validatorPoints[9])
        );
        serviceManager.claimOperatorRewards(0, _validatorPoints[9], rewardsProofLastValidator);
        vm.stopPrank();

        // Check that the last validator has received the rewards.
        assertEq(
            address(_validatorAddresses[9]).balance,
            _validatorPoints[9],
            "Last validator should receive rewards"
        );
    }

    function test_newRewardsMessage_OnlyRewardsAgent() public {
        // Setup validator data.
        _setupValidatorData();

        // Create and submit the rewards message.
        InboundMessageV2 memory updateRewardsMessage = _createRewardsMessage();

        // Build messages merkle tree.
        // We want a proof of the third message, i.e. the attempt at setting the new rewards root
        // with a wrong origin.
        (InboundMessageV2 memory badUpdateRewardsMessage, bytes32[] memory messagesProof) =
            _buildMessagesProofForBadRewardsMessage(updateRewardsMessage);

        // Create BEEFY proof.
        BeefyVerification.Proof memory beefyProof = _createBeefyProof();

        // This is to mock that the `BeefyClient.verifyMMRLeafProof` function returns true
        // despite the fact that we never registered a BEEFY leaf with this message in the
        // `BeefyClient` contract.
        _mockBeefyVerification();

        // Submit message to Gateway.
        // We don't care about the rewardAddress that will get the Snowbridge rewards for relaying this message.
        // We expect this to fail in the RewardsRegistry contract because the Agent trying to
        // set the new rewards root is not the authorised Agent. Therefore there should be an
        // event emitted by the Gateway saying that the message was dispatched but it failed.
        bytes32 rewardAddress = keccak256(abi.encodePacked("rewardAddress"));
        emit IGatewayV2.InboundMessageDispatched(0, bytes32(0), false, rewardAddress);
        gateway.v2_submit(badUpdateRewardsMessage, messagesProof, beefyProof, rewardAddress);
    }

    function test_sendNewValidatorsSetMessage() public {
        // Check that the current validators signed as operators have a registered address for the DataHaven solochain.
        address[] memory currentValidators = allocationManager.getMembers(
            OperatorSet({avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()})
        );
        for (uint256 i = 0; i < currentValidators.length; i++) {
            assertEq(
                serviceManager.validatorEthAddressToSolochainAddress(currentValidators[i]),
                initialValidators[i],
                "Validator should have a registered address for the DataHaven solochain"
            );
        }

        // Mock balance for the AVS owner
        vm.deal(avsOwner, 1000000 ether);

        // Send the new validator set message to the Snowbridge Gateway
        bytes memory message = serviceManager.buildNewValidatorSetMessage();
        Payload memory payload = Payload({
            origin: address(serviceManager),
            assets: new Asset[](0),
            message: Message({kind: MessageKind.Raw, data: message}),
            claimer: bytes(""),
            value: 0,
            executionFee: 1 ether,
            relayerFee: 1 ether
        });
        cheats.expectEmit();
        emit IGatewayV2.OutboundMessageAccepted(1, payload);
        cheats.prank(avsOwner);
        serviceManager.sendNewValidatorSet{value: 2 ether}(1 ether, 1 ether);
    }

    function _setupValidatorData() internal {
        // Build validator points and addresses.
        _validatorPoints = new uint128[](10);
        _validatorPoints[0] = uint128(1111);
        _validatorPoints[1] = uint128(2222);
        _validatorPoints[2] = uint128(3333);
        _validatorPoints[3] = uint128(4444);
        _validatorPoints[4] = uint128(5555);
        _validatorPoints[5] = uint128(6666);
        _validatorPoints[6] = uint128(7777);
        _validatorPoints[7] = uint128(8888);
        _validatorPoints[8] = uint128(9999);
        _validatorPoints[9] = uint128(101010);

        _validatorAddresses = new address[](10);
        _validatorAddresses[0] = address(0xFFFF1);
        _validatorAddresses[1] = address(0xFFFF2);
        _validatorAddresses[2] = address(0xFFFF3);
        _validatorAddresses[3] = address(0xFFFF4);
        _validatorAddresses[4] = address(0xFFFF5);
        _validatorAddresses[5] = address(0xFFFF6);
        _validatorAddresses[6] = address(0xFFFF7);
        _validatorAddresses[7] = address(0xFFFF8);
        _validatorAddresses[8] = address(0xFFFF9);
        _validatorAddresses[9] = address(0xFFFFA);

        _validatorPointsMerkleRoot =
            _buildValidatorPointsMerkleTree(_validatorAddresses, _validatorPoints);
    }

    function _createRewardsMessage() internal view returns (InboundMessageV2 memory) {
        CallContractParams memory updateRewardsCommandParams = CallContractParams({
            target: address(rewardsRegistry),
            data: abi.encodeWithSelector(
                bytes4(keccak256("updateRewardsMerkleRoot(bytes32)")), _validatorPointsMerkleRoot
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

        return InboundMessageV2({
            origin: REWARDS_MESSAGE_ORIGIN,
            nonce: 0,
            topic: bytes32(0),
            commands: commands
        });
    }

    function _buildMessagesProofForGoodRewardsMessage(
        InboundMessageV2 memory updateRewardsMessage
    ) internal pure returns (bytes32[] memory) {
        InboundMessageV2[] memory messages = new InboundMessageV2[](3);
        // The first message is the actual rewards message that we want to submit and then claim.
        messages[0] = updateRewardsMessage;

        // The second message is a dummy message with a different origin.
        messages[1] = InboundMessageV2({
            origin: WRONG_MESSAGE_ORIGIN,
            nonce: 1,
            topic: bytes32(0),
            commands: new CommandV2[](0)
        });

        // The third message is an attempt at setting the new rewards root, but with a wrong origin
        // i.e. not the origin of the authorised Agent.
        messages[2] = InboundMessageV2({
            origin: WRONG_MESSAGE_ORIGIN,
            nonce: 2,
            topic: bytes32(0),
            commands: updateRewardsMessage.commands
        });

        return _buildMessagesProof(messages, 0);
    }

    function _buildMessagesProofForBadRewardsMessage(
        InboundMessageV2 memory goodUpdateRewardsMessage
    ) internal pure returns (InboundMessageV2 memory, bytes32[] memory) {
        InboundMessageV2[] memory messages = new InboundMessageV2[](3);
        // The first message is the actual rewards message that we want to submit and then claim.
        messages[0] = goodUpdateRewardsMessage;

        // The second message is a dummy message with a different origin.
        messages[1] = InboundMessageV2({
            origin: WRONG_MESSAGE_ORIGIN,
            nonce: 1,
            topic: bytes32(0),
            commands: new CommandV2[](0)
        });

        // The third message is an attempt at setting the new rewards root, but with a wrong origin
        // i.e. not the origin of the authorised Agent.
        messages[2] = InboundMessageV2({
            origin: WRONG_MESSAGE_ORIGIN,
            nonce: 2,
            topic: bytes32(0),
            commands: goodUpdateRewardsMessage.commands
        });

        return (messages[2], _buildMessagesProof(messages, 2));
    }

    function _createBeefyProof() internal pure returns (BeefyVerification.Proof memory) {
        // Build BEEFY partial leaf.
        BeefyVerification.MMRLeafPartial memory partialLeaf = BeefyVerification.MMRLeafPartial({
            version: 0,
            parentNumber: 18122022,
            parentHash: keccak256(abi.encode(18122022)),
            nextAuthoritySetID: 18122022,
            nextAuthoritySetLen: 10,
            nextAuthoritySetRoot: keccak256(abi.encode(18122022))
        });

        // Build BEEFY proof.
        // Any non-empty BEEFY proof will do for the mock.
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256(abi.encode(18122022));

        return
            BeefyVerification.Proof({leafPartial: partialLeaf, leafProof: proof, leafProofOrder: 0});
    }

    function _mockBeefyVerification() internal {
        // Mock the BeefyVerification.verifyBeefyMMRLeaf to always return true
        bytes memory encodedReturn = abi.encode(true);

        // Create the function selector for verifyBeefyMMRLeaf
        bytes4 selector = BeefyClient.verifyMMRLeafProof.selector;

        // Mock any call to this function with any parameters to return true
        vm.mockCall(address(beefyClient), abi.encodeWithSelector(selector), encodedReturn);
    }

    function _buildValidatorPointsMerkleTree(
        address[] memory validators,
        uint128[] memory points
    ) internal pure returns (bytes32) {
        require(
            validators.length == points.length,
            "Validators and points arrays must be of the same length"
        );

        bytes32[] memory leaves = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            leaves[i] = keccak256(abi.encode(validators[i], points[i]));
        }

        return MerkleUtils.calculateMerkleRoot(leaves);
    }

    function _buildValidatorPointsProof(
        address[] memory validators,
        uint128[] memory points,
        uint256 leafIndex
    ) internal pure returns (bytes32[] memory) {
        require(
            validators.length == points.length,
            "Validators and points arrays must be of the same length"
        );

        bytes32[] memory leaves = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            leaves[i] = keccak256(abi.encode(validators[i], points[i]));
        }

        return MerkleUtils.buildMerkleProof(leaves, leafIndex);
    }

    function _buildMessagesMerkleTree(
        InboundMessageV2[] memory messages
    ) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            leaves[i] = keccak256(abi.encode(messages[i]));
        }

        return MerkleUtils.calculateMerkleRoot(leaves);
    }

    function _buildMessagesProof(
        InboundMessageV2[] memory messages,
        uint256 leafIndex
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory leaves = new bytes32[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            leaves[i] = keccak256(abi.encode(messages[i]));
        }

        return MerkleUtils.buildMerkleProof(leaves, leafIndex);
    }
}
