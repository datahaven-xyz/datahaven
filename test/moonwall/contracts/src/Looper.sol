// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract Looper {
    uint256 public count;

    function infinite() public pure {
        while (true) {}
    }

    function incrementalLoop(uint256 n) public {
        uint256 i = 0;
        while (i < n) {
            count = count + 1;
            i += 1;
        }
    }
}
