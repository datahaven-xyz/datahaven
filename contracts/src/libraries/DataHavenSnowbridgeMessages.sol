// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Snowbridge imports
import {ScaleCodec} from "snowbridge/src/utils/ScaleCodec.sol";

library DataHavenSnowbridgeMessages {
    /**
     * @title New Validator Set Snowbridge Message
     * @notice A struct representing a new validator set to be sent as a message through Snowbridge.
     *         This mimics the message format defined in the Snowbridge inbound pallet of the DataHaven
     *         solochain.
     * !IMPORTANT: The fields in this struct are placeholder until we have the actual message format
     * !           defined in the DataHaven solochain.
     */
    struct NewValidatorSet {
        /// @notice The nonce of the message
        uint64 nonce;
        /// @notice The topic of the message
        bytes32 topic;
        /// @notice The payload of the message
        NewValidatorSetPayload payload;
    }

    /**
     * @title New Validator Set Snowbridge Message Payload
     * @notice A struct representing the payload of a new validator set message.
     * !IMPORTANT: The fields in this struct are placeholder until we have the actual message format
     * !           defined in the DataHaven solochain.
     */
    struct NewValidatorSetPayload {
        /// @notice The new validator set. This should be interpreted as the list of
        ///         validator addresses in the DataHaven network.
        bytes32[] newValidatorSet;
    }

    /**
     * @notice Encodes a new validator set message into a bytes array.
     * @param message The new validator set message to encode.
     * @return The encoded message.
     */
    function scaleEncodeNewValidatorSetMessage(
        NewValidatorSet memory message
    ) public pure returns (bytes memory) {
        return bytes.concat(
            ScaleCodec.encodeU64(message.nonce),
            message.topic,
            scaleEncodeNewValidatorSetMessagePayload(message.payload)
        );
    }

    /**
     * @notice Encodes a new validator set message payload into a bytes array.
     * @param payload The new validator set message payload to encode.
     * @return The encoded payload.
     */
    function scaleEncodeNewValidatorSetMessagePayload(
        NewValidatorSetPayload memory payload
    ) public pure returns (bytes memory) {
        // Encode all fields into a buffer.
        bytes memory accum = hex"";
        for (uint256 i = 0; i < payload.newValidatorSet.length; i++) {
            accum = bytes.concat(accum, payload.newValidatorSet[i]);
        }
        // Encode number of validator addresses, followed by encoded validator addresses.
        return
            bytes.concat(ScaleCodec.checkedEncodeCompactU32(payload.newValidatorSet.length), accum);
    }
}
