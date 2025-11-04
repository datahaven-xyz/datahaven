// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

/// @notice Smart contract to help test state override
contract StateOverrideTest {
    /// @notice The maxmium allowed value
    uint256 public MAX_ALLOWED = 3;
    uint256 public availableFunds;
    mapping(address => mapping(address => uint256)) public allowance;

    address owner;

    constructor(uint256 intialAmount) payable {
        owner = msg.sender;
        availableFunds = intialAmount;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getSenderBalance() external view returns (uint256) {
        return address(msg.sender).balance;
    }

    function getAllowance(address from, address who)
        external
        view
        returns (uint256)
    {
        return allowance[from][who];
    }

    function setAllowance(address who, uint256 amount) external {
        allowance[address(msg.sender)][who] = amount;
    }
}
