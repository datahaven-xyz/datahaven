// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract Incrementor {
    uint256 public count;

    constructor() {
        count = 0;
    }

    function incr() public {
        count = count + 1;
    }

    function incr(uint256 num) public returns (uint256) {
        count = count + num;
        return count;
    }
}
