// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract CallForwarder {
    function call(
        address target,
        bytes memory data
    ) public returns (bool, bytes memory) {
        return target.call(data);
    }

    function callRange(address first, address last) public {
        require(first < last, "invalid range");
        while (first < last) {
            first.call("");
            first = address(uint160(first) + 1);
        }
    }

    function delegateCall(
        address target,
        bytes memory data
    ) public returns (bool, bytes memory) {
        return target.delegatecall(data);
    }
}
