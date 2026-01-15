// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {SignUpOperatorBase} from "./SignUpOperatorBase.s.sol";

/**
 * @title SignUpValidator
 * @notice Script to sign up a validator for the DataHaven network
 */
contract SignUpValidator is SignUpOperatorBase {
    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorSetId() internal view override returns (uint32) {
        return serviceManager.VALIDATORS_SET_ID();
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _addToAllowlist() internal override {
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.addValidatorToAllowlist(_operator);
    }

    /**
     * @inheritdoc SignUpOperatorBase
     */
    function _getOperatorTypeName() internal pure override returns (string memory) {
        return "VALIDATOR";
    }
}
