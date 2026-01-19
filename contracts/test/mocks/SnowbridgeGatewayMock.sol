// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {OperatingMode, InboundMessage} from "snowbridge/src/v2/Types.sol";
import {BeefyVerification} from "snowbridge/src/BeefyVerification.sol";

/// @notice Minimal mock of the Snowbridge Gateway for testing purposes
contract SnowbridgeGatewayMock is IGatewayV2 {
    function operatingMode() external pure returns (OperatingMode) {
        return OperatingMode.Normal;
    }

    function agentOf(bytes32) external pure returns (address) {
        return address(0);
    }

    function v2_submit(
        InboundMessage calldata,
        bytes32[] calldata,
        BeefyVerification.Proof calldata,
        bytes32
    ) external {}

    function v2_sendMessage(
        bytes calldata,
        bytes[] calldata,
        bytes calldata,
        uint128,
        uint128
    ) external payable {}

    function v2_registerToken(address, uint8, uint128, uint128) external payable {}

    function v2_createAgent(bytes32) external {}

    function v2_outboundNonce() external pure returns (uint64) {
        return 0;
    }

    function v2_isDispatched(uint64) external pure returns (bool) {
        return false;
    }

    function isTokenRegistered(address) external pure returns (bool) {
        return false;
    }
}
