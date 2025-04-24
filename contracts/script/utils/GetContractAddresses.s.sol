// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {SnowbridgeScriptStorage} from "../utils/SnowbridgeScriptStorage.s.sol";

/**
 * @title GetContractAddresses
 * @notice Utility script to get addresses of deployed contracts
 */
contract GetContractAddresses is
    Script,
    DHScriptStorage,
    SnowbridgeScriptStorage
{
    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));

        Logging.logHeader("CONTRACT ADDRESSES");
        console.log("|  Network: %s", network);
        Logging.logFooter();

        // Load DataHaven contracts
        _loadDHContracts(network);

        // Load Snowbridge contracts
        _loadSnowbridgeContracts(network);

        // Print DataHaven contract addresses
        console.log("\n--- DataHaven Contracts ---");
        console.log("ServiceManager     \t%s", address(serviceManager));

        // Print operator set rewards registry addresses
        for (uint32 i = 0; i <= 2; i++) {
            address registry = address(
                serviceManager.operatorSetToRewardsRegistry(i)
            );
            if (registry != address(0)) {
                string memory setType;
                if (i == 0) setType = "VALIDATORS";
                else if (i == 1) setType = "BSPS";
                else if (i == 2) setType = "MSPS";
                console.log(
                    "RewardsRegistry   \t%s\t%s\t%s",
                    setType,
                    i,
                    registry
                );
            }
        }

        // Print Snowbridge contract addresses
        console.log("\n--- Snowbridge Contracts ---");
        console.log("Gateway           \t%s", address(beefyClient));

        // Print agent addresses
        console.log("\n--- Agent Addresses ---");
        // Standard Rewards Agent ID (this is a convention in the system, not necessarily deployed)
        bytes32 rewardsAgentId = 0x0000000000000000000000000000000000000000000000000000000000000002;
        address rewardsAgent = address(beefyClient).staticcall(
            abi.encodeWithSignature("agentOf(bytes32)", rewardsAgentId)
        );
        console.log("RewardsAgent      \t%s\t%s", rewardsAgentId, rewardsAgent);
    }
}
