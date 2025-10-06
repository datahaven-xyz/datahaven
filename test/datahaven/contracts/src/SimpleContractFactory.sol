// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

contract SimpleContract {
    address public owner;

    constructor() {
        owner = msg.sender;
    }
}

contract SimpleContractFactory {
    SimpleContract[] public deployedWithCreate;
    SimpleContract[] public deployedWithCreate2;

    constructor() {
        createSimpleContractWithCreate();
        createSimpleContractWithCreate2(0);
    }

    function createSimpleContractWithCreate() public {
        SimpleContract newContract = new SimpleContract();
        deployedWithCreate.push(newContract);
    }

    function createSimpleContractWithCreate2(uint salt) public returns (address) {
        bytes memory bytecode = type(SimpleContract).creationCode;

        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) { revert(0, 0) }
        }

        deployedWithCreate2.push(SimpleContract(addr));

        return addr;
    }

    function getDeployedWithCreate() public view returns (SimpleContract[] memory) {
        return deployedWithCreate;
    }

    function getDeployedWithCreate2() public view returns (SimpleContract[] memory) {
        return deployedWithCreate2;
    }
}

