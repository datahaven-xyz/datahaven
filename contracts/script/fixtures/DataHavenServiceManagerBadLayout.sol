// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {OwnableUpgradeable} from "@openzeppelin-upgrades/contracts/access/OwnableUpgradeable.sol";

import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";

/// @notice Test-only fixture contract with intentionally broken storage layout.
/// @dev This contract is used to validate the snapshot-diff storage layout check fails as expected.
contract DataHavenServiceManagerBadLayout is OwnableUpgradeable {
    // Deliberate layout shift: inserted before all original state vars
    uint256 public layoutBreaker;

    // Original variables (shifted by one slot)
    address public rewardsInitiator;
    mapping(address => bool) public validatorsAllowlist;
    IGatewayV2 private _snowbridgeGateway;
    mapping(address => address) public validatorEthAddressToSolochainAddress;

    // Keep the original gap size to mirror shape, despite the shift
    uint256[46] private __GAP;

    // Keep a compatible constructor signature for upgrade tests.
    constructor(address, address) {
        _disableInitializers();
    }
}

