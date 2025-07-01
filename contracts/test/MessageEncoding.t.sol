// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {DataHavenSnowbridgeMessages} from "../src/libraries/DataHavenSnowbridgeMessages.sol";

// This test is used to encode the receive validators message and print the hex string.
// Run forge test --match-test testEncodeReceiveValidatorsMessage -vvv to see the hex encoded bytes.
// Use the helper script in operator/test/scripts/test_message_encoding.sh to test the encoding/decoding full cycle.
contract MessageEncodingTest is Test {
    function testEncodeReceiveValidatorsMessage() public pure {
        bytes32[] memory mockValidators = new bytes32[](2);
        mockValidators[0] = bytes32(uint256(1));
        mockValidators[1] = bytes32(uint256(2));

        DataHavenSnowbridgeMessages.NewValidatorSetPayload memory payload =
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: mockValidators});

        DataHavenSnowbridgeMessages.NewValidatorSet memory newValidatorSetMessage =
            DataHavenSnowbridgeMessages.NewValidatorSet({payload: payload});

        bytes memory encodedMessage =
            DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessage(newValidatorSetMessage);

        console.logBytes(encodedMessage);
    }
}
