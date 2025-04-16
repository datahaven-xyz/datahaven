// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {SignUpOperatorBase} from "./SignUpOperatorBase.s.sol";
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

/**
 * @title SignUpMsp
 * @notice Script to sign up a main storage provider (MSP) for the DataHaven network
 */
contract SignUpMsp is SignUpOperatorBase {
    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorSetId() internal view override returns (uint32) {
        return serviceManager.MSPS_SET_ID();
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _addToAllowlist() internal override {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.addMspToAllowlist(_operator);
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorTypeName() internal pure override returns (string memory) {
        return "MSP";
    }
}
