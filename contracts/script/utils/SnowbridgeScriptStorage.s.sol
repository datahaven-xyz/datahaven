// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";

// Snowbridge imports
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";

/**
 * @title SnowbridgeScriptStorage
 * @notice This contract is a utility for scripts that need to interact with Snowbridge contracts.
 */
contract SnowbridgeScriptStorage is Script {
    // Snowbridge Contract declarations
    BeefyClient public beefyClient;
    AgentExecutor public agentExecutor;
    IGatewayV2 public gateway;
    Agent public rewardsAgent;
    bytes32 public rewardsAgentId;
    /**
     * @notice Loads the Snowbridge contracts from the deployment file.
     */

    function _loadSnowbridgeContracts(
        string memory network
    ) internal {
        // Load the deployment file
        string memory deploymentFile =
            vm.readFile(string.concat("./deployments/", network, ".json"));

        // Store the contract addresses
        beefyClient = BeefyClient(vm.parseJsonAddress(deploymentFile, ".BeefyClient"));
        agentExecutor = AgentExecutor(vm.parseJsonAddress(deploymentFile, ".AgentExecutor"));
        gateway = IGatewayV2(vm.parseJsonAddress(deploymentFile, ".Gateway"));
        rewardsAgent = Agent(payable(vm.parseJsonAddress(deploymentFile, ".RewardsAgent")));
        rewardsAgentId = vm.parseJsonBytes32(deploymentFile, ".RewardsAgentId");
    }
}
