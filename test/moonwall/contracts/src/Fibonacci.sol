// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract Fibonacci {
    function fib2(uint256 n) public pure returns (uint256 b) {
        if (n == 0) {
            return 0;
        }
        uint256 a = 1;
        b = 1;
        for (uint256 i = 2; i < n; i++) {
            uint256 c = a + b;
            a = b;
            b = c;
        }
        return b;
    }
}
