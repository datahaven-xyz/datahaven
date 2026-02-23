// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

contract StorageLoop {
    mapping(uint256 => uint256) public map;
    mapping(uint256 => uint256) public map2;

    function store(uint16 n) public {
        for (uint16 i = 0; i < n; i++) {
            map[i] = i + 1;
        }
    }

    function store2(uint256 i) public {
        map2[i] = i;
    }
}
