// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {IDataHavenServiceManager} from "../../src/interfaces/IDataHavenServiceManager.sol";

/**
 * @title ClaimValidatorRewards
 * @notice Script to claim rewards for a validator through the DataHavenServiceManager
 */
contract ClaimValidatorRewards is Script, DHScriptStorage {
    uint256 public validatorPrivateKey;
    address public validator;
    uint32 public operatorSetId;
    uint256 public validatorPoints;
    bytes32[] public proof;

    function setUp() public {
        // Get the validator private key from env
        validatorPrivateKey = vm.envOr(
            "VALIDATOR_PRIVATE_KEY",
            uint256(
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
            ) // First Anvil account
        );
        validator = vm.addr(validatorPrivateKey);

        // Get the operator set ID (0 for VALIDATORS_SET_ID)
        operatorSetId = uint32(vm.envOr("OPERATOR_SET_ID", uint256(0)));

        // Get validator points
        validatorPoints = vm.envOr(
            "VALIDATOR_POINTS",
            uint256(100000000000000000000)
        ); // Default 100 ETH worth of points

        // Get merkle proof from env
        string memory proofStr = vm.envOr("PROOF", string("[]"));
        proof = vm.parseJsonBytes32Array(proofStr);
    }

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));

        Logging.logHeader("CLAIM VALIDATOR REWARDS");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  Validator Address: %s", vm.toString(validator));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  Validator Points: %s", vm.toString(validatorPoints));
        console.log("|  Proof Length: %s", vm.toString(proof.length));
        Logging.logFooter();

        // Load DataHaven contracts
        _loadDHContracts(network);
        Logging.logInfo(
            string.concat("Loaded DataHaven contracts for network: ", network)
        );

        // Get the validator's ETH balance before claiming
        uint256 balanceBefore = validator.balance;
        console.log(
            "Validator balance before: %s ETH",
            vm.toString(balanceBefore / 1e18)
        );

        // Call claimOperatorRewards on the DataHaven Service Manager
        vm.broadcast(validatorPrivateKey);
        serviceManager.claimOperatorRewards(
            operatorSetId,
            validatorPoints,
            proof
        );

        // Get the validator's ETH balance after claiming
        uint256 balanceAfter = validator.balance;
        console.log(
            "Validator balance after: %s ETH",
            vm.toString(balanceAfter / 1e18)
        );
        console.log(
            "Reward received: %s ETH",
            vm.toString((balanceAfter - balanceBefore) / 1e18)
        );

        Logging.logSuccess("Successfully claimed validator rewards");
    }
}
