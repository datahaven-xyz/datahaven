// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/* solhint-disable func-name-mixedcase */

import {IGatewayV2} from "snowbridge/src/Types.sol";
import {Payload, Message, MessageKind, Asset} from "snowbridge/src/v2/Types.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

import {SnowbridgeAndAVSDeployer} from "./utils/SnowbridgeAndAVSDeployer.sol";

contract SnowbridgeIntegrationTest is SnowbridgeAndAVSDeployer {
    address public submitter = address(uint160(uint256(keccak256("submitter"))));

    function setUp() public {
        _deployMockAllContracts();
        // Set up the validator set submitter
        vm.prank(avsOwner);
        serviceManager.setValidatorSetSubmitter(submitter);
    }

    function beforeTestSetup(
        bytes4 testSelector
    ) public pure returns (bytes[] memory beforeTestCalldata) {
        if (testSelector == this.test_sendNewValidatorsSetMessage.selector) {
            beforeTestCalldata = new bytes[](1);
            beforeTestCalldata[0] = abi.encodeWithSelector(this.setupValidatorsAsOperators.selector);
        }
    }

    function test_sendNewValidatorsSetMessage() public {
        // Check that the current validators signed as operators have a registered address for the DataHaven solochain.
        address[] memory currentOperators = allocationManager.getMembers(
            OperatorSet({avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()})
        );
        for (uint256 i = 0; i < currentOperators.length; i++) {
            assertEq(
                serviceManager.validatorEthAddressToSolochainAddress(currentOperators[i]),
                address(uint160(uint256(initialValidatorHashes[i]))),
                "Validator should have a registered address for the DataHaven solochain"
            );
        }

        uint64 targetEra = 42;

        // Mock balance for the submitter
        vm.deal(submitter, 1000000 ether);

        // Send the new validator set message to the Snowbridge Gateway
        bytes memory message = serviceManager.buildNewValidatorSetMessageForEra(targetEra);
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
        cheats.prank(submitter);
        serviceManager.sendNewValidatorSetForEra{value: 2 ether}(targetEra, 1 ether, 1 ether);
    }
}
