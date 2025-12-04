// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

import {
    ISignatureUtilsMixinTypes
} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtilsMixin.sol";

/**
 * @title Minimal interface for a ServiceManager-type contract that AVS ServiceManager contracts must implement
 * for eigenlabs to be able to index their data on the AVS marketplace frontend.
 * @author Layr Labs, Inc.
 */
interface IServiceManagerUI {
    /**
     * @notice Updates the metadata URI for the AVS,
     * @param metadataURI is the metadata URI for the AVS.
     * @dev Metadata should follow the format outlined by this example.
     *     {
     *         "name": "EigenLabs AVS 1",
     *         "website": "https://www.eigenlayer.xyz/",
     *         "description": "This is my 1st AVS",
     *         "logo": "https://holesky-operator-metadata.s3.amazonaws.com/eigenlayer.png",
     *         "twitter": "https://twitter.com/eigenlayer"
     *     }
     */
    function updateAVSMetadataURI(
        string memory metadataURI
    ) external;

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator registration with the AVS.
     * @param operator The address of the operator to register.
     * @param operatorSignature The signature, salt, and expiry of the operator's signature.
     */
    function registerOperatorToAVS(
        address operator,
        ISignatureUtilsMixinTypes.SignatureWithSaltAndExpiry memory operatorSignature
    ) external;

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator deregistration from the AVS.
     * @param operator The address of the operator to deregister.
     */
    function deregisterOperatorFromAVS(
        address operator
    ) external;

    /**
     * @notice Returns the list of strategies that the operator has potentially restaked on the AVS.
     * @param operator The address of the operator to get restaked strategies for.
     * @dev This function is intended to be called off-chain.
     * @dev No guarantee is made on whether the operator has shares for a strategy in a quorum or uniqueness
     *      of each element in the returned array. The off-chain service should do that validation separately.
     */
    function getOperatorRestakedStrategies(
        address operator
    ) external view returns (address[] memory);

    /**
     * @notice Returns the list of strategies that the AVS supports for restaking.
     * @dev This function is intended to be called off-chain.
     * @dev No guarantee is made on uniqueness of each element in the returned array.
     *      The off-chain service should do that validation separately.
     */
    function getRestakeableStrategies() external view returns (address[] memory);
}
