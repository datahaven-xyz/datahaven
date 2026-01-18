// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract BlockVariables {
    uint256 public initialgaslimit;
    uint256 public initialchainid;
    uint256 public initialnumber;

    constructor() {
        initialgaslimit = block.gaslimit;
        initialchainid = block.chainid;
        initialnumber = block.number;
    }

    function getGasLimit() public view returns (uint256) {
        return block.gaslimit;
    }

    function getChainId() public view returns (uint256) {
        return block.chainid;
    }

    function getNumber() public view returns (uint256) {
        return block.number;
    }
}
