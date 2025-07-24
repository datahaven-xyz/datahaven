// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {MerkleUtils} from "../../src/libraries/MerkleUtils.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";

library ValidatorsUtils {

    function _buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array using the shared library
        bytes32 merkleRoot = MerkleUtils.calculateMerkleRootUnsorted(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

}