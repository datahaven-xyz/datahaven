// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Snowbridge imports
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";

library DataHavenSnowbridgeMessages {
    // Message ID. This is not expected to change and comes from the runtime.
    // See EigenLayerMessageProcessor in primitives/bridge/src/lib.rs.
    bytes4 constant EL_MESSAGE_ID = 0x70150038;

    enum Message {
        V0
    }

    enum OutboundCommandV1 {
        ReceiveValidators
    }

    /**
     * @title New Validator Set Snowbridge Message
     * @notice A struct representing a new validator set to be sent as a message through Snowbridge.
     *         This contains only the payload as nonce and topic are not used.
     */
    struct NewValidatorSet {
        /// @notice The payload of the message
        NewValidatorSetPayload payload;
    }

    /**
     * @title New Validator Set Snowbridge Message Payload
     * @notice A struct representing the payload of a new validator set message.
     *         This mimics the message format defined in the InboundQueueV2 pallet of the DataHaven
     *         solochain.
     */
    struct NewValidatorSetPayload {
        /// @notice The list of validators in the DataHaven network.
        bytes32[] validators;
    }

    /**
     * @notice Converts a bytes32[] validator set to bytes20[] format.
     * @param validatorSet The validator set in bytes32 format.
     * @return The validator set converted to bytes20 format.
     */
    function adaptValidatorsetToBytes20(
        bytes32[] memory validatorSet
    ) internal pure returns (bytes20[] memory) {
        bytes20[] memory validatorSetBytes20 = new bytes20[](validatorSet.length);
        for (uint32 i = 0; i < validatorSet.length; i++) {
            // Convert bytes32 to address (which is 20 bytes) by taking the rightmost 20 bytes
            validatorSetBytes20[i] = bytes20(uint160(uint256(validatorSet[i])));
        }
        return validatorSetBytes20;
    }

    /**
     * @notice Encodes a new validator set message into a bytes array.
     * @param message The new validator set message to encode.
     * @return The encoded message.
     */
    function scaleEncodeNewValidatorSetMessage(
        NewValidatorSet memory message
    ) public pure returns (bytes memory) {
        return scaleEncodeNewValidatorSetMessagePayload(message.payload);
    }

    /**
     * @notice Encodes a new validator set message payload into a bytes array.
     * @param payload The new validator set message payload to encode.
     * @return The encoded payload.
     */
    function scaleEncodeNewValidatorSetMessagePayload(
        NewValidatorSetPayload memory payload
    ) public pure returns (bytes memory) {
        uint32 validatorsLen = uint32(payload.validators.length);
        bytes32[] memory validatorSet = payload.validators;

        // Convert the bytes32[] to bytes20[] - keep the most significant 20 bytes
        bytes20[] memory validatorSetBytes20 = adaptValidatorsetToBytes20(validatorSet);

        uint64 externalIndex = uint64(0);

        // Flatten the validator set into a single bytes array
        bytes memory validatorsFlattened;
        for (uint32 i = 0; i < validatorSetBytes20.length; i++) {
            validatorsFlattened =
                bytes.concat(validatorsFlattened, abi.encodePacked(validatorSetBytes20[i]));
        }

        return bytes.concat(
            EL_MESSAGE_ID,
            bytes1(uint8(Message.V0)),
            bytes1(uint8(OutboundCommandV1.ReceiveValidators)),
            ScaleCodec.encodeCompactU32(validatorsLen),
            validatorsFlattened,
            ScaleCodec.encodeU64(externalIndex)
        );
    }
}
