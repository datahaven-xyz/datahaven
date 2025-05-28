// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {DataHavenSnowbridgeMessages} from "../src/libraries/DataHavenSnowbridgeMessages.sol";

// This test is used to encode the receive validators message and log the hex string.
// The hex string is then used to generate the .bin file for the Rust test. 
// To generate the .bin file, run:
// forge test --match-test testEncodeReceiveValidatorsMessageAndLog -vvvvv --fork-url https://rpc.ankr.com/eth_sepolia
// Then, copy the hex string and paste it into the Rust test file. 
// Then, run:
// cargo test --test decode_receive_validators_message_from_file_correctly
// The test should pass.
contract MessageEncodingTest is Test {
    function testEncodeReceiveValidatorsMessageAndLog() public {
        // Mock Data -
        uint64 mockNonce = 12345;
        bytes32 mockTopic = 0x123456789012345678901234567890123456789012345678901234567890abcd;

        bytes32[] memory mockValidators = new bytes32[](2);
        mockValidators[0] = 0x0000000000000000000000000000000000000000000000000000000000000001;
        mockValidators[1] = 0x0000000000000000000000000000000000000000000000000000000000000002;
        // uint64 mockEpoch = 0; // This is hardcoded to 0 in the Solidity function's payload part

        DataHavenSnowbridgeMessages.NewValidatorSetPayload memory newValidatorSetPayload =
            DataHavenSnowbridgeMessages.NewValidatorSetPayload({validators: mockValidators});
        // epoch is implicitly 0 in scaleEncodeNewValidatorSetMessagePayload

        DataHavenSnowbridgeMessages.NewValidatorSet memory newValidatorSetMessage =
        DataHavenSnowbridgeMessages.NewValidatorSet({
            nonce: mockNonce,
            topic: mockTopic,
            payload: newValidatorSetPayload
        });

        bytes memory encodedMessage =
            DataHavenSnowbridgeMessages.scaleEncodeNewValidatorSetMessage(newValidatorSetMessage);

        console.log("Encoded NewValidatorSet message (hex):");
        console.logBytes(encodedMessage); // This will print the hex string
    }
}
