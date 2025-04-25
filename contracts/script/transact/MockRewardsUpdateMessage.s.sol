// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {SnowbridgeScriptStorage} from "../utils/SnowbridgeScriptStorage.s.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";
import {IDataHavenServiceManager} from "../../src/interfaces/IDataHavenServiceManager.sol";
import {RewardsRegistryStorage} from "../../src/middleware/RewardsRegistryStorage.sol";
import {Gateway} from "../../lib/snowbridge/contracts/src/Gateway.sol";
import {CallContractParams} from "../../lib/snowbridge/contracts/src/v2/Types.sol";

/**
 * @title MockRewardsUpdateMessage
 * @notice Script to mock a rewards update message from the substrate solochain through the Gateway
 * @dev This script directly calls v2_handleCallContract on the Gateway contract to bypass
 *      the normal BEEFY validation flow, simulating a message from substrate
 */
contract MockRewardsUpdateMessage is Script, DHScriptStorage, SnowbridgeScriptStorage {
    uint32 public operatorSetId;
    bytes32 public newMerkleRoot;

    function setUp() public {
        // Get the operator set ID (0 for VALIDATORS_SET_ID by default)
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

        Logging.logHeader("MOCK REWARDS UPDATE MESSAGE");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  Rewards Agent ID: %s", vm.toString(rewardsAgentId));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  New Merkle Root: %s", vm.toString(newMerkleRoot));
        Logging.logFooter();

        // Load DataHaven and Snowbridge contracts
        _loadDHContracts(network);
        _loadSnowbridgeContracts(network);
        Logging.logInfo(string.concat("Loaded contracts for network: ", network));

        // Get the gateway address
        address gateway = address(gateway);
        console.log("Gateway address: %s", vm.toString(gateway));

        // Get the rewards registry for the specified operator set
        address rewardsRegistry =
            address(serviceManager.operatorSetToRewardsRegistry(operatorSetId));
        require(rewardsRegistry != address(0), "Rewards registry not set for operator set");
        console.log("Rewards Registry address: %s", rewardsRegistry);

        // Get the initial merkle root from the rewards registry
        bytes32 initialMerkleRoot = RewardsRegistryStorage(rewardsRegistry).lastRewardsMerkleRoot();
        console.log("Initial Merkle Root: %s", vm.toString(initialMerkleRoot));

        // Build calldata for updateRewardsMerkleRoot
        bytes memory callData =
            abi.encodeWithSelector(IRewardsRegistry.updateRewardsMerkleRoot.selector, newMerkleRoot);
        console.log("Call data: %s", vm.toString(callData));

        // Create payload for v2_handleCallContract
        bytes memory payload = abi.encode(
            CallContractParams({
                target: rewardsRegistry, // target contract
                data: callData, // call data
                value: 0 // value (no ETH sent)
            })
        );
        console.log("Payload: %s", vm.toString(payload));

        // Use vm.prank to simulate call from the Gateway itself
        // This is necessary because v2_handleCallContract has the onlySelf modifier
        vm.prank(gateway);

        // Mock a direct call to v2_handleCallContract to simulate message from substrate
        Gateway(gateway).v2_handleCallContract(rewardsAgentId, payload);

        // Check that the rewards registry has been updated
        bytes32 currentMerkleRoot = RewardsRegistryStorage(rewardsRegistry).lastRewardsMerkleRoot();
        console.log("Current Merkle Root: %s", vm.toString(currentMerkleRoot));
        require(currentMerkleRoot == newMerkleRoot, "Rewards registry not updated");

        Logging.logInfo("Successfully mocked Gateway message to update rewards root");
    }
}
