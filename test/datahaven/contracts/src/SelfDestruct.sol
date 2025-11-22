// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

contract SelfDestructable {
    constructor() {
        selfdestruct(payable(address(0)));
    }
}

contract SelfDestructAfterCreate2 {
    uint constant SALT = 1;

    address public deployed1;
    address public deployed2;

    function step1() public {
        bytes memory bytecode = type(SelfDestructable).creationCode;
        address contractAddress;
        uint contractSize;
        assembly {
            contractAddress := create2(0, add(bytecode, 32), mload(bytecode), SALT)
            contractSize := extcodesize(contractAddress)
        }
        require(contractSize == 0, "Contract size should be zero");
        deployed1 = contractAddress;
    }


    function step2() public {
        bytes memory bytecode = type(SelfDestructable).creationCode;
        address contractAddress;
        uint contractSize;
        assembly {
            contractAddress := create2(0, add(bytecode, 32), mload(bytecode), SALT)
            contractSize := extcodesize(contractAddress)
        }
        require(contractSize == 0, "Contract size should be zero");
        deployed2 = contractAddress;
        require(deployed1 == deployed2, "Addresses not equal");
    }

    function cannotRecreateInTheSameCall() public {
        bytes memory bytecode = type(SelfDestructable).creationCode;
        address contractAddress1;
        address contractAddress2;
        assembly {
            contractAddress1 := create2(0, add(bytecode, 32), mload(bytecode), SALT)
            contractAddress2 := create2(0, add(bytecode, 32), mload(bytecode), SALT)
        }
        require(contractAddress1 != address(0), "First address must not be null");
        require(contractAddress2 == address(0), "Second address must be null");
    }
}