// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReentrancyProtected {
    // A constant key for the reentrancy guard stored in Transient Storage.
    // This acts as a unique identifier for the reentrancy lock.
    bytes32 constant REENTRANCY_GUARD = keccak256("REENTRANCY_GUARD");

    // Modifier to prevent reentrant calls.
    // It checks if the reentrancy guard is set (indicating an ongoing execution)
    // and sets the guard before proceeding with the function execution.
    // After the function executes, it resets the guard to allow future calls.
    modifier nonReentrant() {
        // Ensure the guard is not set (i.e., no ongoing execution).
        require(tload(REENTRANCY_GUARD) == 0, "Reentrant call detected.");

        // Set the guard to block reentrant calls.
        tstore(REENTRANCY_GUARD, 1);

        _; // Execute the function body.

        // Reset the guard after execution to allow future calls.
        tstore(REENTRANCY_GUARD, 0);
    }

    // Uses inline assembly to access the Transient Storage's tstore operation.
    function tstore(bytes32 location, uint value) private {
        assembly {
            tstore(location, value)
        }
    }

    // Uses inline assembly to access the Transient Storage's tload operation.
    // Returns the value stored at the given location.
    function tload(bytes32 location) private returns (uint value) {
        assembly {
            value := tload(location)
        }
    }

    function nonReentrantMethod() public nonReentrant {
        (bool success, bytes memory result) = msg.sender.call("");
        if (!success) {
            assembly {
                revert(add(32, result), mload(result))
            }
        }
    }

    function test() external {
        this.nonReentrantMethod();
    }

    receive() external payable {
        this.nonReentrantMethod();
    }
}
