// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {SnowbridgeScriptStorage} from "../utils/SnowbridgeScriptStorage.s.sol";
import {IRewardsRegistry} from "../../src/interfaces/IRewardsRegistry.sol";
import {IDataHavenServiceManager} from "../../src/interfaces/IDataHavenServiceManager.sol";
import {Gateway} from "../../lib/snowbridge/contracts/src/Gateway.sol";

/**
 * @title MockGatewayMessage
 * @notice Script to mock a message from the substrate solochain through the Gateway
 * @dev This script directly calls v2_handleCallContract on the Gateway contract to bypass
 *      the normal BEEFY validation flow, simulating a message from substrate
 */
contract MockGatewayMessage is
    Script,
    DHScriptStorage,
    SnowbridgeScriptStorage
{
    uint256 public gatewayPrivateKey;
    address public gateway;
    bytes32 public rewardsAgentId;
    uint32 public operatorSetId;
    bytes32 public newMerkleRoot;

    function setUp() public {
        // Get the gateway private key (to simulate Gateway calling itself)
        gatewayPrivateKey = vm.envOr(
            "GATEWAY_PRIVATE_KEY",
            uint256(
                0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
            ) // Ninth pre-funded account from Anvil
        );
        gateway = vm.addr(gatewayPrivateKey);

        // Get the rewards agent ID
        rewardsAgentId = bytes32(
            vm.envOr(
                "REWARDS_AGENT_ID",
                uint256(
                    0x0000000000000000000000000000000000000000000000000000000000000002
                )
            )
        );

        // Get the operator set ID (0 for VALIDATORS_SET_ID by default)
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

        Logging.logHeader("MOCK GATEWAY MESSAGE FOR REWARDS UPDATE");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  Rewards Agent ID: %s", vm.toString(rewardsAgentId));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  New Merkle Root: %s", vm.toString(newMerkleRoot));
        Logging.logFooter();

        // Load DataHaven and Snowbridge contracts
        _loadDHContracts(network);
        _loadSnowbridgeContracts(network);
        Logging.logInfo(
            string.concat("Loaded contracts for network: ", network)
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

        // Get the rewards agent address
        address rewardsAgent = Gateway(address(beefyClient)).agentOf(
            rewardsAgentId
        );
        require(rewardsAgent != address(0), "Rewards agent does not exist");
        console.log("Rewards Agent address: %s", rewardsAgent);

        // Build calldata for updateRewardsMerkleRoot
        bytes memory callData = abi.encodeWithSelector(
            IRewardsRegistry.updateRewardsMerkleRoot.selector,
            newMerkleRoot
        );

        // Create payload for v2_handleCallContract
        bytes memory payload = abi.encode(
            rewardsRegistry, // target contract
            callData, // call data
            uint128(0) // value (no ETH sent)
        );

        // Set up prank to make it look like the Gateway is calling itself
        // This is necessary because v2_handleCallContract has the onlySelf modifier
        vm.startPrank(address(beefyClient));

        // Mock a direct call to v2_handleCallContract to simulate message from substrate
        Gateway(address(beefyClient)).v2_handleCallContract(
            rewardsAgentId,
            payload
        );

        vm.stopPrank();

        Logging.logSuccess(
            "Successfully mocked Gateway message to update rewards root"
        );
    }
}
