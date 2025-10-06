// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

/// @dev The Batch contract's address.
address constant BATCH_ADDRESS = 0x0000000000000000000000000000000000000808;

/// @dev The Batch contract's instance.
Batch constant BATCH_CONTRACT = Batch(BATCH_ADDRESS);

/// @title Batch precompile
/// @dev Minimal Batch interface for testing
interface Batch {
    function batchAll(
        address[] memory to,
        uint256[] memory value,
        bytes[] memory callData,
        uint64[] memory gasLimit
    ) external;
}

contract BatchCaller {
    function inner(address to, bytes[] memory callData) internal {
        address[] memory toAddress = new address[](1);
        toAddress[0] = to;
        uint256[] memory value = new uint256[](1);
        value[0] = 0;
        uint64[] memory gasLimit = new uint64[](1);
        gasLimit[0] = 0;
        BATCH_CONTRACT.batchAll(toAddress, value, callData, gasLimit);
    }
}

contract CallBatchPrecompileFromConstructor is BatchCaller {
    constructor(address to, bytes[] memory callData) {
        inner(to, callData);
    }
}

contract CallBatchPrecompileFromConstructorInSubCall {
    CallBatchPrecompileFromConstructor public addr;

    function simple(address to, bytes[] memory callData) external {
        addr = new CallBatchPrecompileFromConstructor(to, callData);
    }
}

