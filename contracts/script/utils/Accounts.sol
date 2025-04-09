// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";

contract Accounts is Script {

    uint256 internal _deployerPrivateKey = vm.envOr(
        "DEPLOYER_PRIVATE_KEY",
        uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // First pre-funded account from Anvil
    );
    address internal _deployer = vm.addr(_deployerPrivateKey);

    uint256 internal _operatorPrivateKey = vm.envOr(
        "OPERATOR_PRIVATE_KEY",
        uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d) // Second pre-funded account from Anvil
    );
    address internal _operator = vm.addr(_operatorPrivateKey);

    uint256 internal _avsOwnerPrivateKey = vm.envOr(
        "AVS_OWNER_PRIVATE_KEY",
        uint256(0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e) // Sixth pre-funded account from Anvil
    );
    address internal _avsOwner = vm.addr(_avsOwnerPrivateKey);
}