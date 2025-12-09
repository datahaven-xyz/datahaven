// SPDX-License-Identifier: GPL-3.0
// This is a test contract for the DataHaven project
// It is deployed as pure bytecode in kurtosis
pragma solidity >=0.8.2 <0.9.0;

contract DataHavenTest {
    uint256 public number;
    address public owner;

    constructor() {
        number = 10;
        owner = msg.sender;
    }

    function decrement() external {
        require(number > 0, "Number should be greater than 0");
        number = number - 1;
    }

    function reset() external {
        require(msg.sender == owner, "Only callable by owner!");
        number = 10;
    }

    function increment() external {
        require(msg.sender == owner, "Only callable by owner!");
        number = number + 1;
    }
}
