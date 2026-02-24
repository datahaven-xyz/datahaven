// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.3;

contract RecoveryChecker {
    constructor() {}

    function checkRecovery(
        bytes32 msgHash,
        uint256 v,
        bytes32 r,
        bytes32 s
    ) public view returns (address) {
        (, bytes memory data) = address(0x01).staticcall(
            abi.encode(msgHash, v, r, s)
        );
        return abi.decode(data, (address));
    }
}

contract PairingChecker {
    bool public status = false;

    function callBn256Pairing(bytes memory input)
        public
        returns (bytes32 result)
    {
        uint256 len = input.length;
        assembly {
            let memPtr := mload(0x40)
            let success := call(
                gas(),
                0x08,
                0,
                add(input, 0x20),
                len,
                memPtr,
                0x20
            )
            switch success
            case 0 {
                revert(0, 0)
            }
            default {
                result := mload(memPtr)
            }
        }
        status =
            result ==
            0x0000000000000000000000000000000000000000000000000000000000000001;
    }
}
