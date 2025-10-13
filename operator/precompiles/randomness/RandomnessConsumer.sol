// Inspired by: https://raw.githubusercontent.com/smartcontractkit/chainlink/8e8a996fd882c0861bdc9824c1ca27c857c87d03/contracts/src/v0.8/VRFConsumerBaseV2.sol
// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.3;

/// @dev The Randomness contract's address.
address constant RANDOMNESS_ADDRESS = 0x0000000000000000000000000000000000000809;

/** ****************************************************************************
 * @notice Interface for contracts using VRF randomness
 * *****************************************************************************
 * @dev PURPOSE
 *
 * @dev The purpose of this contract is to make it easy for contracts to talk to
 * @dev the Randomness Precompile. It ensures 2 things:
 * @dev 1. The fulfillment came from the Randomness Precompile
 * @dev 2. The consumer contract implements fulfillRandomWords.
 * *****************************************************************************
 * @dev USAGE
 *
 * @dev Calling contracts must inherit from RandomnessConsumer
 *
 * @dev Call one of the randomness request functions:
 * @dev 1. requestLocalVRFRandomWords(refundAddress, fee, gasLimit, salt
 * @dev numWords, delay),
 * @dev 2. requestRelayBabeEpochRandomWords(refundAddress, fee, gasLimit, salt
 * @dev numWords),
 * @dev see (Randomness.sol for a description of each function and their arguments).
 *
 * @dev Once the request has been registered and the minimum delay is passed, the
 * @dev request then can be executed (for 0 fee) by anyone. it will call your
 * @dev contract's fulfillRandomWords method.
 *
 * @dev The randomness argument to fulfillRandomWords is a set of random words
 * @dev generated from your requestId.
 *
 * @dev If your contract could have concurrent requests open, you can use the
 * @dev requestId returned from requestRandomWords to track which response is associated
 * @dev with which randomness request.
 * @dev See "SECURITY CONSIDERATIONS" for principles to keep in mind,
 * @dev if your contract could have multiple requests in flight simultaneously.
 *
 * @dev Colliding `requestId`s are cryptographically impossible as long as seeds
 * @dev differ.
 *
 * *****************************************************************************
 * @dev SECURITY CONSIDERATIONS
 *
 * @dev A method with the ability to call your fulfillRandomness method directly
 * @dev could spoof a VRF response with any random value, so it's critical that
 * @dev it cannot be directly called by anything other than this base contract
 * @dev (specifically, by the RandomnessConsumer.rawFulfillRandomness method).
 *
 * @dev For your users to trust that your contract's random behavior is free
 * @dev from malicious interference, it's best if you can write it so that all
 * @dev behaviors implied by a VRF response are executed *during* your
 * @dev fulfillRandomness method. If your contract must store the response (or
 * @dev anything derived from it) and use it later, you must ensure that any
 * @dev user-significant behavior which depends on that stored value cannot be
 * @dev manipulated by a subsequent VRF request.
 *
 * @dev Similarly, the collators have some influence over the order in which
 * @dev VRF responses appear on the blockchain, so if your contract could have
 * @dev multiple VRF requests in flight simultaneously, you must ensure that
 * @dev the order in which the VRF responses arrive cannot be used to manipulate
 * @dev your contract's user-significant behavior.
 *
 * @dev Since the output of the random words generated for
 * @dev *requestLocalVRFRandomWords* is dependant of the collator producing the
 * @dev block at fulfillment, the collator could skip its block forcing the
 * @dev fulfillment to be executed by a different collator, and therefore
 * @dev generating a different VRF.
 * @dev However, such an attack would incur the cost of losing the block reward to
 * @dev the collator.
 * @dev It is also possible for a collator to be able to predict some of the
 * @dev possible outcome of the VRF if the delay between the request and the
 * @dev fulfillment is too short. It is for this reason that we allow to provide
 * @dev a higher delay
 *
 * @dev Since the output of the random words generated for
 * @dev *requestRelayBabeEpochRandomWords* is dependant of the relaychain
 * @dev validator producing the blocks during an epoch, it is possible for
 * @dev the last validator of an epoch to choose between 2 possible VRF
 * @dev outputs by skipping the production of a block.
 * @dev However, such an attack would incur the cost of losing the block reward to
 * @dev the validator
 * @dev It is not possible for a parachain collator to predict nor influence
 * @dev the output of the relaychain VRF, not to censor the fulfillment as long as
 * @dev there is one honest collator.
 */
abstract contract RandomnessConsumer {
    error OnlyRandomnessPrecompileCanFulfill(address have, address want);

    /**
     * @notice fulfillRandomness handles the VRF response. Your contract must
     * @notice implement it. See "SECURITY CONSIDERATIONS" above for important
     * @notice principles to keep in mind when implementing your fulfillRandomness
     * @notice method.
     *
     * @dev RandomnessConsumer expects its subcontracts to have a method with this
     * @dev signature, and will call it once it has verified the proof
     * @dev associated with the randomness. (It is triggered via a call to
     * @dev rawFulfillRandomness, below.)
     *
     * @param requestId The Id initially returned by requestLocalVRFRandomWords or requestRelayBabeEpochRandomWords
     * @param randomWords The VRF output expanded to the requested number of words
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        virtual;

    // rawFulfillRandomness is called by Randomness Precompile when the executeFulfillement
    // is called. rawFulfillRandomness then calls fulfillRandomness, after validating
    // the origin of the call
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external {
        if (msg.sender != RANDOMNESS_ADDRESS) {
            revert OnlyRandomnessPrecompileCanFulfill(
                msg.sender,
                RANDOMNESS_ADDRESS
            );
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
