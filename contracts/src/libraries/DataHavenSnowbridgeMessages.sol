// SPDX-License-Identifier: GPL-3.0
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
        address[] validators;
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
        address[] memory validatorSet = payload.validators;

        uint64 externalIndex = uint64(0);

        // Flatten the validator set into a single bytes array
        bytes memory validatorsFlattened;
        for (uint32 i = 0; i < validatorSet.length; i++) {
            validatorsFlattened =
                bytes.concat(validatorsFlattened, abi.encodePacked(validatorSet[i]));
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
