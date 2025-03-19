// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin-upgrades/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgrades/contracts/access/OwnableUpgradeable.sol";

import "../interfaces/IBeefyMessageVerifier.sol";

contract ServiceMessageDispatcher is IBeefyMessageVerifier, Initializable, OwnableUpgradeable {
    bytes32 public constant VALIDATOR_POINTS_MESSAGE_ID = keccak256("VALIDATOR_POINTS");
    bytes32 public constant SLASH_MESSAGE_ID = keccak256("SLASH");

    /// @notice A mapping of message IDs to external verifiers.
    /// @dev The external verifier is a contract that implements the `IBeefyMessageVerifier` interface.
    /// @dev This provides a way to delegate the verification of unknown message IDs to an external contract,
    ///      thus extending the functionality of this contract without the need to modify the contract.
    mapping(bytes32 => address) public messageIdToExternalVerifier;

    function initialize() public initializer {
        __Ownable_init();
    }

    function verifyValidatorPointsMessage(
        bytes calldata, // message,
        bytes calldata, // messageProof,
        SubstrateBinaryMerkleProof calldata, // messageCommitmentProof,
        BeefyMMRLeafPartial calldata, // partialBeefyLeaf,
        BeefyMMRProof calldata // beefyLeafProof
    ) public view returns (bool) {
        // TODO: Implement the logic to verify the validator points message
        return true;
    }

    function verifySlashMessage(
        bytes calldata, // message,
        bytes calldata, // messageProof,
        SubstrateBinaryMerkleProof calldata, // messageCommitmentProof,
        BeefyMMRLeafPartial calldata, // partialBeefyLeaf,
        BeefyMMRProof calldata // beefyLeafProof
    ) public view returns (bool) {
        // TODO: Implement the logic to verify the slash message
        return true;
    }

    function verifyBeefyMessage(
        bytes calldata message,
        bytes calldata messageProof,
        bytes32 messageId,
        SubstrateBinaryMerkleProof calldata messageCommitmentProof,
        BeefyMMRLeafPartial calldata partialBeefyLeaf,
        BeefyMMRProof calldata beefyLeafProof
    ) external view override returns (bool) {
        // For known message IDs, we can verify it here.
        if (messageId == VALIDATOR_POINTS_MESSAGE_ID) {
            return verifyValidatorPointsMessage(
                message, messageProof, messageCommitmentProof, partialBeefyLeaf, beefyLeafProof
            );
        } else if (messageId == SLASH_MESSAGE_ID) {
            return verifySlashMessage(
                message, messageProof, messageCommitmentProof, partialBeefyLeaf, beefyLeafProof
            );
        } else if (messageIdToExternalVerifier[messageId] != address(0)) {
            // For unknown message IDs, we delegate the verification to an external verifier, if there is one registered.
            return IBeefyMessageVerifier(messageIdToExternalVerifier[messageId]).verifyBeefyMessage(
                message,
                messageProof,
                messageId,
                messageCommitmentProof,
                partialBeefyLeaf,
                beefyLeafProof
            );
        }
        // Unknown message IDs are not supported.
        return false;
    }
}
