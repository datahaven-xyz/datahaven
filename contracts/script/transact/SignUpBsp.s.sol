// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {SignUpOperatorBase} from "./SignUpOperatorBase.s.sol";
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";

/**
 * @title SignUpBsp
 * @notice Script to sign up a backup storage provider (BSP) for the DataHaven network
 */
contract SignUpBsp is SignUpOperatorBase {
    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorSetId() internal view override returns (uint32) {
        return serviceManager.BSPS_SET_ID();
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _addToAllowlist() internal override {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.addBspToAllowlist(_operator);
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorTypeName() internal pure override returns (string memory) {
        return "BSP";
    }
}
