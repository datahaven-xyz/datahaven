// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";

/**
 * @title UpdateRewardsRoot
 * @notice Script to update the rewards merkle root in the RewardsRegistry contract
 * @dev This script is used to mock the behavior of the substrate solochain sending a message
 *      to update the rewards merkle root in the RewardsRegistry contract
 */
contract UpdateRewardsRoot is Script, DHScriptStorage {
    uint256 public agentPrivateKey;
    address public agent;
    uint32 public operatorSetId;
    bytes32 public newMerkleRoot;

    function setUp() public {
        // Get the rewards agent private key from env
        agentPrivateKey = vm.envOr(
            "REWARDS_AGENT_PRIVATE_KEY",
            uint256(
                0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
            ) // Third pre-funded account from Anvil
        );
        agent = vm.addr(agentPrivateKey);

        // Get the operator set ID from env (0 for VALIDATORS_SET_ID)
        operatorSetId = uint32(vm.envOr("OPERATOR_SET_ID", uint256(0)));

        // Get the new merkle root from env or use a default value
        newMerkleRoot = bytes32(
            vm.envOr(
                "NEW_MERKLE_ROOT",
                uint256(
                    0x0000000000000000000000000000000000000000000000000000000000000001
                )
            )
        );
    }

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));

        Logging.logHeader("UPDATE REWARDS MERKLE ROOT");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  Agent Address: %s", vm.toString(agent));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  New Merkle Root: %s", vm.toString(newMerkleRoot));
        Logging.logFooter();

        // Load DataHaven contracts
        _loadDHContracts(network);
        Logging.logInfo(
            string.concat("Loaded DataHaven contracts for network: ", network)
        );

        // Get the rewards registry for the specified operator set
        address rewardsRegistry = address(
            serviceManager.operatorSetToRewardsRegistry(operatorSetId)
        );
        require(
            rewardsRegistry != address(0),
            "Rewards registry not set for operator set"
        );
        console.log("Rewards Registry address: %s", rewardsRegistry);

        // Update the rewards merkle root
        vm.broadcast(agentPrivateKey);
        IRewardsRegistry(rewardsRegistry).updateRewardsMerkleRoot(
            newMerkleRoot
        );

        Logging.logSuccess("Successfully updated rewards merkle root");
    }
}
