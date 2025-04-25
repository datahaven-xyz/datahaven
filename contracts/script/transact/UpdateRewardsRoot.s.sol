// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";
import {RewardsRegistryStorage} from "../../src/middleware/RewardsRegistryStorage.sol";
import {IDataHavenServiceManager} from "../../src/interfaces/IDataHavenServiceManager.sol";

/**
 * @title UpdateRewardsRoot
 * @notice Script to update the rewards merkle root in the RewardsRegistry contract
 * @dev This script uses the AVS owner to temporarily set a new rewards agent,
 *      updates the merkle root, and then restores the original agent
 */
contract UpdateRewardsRoot is Script, DHScriptStorage {
    uint256 public avsOwnerPrivateKey;
    address public avsOwner;
    uint256 public tempAgentPrivateKey;
    address public tempAgent;
    uint32 public operatorSetId;
    bytes32 public newMerkleRoot;
    address public originalRewardsAgent;

    function setUp() public {
        // Get the AVS owner private key from env
        avsOwnerPrivateKey = vm.envOr(
            "AVS_OWNER_PRIVATE_KEY",
            uint256(0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e) // Sixth pre-funded account from Anvil
        );
        avsOwner = vm.addr(avsOwnerPrivateKey);

        // Get the temporary rewards agent private key from env
        tempAgentPrivateKey = vm.envOr(
            "TEMP_REWARDS_AGENT_PRIVATE_KEY",
            uint256(0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6) // Third pre-funded account from Anvil
        );
        tempAgent = vm.addr(tempAgentPrivateKey);

        // Get the operator set ID from env (0 for VALIDATORS_SET_ID)
        operatorSetId = uint32(vm.envOr("OPERATOR_SET_ID", uint256(0)));

        // Get the new merkle root from env or use a default value
        newMerkleRoot = bytes32(
            vm.envOr(
                "NEW_MERKLE_ROOT",
                uint256(0x0000000000000000000000000000000000000000000000000000000000000001)
            )
        );
    }

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));

        Logging.logHeader("UPDATE REWARDS MERKLE ROOT");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  AVS Owner: %s", vm.toString(avsOwner));
        console.log("|  Temporary Agent: %s", vm.toString(tempAgent));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  New Merkle Root: %s", vm.toString(newMerkleRoot));
        Logging.logFooter();

        // Load DataHaven contracts
        _loadDHContracts(network);
        Logging.logInfo(string.concat("Loaded DataHaven contracts for network: ", network));

        // Get the rewards registry for the specified operator set
        address rewardsRegistry =
            address(serviceManager.operatorSetToRewardsRegistry(operatorSetId));
        require(rewardsRegistry != address(0), "Rewards registry not set for operator set");
        console.log("Rewards Registry address: %s", rewardsRegistry);

        // Get the original rewards agent
        originalRewardsAgent = RewardsRegistryStorage(rewardsRegistry).rewardsAgent();
        console.log("Original Rewards Agent: %s", vm.toString(originalRewardsAgent));

        // Step 1: Use the AVS owner to set the temporary rewards agent
        vm.broadcast(avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(operatorSetId, tempAgent);
        console.log("Set temporary rewards agent to: %s", vm.toString(tempAgent));

        // Step 2: Use the temporary agent to update the rewards merkle root
        vm.broadcast(tempAgentPrivateKey);
        IRewardsRegistry(rewardsRegistry).updateRewardsMerkleRoot(newMerkleRoot);
        console.log("Updated merkle root to: %s", vm.toString(newMerkleRoot));

        // Step 3: Restore the original rewards agent
        vm.broadcast(avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(operatorSetId, originalRewardsAgent);
        console.log("Restored original rewards agent: %s", vm.toString(originalRewardsAgent));

        Logging.logInfo("Successfully updated rewards merkle root");
    }
}
